"""Credit engine: daily allowance first, purchased credits second."""

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CreditTransaction, CreditWallet, DailyCreditUsage
from app.plans import cost_for, daily_allowance

IST = timezone(timedelta(hours=5, minutes=30))


def today_ist() -> date:
    return datetime.now(IST).date()


def next_reset_epoch_ms() -> int:
    now = datetime.now(IST)
    midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return int(midnight.timestamp() * 1000)


@dataclass
class UsageView:
    plan_id: str
    pct: int
    next_reset: int
    has_purchased: bool
    unlimited: bool


class InsufficientCredits(Exception):
    """Raised when neither the daily allowance nor purchased credits can cover the cost."""


async def _wallet(session: AsyncSession, uid: str) -> CreditWallet:
    wallet = await session.get(CreditWallet, uid)
    if wallet is None:
        wallet = CreditWallet(user_id=uid, plan_id="free", purchased=0, lifetime_used=0)
        session.add(wallet)
        await session.flush()
    return wallet


async def _today_row(session: AsyncSession, uid: str, plan_id: str) -> DailyCreditUsage:
    stmt = select(DailyCreditUsage).where(
        DailyCreditUsage.user_id == uid, DailyCreditUsage.usage_date == today_ist()
    )
    row = (await session.execute(stmt)).scalar_one_or_none()
    if row is None:
        row = DailyCreditUsage(
            user_id=uid, usage_date=today_ist(), used=0, allowance=daily_allowance(plan_id)
        )
        session.add(row)
        await session.flush()
    return row


async def usage_view(session: AsyncSession, uid: str, is_admin: bool) -> UsageView:
    wallet = await _wallet(session, uid)
    row = await _today_row(session, uid, wallet.plan_id)
    pct = 0 if is_admin or row.allowance <= 0 else min(100, round(row.used / row.allowance * 100))
    return UsageView(
        plan_id=wallet.plan_id,
        pct=pct,
        next_reset=next_reset_epoch_ms(),
        has_purchased=wallet.purchased > 0,
        unlimited=is_admin,
    )


async def charge(
    session: AsyncSession, uid: str, mode: str, has_attachment: bool, is_admin: bool
) -> int:
    """Deduct the cost of one AI action. Returns the number of credits charged."""
    if is_admin:
        return 0

    cost = cost_for(mode, has_attachment)
    wallet = await _wallet(session, uid)
    row = await _today_row(session, uid, wallet.plan_id)

    remaining_daily = max(0, row.allowance - row.used)
    from_daily = min(cost, remaining_daily)
    from_purchased = cost - from_daily

    if from_purchased > wallet.purchased:
        raise InsufficientCredits

    row.used += from_daily
    wallet.purchased -= from_purchased
    wallet.lifetime_used += cost
    session.add(CreditTransaction(user_id=uid, amount=-cost, kind="debit", label=f"{mode} generation"))
    await session.commit()
    return cost


async def add_credits(session: AsyncSession, uid: str, credits: int, label: str, kind: str) -> None:
    wallet = await _wallet(session, uid)
    wallet.purchased += credits
    session.add(CreditTransaction(user_id=uid, amount=credits, kind=kind, label=label))
    await session.commit()


async def set_plan(session: AsyncSession, uid: str, plan_id: str) -> None:
    wallet = await _wallet(session, uid)
    wallet.plan_id = plan_id
    row = await _today_row(session, uid, plan_id)
    row.allowance = daily_allowance(plan_id)
    session.add(
        CreditTransaction(user_id=uid, amount=0, kind="plan", label=f"Activated {plan_id} plan")
    )
    await session.commit()
