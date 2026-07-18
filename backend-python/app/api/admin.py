from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import Identity, current_identity
from app.database import get_session
from app.models import CreditTransaction, CreditWallet
from app.services import credits as credit_service

router = APIRouter(prefix="/admin", tags=["admin"])


def _require_admin(me: Identity) -> None:
    if not me.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admins only")


@router.get("/dashboard")
async def dashboard(
    me: Identity = Depends(current_identity),
    session: AsyncSession = Depends(get_session),
) -> dict[str, int]:
    _require_admin(me)
    users = (await session.execute(select(func.count()).select_from(CreditWallet))).scalar_one()
    spent = (
        await session.execute(
            select(func.coalesce(func.sum(CreditTransaction.amount), 0)).where(
                CreditTransaction.kind == "debit"
            )
        )
    ).scalar_one()
    return {"wallets": int(users), "credits_spent": abs(int(spent))}


class AdjustIn(BaseModel):
    user_id: str
    credits: int
    reason: str = "Admin adjustment"


@router.post("/add-credits")
async def add_credits(
    body: AdjustIn,
    me: Identity = Depends(current_identity),
    session: AsyncSession = Depends(get_session),
) -> dict[str, bool]:
    _require_admin(me)
    await credit_service.add_credits(session, body.user_id, body.credits, body.reason, "admin")
    return {"ok": True}
