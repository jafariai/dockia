# Security Policy

Dockia renders user-supplied HTML and guards private documents, so security
reports are taken seriously and are very welcome.

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Report it privately through GitHub: open the repository's **Security** tab and
choose **Report a vulnerability**. That creates a private advisory visible only
to you and the maintainers.

Please include:

- what is affected (endpoint, component, or file)
- steps to reproduce, or a proof of concept
- the impact you believe it has
- the version or commit you tested

You can expect an acknowledgement within a few days. Once a fix is ready it is
released, and you are credited in the advisory unless you would rather not be.

## Scope

Reports in these areas are especially useful:

- Sanitizer bypasses — getting script, event handlers, or active content
  through `backend/apps/documents/sanitization.py`
- Escaping the preview sandbox or its Content-Security-Policy, in either
  `sanitized` or `interactive` render mode
- Authorization gaps — reading or changing a document, file, prompt, or project
  the caller should not have access to
- Authentication, token handling, and API-token scope enforcement
- SSRF through web push subscription endpoints

Out of scope: findings that require an already-compromised admin account, the
self-signed certificate warning in the default local setup, and missing
hardening that the deployment guide tells operators to configure themselves.

## Supported versions

Dockia is pre-1.0. Security fixes land on `main`; please run a recent commit.

## More

The security model — the layered defences around HTML preview, the
authorization model, and the deploy-time hardening checklist — is documented in
[docs/SECURITY.md](docs/SECURITY.md).
