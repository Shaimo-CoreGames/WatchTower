from celery import Celery

celery_app = Celery(
    "watchtower_worker",
    broker="redis://127.0.0.1:6379/0",
    backend="redis://127.0.0.1:6379/0",
    include=["app.tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    worker_prefetch_multiplier=1,
)

# ⏳ Bind the orchestrator task to a repeating 10-second automation heartbeat clock
celery_app.conf.beat_schedule = {
    "watchtower-heartbeat-engine": {
        "task": "tasks.trigger_all_active_monitors",
        "schedule": 10.0, # Checks the schedule table matrix every 10 seconds
    },
}