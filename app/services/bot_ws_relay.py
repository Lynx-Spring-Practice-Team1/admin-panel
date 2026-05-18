"""Kafka → admin WebSocket relay for bot.activity.* topics.

The admin-panel hosts a WebSocket endpoint at /api/admin/bots/ws. Each
connected client subscribes to either a specific session_id or to "*"
(firehose for the list view). This relay:

  1. Runs a single AIOKafkaConsumer subscribed to all bot.activity.* topics.
  2. For every message, fans out to clients whose subscription matches.
  3. Survives Kafka outages — restarts the consumer with backoff.

Only one consumer runs per admin-panel process. Cookie-based admin auth is
checked at the WebSocket handshake (in main.py) before clients are
registered here.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from aiokafka import AIOKafkaConsumer
from aiokafka.errors import KafkaError
from fastapi import WebSocket

from app.config import settings

logger = logging.getLogger(__name__)

# Topic names mirror bot-service/app/services/kafka_producer.py.
TOPIC_DECISIONS = "bot.activity.decisions"
TOPIC_EVENTS = "bot.activity.events"
TOPIC_LIFECYCLE = "bot.activity.lifecycle"
ALL_TOPICS: tuple[str, ...] = (TOPIC_DECISIONS, TOPIC_EVENTS, TOPIC_LIFECYCLE)

# Sentinel used as a subscription value when a client wants the firehose.
WILDCARD = "*"

_clients: set[WebSocket] = set()
_subscriptions: dict[WebSocket, set[str]] = {}
_consumer_task: asyncio.Task | None = None
_stop_event: asyncio.Event | None = None


def _matches(subscribed: set[str], session_id: str | None) -> bool:
    if WILDCARD in subscribed:
        return True
    return session_id is not None and session_id in subscribed


async def _send_safe(ws: WebSocket, payload: dict) -> bool:
    """Send to a single client. Returns False if the send failed."""
    try:
        await ws.send_json(payload)
        return True
    except Exception:
        return False


async def _broadcast(topic: str, message: dict) -> None:
    """Fan out a Kafka message to subscribed clients."""
    if not _clients:
        return
    session_id = message.get("session_id")
    payload = {"topic": topic, "payload": message}

    dead: list[WebSocket] = []
    for ws in list(_clients):
        subs = _subscriptions.get(ws, set())
        if not _matches(subs, session_id):
            continue
        ok = await _send_safe(ws, payload)
        if not ok:
            dead.append(ws)
    for ws in dead:
        unregister(ws)


async def _consume_forever() -> None:
    """Run the Kafka consumer with exponential backoff on failure."""
    backoff = 1.0
    while _stop_event is not None and not _stop_event.is_set():
        consumer = AIOKafkaConsumer(
            *ALL_TOPICS,
            bootstrap_servers=settings.kafka_bootstrap_servers,
            group_id=None,                  # broadcast — no offsets persisted
            auto_offset_reset="latest",
            value_deserializer=lambda v: json.loads(v.decode()),
        )
        try:
            await consumer.start()
            backoff = 1.0
            logger.info("Bot activity Kafka consumer started (topics=%s)", ", ".join(ALL_TOPICS))
            async for msg in consumer:
                if _stop_event.is_set():
                    break
                try:
                    await _broadcast(msg.topic, msg.value)
                except Exception:
                    logger.exception("Failed to broadcast Kafka message")
        except KafkaError as exc:
            logger.warning("Kafka consumer error: %s — reconnecting in %.1fs", exc, backoff)
        except asyncio.CancelledError:
            break
        except Exception:
            logger.exception("Unexpected Kafka consumer error — reconnecting in %.1fs", backoff)
        finally:
            try:
                await consumer.stop()
            except Exception:
                pass

        if _stop_event.is_set():
            break
        try:
            await asyncio.wait_for(_stop_event.wait(), timeout=backoff)
            break
        except asyncio.TimeoutError:
            pass
        backoff = min(backoff * 2, 30.0)


async def start_relay() -> None:
    """Spawn the Kafka consumer task. Idempotent; safe to call once at startup."""
    global _consumer_task, _stop_event
    if not settings.kafka_enabled:
        logger.info("Bot WS relay: KAFKA_ENABLED=false — relay disabled (REST polling still works)")
        return
    if _consumer_task and not _consumer_task.done():
        return
    _stop_event = asyncio.Event()
    _consumer_task = asyncio.create_task(_consume_forever(), name="bot-ws-relay-consumer")


async def stop_relay() -> None:
    """Signal the consumer to exit and close all client sockets."""
    if _stop_event is not None:
        _stop_event.set()
    if _consumer_task is not None:
        _consumer_task.cancel()
        try:
            await _consumer_task
        except (asyncio.CancelledError, Exception):
            pass
    for ws in list(_clients):
        try:
            await ws.close()
        except Exception:
            pass
        unregister(ws)


def register(ws: WebSocket, session_ids: set[str] | None = None) -> None:
    """Add a client and seed its subscription set."""
    _clients.add(ws)
    _subscriptions[ws] = set(session_ids or set())


def unregister(ws: WebSocket) -> None:
    _clients.discard(ws)
    _subscriptions.pop(ws, None)


def subscribe(ws: WebSocket, session_id: str) -> None:
    if ws not in _subscriptions:
        _subscriptions[ws] = set()
    _subscriptions[ws].add(session_id)


def unsubscribe(ws: WebSocket, session_id: str) -> None:
    subs = _subscriptions.get(ws)
    if subs:
        subs.discard(session_id)


def replace_subscriptions(ws: WebSocket, session_ids: set[str]) -> None:
    _subscriptions[ws] = set(session_ids)


def client_count() -> int:
    return len(_clients)


def subscriptions_for(ws: WebSocket) -> set[str]:
    return _subscriptions.get(ws, set())


async def emit_to_all(payload: dict[str, Any]) -> None:
    """Broadcast an admin-locally-generated event (e.g. proxy errors).

    Goes to every registered client regardless of subscription.
    """
    dead: list[WebSocket] = []
    for ws in list(_clients):
        ok = await _send_safe(ws, payload)
        if not ok:
            dead.append(ws)
    for ws in dead:
        unregister(ws)
