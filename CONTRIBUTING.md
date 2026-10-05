# Contributing to Dockia

Thanks for taking the time to contribute. Bug reports, feature ideas, docs
fixes, and code are all welcome.

## Ways to help

- **Report a bug** — open an issue with steps to reproduce, what you expected,
  and what happened. Screenshots and logs help a lot.
- **Suggest a feature** — open an issue describing the problem you are trying to
  solve before describing the solution. The [roadmap](README.md#roadmap) lists
  what is already planned.
- **Send a pull request** — small, focused PRs get reviewed fastest. For
  anything larger than a bug fix, open an issue first so we can agree on the
  approach before you invest the time.
- **Improve the docs** — if something in the setup tripped you up, it will trip
  up the next person too.

Issues labelled `good first issue` are a good place to start.

**Security issues are the exception:** please do not open a public issue.
Follow [SECURITY.md](SECURITY.md) instead.

## Development setup

You need Python 3.12, Node 20, and (optionally) Docker.

```bash
git clone https://github.com/<you>/dockia.git
cd dockia

# Backend — SQLite settings, no Postgres or Redis required
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
export DJANGO_SETTINGS_MODULE=config.settings_sqlite DJANGO_SECRET_KEY=dev
python manage.py migrate
python manage.py seed_initial     # admin@team.internal / ChangeMe123!
python manage.py runserver        # http://localhost:8000

# Frontend — in a second shell
cd frontend
npm install
npm run dev                       # http://localhost:3000
```

The Next.js dev server proxies `/api` to the backend on `:8000`, so the browser
only ever talks to one origin. To run the full production-like stack instead,
follow the Docker quick start in the [README](README.md#quick-start).

## Before you open a pull request

Run the same checks CI runs:

```bash
# Backend
cd backend
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py migrate && python smoke_test.py

# Frontend
cd frontend
npm run typecheck
npm run build
```

Then:

1. Branch from `main` (`fix/…`, `feat/…`, `docs/…`).
2. Keep the change focused; unrelated refactors belong in their own PR.
3. If you change a model, commit the migration with it.
4. If you change behaviour, add or update a check in `backend/smoke_test.py`.
5. Update the docs when you change setup steps, environment variables, or the API.
6. Describe *why* in the PR, not just *what* — and include a screenshot for UI changes.

## Code style

**Backend (Python / Django)**

- Follow PEP 8; keep lines under ~100 characters.
- Authorization lives on the server. Scope querysets to the caller's projects
  and add an object-level permission; never rely on the UI hiding something.
- Anything that mutates state should write an audit entry via
  `apps.audit.services.log_action`.
- Comments explain *why* a non-obvious decision was made, not what the next
  line does.

**Frontend (TypeScript / React)**

- Server state goes through the typed TanStack Query hooks in `lib/hooks.ts`;
  local UI state stays in the component.
- Reuse the primitives in `components/ui/` before adding a new one.
- Keep it working on mobile and in both themes.

**Document rendering**

Changes to `backend/apps/documents/sanitization.py`, the preview CSP, or the
iframe sandbox attributes are security-sensitive. Please explain the threat
model in the PR and add a smoke-test case covering it. Read
[docs/SECURITY.md](docs/SECURITY.md) first.

## Commit messages

Short imperative subject line, optional body explaining the reasoning:

```
Add revision history to documents

Store each save as an immutable DocumentRevision instead of overwriting
html_file, so earlier versions can be diffed and restored.
```

## License

By contributing, you agree that your contributions are licensed under the
project's [MIT License](LICENSE).
