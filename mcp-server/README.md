# Dockia MCP server

A small [Model Context Protocol](https://modelcontextprotocol.io) server that
exposes Dockia's document API as tools. Point any MCP client at it and the
assistant you already use can publish and update documents for you:

> "Create a doc in the *Onboarding* project titled *VPN setup* with these steps…"
> "Open doc 42 and add a troubleshooting section at the end."

## Tools

| Tool | What it does |
|------|--------------|
| `list_documents` | List/search documents (filter by project/category) |
| `get_document` | Fetch a document's metadata |
| `get_document_html` | Fetch the editable HTML source (paged for large docs) |
| `list_projects` / `list_categories` | Look up the ids needed to create a doc |
| `create_document` | Create a new doc from raw HTML |
| `edit_document` | Update HTML / title / tags / render mode |
| `create_document_from_file` | Create a doc by uploading an `.html` file from disk |
| `update_document_from_file` | Replace a doc's HTML from a file on disk |
| `upload_file` | Store an arbitrary file in the Files module (admin token) |

Every call runs with the permissions of the token's owner, project scoping
included. A read-only token can only use the read tools.

## Setup

1. **Mint a token** in the web app: **Settings → API tokens → New token**.
   Copy the `idp_…` value — it is shown once.

2. **Install the dependencies** (Python 3.10+):

   ```bash
   cd mcp-server
   python -m venv .venv
   source .venv/bin/activate      # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Register the server** with your MCP client. Most clients take a JSON entry
   like this:

   ```json
   {
     "mcpServers": {
       "dockia": {
         "command": "/path/to/dockia/mcp-server/.venv/bin/python",
         "args": ["/path/to/dockia/mcp-server/server.py"],
         "env": {
           "DOCKIA_BASE_URL": "https://localhost:8443/api",
           "DOCKIA_TOKEN": "idp_paste_your_token_here",
           "DOCKIA_CA_BUNDLE": "/path/to/dockia/nginx/certs/dockia.crt"
         }
       }
     }
   }
   ```

4. **Restart the client** and ask it to list your Dockia documents to confirm
   the connection.

## Configuration

| Variable | Purpose |
|----------|---------|
| `DOCKIA_BASE_URL` | API root. Docker stack: `https://<host>:8443/api`. Bare Django dev server: `http://localhost:8000/api`. |
| `DOCKIA_TOKEN` | The `idp_…` service token (required). |
| `DOCKIA_CA_BUNDLE` | Path to `nginx/certs/dockia.crt`, to trust a self-signed deployment. |
| `DOCKIA_INSECURE` | `1` skips TLS verification entirely. Only for an endpoint you control. |

## Notes

- Tokens can be scoped read-only, given an expiry, and revoked at any time in
  **Settings → API tokens**.
- `render_mode`: `sanitized` strips scripts (safest); `interactive` runs the
  document's own JavaScript inside an isolated sandbox and is admin-only.
- The file tools read `file_path` on the machine the MCP server runs on, so
  large documents never have to pass through the model's context window.
