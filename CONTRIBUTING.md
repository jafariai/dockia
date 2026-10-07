# Contributing to Dockia

First off, thanks for considering contributing to Dockia! 🎉 It's people like you that make Dockia such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### 🐛 Reporting Bugs

Before creating bug reports, check the issue list as you might find out that you don't need to create one. When you are creating a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps which reproduce the problem**
- **Provide specific examples to demonstrate the steps**
- **Describe the behavior you observed after following the steps**
- **Explain which behavior you expected to see instead and why**
- **Include screenshots and animated GIFs if possible**
- **Include your environment details** (OS, Docker version, etc.)

### 💡 Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- **Use a clear and descriptive title**
- **Provide a step-by-step description of the suggested enhancement**
- **Provide specific examples to demonstrate the steps**
- **Describe the current behavior and expected behavior**
- **Explain why this enhancement would be useful**

### 🔧 Pull Requests

- Follow the [Development](#development) section below
- Fill in the pull request template
- Follow the TypeScript/Python style guides
- Document new code with docstrings and comments
- End all files with a newline
- Avoid platform-dependent code

**For large changes:** Open an issue first to discuss the approach.

## Development

### Prerequisites

- Docker & Docker Compose
- Python 3.10+
- Node.js 18+
- Git

### Setting Up Your Development Environment

1. Fork and clone the repository:
```bash
git clone https://github.com/YOUR-USERNAME/dockia.git
cd dockia
```

2. Create a branch for your work:
```bash
git checkout -b feature/your-feature-name
```

3. Backend setup:
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
export DJANGO_SETTINGS_MODULE=config.settings_sqlite DJANGO_SECRET_KEY=dev
python manage.py migrate
python manage.py seed_initial
python manage.py runserver
```

4. Frontend setup (new terminal):
```bash
cd frontend
npm install
npm run dev  # Proxies /api to :8000
```

5. Visit http://localhost:3000 and log in with `admin@example.com` / `admin`

### Running Tests

Before pushing, run the full test suite:

```bash
# Backend tests
cd backend
export DJANGO_SETTINGS_MODULE=config.settings_sqlite DJANGO_SECRET_KEY=test
python manage.py migrate
python smoke_test.py

# Frontend checks
cd frontend
npm run typecheck
npm run build
```

### Code Style

**Python:**
- Follow [PEP 8](https://pep8.org/)
- Use `black` for formatting (configured in `pyproject.toml`)
- Use meaningful variable names
- Add docstrings to functions and classes

**TypeScript/JavaScript:**
- Use TypeScript for all new code (no `.js` files)
- Follow the Prettier config in `.prettierrc`
- Use meaningful component and variable names
- Add JSDoc comments for complex logic
- Keep components focused and testable

### Git Commits

- Use clear, descriptive commit messages
- Start with a verb: "Add", "Fix", "Update", "Refactor"
- Reference issues when relevant: "Fixes #123"
- Keep commits atomic—one logical change per commit

Good: `"Add document version history feature (partial)"`  
Bad: `"Fix stuff"` or `"WIP"`

### Documentation

- Document new features in the README
- Update API docs if you change endpoints
- Add comments for complex logic
- Include examples for new features

### Security

**Found a security vulnerability?**

🔒 **Do NOT open a public issue.** Please use **Security → Report a vulnerability** on the repository to report privately. We take security seriously and will respond promptly.

When reporting:
- Describe the vulnerability clearly
- Include proof-of-concept if possible
- Suggest a fix if you have one

---

## Style Guides

### Commit Messages

```
Short (50 chars or less) summary

Longer explanation if necessary. Wrap at 72 characters.

- Bullet points are okay, too
- Use imperative mood ("add", not "added" or "adds")
- Reference issues and pull requests when relevant

Fixes #123
```

### Documentation

- Use Markdown
- Keep line length under 80 characters
- Use code blocks for examples
- Link to relevant sections

### Python Code

```python
def get_document_by_id(doc_id: int) -> Document:
    """
    Retrieve a document by its ID.
    
    Args:
        doc_id: The document's unique identifier
        
    Returns:
        The Document object
        
    Raises:
        Document.DoesNotExist: If no document found
    """
    return Document.objects.get(id=doc_id)
```

### TypeScript Code

```typescript
/**
 * Format a date for display
 * @param date - The date to format
 * @param locale - The locale for formatting (default: 'en-US')
 * @returns Formatted date string
 */
export function formatDate(date: Date, locale: string = 'en-US'): string {
  return date.toLocaleDateString(locale);
}
```

---

## Common Tasks

### Adding a New API Endpoint

1. Create a serializer in `backend/apps/documents/serializers.py`
2. Add a viewset method in `backend/apps/documents/views.py`
3. Update `backend/apps/documents/urls.py` with the route
4. Add tests in `backend/smoke_test.py`
5. Document in `docs/API.md`

### Adding a New Feature to the Frontend

1. Create components in `frontend/components/`
2. Add pages in `frontend/app/` (if needed)
3. Update types in `frontend/lib/types.ts`
4. Use TanStack Query for API calls
5. Test in the dev server

### Running Docker Locally

```bash
# Build and start all services
docker compose up -d --build

# View logs
docker compose logs -f

# Stop everything
docker compose down
```

---

## Additional Notes

### Local Testing with Docker

```bash
# Full stack test (if you need it)
cp .env.example .env
# Edit .env with test values
./scripts/gen-selfsigned-cert.sh localhost
docker compose up -d --build
# Test at https://localhost:8443
```

### Debugging

- **Backend:** Add `print()` or use `pdb`
- **Frontend:** Use Chrome DevTools
- **Database:** Use `psql` or Django shell (`python manage.py shell`)
- **Redis:** Use `redis-cli` to inspect

### Performance Tips

- Use `.select_related()` and `.prefetch_related()` in Django queries
- Memoize expensive computations in React components
- Check database query count with Django Debug Toolbar

---

## Questions?

- 📖 Check the [README](README.md)
- 💬 Open a [GitHub Discussion](https://github.com/jafariai/dockia/discussions)
- 🐛 Search existing [issues](https://github.com/jafariai/dockia/issues)
- 📧 Reach out to [Matthew Jafari](https://github.com/jafariai)

Thanks for contributing! 🚀
