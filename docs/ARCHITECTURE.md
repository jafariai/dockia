# Architecture

## System overview

```
                         ┌───────────────────────────────┐
   Browser ── :8443 ───▶ │            Nginx              │
                         │  • TLS termination            │
                         │  • rate limit (login/api)     │
                         │  • security headers           │
                         └────┬───────────┬───────────┬──┘
                              │ /api      │ /ws       │ /  (everything else)
                              ▼           ▼           ▼
                    ┌──────────────┐ ┌──────────┐ ┌──────────────┐
                    │  Django API  │ │  Daphne  │ │   Next.js    │
                    │  (gunicorn)  │ │  (ASGI)  │ │ (App Router) │
                    └──────┬───────┘ └────┬─────┘ └──────────────┘
                           │              │      internal network only
                           ▼              ▼
                    ┌──────────────┐ ┌──────────┐
                    │ PostgreSQL   │ │  Redis   │   media volume (uploads)
                    └──────────────┘ └──────────┘
```

- Single public origin (Nginx). The browser only ever talks to one host and
  port, so there is no cross-origin surface for the API.
- The database and Redis are on a Docker `internal` network — unreachable from
  the host.
- Websockets are served by a separate Daphne process; gunicorn workers publish
  activity events to it through the Redis channel layer. Redis also backs the
  shared cache (login lockout counters) and web push subscriptions.
- Uploaded files live on a named volume and are **never** served directly by
  Nginx (`/media` is `internal`). Raw HTML only leaves the system through the
  sanitizing preview API.

## Data model

```
User (custom, email login)
  id, first_name, last_name, email(unique), password(argon2),
  role(admin|member|audience), is_active, is_staff, created_at, updated_at

ApiToken                     # service credential; only the SHA-256 hash is stored
  id, user→User, name, token_hash, prefix, scope(full|read_only),
  expires_at, last_used_at, revoked, created_at

Project
  id, name(unique), slug, description, color, is_archived,
  created_by→User, created_at

ProjectMembership            # the access-control join table
  id, project→Project, user→User           (unique together)

ProjectLink                  # external reference (Figma, Linear, repo, …)
  id, project→Project, label, url, link_type

Category
  id, name(unique), slug, color

Document
  id, title, description, render_mode(sanitized|interactive),
  html_file (original, never served raw), sanitized_html (rendered in preview),
  file_size, category→Category, project→Project, owner→User,
  tags (JSON array), created_at, updated_at

Prompt                       # shared plain-text prompt / instruction
  id, title, description, content, category→Category, project→Project,
  owner→User, tags, created_at, updated_at

StoredFile                   # arbitrary file; stored and downloaded, never rendered
  id, name, description, file, original_filename, size, content_type,
  category→Category, project→Project, owner→User, created_at, updated_at

AuditLog                     # append-only
  id, user→User, action, target_type, target_id,
  ip_address, metadata(JSON), timestamp
```

### Authorization model

- **Admins** implicitly have access to every project.
- **Audience** users are read-only: they can browse the projects they belong
  to, and every unsafe method is denied.
- **Members** see a project (and its documents) only if a `ProjectMembership`
  row links them. This is enforced in two places for every document request:
  1. **Queryset scoping** — non-admin querysets are filtered to
     `project_id IN accessible_project_ids()`, so an unauthorized id returns
     **404** (no existence leak), not 403.
  2. **Object permission** — `DocumentAccessPermission` re-checks project access
     and, for writes, requires admin or ownership.

## Request flow: authentication

```
login ──▶ access (15 min, memory) + refresh (7 days, localStorage)
   │
   ├─ each API call: Authorization: Bearer <access>
   │
   └─ on 401: client calls /auth/refresh with the stored refresh token
              → backend rotates it (old one blacklisted) → new access
              → original request retried once
```

Access tokens are kept in memory (Zustand), never persisted, to limit the blast
radius of XSS. The refresh token is rotated on every use and the previous one is
blacklisted, so a leaked refresh token has a short useful life.

## Request flow: HTML preview (the core feature)

```
upload (multipart) ──▶ validate (ext, size)
                   ──▶ sanitize_html(): strip <script>/handlers/js: URLs,
                       allowlist tags+attrs, sanitize inline CSS
                   ──▶ store original file + sanitized_html
                   ──▶ audit: upload_document

preview ── GET /api/documents/:id/preview (bearer) ──▶ sanitized HTML
                       + Content-Security-Policy: default-src 'none'; …
       client fetches it as text, injects via <iframe sandbox srcdoc=…>
       (sandbox WITHOUT allow-scripts/allow-same-origin → opaque origin, no JS)
```

Three independent layers protect the platform from a malicious upload:
1. **Server sanitization** removes active content before storage.
2. **CSP** on the preview response forbids scripts and external loads.
3. **Iframe sandbox** runs the markup in an opaque origin with scripting
   disabled, so even a sanitizer bypass cannot touch the app, its cookies, or
   its tokens.

## Frontend structure

- `app/(app)/*` is an authenticated route group wrapped by `AuthGuard` + the
  sidebar/topbar shell. `app/login` is the only unauthenticated page.
- `lib/api.ts` is a single Axios instance with request (token attach) and
  response (transparent refresh) interceptors shared by all queries.
- `lib/hooks.ts` holds typed TanStack Query hooks — one per API resource —
  keeping components declarative and cache invalidation centralized.
- Admin-only pages additionally wrap their content in `AuthGuard adminOnly`; the
  API is still the real boundary (returns 403/404 regardless of the UI).
