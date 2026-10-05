# Dockia — project proposal

**Open-source version control and a shared home for the documents AI helps
teams create.**

| | |
|---|---|
| Status | Working software, pre-1.0 |
| License | MIT |
| Stack | Django · PostgreSQL · Redis · Next.js · Docker |
| Author | Matthew Jafari ([@jafariai](https://github.com/jafariai)) |

---

## 1. Summary

Writing a good-looking document used to be the expensive part. It no longer is.
With an AI assistant, anyone on a team can turn a rough idea into a polished,
visual HTML document — a design spec with diagrams, a research summary with
charts, an interactive explainer — in a few minutes.

The cost has moved. The hard part now is everything *after* the document
exists: where it lives, who can see it, which copy is current, what changed
since last week, and whether it is safe to open.

Dockia is an open-source, self-hosted platform that answers those questions. It
already gives teams a secure, organized, access-controlled home for generated
HTML documents, with an MCP server so assistants can publish directly. This
proposal describes what exists, and the plan to grow it into full version
control for documents — history, diff, restore, and review — built in the open.

---

## 2. The problem

**Documents are now abundant, and nothing is built to hold them.**

A team that works with AI tools produces HTML documents at a rate no earlier
workflow anticipated. In practice those files end up:

- **Scattered.** In chat threads, download folders, and email attachments. The
  document exists; nobody can find it.
- **Unversioned.** `spec-final.html`, `spec-final-v2.html`, `spec-final-v2-fixed.html`.
  There is no record of what changed, who changed it, or why.
- **Unsafe to share.** An HTML file is a program. Opening one from a teammate —
  or from a model — on a trusted origin means running whatever script it
  contains.
- **Unowned.** No permissions, no audit trail, no way to say "this project's
  documents are visible to these people."

The existing tools each miss in a different way:

| Tool | Why it does not fit |
|---|---|
| Wikis (Confluence, Notion) | They own the format. A rich generated HTML document has to be flattened into their block model, losing layout, styling, and interactivity. |
| Git | Excellent versioning, but no rendered preview, no access model non-engineers can use, and a diff of generated HTML is unreadable. |
| File drives | Store the file, but will not render it safely, and versioning is opaque. |
| Static hosting | Renders the file, but with no isolation between documents, no per-project access control, and no history. |

Teams need something that treats **the HTML document itself** as the unit of
work: stored as-is, rendered faithfully, isolated safely, organized by project,
and tracked over time.

---

## 3. What Dockia is

A self-hosted web application where a team uploads, previews, organizes, and
manages HTML documents — and where assistants can publish them directly.

### What works today

**Safe rendering of untrusted HTML.** This is the core of the project and the
part that is hardest to get right. Every document passes through three
independent layers:

1. server-side sanitization against a tag, attribute, and CSS allowlist;
2. a strict Content-Security-Policy on the preview;
3. a sandboxed iframe with an opaque origin, so even a sanitizer bypass cannot
   reach the application, its cookies, or its tokens.

Documents that genuinely need their own JavaScript can run in an admin-gated
*interactive* mode: scripts execute, but in an isolated origin with every
network egress channel closed.

**Team organization and access control.** Projects with explicit membership,
categories, tags, search, and filters. Three roles — admin, member, and
read-only audience. Authorization is enforced server-side on every request;
a document outside your projects returns 404, not 403.

**An AI-native publishing path.** A bundled Model Context Protocol server
exposes the document API as tools. Any MCP-capable assistant can list, read,
create, and edit documents using a revocable, scopeable API token — so the
document goes from conversation to shared library without a manual upload.

**The surrounding essentials.** An in-app HTML editor with live preview, a
shared prompt library, per-project file storage, realtime notifications over
websockets and web push, an append-only audit log with export, an installable
mobile-friendly UI, and a one-command Docker deployment with backup and restore
scripts.

### What it is not yet

Dockia currently keeps **one current revision** of each document. Edits replace
the previous content; the audit log records *that* a change happened, not *what*
changed. Closing that gap is the main goal of this proposal.

---

## 4. Where it is going

The roadmap is ordered by one question: *what does a team need in order to
trust this as the system of record for its documents?*

### Milestone 1 — Version history

- Every save creates an immutable revision: content, author, timestamp, and an
  optional message.
- A revision timeline on each document.
- Restore any earlier revision as the new current one.
- Soft delete, with a trash that can be emptied or restored.
- The MCP server gains revision-aware tools, so an assistant can say what it
  changed and why.

### Milestone 2 — Diff

- **Visual diff**: two revisions rendered side by side, with changed regions
  highlighted — the diff a non-engineer actually wants.
- **Source diff**: a structural HTML diff rather than a line diff, so
  reformatted-but-identical markup does not drown the real change.

### Milestone 3 — Review

- Comments anchored to a region of a document.
- Draft revisions and an approval step before a revision becomes current.
- Notifications that link to "what changed" rather than "something changed."

### Milestone 4 — Reach

- Asset bundles: images and stylesheets uploaded alongside the HTML.
- Full-text search across document content.
- SSO / OIDC and optional two-factor authentication.
- Share links for a single document, with expiry.
- Webhooks and a CLI, so CI pipelines can publish generated documentation.

---

## 5. Why open source

**Trust.** Dockia holds private documents and executes untrusted markup. Both
are claims a team should be able to verify. The sanitizer, the CSP, and the
sandbox configuration are a few hundred lines that anyone can read, test, and
attack — and the project is better for every bypass that gets reported.

**Self-hosting is the point.** The documents teams generate with AI are often
the most sensitive ones they have: unreleased designs, internal analysis,
strategy. A tool for them should run on the team's own infrastructure with no
external dependency. That is only credible when the source is open.

**The problem is shared.** Every team adopting AI tools runs into the same pile
of orphaned HTML files. A common, well-reviewed solution is more valuable than
a hundred private scripts.

**No lock-in.** Documents are stored as the original HTML files. Leaving Dockia
means copying a folder.

---

## 6. Design principles

1. **The document is the source of truth.** Dockia stores the original file and
   never converts it into a proprietary format.
2. **Never trust the upload.** Rendering is isolated by default; capability is
   added deliberately and visibly, never assumed.
3. **Authorization lives on the server.** The UI hides what you cannot do; the
   API refuses it regardless.
4. **One command to run.** A single compose file, a single published port,
   sensible defaults, and documented backups.
5. **Assistants are first-class users.** Anything a person can do through the
   UI, an assistant should be able to do through a scoped token.

---

## 7. Who it is for

- **Product and engineering teams** that generate specs, design docs, and
  architecture write-ups with AI and need them findable six months later.
- **Agencies and consultancies** producing client-facing reports, who need
  per-client isolation and a read-only role for the client.
- **Research and data teams** sharing interactive analyses that do not survive
  being pasted into a wiki.
- **Anyone building agents** that need a durable, permissioned place to publish
  their output.

---

## 8. How to get involved

The project is early, which means contributions shape it.

| If you are interested in… | A good place to start |
|---|---|
| Backend / data modelling | The revision model for Milestone 1 |
| Algorithms | Structural HTML diffing for Milestone 2 |
| Frontend | The revision timeline and side-by-side visual diff |
| Security | Auditing the sanitizer, CSP, and sandbox — see [SECURITY.md](../SECURITY.md) |
| Integrations | Extending the MCP server; a publishing CLI |
| Docs and design | Screenshots, a demo, onboarding docs |

Read [CONTRIBUTING.md](../CONTRIBUTING.md) for the development setup, and open
an issue to discuss anything larger than a bug fix before you start.

---

## 9. What success looks like

- Teams run Dockia as their document system of record.
- Version history, diff, and restore ship and are used daily.
- The rendering pipeline has been reviewed by people outside the project.
- A steady group of contributors, with more than one person able to review and
  merge.
- Assistants publish to Dockia as routinely as people do.
