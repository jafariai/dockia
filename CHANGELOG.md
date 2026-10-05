# Changelog

Notable changes to Dockia are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.1.0] — Initial public release

### Added

- HTML document upload with server-side sanitization and sandboxed preview
- Interactive render mode for script-driven documents (admin-gated, isolated
  origin, no network egress)
- In-app HTML editor with live preview
- Projects with per-project membership, colors, archiving, and external links
- Categories, tags, search, and filters
- Shared prompt library
- Per-project file storage with signed, short-lived download links
- Roles: admin, member, and read-only audience
- JWT authentication with rotating refresh tokens and per-account lockout
- API tokens with read-only scope and optional expiry
- MCP server exposing the document API as tools
- Realtime notifications over websockets, plus web push
- Append-only audit log with CSV export
- Installable PWA with light and dark themes
- Docker Compose stack, deploy, backup, and restore scripts
