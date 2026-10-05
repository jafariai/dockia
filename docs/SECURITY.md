# Security checklist

This platform is private and security-critical. The table maps each requirement
to where it is implemented.

| Requirement                         | Status | Where / how                                                                 |
| ----------------------------------- | :----: | --------------------------------------------------------------------------- |
| Private app, login on every page    |   ✅   | DRF default `IsAuthenticated`; frontend `AuthGuard`; login is the only public page |
| JWT authentication                  |   ✅   | SimpleJWT, `Authorization: Bearer`; access 15 min, refresh 7 days           |
| Refresh token rotation              |   ✅   | `ROTATE_REFRESH_TOKENS` + `BLACKLIST_AFTER_ROTATION`; logout blacklists      |
| Password hashing                    |   ✅   | Argon2 (primary), strong validators (min length, common-password, numeric)  |
| Rate limiting on login              |   ✅   | DRF `ScopedRateThrottle` 5/min **and** Nginx `limit_req` 5r/m on `/api/auth/login` |
| CSRF protection                     |   ✅   | Django CSRF middleware; `CSRF_TRUSTED_ORIGINS`; JWT in header (not cookie) avoids CSRF on API |
| Secure HTTP headers                 |   ✅   | Nginx: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy; Django security middleware |
| XSS protection                      |   ✅   | Sanitized mode: `bleach` + strict CSP + sandbox (no `allow-scripts`). Interactive mode: admin-only, opaque-origin sandbox + no-egress CSP (see below) |
| HTML sanitization before rendering  |   ✅   | `apps/documents/sanitization.py` — strips scripts/handlers/`javascript:`, allowlists tags/attrs, sanitizes CSS |
| Permission middleware / classes     |   ✅   | `apps/common/permissions.py`, `DocumentAccessPermission`, per-view `IsAdmin` |
| Server-side authorization checks    |   ✅   | Queryset scoping + object-level permission on every resource                |
| No document without authentication  |   ✅   | All document endpoints require a valid token; `/media` is internal-only in Nginx |
| Direct-URL protection               |   ✅   | Unauthorized document ids return **404** via queryset scoping (no leak)     |
| Project-level isolation             |   ✅   | `ProjectMembership`; members never see other projects' documents            |
| Audit logging                       |   ✅   | Append-only `AuditLog` for login/logout/upload/update/delete/user & project ops |
| Transport security                  |   ⚙️   | Terminate TLS at Nginx; enable HSTS + `SECURE_SSL_REDIRECT` (one-line toggles, see README) |

Legend: ✅ implemented · ⚙️ configured, enable at deploy time with TLS.

## Defense-in-depth for the preview system

The single highest-risk feature is rendering user-supplied HTML. Documents have
a `render_mode` that selects the security profile:

**Sanitized mode (default).** Three independent controls each individually
prevent script execution:

1. **Sanitize on ingest** — scripts, event handlers (`onerror`, …),
   `javascript:`/`data:` URLs, iframes/objects/forms and disallowed tags are
   removed before anything is stored.
2. **Content-Security-Policy** — the preview response sets
   `default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data: https:`,
   so no script or external resource of consequence can load.
3. **Sandboxed iframe** — the client renders via `<iframe sandbox srcdoc=…>`
   with neither `allow-scripts` nor `allow-same-origin`, giving the content an
   opaque origin with scripting disabled. It cannot reach the parent DOM,
   cookies, `localStorage`, or the JWT.

**Interactive mode (admin-only).** Some documents must run their own scripts, so
this mode deliberately allows them. It is *not* unconstrained:

1. **Admin gate** — only an admin may put a document into interactive mode or
   modify the content of one (enforced in `DocumentWriteSerializer`); a member
   cannot introduce script-bearing interactive content. Enabling it is audited.
2. **Opaque-origin sandbox** — the client still omits `allow-same-origin`, so the
   frame is a unique opaque origin: even running scripts cannot read the parent
   DOM, cookies, `localStorage`, or the JWT. (`allow-scripts` is the only added
   capability.)
3. **No-egress CSP** — the injected CSP closes every exfiltration channel:
   `script-src` has no host source (no remote scripts), `connect-src 'none'`
   (no fetch/XHR/WebSocket), and `img-src`/`font-src` are `'self' data:` only
   (no beacon GETs). The response is also served `Content-Disposition: attachment`
   so a direct navigation downloads rather than executes it on the app origin.

The API is header-authenticated (`Authorization: Bearer`), so a direct top-level
browser navigation to a preview URL carries no credentials and returns 401 —
preview content only renders inside the sandboxed iframe above.

## Operational hardening (deploy-time)

- [ ] Replace `DJANGO_SECRET_KEY`, `POSTGRES_PASSWORD`, and the bootstrap admin
      password; rotate the admin password after first login.
- [ ] Put TLS in front of Nginx; uncomment HSTS and set `SECURE_SSL_REDIRECT=1`.
- [ ] Set `DJANGO_ALLOWED_HOSTS` and `FRONTEND_ORIGIN` to real hostnames.
- [ ] Keep the DB on the internal network (default) — never publish its port.
- [ ] Back up the `pgdata` and `media` volumes; test restores.
- [ ] Consider virus/secret scanning of uploads and SIEM shipping of audit logs.

## Known trade-offs

- Access tokens live in browser memory (not `httpOnly` cookies) to keep the API
  stateless and CSRF-free; the refresh token in `localStorage` is rotated on
  every use to bound exposure. For a small-team internal tool this is a
  reasonable balance; a cookie-based session can be layered on later if needed.
- The frontend `AuthGuard` is UX only — the API enforces every authorization
  decision server-side.
