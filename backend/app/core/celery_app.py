from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "watchtower_worker",
    broker=settings.REDIS_URL,          # ◄ Update this to target settings
    backend=settings.REDIS_URL          # ◄ Update this to target settings
)

# Load additional task discovery paths
celery_app.autodiscover_tasks(["app"])