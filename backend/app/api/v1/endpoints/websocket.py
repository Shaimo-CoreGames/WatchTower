import asyncio
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import redis.asyncio as aioredis
from redis.exceptions import ConnectionError as RedisConnectionError

logger = logging.getLogger("watchtower")
router = APIRouter()

# 🎯 FIX 1: Explicit IPv4 resolution prevents Windows loopback connection drops
REDIS_URL = "redis://127.0.0.1:6379/0"
redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"🔌 Browser window joined stream layer. Active counts: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"🔌 Browser channel cleared. Remaining window instances: {len(self.active_connections)}")

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                pass

manager = ConnectionManager()

@router.websocket("/ws/analytics")
async def websocket_analytics_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    
    # 🎯 FIX 2: Use the unified connection client instance pool directly
    pubsub = redis_client.pubsub()
    
    try:
        await pubsub.subscribe("monitor_updates")
        logger.info("📡 FastAPI successfully bound to Redis 'monitor_updates' pipeline channel.")
    except (RedisConnectionError, Exception) as e:
        logger.error(f"❌ Initial Redis PubSub connection failed: {e}")
        await websocket.close(code=1011)
        manager.disconnect(websocket)
        return

    async def listen_to_redis():
        try:
            while True:
                # Safer check blocks handling network state fluctuations cleanly
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=0.5)
                if message and message.get("data"):
                    raw_payload = message["data"]
                    logger.info(f"📥 [FASTAPI WS BROADCAST] Intercepted Redis packet -> Splitting to client nodes: {raw_payload}")
                    await manager.broadcast(raw_payload)
                await asyncio.sleep(0.01)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"❌ Error inside Redis execution generator thread loop: {e}")
        finally:
            try:
                await pubsub.unsubscribe("monitor_updates")
                await pubsub.close()
            except Exception:
                pass

    # Spawn the listener sub-routine concurrently
    listener_task = asyncio.create_task(listen_to_redis())

    try:
        while True:
            # Keep wrapper heartbeat channel alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        logger.warn("📡 Client closed browser panel channel cleanly.")
    finally:
        manager.disconnect(websocket)
        listener_task.cancel()
        try:
            await listener_task
        except asyncio.CancelledError:
            pass