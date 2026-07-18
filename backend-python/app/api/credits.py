from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import Identity, current_identity
from app.database import get_session
from app.plans import PLAN_CREDITS
from app.services import credits as credit_service

router = APIRouter(prefix="/credits", tags=["credits"])


class DailyUsageOut(BaseModel):
    plan: str
    pct: int
    next_reset: int
    has_purchased: bool
    unlimited: bool


@router.get("/daily", response_model=DailyUsageOut)
async def daily(
    me: Identity = Depends(current_identity),
    session: AsyncSession = Depends(get_session),
) -> DailyUsageOut:
    """Today's usage as a percentage. Deliberately never returns a balance."""
    view = await credit_service.usage_view(session, me.uid, me.is_admin)
    return DailyUsageOut(
        plan=view.plan_id,
        pct=view.pct,
        next_reset=view.next_reset,
        has_purchased=view.has_purchased,
        unlimited=view.unlimited,
    )


class ChargeIn(BaseModel):
    mode: str = "auto"
    has_attachment: bool = False


@router.post("/charge")
async def charge(
    body: ChargeIn,
    me: Identity = Depends(current_identity),
    session: AsyncSession = Depends(get_session),
) -> dict[str, int | bool]:
    try:
        charged = await credit_service.charge(session, me.uid, body.mode, body.has_attachment, me.is_admin)
    except credit_service.InsufficientCredits:
        raise HTTPException(
            status.HTTP_402_PAYMENT_REQUIRED,
            "You have used all of today's AI credits. They reset tomorrow at 12:00 AM.",
        ) from None
    return {"ok": True, "charged": charged}


class PurchaseIn(BaseModel):
    plan_id: str | None = None
    pack_credits: int | None = None


@router.post("/purchase")
async def purchase(
    body: PurchaseIn,
    me: Identity = Depends(current_identity),
    session: AsyncSession = Depends(get_session),
) -> dict[str, bool]:
    """Applies an entitlement. Call only after the payment gateway has confirmed."""
    if body.plan_id:
        if body.plan_id not in PLAN_CREDITS:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown plan")
        await credit_service.set_plan(session, me.uid, body.plan_id)
    elif body.pack_credits and body.pack_credits > 0:
        await credit_service.add_credits(
            session, me.uid, body.pack_credits, f"Purchased {body.pack_credits} credits", "purchase"
        )
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nothing to purchase")
    return {"ok": True}
