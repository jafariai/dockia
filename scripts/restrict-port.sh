#!/usr/bin/env bash
#
# Lock Dockia's published port to an IP allowlist via the DOCKER-USER chain.
# Docker bypasses ufw for published ports, so the allowlist has to live in
# DOCKER-USER. Re-runnable / idempotent.
#
# Usage (as root, on the server):
#     sudo DOCKIA_ALLOW_IPS="203.0.113.10 198.51.100.0/24" ./scripts/restrict-port.sh
#     sudo DOCKIA_PORT=8090 DOCKIA_ALLOW_IPS="203.0.113.10" ./scripts/restrict-port.sh
#
set -euo pipefail

# Host port Dockia's nginx is published on (must match HTTPS_PORT in .env).
PORT="${DOCKIA_PORT:-8443}"

# Space- or comma-separated IPs / CIDR ranges allowed to reach Dockia.
read -r -a ALLOW_IPS <<< "${DOCKIA_ALLOW_IPS//,/ }"

CHAIN="DOCKER-USER"
TAG="dockia"

[[ "${EUID:-$(id -u)}" -eq 0 ]] || { echo "Run as root (sudo)." >&2; exit 1; }
[[ "${#ALLOW_IPS[@]}" -gt 0 ]] || {
  echo "Set DOCKIA_ALLOW_IPS to the IPs allowed to reach Dockia." >&2; exit 1; }
command -v iptables >/dev/null || { echo "iptables not found." >&2; exit 1; }
iptables -nL "$CHAIN" >/dev/null 2>&1 || iptables -N "$CHAIN"

echo "==> Removing any previous '$TAG' rules"
existing="$(iptables -S "$CHAIN" | grep -- "--comment $TAG" || true)"
if [[ -n "$existing" ]]; then
  while IFS= read -r spec; do
    # turn the "-A DOCKER-USER …" line into a "-D DOCKER-USER …" delete
    # shellcheck disable=SC2086
    iptables ${spec/#-A/-D} || true
  done <<< "$existing"
fi

echo "==> Allowing tcp/$PORT only from: ${ALLOW_IPS[*]}"
# Insert DROP first (lands at the top), then each ACCEPT above it, so the final
# order is: ACCEPT(allowed IPs) … then DROP(everyone else). Other stacks'
# rules are untouched — these match only --dport $PORT.
iptables -I "$CHAIN" 1 -p tcp --dport "$PORT" -m comment --comment "$TAG" -j DROP
for ip in "${ALLOW_IPS[@]}"; do
  iptables -I "$CHAIN" 1 -p tcp -s "$ip" --dport "$PORT" \
    -m comment --comment "$TAG" -j ACCEPT
done

echo "==> DOCKER-USER is now:"
iptables -L "$CHAIN" --line-numbers -n
echo
echo "Done — Dockia on tcp/$PORT is reachable only from the IPs above."
echo "Persist across reboot: install iptables-persistent (netfilter-persistent save),"
echo "or run this script from a systemd unit ordered After=docker.service."
