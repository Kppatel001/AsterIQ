"""Verifies the Firebase ID tokens issued by the existing Next.js frontend."""

import time
from dataclasses import dataclass

import httpx
from fastapi import Depends, HTTPException, Request, status
from jose import jwt

from app.config import get_settings

_CERT_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
_certs: dict[str, str] = {}
_certs_fetched_at: float = 0.0


@dataclass
class Identity:
    uid: str
    email: str | None

    @property
    def is_admin(self) -> bool:
        return bool(self.email) and self.email.lower() in get_settings().admin_email_set


async def _google_certs() -> dict[str, str]:
    global _certs, _certs_fetched_at
    if _certs and time.time() - _certs_fetched_at < 3600:
        return _certs
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.get(_CERT_URL)
        res.raise_for_status()
        _certs = res.json()
        _certs_fetched_at = time.time()
    return _certs


async def current_identity(request: Request) -> Identity:
    header = request.headers.get("authorization", "")
    if not header.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")

    token = header[7:]
    project_id = get_settings().firebase_project_id
    if not project_id:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "firebase_project_id not set")

    try:
        kid = jwt.get_unverified_header(token).get("kid", "")
        certs = await _google_certs()
        if kid not in certs:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unknown signing key")
        claims = jwt.decode(
            token,
            certs[kid],
            algorithms=["RS256"],
            audience=project_id,
            issuer=f"https://securetoken.google.com/{project_id}",
        )
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 - any failure means the token is not usable
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token") from exc

    return Identity(uid=str(claims.get("sub", "")), email=claims.get("email"))


CurrentUser = Depends(current_identity)
