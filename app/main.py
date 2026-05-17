from pathlib import Path
import secrets

import httpx
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response, status
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from pydantic import BaseModel, Field

from app.config import settings


COOKIE_NAME = "broker_admin_session"
STATIC_DIR = Path(__file__).resolve().parents[1] / "static"

app = FastAPI(title="Broker Admin Service", version="0.1.0")
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
    return {
        "users": {"total": users.get("total", 0)},
        "orders": orders,
        "wallet": wallet,
        "portfolio": portfolio,
        "connections": connections,
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
