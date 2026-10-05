# Deploying Dockia

Dockia ships as a self-contained Docker stack: Postgres, Redis, the Django
backend, a websocket process, the Next.js frontend, and nginx. It publishes
**exactly one host port** — everything else stays on internal Docker networks —
so it can share a server with other services without conflicts.

The stack is namespaced (`name: dockia` → `dockia_*` containers, volumes, and
networks), its database is not published to the host, and only nginx takes a
host port (`HTTPS_PORT`, default **8443**).

---

## Option A — Internal, IP-restricted (self-signed HTTPS)

For a team that wants Dockia reachable only from known IPs at
`https://<SERVER_IP>:<PORT>`, with TLS from a self-signed certificate.

1. **Get the code onto the server**, e.g. into `/opt/dockia`, and `cd` in.

2. **Generate the TLS certificate** for the server's IP or hostname. nginx will
   not start without it:
   ```bash
   DOCKIA_HOST=<SERVER_IP> ./scripts/gen-selfsigned-cert.sh
   ```
   This writes `nginx/certs/dockia.{crt,key}` with the host in the SAN, valid
   for about ten years.

3. **Configure the environment:**
   ```bash
   cp .env.example .env
   ```
   Then edit `.env`:
   - `DJANGO_SECRET_KEY`, `POSTGRES_PASSWORD`, `ADMIN_PASSWORD` — set real values
   - `DJANGO_ALLOWED_HOSTS=<SERVER_IP>`
   - `FRONTEND_ORIGIN=https://<SERVER_IP>:8443` — the exact origin the browser
     uses, including the port
   - `HTTPS_PORT` — change it if 8443 is taken, and keep it consistent everywhere

4. **Start the stack.** This builds the images, runs migrations, and seeds the
   admin user:
   ```bash
   docker compose up -d --build
   ```

5. **Lock the port to your allowlist.** Docker bypasses `ufw` for published
   ports, so the rules go in the `DOCKER-USER` chain:
   ```bash
   sudo DOCKIA_PORT=8443 DOCKIA_ALLOW_IPS="203.0.113.10 198.51.100.0/24" \
     ./scripts/restrict-port.sh
   ```
   After this, `tcp/8443` is reachable only from those addresses. Rules for
   other ports are left alone, and the script is safe to re-run.

6. **Open** `https://<SERVER_IP>:8443` from an allowed IP. The browser warns
   about the self-signed certificate — proceed once. Sign in with `ADMIN_EMAIL`
   / `ADMIN_PASSWORD` from `.env`, then **change the admin password**.

### Notes for this mode

- To remove the browser warning, import `nginx/certs/dockia.crt` into each
  teammate's OS or browser trust store.
- Because it is real TLS to the browser, secure cookies and the Django admin
  work normally.
- **Persist the firewall rules** across reboots with `iptables-persistent`
  (`netfilter-persistent save`), or a systemd unit ordered
  `After=docker.service` that re-runs `restrict-port.sh`.
- Do not set `SECURE_HSTS_SECONDS` with a self-signed certificate — pinning
  HTTPS while the certificate is untrusted can lock clients out.

---

## Option B — Public, with a domain and trusted HTTPS

Put a reverse proxy with a CA-issued certificate (Caddy with automatic HTTPS, or
host nginx + certbot) in front of Dockia's `HTTPS_PORT`. Set
`DJANGO_ALLOWED_HOSTS=yourdomain` and `FRONTEND_ORIGIN=https://yourdomain`. Once
the certificate is trusted you can enable `SECURE_HSTS_SECONDS=31536000` in
`.env` and run `docker compose up -d` again.

If more than one proxy sits in front of the app, set `TRUSTED_PROXY_DEPTH` to
the number of hops so rate limiting and audit logs see the real client IP.

---

## Continuous deployment

`.github/workflows/ci-cd.yml` runs on GitHub Actions:

- **Every push and pull request to `main`** → backend checks (Django `check`,
  missing-migration check, API smoke test) and frontend `typecheck` + `build`.
- **Push to `main`, after the checks pass** → SSH into the server and run
  `scripts/deploy.sh` (`git pull --ff-only` → `docker compose up -d --build` →
  restart nginx). Migrations and static collection run when the backend
  container starts.

The deploy job is skipped automatically when the deploy secrets are not set, so
forks run the checks without needing a server.

### One-time setup

**1. Make the server a git checkout with a read-only deploy key:**
```bash
ssh-keygen -t ed25519 -f ~/.ssh/dockia_deploy -N "" -C "dockia-deploy"
cat ~/.ssh/dockia_deploy.pub        # add to GitHub: repo → Settings → Deploy keys (read-only)
cat >> ~/.ssh/config <<'EOF'
Host github-dockia
  HostName github.com
  User git
  IdentityFile ~/.ssh/dockia_deploy
EOF
git clone github-dockia:<owner>/<repo>.git /opt/dockia
```
Then follow steps 2–5 of Option A.

**2. Create a separate key for the Actions runner → server:**
```bash
ssh-keygen -t ed25519 -f dockia_ci -N "" -C "dockia-ci"
# append dockia_ci.pub to the deploy user's ~/.ssh/authorized_keys on the server
```

**3. Add the secrets** under GitHub → repo → Settings → Secrets and variables →
Actions:

| Secret | Value |
|--------|-------|
| `DEPLOY_SSH_HOST` | the server's IP or hostname |
| `DEPLOY_SSH_USER` | SSH user (ideally a dedicated `deploy` user) |
| `DEPLOY_SSH_KEY`  | the **private** key `dockia_ci` (full contents) |
| `DEPLOY_SSH_PORT` | `22` (optional) |
| `DEPLOY_PATH`     | `/opt/dockia` (optional) |

### Day to day

- **Push to `main`** → checks run → on green, the server pulls and rebuilds.
- **Manual run:** GitHub → Actions → *CI / Deploy* → **Run workflow**.
- **By hand on the server:** `bash scripts/deploy.sh`.

> Hardening: restrict the CI key to the deploy command with `command="…"` in
> `authorized_keys`, or use a self-hosted runner on the server so no inbound SSH
> is needed at all.

---

## Backups

Set this up before real data goes in. The script dumps the database and archives
uploaded media into `./backups/`:

```bash
./scripts/backup.sh
```

Nightly via cron:

```cron
0 3 * * *  cd /opt/dockia && ./scripts/backup.sh >> /var/log/dockia-backup.log 2>&1
```

Backups older than 14 days are pruned (`BACKUP_RETENTION_DAYS` to change it).
**Copy `backups/` off the server** regularly.

### Restore

Destructive — it overwrites the live database and asks you to confirm:

```bash
./scripts/restore.sh backups/db-YYYYMMDD-HHMMSS.sql.gz backups/media-YYYYMMDD-HHMMSS.tar.gz
```

---

## Housekeeping

- Uploads have **no size cap** by default, so a single large upload can fill the
  disk. Watch free space, or set `DOCUMENT_MAX_BYTES` in
  `backend/config/settings.py` and `client_max_body_size` in `nginx/nginx.conf`.
- Keep `.env`, `nginx/certs/`, and `backups/` out of git — they are already
  ignored.
