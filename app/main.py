import logging
from contextlib import asynccontextmanager
from pathlib import Path
import secrets

import httpx
from fastapi import (
    Depends,
    FastAPI,
    HTTPException,
    Query,
    Request,
    Response,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from pydantic import BaseModel, Field

from app.config import settings
from app.services import bot_ws_relay


COOKIE_NAME = "broker_admin_session"
STATIC_DIR = Path(__file__).resolve().parents[1] / "static"

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await bot_ws_relay.start_relay()
    except Exception:
        logger.exception("Failed to start bot_ws_relay; admin UI will fall back to polling")
    try:
        yield
    finally:
        await bot_ws_relay.stop_relay()


app = FastAPI(title="Broker Admin Service", version="0.2.0", lifespan=lifespan)
serializer = URLSafeTimedSerializer(settings.admin_session_secret)


class AdminLoginRequest(BaseModel):
    username: str
    password: str


class AdminSessionResponse(BaseModel):
    username: str


class FeePolicyUpdate(BaseModel):
    platform_fee_rate: float = Field(..., ge=0)
    reason: str | None = Field(default=None, max_length=500)


class SuspendRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


class BotRestartRequest(BaseModel):
    close_positions: bool = False


def _session_max_age() -> int:
    return settings.admin_session_minutes * 60


def _sign_session(username: str) -> str:
    return serializer.dumps({"sub": username})


def _read_session(request: Request) -> str:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin login required")
    try:
        payload = serializer.loads(token, max_age=_session_max_age())
    except SignatureExpired:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin session expired")
    except BadSignature:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin session")
    username = payload.get("sub")
    if username != settings.admin_username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin session")
    return username


def require_admin(request: Request) -> str:
    return _read_session(request)


def internal_headers(admin_username: str | None = None) -> dict[str, str]:
    headers = {"X-Internal-Token": settings.internal_service_token}
    if admin_username:
        headers["X-Admin-User"] = admin_username
    return headers


async def fetch_json(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    *,
    admin_username: str | None = None,
    json: dict | None = None,
    params: dict | None = None,
):
    response = await client.request(
        method,
        url,
        headers=internal_headers(admin_username),
        json=json,
        params=params,
    )
    if response.status_code >= 400:
        detail = response.text
        try:
            detail = response.json().get("detail", detail)
        except ValueError:
            pass
        raise HTTPException(status_code=response.status_code, detail=detail)
    return response.json()


async def optional_fetch(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    default,
    errors: list[str],
    *,
    service: str,
    params: dict | None = None,
):
    try:
        return await fetch_json(client, method, url, params=params)
    except Exception as exc:
        errors.append(f"{service}: {exc}")
        return default


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "admin-service"}


@app.post("/api/admin/login", response_model=AdminSessionResponse)
async def login(body: AdminLoginRequest, response: Response) -> AdminSessionResponse:
    valid_username = secrets.compare_digest(body.username, settings.admin_username)
    valid_password = secrets.compare_digest(body.password, settings.admin_password)
    if not valid_username or not valid_password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin credentials")
    response.set_cookie(
        COOKIE_NAME,
        _sign_session(settings.admin_username),
        max_age=_session_max_age(),
        httponly=True,
        samesite="lax",
    )
    return AdminSessionResponse(username=settings.admin_username)


@app.post("/api/admin/logout")
async def logout(response: Response) -> dict[str, bool]:
    response.delete_cookie(COOKIE_NAME)
    return {"ok": True}


@app.get("/api/admin/me", response_model=AdminSessionResponse)
async def me(admin_username: str = Depends(require_admin)) -> AdminSessionResponse:
    return AdminSessionResponse(username=admin_username)


@app.get("/api/admin/overview")
async def overview(_: str = Depends(require_admin)) -> dict:
    errors: list[str] = []
    async with httpx.AsyncClient(timeout=8.0) as client:
        users = await optional_fetch(
            client,
            "GET",
            f"{settings.auth_service_url}/internal/admin/users",
            {"items": [], "total": 0, "limit": 1, "offset": 0},
            errors,
            service="auth-service",
            params={"limit": 1, "offset": 0},
        )
        orders = await optional_fetch(
            client,
            "GET",
            f"{settings.order_service_url}/orders/internal/admin/metrics",
            {},
            errors,
            service="order-service",
        )
        wallet = await optional_fetch(
            client,
            "GET",
            f"{settings.wallet_service_url}/internal/admin/metrics",
            {},
            errors,
            service="wallet-service",
        )
        portfolio = await optional_fetch(
            client,
            "GET",
            f"{settings.portfolio_service_url}/internal/admin/metrics",
            {},
            errors,
            service="portfolio-service",
        )
        connections = await optional_fetch(
            client,
            "GET",
            f"{settings.market_notifications_url}/internal/admin/metrics",
            {"connected_users": 0, "total_connections": 0, "connected_user_ids": []},
            errors,
            service="market-notifications",
        )
        bots = await optional_fetch(
            client,
            "GET",
            f"{settings.bot_service_url}/internal/admin/metrics",
            {
                "running_count": 0,
                "sessions_by_status": {},
                "total_open_trades": 0,
                "total_pnl_today": 0.0,
                "total_pnl_all_time": 0.0,
                "errors_last_24h": 0,
            },
            errors,
            service="bot-service",
        )
    return {
        "users": {"total": users.get("total", 0)},
        "orders": orders,
        "wallet": wallet,
        "portfolio": portfolio,
        "connections": connections,
        "bots": bots,
        "errors": errors,
    }


@app.get("/api/admin/fees")
async def fees(_: str = Depends(require_admin)) -> dict:
    async with httpx.AsyncClient(timeout=8.0) as client:
        policy = await fetch_json(
            client,
            "GET",
            f"{settings.order_service_url}/orders/internal/admin/fee-policy",
        )
        history = await fetch_json(
            client,
            "GET",
            f"{settings.order_service_url}/orders/internal/admin/fee-policy/history",
        )
    return {"policy": policy, "history": history}


@app.post("/api/admin/fees")
async def update_fees(
    body: FeePolicyUpdate,
    admin_username: str = Depends(require_admin),
) -> dict:
    async with httpx.AsyncClient(timeout=8.0) as client:
        updated = await fetch_json(
            client,
            "POST",
            f"{settings.order_service_url}/orders/internal/admin/fee-policy",
            admin_username=admin_username,
            json=body.model_dump(),
        )
    return updated


@app.get("/api/admin/users")
async def users(
    _: str = Depends(require_admin),
    q: str | None = Query(default=None),
    status_filter: str = Query(default="all", alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> dict:
    async with httpx.AsyncClient(timeout=8.0) as client:
        payload = await fetch_json(
            client,
            "GET",
            f"{settings.auth_service_url}/internal/admin/users",
            params={"q": q, "status": status_filter, "limit": limit, "offset": offset},
        )
        connection_metrics = await fetch_json(
            client,
            "GET",
            f"{settings.market_notifications_url}/internal/admin/metrics",
        )
    connected_ids = {str(user_id) for user_id in connection_metrics.get("connected_user_ids", [])}
    payload["items"] = [
        {**item, "is_connected": str(item.get("id")) in connected_ids}
        for item in payload.get("items", [])
    ]
    return payload


@app.get("/api/admin/users/{user_id}")
async def user_detail(user_id: int, _: str = Depends(require_admin)) -> dict:
    async with httpx.AsyncClient(timeout=8.0) as client:
        payload = await fetch_json(
            client,
            "GET",
            f"{settings.auth_service_url}/internal/admin/users/{user_id}",
        )
        connection_metrics = await fetch_json(
            client,
            "GET",
            f"{settings.market_notifications_url}/internal/admin/metrics",
        )
    payload["is_connected"] = str(user_id) in {
        str(item) for item in connection_metrics.get("connected_user_ids", [])
    }
    return payload


@app.post("/api/admin/users/{user_id}/suspend")
async def suspend_user(
    user_id: int,
    body: SuspendRequest,
    _: str = Depends(require_admin),
) -> dict:
    async with httpx.AsyncClient(timeout=8.0) as client:
        return await fetch_json(
            client,
            "POST",
            f"{settings.auth_service_url}/internal/admin/users/{user_id}/suspend",
            json=body.model_dump(),
        )


@app.post("/api/admin/users/{user_id}/reactivate")
async def reactivate_user(user_id: int, _: str = Depends(require_admin)) -> dict:
    async with httpx.AsyncClient(timeout=8.0) as client:
        return await fetch_json(
            client,
            "POST",
            f"{settings.auth_service_url}/internal/admin/users/{user_id}/reactivate",
        )


@app.get("/api/admin/trading")
async def trading(_: str = Depends(require_admin)) -> dict:
    errors: list[str] = []
    async with httpx.AsyncClient(timeout=8.0) as client:
        orders = await optional_fetch(
            client,
            "GET",
            f"{settings.order_service_url}/orders/internal/admin/metrics",
            {},
            errors,
            service="order-service",
        )
        portfolio = await optional_fetch(
            client,
            "GET",
            f"{settings.portfolio_service_url}/internal/admin/metrics",
            {},
            errors,
            service="portfolio-service",
        )
    return {"orders": orders, "portfolio": portfolio, "errors": errors}


# ── Bot Service admin proxy ────────────────────────────────────────────────
# All routes forward to bot-service /internal/admin/bots/* with the shared
# X-Internal-Token header. Admin-action endpoints additionally set
# X-Admin-User for audit logging on the bot side.

def _bot_url(path: str) -> str:
    return f"{settings.bot_service_url}/internal/admin{path}"


@app.get("/api/admin/bots")
async def list_bots(
    _: str = Depends(require_admin),
    q: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict:
    params: dict[str, object] = {"limit": limit, "offset": offset}
    if q:
        params["q"] = q
    if status_filter:
        params["status"] = status_filter
    async with httpx.AsyncClient(timeout=30.0) as client:
        return await fetch_json(client, "GET", _bot_url("/bots"), params=params)


@app.get("/api/admin/bots/metrics")
async def bots_metrics(_: str = Depends(require_admin)) -> dict:
    async with httpx.AsyncClient(timeout=8.0) as client:
        return await fetch_json(client, "GET", _bot_url("/metrics"))


@app.post("/api/admin/bots/stop-all")
async def bots_stop_all(admin_username: str = Depends(require_admin)) -> dict:
    async with httpx.AsyncClient(timeout=30.0) as client:
        return await fetch_json(
            client, "POST", _bot_url("/bots/stop-all"),
            admin_username=admin_username, json={},
        )


@app.get("/api/admin/bots/{session_id}")
async def bot_detail(session_id: str, _: str = Depends(require_admin)) -> dict:
    async with httpx.AsyncClient(timeout=8.0) as client:
        return await fetch_json(client, "GET", _bot_url(f"/bots/{session_id}"))


@app.get("/api/admin/bots/{session_id}/trades")
async def bot_trades(
    session_id: str,
    _: str = Depends(require_admin),
    side: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict:
    params: dict[str, object] = {"limit": limit, "offset": offset}
    if side:
        params["side"] = side
    if status_filter:
        params["status"] = status_filter
    async with httpx.AsyncClient(timeout=8.0) as client:
        return await fetch_json(client, "GET", _bot_url(f"/bots/{session_id}/trades"), params=params)


@app.get("/api/admin/bots/{session_id}/holdings")
async def bot_holdings(session_id: str, _: str = Depends(require_admin)) -> dict:
    async with httpx.AsyncClient(timeout=8.0) as client:
        return await fetch_json(client, "GET", _bot_url(f"/bots/{session_id}/holdings"))


@app.get("/api/admin/bots/{session_id}/decisions")
async def bot_decisions(
    session_id: str,
    _: str = Depends(require_admin),
    since: str | None = Query(default=None),
    strategy: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=1000),
) -> dict:
    params: dict[str, object] = {"limit": limit}
    if since:
        params["since"] = since
    if strategy:
        params["strategy"] = strategy
    async with httpx.AsyncClient(timeout=8.0) as client:
        return await fetch_json(client, "GET", _bot_url(f"/bots/{session_id}/decisions"), params=params)


@app.get("/api/admin/bots/{session_id}/events")
async def bot_events(
    session_id: str,
    _: str = Depends(require_admin),
    severity: str | None = Query(default=None),
    event_type: str | None = Query(default=None),
    since: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=1000),
) -> dict:
    params: dict[str, object] = {"limit": limit}
    if severity:
        params["severity"] = severity
    if event_type:
        params["event_type"] = event_type
    if since:
        params["since"] = since
    async with httpx.AsyncClient(timeout=8.0) as client:
        return await fetch_json(client, "GET", _bot_url(f"/bots/{session_id}/events"), params=params)


@app.get("/api/admin/bots/{session_id}/metrics")
async def bot_metrics(
    session_id: str,
    _: str = Depends(require_admin),
    window: str = Query(default="all", pattern="^(24h|7d|all)$"),
) -> dict:
    async with httpx.AsyncClient(timeout=8.0) as client:
        return await fetch_json(
            client, "GET", _bot_url(f"/bots/{session_id}/metrics"),
            params={"window": window},
        )


@app.get("/api/admin/bots/{session_id}/equity")
async def bot_equity(
    session_id: str,
    _: str = Depends(require_admin),
    range_: str = Query(default="24h", alias="range", pattern="^(24h|7d|30d)$"),
) -> dict:
    async with httpx.AsyncClient(timeout=8.0) as client:
        return await fetch_json(
            client, "GET", _bot_url(f"/bots/{session_id}/equity"),
            params={"range": range_},
        )


@app.post("/api/admin/bots/{session_id}/start")
async def bot_start(
    session_id: str,
    admin_username: str = Depends(require_admin),
) -> dict:
    async with httpx.AsyncClient(timeout=8.0) as client:
        return await fetch_json(
            client, "POST", _bot_url(f"/bots/{session_id}/start"),
            admin_username=admin_username, json={},
        )


@app.post("/api/admin/bots/{session_id}/stop")
async def bot_stop(
    session_id: str,
    admin_username: str = Depends(require_admin),
) -> dict:
    async with httpx.AsyncClient(timeout=8.0) as client:
        return await fetch_json(
            client, "POST", _bot_url(f"/bots/{session_id}/stop"),
            admin_username=admin_username, json={},
        )


@app.post("/api/admin/bots/{session_id}/restart")
async def bot_restart(
    session_id: str,
    body: BotRestartRequest,
    admin_username: str = Depends(require_admin),
) -> dict:
    async with httpx.AsyncClient(timeout=8.0) as client:
        return await fetch_json(
            client, "POST", _bot_url(f"/bots/{session_id}/restart"),
            admin_username=admin_username, json=body.model_dump(),
        )


@app.post("/api/admin/bots/{session_id}/pause")
async def bot_pause(
    session_id: str,
    admin_username: str = Depends(require_admin),
) -> dict:
    async with httpx.AsyncClient(timeout=8.0) as client:
        return await fetch_json(
            client, "POST", _bot_url(f"/bots/{session_id}/pause"),
            admin_username=admin_username, json={},
        )


@app.post("/api/admin/bots/{session_id}/resume")
async def bot_resume(
    session_id: str,
    admin_username: str = Depends(require_admin),
) -> dict:
    async with httpx.AsyncClient(timeout=8.0) as client:
        return await fetch_json(
            client, "POST", _bot_url(f"/bots/{session_id}/resume"),
            admin_username=admin_username, json={},
        )


@app.post("/api/admin/bots/{session_id}/close-positions")
async def bot_close_positions(
    session_id: str,
    admin_username: str = Depends(require_admin),
) -> dict:
    async with httpx.AsyncClient(timeout=8.0) as client:
        return await fetch_json(
            client, "POST", _bot_url(f"/bots/{session_id}/close-positions"),
            admin_username=admin_username, json={},
        )


# ── Live bot activity WebSocket ────────────────────────────────────────────
# Cookie-auth: the handshake fails if no valid admin session cookie is
# present. Once accepted, the client can send {"action": "subscribe", ...}
# messages to filter the firehose to specific session_ids, or "*" for all.

def _check_ws_admin(websocket: WebSocket) -> bool:
    token = websocket.cookies.get(COOKIE_NAME)
    if not token:
        return False
    try:
        payload = serializer.loads(token, max_age=_session_max_age())
    except (SignatureExpired, BadSignature):
        return False
    return payload.get("sub") == settings.admin_username


@app.websocket("/api/admin/bots/ws")
async def bots_ws(websocket: WebSocket) -> None:
    if not _check_ws_admin(websocket):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()
    # Default subscription: firehose (matches list view); detail view sends a
    # narrow subscribe action immediately after connect.
    bot_ws_relay.register(websocket, {bot_ws_relay.WILDCARD})
    try:
        await websocket.send_json({"topic": "system", "payload": {"event": "connected"}})
        while True:
            msg = await websocket.receive_json()
            action = msg.get("action")
            if action == "subscribe":
                session_id = str(msg.get("session_id", "")).strip()
                if session_id:
                    bot_ws_relay.subscribe(websocket, session_id)
            elif action == "unsubscribe":
                session_id = str(msg.get("session_id", "")).strip()
                if session_id:
                    bot_ws_relay.unsubscribe(websocket, session_id)
            elif action == "set_subscriptions":
                session_ids = {str(s) for s in (msg.get("session_ids") or []) if s}
                bot_ws_relay.replace_subscriptions(websocket, session_ids)
            elif action == "ping":
                await websocket.send_json({"topic": "system", "payload": {"event": "pong"}})
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("Error in admin bots WS")
    finally:
        bot_ws_relay.unregister(websocket)


if STATIC_DIR.exists():
    app.mount("/admin/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="admin-assets")


@app.get("/")
@app.head("/")
async def root_redirect():
    return RedirectResponse(url="/admin")


@app.get("/admin")
@app.get("/admin/{path:path}")
@app.head("/admin")
@app.head("/admin/{path:path}")
async def admin_ui(path: str = ""):
    index_file = STATIC_DIR / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=404, detail="Admin UI has not been built")
    return FileResponse(index_file)
