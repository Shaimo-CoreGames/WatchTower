from app.core.celery_app import celery_app
from celery.schedules import crontab
from datetime import datetime
from sqlalchemy.future import select
from app.models.incident import Incident

@celery_app.on_after_configure.connect
def setup_periodic_tasks(sender, **kwargs):
    # Triggers our orchestration task runner every 30 seconds automatically
    sender.add_periodic_task(30.0, trigger_all_active_monitors.s(), name="cycle-every-30-seconds")

@celery_app.task(name="tasks.trigger_all_active_monitors")
def trigger_all_active_monitors():
    """Queries the main database and broadcasts ping commands for all active endpoints to the queue cluster."""
    from app.core.database import SessionLocal
    from app.models.monitor import Monitor
    
    db = SessionLocal()
    try:
        active_monitors = db.query(Monitor).filter(Monitor.is_active == True).all()
        for monitor in active_monitors:
            # .delay() immediately pushes the task command off into Redis so workers can consume it
            celery_app.send_task("tasks.execute_endpoint_ping", args=[monitor.id, monitor.url])
    finally:
        db.close()


async def process_incident_rules(monitor_id: int, status_code: int, error_msg: str, db: AsyncSession):
    """Runs a post-check assessment loop to manage active and resolved outages."""
    
    is_check_successful = (status_code == 200)

    if not is_check_successful:
        # 🚨 Target is DOWN. Check if an active outage log already exists.
        query = select(Incident).where(Incident.monitor_id == monitor_id, Incident.is_resolved == False)
        res = await db.execute(query)
        existing_incident = res.scalar_one_or_none()

        if not existing_incident:
            # Open a brand new infrastructure incident log entry
            new_incident = Incident(
                monitor_id=monitor_id,
                error_details=f"Status {status_code} - {error_msg}" if error_msg else f"HTTP Status {status_code}",
                started_at=datetime.utcnow(),
                is_resolved=False
            )
            db.add(new_incident)
            await db.commit()
            
    else:
        # ✅ Target is UP. Check if we need to close a historical outage incident.
        query = select(Incident).where(Incident.monitor_id == monitor_id, Incident.is_resolved == False)
        res = await db.execute(query)
        active_incident = res.scalar_one_or_none()

        if active_incident:
            # Resolve the incident instantly!
            active_incident.is_resolved = True
            active_incident.resolved_at = datetime.utcnow()
            await db.commit()