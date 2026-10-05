"""MCP server for Dockia.

Exposes Dockia's document API as Model Context Protocol tools, so any MCP
client (an editor, a desktop assistant, an agent) can list, read, create, and
edit HTML documents.

Auth: a service API token minted in Dockia (Settings → API tokens). The
server sends it as `Authorization: Token <token>`; every call runs with that
token owner's permissions and project scoping.

Configure via environment variables:
    DOCKIA_BASE_URL   e.g. https://203.0.113.10:8443/api
                      (default: https://localhost:8443/api)
    DOCKIA_TOKEN      the idp_… service token (required)
    DOCKIA_CA_BUNDLE  path to the server cert (dockia.crt) to TRUST a
                      self-signed HTTPS endpoint — the secure option.
    DOCKIA_INSECURE   set to 1 to skip TLS verification entirely (only for a
                      self-signed endpoint you control; less secure).

The older INTERNAL_DOCS_* names are still read as a fallback.

Run:  python server.py        (stdio transport)
"""
from __future__ import annotations

import os
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP


def _env(name: str, default: str = "") -> str:
    """Read DOCKIA_<name>, falling back to the legacy INTERNAL_DOCS_<name>."""
    return os.environ.get(f"DOCKIA_{name}") or os.environ.get(
        f"INTERNAL_DOCS_{name}", default
    )


BASE_URL = _env("BASE_URL", "https://localhost:8443/api").rstrip("/")
TOKEN = _env("TOKEN")


def _tls_verify():
    """httpx `verify`: a CA bundle path (trust a self-signed cert), False
    (skip verification), or True (default — trusted/public CAs)."""
    ca = _env("CA_BUNDLE")
    if ca:
        return ca
    if _env("INSECURE").lower() in ("1", "true", "yes"):
        return False
    return True


mcp = FastMCP("dockia")

# One reused client so calls share a keep-alive connection pool instead of
# opening a fresh TCP/TLS connection per tool invocation.
_client_singleton: httpx.Client | None = None


def _client() -> httpx.Client:
    global _client_singleton
    if not TOKEN:
        raise RuntimeError(
            "DOCKIA_TOKEN is not set. Mint one in Dockia under "
            "Settings → API tokens and set it in the MCP server environment."
        )
    if _client_singleton is None:
        _client_singleton = httpx.Client(
            base_url=BASE_URL,
            headers={"Authorization": f"Token {TOKEN}"},
            timeout=30.0,
            verify=_tls_verify(),
        )
    return _client_singleton


def _raise_for_status(resp: httpx.Response) -> None:
    """Surface API validation errors as readable text instead of a bare 4xx."""
    if resp.is_success:
        return
    try:
        detail = resp.json()
    except Exception:
        detail = resp.text
    raise RuntimeError(f"API {resp.status_code}: {detail}")


# --- Read tools ------------------------------------------------------------
@mcp.tool()
def list_documents(search: str = "", project: int | None = None,
                   category: int | None = None, page: int = 1) -> dict[str, Any]:
    """List documents (paginated). Optionally filter by free-text search,
    project id, or category id. Returns id, title, project, category, render_mode."""
    params: dict[str, Any] = {"page": page}
    if search:
        params["search"] = search
    if project is not None:
        params["project"] = project
    if category is not None:
        params["category"] = category
    r = _client().get("/documents", params=params)
    _raise_for_status(r)
    data = r.json()
    return {
        "count": data.get("count"),
        "results": [
            {
                "id": d["id"], "title": d["title"], "project": d["project_name"],
                "category": d["category_name"], "render_mode": d["render_mode"],
                "updated_at": d["updated_at"],
            }
            for d in data.get("results", [])
        ],
    }


@mcp.tool()
def get_document(document_id: int) -> dict[str, Any]:
    """Get a document's metadata (title, description, project, category, tags,
    render mode, size). Use get_document_html for the actual HTML source."""
    r = _client().get(f"/documents/{document_id}")
    _raise_for_status(r)
    return r.json()


@mcp.tool()
def get_document_html(document_id: int, max_chars: int = 100000,
                      offset: int = 0) -> dict[str, Any]:
    """Return the editable HTML source of a document (original markup, before
    server-side sanitization).

    Documents can be very large, so the source is truncated to `max_chars`
    (default 100k) to fit the context window. Page through big docs with
    `offset`, or pass `max_chars=0` to get the entire source (use with care —
    multi-MB documents may exceed the context limit).

    Returns: html (the slice), total_chars, returned_chars, offset, truncated.
    """
    # Slice server-side so we transfer only the requested window, not the whole
    # (possibly multi-MB) document on every page.
    params: dict[str, Any] = {"offset": offset}
    if max_chars:
        params["max_chars"] = max_chars
    r = _client().get(f"/documents/{document_id}/raw", params=params)
    _raise_for_status(r)
    data = r.json()
    return {
        "document_id": document_id,
        "total_chars": data.get("total_chars"),
        "offset": data.get("offset", offset),
        "returned_chars": data.get("returned_chars"),
        "truncated": data.get("truncated"),
        "html": data.get("html", ""),
    }


@mcp.tool()
def list_projects() -> list[dict[str, Any]]:
    """List projects you can access (id + name). Needed to create a document."""
    r = _client().get("/projects", params={"page_size": 100})
    _raise_for_status(r)
    return [{"id": p["id"], "name": p["name"], "is_archived": p["is_archived"]}
            for p in r.json().get("results", [])]


@mcp.tool()
def list_categories() -> list[dict[str, Any]]:
    """List categories (id + name). Needed to create a document."""
    r = _client().get("/categories", params={"page_size": 100})
    _raise_for_status(r)
    return [{"id": c_["id"], "name": c_["name"]} for c_ in r.json().get("results", [])]


# --- Write tools -----------------------------------------------------------
@mcp.tool()
def create_document(title: str, html: str, project_id: int, category_id: int,
                    description: str = "", render_mode: str = "sanitized",
                    tags: list[str] | None = None) -> dict[str, Any]:
    """Create a new HTML document from raw HTML.

    render_mode: 'sanitized' (scripts stripped, safest) or 'interactive'
    (scripts run inside an isolated sandbox — use for JS-driven docs).
    Returns the created document's metadata including its new id.
    """
    payload = {
        "title": title, "description": description, "project": project_id,
        "category": category_id, "render_mode": render_mode,
        "tags": tags or [], "html_content": html,
    }
    r = _client().post("/documents", json=payload)
    _raise_for_status(r)
    return r.json()


@mcp.tool()
def edit_document(document_id: int, html: str | None = None,
                  title: str | None = None, description: str | None = None,
                  render_mode: str | None = None,
                  tags: list[str] | None = None) -> dict[str, Any]:
    """Edit an existing document. Any provided field is updated; omit the rest.

    Pass `html` to replace the document's HTML source (it is re-sanitized
    server-side). Returns the updated metadata.
    """
    payload: dict[str, Any] = {}
    if html is not None:
        payload["html_content"] = html
    if title is not None:
        payload["title"] = title
    if description is not None:
        payload["description"] = description
    if render_mode is not None:
        payload["render_mode"] = render_mode
    if tags is not None:
        payload["tags"] = tags
    if not payload:
        raise RuntimeError("Nothing to update — provide at least one field.")
    r = _client().patch(f"/documents/{document_id}", json=payload)
    _raise_for_status(r)
    return r.json()


# --- File-upload tools (sidestep the inline-string limit) -------------------
@mcp.tool()
def create_document_from_file(file_path: str, title: str, project_id: int,
                              category_id: int, description: str = "",
                              render_mode: str = "sanitized",
                              tags: list[str] | None = None) -> dict[str, Any]:
    """Create a document by UPLOADING an .html/.htm file from disk (multipart),
    instead of passing the HTML inline. Use this for large documents that would
    exceed create_document's inline-argument limit.

    `file_path` must be readable by THIS MCP server process (the machine the
    server runs on). The HTML is streamed straight to Dockia and never loaded
    as a tool argument.
    """
    if not os.path.isfile(file_path):
        raise RuntimeError(f"File not found: {file_path}")
    data = {
        "title": title, "description": description,
        "project": project_id, "category": category_id, "render_mode": render_mode,
    }
    with open(file_path, "rb") as fh:
        files = {"html_file": (os.path.basename(file_path), fh, "text/html")}
        r = _client().post("/documents", data=data, files=files)
    _raise_for_status(r)
    doc = r.json()
    # tags are a JSON list — set them in a follow-up call (multipart can't carry them).
    if tags:
        r2 = _client().patch(f"/documents/{doc['id']}", json={"tags": tags})
        _raise_for_status(r2)
        doc = r2.json()
    return doc


@mcp.tool()
def update_document_from_file(document_id: int, file_path: str) -> dict[str, Any]:
    """Replace an existing document's HTML by uploading an .html/.htm file from
    disk (multipart). For large edits that exceed edit_document's inline limit."""
    if not os.path.isfile(file_path):
        raise RuntimeError(f"File not found: {file_path}")
    with open(file_path, "rb") as fh:
        files = {"html_file": (os.path.basename(file_path), fh, "text/html")}
        r = _client().patch(f"/documents/{document_id}", files=files)
    _raise_for_status(r)
    return r.json()


@mcp.tool()
def upload_file(file_path: str, project_id: int, category_id: int,
                name: str = "", description: str = "") -> dict[str, Any]:
    """Upload an ARBITRARY file (any type/size) into the Files module for storage
    (backups / assets). `file_path` must be readable by this MCP server. Requires
    an admin token. Returns the stored file's metadata."""
    if not os.path.isfile(file_path):
        raise RuntimeError(f"File not found: {file_path}")
    data: dict[str, Any] = {
        "project": project_id, "category": category_id, "description": description,
    }
    if name:
        data["name"] = name
    with open(file_path, "rb") as fh:
        files = {"file": (os.path.basename(file_path), fh)}
        r = _client().post("/files", data=data, files=files)
    _raise_for_status(r)
    return r.json()


if __name__ == "__main__":
    mcp.run()
