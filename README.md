# Dockia

**A self-hosted home for the HTML documents your team generates.**

[![CI](https://github.com/jafariai/dockia/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/jafariai/dockia/actions/workflows/ci-cd.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

AI tools have made rich, visual HTML documents cheap to produce: specs, reports,
architecture write-ups, dashboards, one-off explainers. A team can generate
dozens a week. What is still missing is somewhere to *keep* them — a place where
they are organized, searchable, access-controlled, and safe to open.

Dockia is that place. Upload an HTML file (or have your assistant publish it
over MCP), and your team gets a rendered, sandboxed preview, organized by
project and category, with roles, audit logs, and realtime notifications.

- **Safe by construction.** Uploaded HTML is sanitized server-side and rendered
  in a sandboxed, opaque-origin iframe behind a strict CSP. Documents that need
  their own JavaScript run in an isolated mode with no network egress.
- **Private by default.** Every page and every document requires login. Members
  only see the projects they have been added to.
- **Built for AI workflows.** A bundled MCP server lets any MCP-capable
  assistant list, read, create, and edit documents with a scoped API token.
- **Yours to run.** One `docker compose up`, one published port, your data on
  your own server.

---

## Features

| | |
|---|---|
| **Documents** | Upload HTML, live sandboxed preview, in-app code editor with side-by-side preview, thumbnails, download, tags, search and filters |
| **Projects** | Per-project membership, colors, archiving, and links out to the tools a project lives in (Figma, Linear, GitHub, …) |
| **Prompts** | A shared library of the prompts and instructions your team reuses |
| **Files** | Arbitrary file storage per project, streamed through nginx with signed, short-lived download links |
| **Roles** | `admin`, `member`, and read-only `audience` |
| **API tokens** | Revocable service tokens with read-only scope and optional expiry |
| **MCP server** | Publish and edit documents straight from an AI assistant |
| **Realtime** | WebSocket activity feed, nav badges, and web push notifications |
| **Audit log** | Append-only record of logins, uploads, edits, and admin actions, with CSV export |
| **PWA** | Installable, mobile-friendly, light and dark themes |

---

## Quick start

You need Docker, Docker Compose, and `openssl`.

```bash
git clone https://github.com/jafariai/dockia.git
cd dockia

cp .env.example .env
# Edit .env: set DJANGO_SECRET_KEY, POSTGRES_PASSWORD, ADMIN_PASSWORD
#   python -c "import secrets; print(secrets.token_urlsafe(64))"

# nginx terminates TLS, so it needs a certificate before the first start.
./scripts/gen-selfsigned-cert.sh localhost

docker compose up -d --build
```

Open **https://localhost:8443** and sign in with `ADMIN_EMAIL` /
`ADMIN_PASSWORD` from `.env`. Your browser will warn about the self-signed
certificate; that is expected locally. The first boot runs migrations, collects
static files, and seeds the admin user plus a starter project and
categories.

To put Dockia on a real server, see [Deployment](#deployment).

### Local development

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
export DJANGO_SETTINGS_MODULE=config.settings_sqlite DJANGO_SECRET_KEY=dev
python manage.py migrate && python manage.py seed_initial
python manage.py runserver        # http://localhost:8000

# Frontend (separate shell)
cd frontend
npm install
npm run dev                       # http://localhost:3000  (proxies /api -> :8000)
```

`config.settings_sqlite` swaps PostgreSQL for a local SQLite file, so you can
work on the app without running the Docker stack.

---

## Publishing from an AI assistant

The MCP server in `mcp-server/` turns Dockia into a publishing target for any
[Model Context Protocol](https://modelcontextprotocol.io) client. Every call
runs with the permissions of the token's owner, project scoping included.

1. Mint a token in the web app under **Settings → API tokens**. Tokens can be
   read-only, given an expiry, and revoked at any time.
2. Install the dependencies (Python 3.10+):
   ```bash
   cd mcp-server
   python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```
3. Register the server with your MCP client:
   ```json
   {
     "mcpServers": {
       "dockia": {
         "command": "/path/to/dockia/mcp-server/.venv/bin/python",
         "args": ["/path/to/dockia/mcp-server/server.py"],
         "env": {
           "DOCKIA_BASE_URL": "https://localhost:8443/api",
           "DOCKIA_TOKEN": "idp_paste_your_token_here",
           "DOCKIA_CA_BUNDLE": "/path/to/dockia/nginx/certs/dockia.crt"
         }
       }
     }
   }
   ```

Then ask your assistant:

> "Write up the caching design we just discussed as an HTML doc and publish it
> to the *Infrastructure* project."

Tools: `list_documents`, `get_document`, `get_document_html`, `list_projects`,
`list_categories`, `create_document`, `edit_document`,
`create_document_from_file`, `update_document_from_file`, `upload_file`.

`DOCKIA_CA_BUNDLE` trusts a self-signed deployment; `DOCKIA_INSECURE=1` skips
TLS verification entirely and is only for an endpoint you control.

---

## How it works

```
                 ┌─────────────────────────────┐
  Browser ─ TLS ▶│            nginx            │  rate limits, security headers
                 └───┬──────────┬──────────┬───┘
                /api │      /ws │        / │
                     ▼          ▼          ▼
              ┌──────────┐ ┌─────────┐ ┌──────────┐
              │  Django  │ │ Daphne  │ │ Next.js  │
              │ gunicorn │ │  (ASGI) │ │          │
              └────┬─────┘ └────┬────┘ └──────────┘
                   │            │       internal network only
              ┌────▼─────┐ ┌────▼────┐
              │ Postgres │ │  Redis  │
              └──────────┘ └─────────┘
```

| Layer | Technology |
|---|---|
| Backend | Django 5, Django REST Framework, Channels |
| Auth | JWT (rotating refresh tokens) for the browser, hashed service tokens for integrations |
| Database | PostgreSQL 16, Redis 7 |
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind, TanStack Query, Zustand |
| Proxy | nginx — TLS, rate limiting, `X-Accel-Redirect` downloads |
| Storage | Local volume, or S3 with `STORAGE_BACKEND=s3` |

Only nginx publishes a port. The database and Redis sit on an internal Docker
network, and uploaded files are never served directly — raw HTML only leaves
the system through the sanitizing preview API.

### Rendering untrusted HTML

Every document passes through three independent layers:

1. **Sanitization on upload** — scripts, event handlers, `javascript:` URLs,
   iframes, forms, and anything outside a tag / attribute / CSS allowlist are
   removed before storage.
2. **Content-Security-Policy** on the preview — no scripts, no external loads.
3. **Sandboxed iframe** with an opaque origin, so even a sanitizer bypass cannot
   reach the app, its cookies, or its tokens.

Documents that need their own JavaScript can be switched by an admin to
*interactive* mode: scripts run, still in an opaque origin, with every network
egress channel closed by CSP.

Authorization is enforced on the server for every request. Querysets are scoped
to the caller's projects, so a document outside them returns 404 rather than 403.

### Repository layout

```
.
├── backend/          Django project
│   ├── apps/         accounts · projects · categories · documents · files
│   │                 prompts · realtime · audit · common
│   ├── config/       settings, urls, asgi/wsgi
│   └── smoke_test.py end-to-end API test
├── frontend/         Next.js app (app/, components/, lib/)
├── mcp-server/       MCP server exposing the document API as tools
├── nginx/            reverse-proxy config
└── scripts/          cert generation, deploy, backup/restore, port allowlist
```

---

## API

All endpoints live under `/api` and require authentication — a browser JWT
(`Authorization: Bearer …`) or a service token (`Authorization: Token idp_…`).

| Resource | Endpoints |
|---|---|
| Auth | `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me` |
| Documents | `GET/POST /documents` · `GET/PATCH/DELETE /documents/:id` · `GET /documents/:id/preview` · `GET /documents/:id/raw` |
| Prompts | `GET/POST /prompts` · `GET/PATCH/DELETE /prompts/:id` |
| Files | `GET/POST /files` · `GET/PATCH/DELETE /files/:id` · `GET /files/:id/download` |
| Projects | `GET/POST /projects` · members · archive · `GET/POST /project-links` |
| Categories | `GET/POST /categories` |
| Admin | `GET/POST/PATCH /users` · `GET /logs` · `GET /logs/export` |
| Other | `GET /dashboard` · `/push/*` (web push subscriptions) |

Document listing filters are combinable: `search`, `owner`, `category`,
`project`, `date` (`today` / `7d` / `30d`), `created_after`, `created_before`,
`tag`, `ordering`, `page`.

---

## Deployment

The stack publishes one host port (`HTTPS_PORT`, default 8443); the database and
Redis are never exposed. On the server:

```bash
DOCKIA_HOST=<server-ip-or-hostname> ./scripts/gen-selfsigned-cert.sh
cp .env.example .env      # set the secrets, DJANGO_ALLOWED_HOSTS, FRONTEND_ORIGIN
docker compose up -d --build
```

`FRONTEND_ORIGIN` must be the exact origin the browser uses, including the port
(for example `https://203.0.113.10:8443`). Change the admin password after the
first login.

- **Restrict access by IP.** Docker bypasses `ufw` for published ports, so the
  allowlist goes in the `DOCKER-USER` chain:
  ```bash
  sudo DOCKIA_ALLOW_IPS="203.0.113.10 198.51.100.0/24" ./scripts/restrict-port.sh
  ```
- **Use a domain and a trusted certificate.** Put a reverse proxy with a
  CA-issued certificate in front of `HTTPS_PORT`, set `DJANGO_ALLOWED_HOSTS` and
  `FRONTEND_ORIGIN` to the domain, then enable `SECURE_HSTS_SECONDS`.
- **Back up.** `./scripts/backup.sh` dumps the database and archives uploads
  into `./backups/`; `./scripts/restore.sh` restores them. Copy backups off the
  server.
- **Update.** `bash scripts/deploy.sh` pulls, rebuilds, and restarts. The
  included GitHub Actions workflow can run it over SSH after the checks pass,
  once the `DEPLOY_SSH_HOST`, `DEPLOY_SSH_USER`, and `DEPLOY_SSH_KEY` secrets
  are set; without them the deploy step is skipped.
- **Storage.** Uploads have no size cap by default, so watch free disk space.
  Set `STORAGE_BACKEND=s3` and the `AWS_*` variables to store uploads in S3.

---

## Roadmap

Dockia stores one current revision per document today. The next milestones turn
it into proper version control for documents:

- [ ] **Version history** — keep every revision of a document, with author and timestamp
- [ ] **Visual and source diff** between any two revisions
- [ ] **Restore** a previous revision; soft-delete and trash
- [ ] Review flow: comments and approval before a revision becomes current
- [ ] Asset bundles (images / CSS uploaded alongside the HTML)
- [ ] Full-text search over document content
- [ ] SSO / OIDC and optional 2FA
- [ ] Per-document share links
- [ ] Webhooks for CI pipelines that publish generated docs

If one of these matters to you, open an issue — or pick it up.

---

## Tests

```bash
cd backend
export DJANGO_SETTINGS_MODULE=config.settings_sqlite DJANGO_SECRET_KEY=test
python manage.py migrate && python smoke_test.py
```

The smoke test drives the real API: authentication, HTML sanitization
(script / handler / `javascript:` stripping), project-scoped authorization
including direct-URL access, admin-only surfaces, audit logging, filtering, and
the dashboard. CI runs it on every push alongside the Django system checks and
the frontend typecheck and build.

---

## Contributing

Bug reports, feature ideas, and pull requests are welcome.

- For anything larger than a bug fix, open an issue first so the approach can be
  agreed before you invest the time.
- Run the checks before opening a pull request: `python manage.py check` and
  `python smoke_test.py` in `backend/`, `npm run typecheck` and `npm run build`
  in `frontend/`.
- Commit migrations together with the model change that needs them.
- Changes to the sanitizer, the preview CSP, or the iframe sandbox are
  security-sensitive: explain the threat model and add a smoke-test case.

**Security issues:** please do not open a public issue. Use **Security → Report
a vulnerability** on the repository to report privately.

## License

[MIT](LICENSE) © Matthew Jafari
