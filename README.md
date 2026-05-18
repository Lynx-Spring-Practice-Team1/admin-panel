# Admin Panel

Full-stack administration dashboard for the broker platform.

## Overview

A single-container application combining a FastAPI backend with a React/Vite frontend served via Nginx. Provides administrators with centralized monitoring and control over users, fees, trading activity, and automated trading bots. Real-time bot activity is streamed via Kafka → WebSocket relay.

## Tech Stack

**Backend:**
- Python 3.12 + FastAPI 0.111 + uvicorn
- HTTPX (async HTTP proxy to microservices)
- aiokafka (Kafka consumer for bot activity streams)
- itsdangerous (signed session cookies)

**Frontend:**
- React 19 + Vite 5 + Tailwind CSS 4
- Recharts (charts), lucide-react (icons)
- Single-page app at `/admin/`

**Infrastructure:**
- Multi-stage Docker build (Node 22 → Python 3.12-slim)
- Nginx on port 8006 (serves frontend + proxies `/api/admin` to uvicorn)
- supervisord manages both processes

## Project Structure

```
admin-panel/
├── app/
│   ├── main.py               # FastAPI app, all API routes (~657 lines)
│   ├── config.py             # Settings from environment variables
│   └── services/
│       └── bot_ws_relay.py   # Kafka → WebSocket relay
├── ui/
│   ├── src/
│   │   ├── main.jsx          # Entire React SPA (~1550 lines)
│   │   └── styles.css        # Tailwind imports
│   ├── vite.config.js        # Base path: /admin/
│   └── package.json
├── Dockerfile
└── requirements.txt
```

## Features

- **Overview Dashboard** — user counts, fee revenue, cash position, top traded symbols
- **User Management** — list, search, filter, suspend/reactivate users with reason tracking
- **Fee Management** — view/update platform fee rate, full audit history
- **Trading Dashboard** — order status breakdown, symbol activity, holdings
- **Bot Control Panel** — list sessions, start/stop/pause/resume bots, view decisions, trades, equity curves, error logs
- **Live Bot Feed** — real-time WebSocket stream from Kafka topics `bot.activity.*`
- **Dark/Light Theme** — persisted to localStorage

## API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/admin/login` | Login with credentials |
| `POST` | `/api/admin/logout` | Clear session |
| `GET` | `/api/admin/me` | Check current session |

### Dashboard
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/overview` | Aggregated overview metrics |
| `GET` | `/api/admin/trading` | Trading metrics |

### Fee Management
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/fees` | Current fee policy and history |
| `POST` | `/api/admin/fees` | Update fee rate |

### User Management
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/users` | List users (paginated, filterable) |
| `GET` | `/api/admin/users/{user_id}` | User details |
| `POST` | `/api/admin/users/{user_id}/suspend` | Suspend user |
| `POST` | `/api/admin/users/{user_id}/reactivate` | Reactivate user |

### Bot Management
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/bots` | List bot sessions |
| `GET` | `/api/admin/bots/metrics` | Global bot metrics |
| `POST` | `/api/admin/bots/stop-all` | Emergency stop all bots |
| `GET` | `/api/admin/bots/{session_id}` | Bot details |
| `GET` | `/api/admin/bots/{session_id}/{endpoint}` | Holdings, trades, decisions, equity… |
| `POST` | `/api/admin/bots/{session_id}/{action}` | start, stop, restart, pause, resume |
| `WS` | `/api/admin/bots/ws` | Live bot activity feed |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ADMIN_USERNAME` | `admin` | Admin login username |
| `ADMIN_PASSWORD` | `admin` | Admin login password |
| `ADMIN_SESSION_SECRET` | `change-me-admin-session-secret` | Session signing key |
| `ADMIN_SESSION_MINUTES` | `60` | Session timeout |
| `INTERNAL_SERVICE_TOKEN` | `change-me-in-production` | Service-to-service token |
| `AUTH_SERVICE_URL` | `http://auth-service:8000` | |
| `ORDER_SERVICE_URL` | `http://order-service:8002` | |
| `WALLET_SERVICE_URL` | `http://wallet-service:8003` | |
| `PORTFOLIO_SERVICE_URL` | `http://portfolio-service:8004` | |
| `MARKET_NOTIFICATIONS_URL` | `http://market-notifications:8005` | |
| `BOT_SERVICE_URL` | `http://bot-service:8000` | |
| `KAFKA_BOOTSTRAP_SERVERS` | `redpanda:9092` | Kafka/Redpanda address |
| `KAFKA_ENABLED` | `true` | Enables live bot WebSocket feed |

## Getting Started

### Docker (Recommended)

```bash
docker build -t admin-panel .
docker run -p 8006:8006 \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD=admin \
  -e ADMIN_SESSION_SECRET=change-me \
  -e INTERNAL_SERVICE_TOKEN=change-me \
  admin-panel
```

Access at `http://localhost:8006/admin/`

### Local Development

**Backend:**
```bash
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Frontend:**
```bash
cd ui
npm install
npm run dev   # http://localhost:5173
```

## Deployment

GitHub Actions CI/CD pushes to GHCR on push to `main`:
```
ghcr.io/lynx-spring-practice-team1/admin-service:latest
```
