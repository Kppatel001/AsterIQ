from celery import Celery
from celery.schedules import crontab

from app.config import get_settings

settings = get_settings()

celery_app = Celery("asteriq", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.timezone = "Asia/Kolkata"

celery_app.conf.beat_schedule = {
    # Midnight IST: close out the day. New rows are created lazily on first use,
    # so this job only needs to prune and report.
    "daily-credit-reset": {
        "task": "app.workers.tasks.daily_credit_reset",
        "schedule": crontab(hour=0, minute=0),
    },
}
