import asyncio
import datetime
import random
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User
from app.models.monitor import Monitor
from app.models.health_check import HealthCheck


async def run_simulation_seeder():
    print("🚀 Initializing WatchTower local data simulation factory...")
    engine = create_async_engine(settings.DATABASE_URL)
    AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False)
    
    async with AsyncSessionLocal() as session:
        # 1. Inject a static test user account profile
        user_email = "demo@watchtower.io"
        print(f"👥 Generating default operator profile: {user_email}")
        
        # Check if the demo user already exists to prevent duplicate key constraint crashes
        from sqlalchemy.future import select
        user_check = await session.execute(select(User).where(User.email == user_email))
        demo_user = user_check.scalars().first()
        
        if not demo_user:
            demo_user = User(
                email=user_email,
                hashed_password=get_password_hash("password123"),
                full_name="Alex Operator"
            )
            session.add(demo_user)
            await session.flush()  # Extract the newly assigned ID transactionally
        
        # 2. Clear old monitor records to prevent cross-contamination
        await session.execute(select(Monitor).where(Monitor.user_id == demo_user.id))
        
        # 3. Establish standard targets matching your design layout shell
        targets = [
            {"name": "Primary API Gateway", "url": "https://api.watchtower.io"},
            {"name": "Main DB Cluster", "url": "db-prod-01.local"},
            {"name": "Asset Delivery Edge", "url": "https://assets-cdn.watchtower.io"},
            {"name": "Auth Microservice", "url": "auth.internal.svc"}
        ]
        
        print("🖥️  Provisioning live target monitors matching Stitch layouts...")
        now = datetime.datetime.now(datetime.timezone.utc)
        
        for t in targets:
            # Instantiate monitor configuration
            monitor = Monitor(
                name=t["name"],
                url=t["url"],
                check_interval=60,
                is_active=True,
                user_id=demo_user.id
            )
            session.add(monitor)
            await session.flush()
            
            # Generate 30 unique temporal check blocks representing a 30-day/30-minute historical window
            print(f"📊 Injecting time-series metric streams for: {t['name']}")
            for i in range(30):
                # Introduce occasional network anomalies (simulated down/degraded incidents)
                is_unhealthy = random.random() < 0.05  # 5% incident distribution
                is_degraded = random.random() < 0.10   # 10% structural latency spike distribution
                
                if is_unhealthy:
                    status = random.choice([502, 504, 500])
                    latency = random.randint(1200, 3500)
                    error = "Gateway Timeout Connection Failure Exception"
                elif is_degraded:
                    status = 200
                    latency = random.randint(350, 780)
                    error = None
                else:
                    status = 200
                    latency = random.randint(12, 65)  # Normal sub-millisecond execution speeds
                    error = None
                
                check_time = now - datetime.timedelta(minutes=(30 - i))
                
                log = HealthCheck(
                    monitor_id=monitor.id,
                    status_code=status,
                    latency_ms=latency,
                    error_message=error,
                    timestamp=check_time
                )
                session.add(log)
        
        await session.commit()
        print("\n✨ Database fully loaded with real-time tracking data metrics!")
        print("🔑 Login Credentials -> Email: demo@watchtower.io | Password: password123")

if __name__ == "__main__":
    asyncio.run(run_simulation_seeder())