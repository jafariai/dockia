#!/usr/bin/env bash
#
# Generate a self-signed TLS certificate for Dockia, valid for the server's IP
# (or a hostname). Run this ON THE SERVER, BEFORE `docker compose up`, so the
# nginx container has a cert to load. Browsers will show a warning until the
# cert is trusted on each client machine — that is expected for self-signed.
#
# Usage:
#     DOCKIA_HOST=203.0.113.10 ./scripts/gen-selfsigned-cert.sh
#   or
#     ./scripts/gen-selfsigned-cert.sh 203.0.113.10
#
set -euo pipefail

HOST="${DOCKIA_HOST:-${1:-}}"
[[ -n "$HOST" ]] || { echo "Usage: DOCKIA_HOST=<server-ip-or-host> $0" >&2; exit 1; }
command -v openssl >/dev/null || { echo "openssl not found." >&2; exit 1; }

CERT_DIR="$(cd "$(dirname "$0")/.." && pwd)/nginx/certs"
mkdir -p "$CERT_DIR"

# Modern browsers ignore CN and require a Subject Alternative Name. Use an IP
# SAN for an address, a DNS SAN for a hostname.
if [[ "$HOST" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  SAN="IP:$HOST"
else
  SAN="DNS:$HOST"
fi

openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
  -keyout "$CERT_DIR/dockia.key" \
  -out    "$CERT_DIR/dockia.crt" \
  -subj   "/CN=$HOST" \
  -addext "subjectAltName=$SAN"

chmod 600 "$CERT_DIR/dockia.key"
chmod 644 "$CERT_DIR/dockia.crt"

echo "==> Wrote:"
echo "    $CERT_DIR/dockia.crt"
echo "    $CERT_DIR/dockia.key   (SAN=$SAN, valid ~10 years)"
echo "    These mount into the nginx container at /etc/nginx/certs/."
