# Dockia

**A self-hosted home for the HTML documents your team generates.**

[![CI](https://github.com/jafariai/dockia/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/jafariai/dockia/actions/workflows/ci-cd.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

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
| **MCP server** | Publish and edit documents straight from an AI assistant — see [mcp-server/](mcp-server/) |
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

To put Dockia on a real server — behind an IP allowlist or a domain with a
trusted certificate — see [DEPLOY.md](DEPLOY.md).

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

The [MCP server](mcp-server/) turns Dockia into a publishing target for any
[Model Context Protocol](https://modelcontextprotocol.io) client. Mint a token
under **Settings → API tokens**, register the server with your client, and ask:

> "Write up the caching design we just discussed as an HTML doc and publish it
> to the *Infrastructure* project."

The assistant calls `create_document`, Dockia sanitizes and stores it, and your
teammates get a notification with a link. Tokens inherit their owner's project
access and can be limited to read-only.

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

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the data model
and request flows, [docs/SECURITY.md](docs/SECURITY.md) for the security model.

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
├── scripts/          cert generation, deploy, backup/restore, port allowlist
└── docs/             architecture, security, project proposal
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

The reasoning behind this order is in [docs/PROPOSAL.md](docs/PROPOSAL.md). If
one of these matters to you, open an issue — or pick it up.

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

Contributions are welcome — bug reports, features, docs, and design feedback
alike. Start with [CONTRIBUTING.md](CONTRIBUTING.md), and please read the
[Code of Conduct](CODE_OF_CONDUCT.md).

Found a security issue? Please report it privately; see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © Matthew Jafari
