import asyncio

from sqlalchemy import delete
from datetime import timedelta

from app.database import SessionLocal
from app.models import DailyCreditUsage
from app.services.credits import today_ist
from app.workers.celery_app import celery_app


async def _reset() -> int:
    """Remove usage rows older than 90 days. Today's row is created on demand."""
    cutoff = today_ist() - timedelta(days=90)
    async with SessionLocal() as session:
        result = await session.execute(
            delete(DailyCreditUsage).where(DailyCreditUsage.usage_date < cutoff)
        )
        await session.commit()
        return result.rowcount or 0


@celery_app.task(name="app.workers.tasks.daily_credit_reset")
def daily_credit_reset() -> int:
    return asyncio.run(_reset())
