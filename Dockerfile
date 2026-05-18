# ── Stage 1: build React/Vite UI ──────────────────────────────────────────────
FROM node:22-alpine AS ui-builder
WORKDIR /ui
COPY ui/package*.json ./
RUN npm ci --prefer-offline
COPY ui/ .
RUN npm run build

# ── Stage 2: production image (nginx + uvicorn) ────────────────────────────────
FROM python:3.12-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends nginx supervisor && \
    rm -rf /var/lib/apt/lists/* /etc/nginx/sites-enabled/default

WORKDIR /app

# Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App source
COPY app ./app

# Built UI → /usr/share/nginx/html/admin  (matches Vite base: '/admin/')
COPY --from=ui-builder /ui/dist /usr/share/nginx/html/admin

# ── nginx config ───────────────────────────────────────────────────────────────
RUN cat > /etc/nginx/conf.d/admin.conf << 'NGINX'
server {
    listen 8006;
    server_name _;

    root /usr/share/nginx/html;

    # Proxy all API calls (REST + WebSocket) to uvicorn
    location /api/ {
        proxy_pass         http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host       $host;
        proxy_set_header   X-Real-IP  $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    location /health {
        proxy_pass http://127.0.0.1:8000/health;
    }

    # Redirect bare root to the SPA
    location = / {
        return 301 /admin/;
    }

    # Hashed assets — safe to cache forever
    location /admin/assets/ {
        expires    1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA — serve index.html for every /admin/* path
    location /admin/ {
        try_files $uri $uri/ /admin/index.html;
    }
}
NGINX

# ── supervisord config ─────────────────────────────────────────────────────────
RUN cat > /etc/supervisor/conf.d/admin.conf << 'SUPERVISOR'
[supervisord]
nodaemon=true
logfile=/dev/null
logfile_maxbytes=0

[program:uvicorn]
command=uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
directory=/app
autostart=true
autorestart=true
priority=5
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

[program:nginx]
command=nginx -g "daemon off;"
autostart=true
autorestart=true
priority=10
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
SUPERVISOR

EXPOSE 8006
CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/admin.conf"]
