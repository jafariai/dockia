"""Web Push (VAPID) delivery for closed-tab notifications.

Subscriptions AND the VAPID keypair both live in Redis (no DB table / migration,
no secret in the repo, no manual server config). The keypair is generated once
on first use and persisted, so it stays stable across restarts (as long as Redis
persistence is on). Everything is best-effort and a no-op without Redis (local).
"""
import base64
import ipaddress
import json
import logging
import os
import socket
import threading
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse

from django.conf import settings
from django.db import close_old_connections, connection

logger = logging.getLogger(__name__)

VAPID_SUBJECT = os.getenv("VAPID_SUBJECT", "mailto:admin@dockia.local")

# Optional hard allowlist of push-service host suffixes (comma-separated env).
# When set, an endpoint host must match one of these; when unset we fall back to
# the resolved-IP check below (reject anything resolving to a private range).
_ALLOWED_HOST_SUFFIXES = tuple(
    h.strip().lower().lstrip(".")
    for h in os.getenv("PUSH_ENDPOINT_ALLOWED_HOSTS", "").split(",")
    if h.strip()
)


def _ip_is_public(ip_str: str) -> bool:
    """True only for a globally-routable unicast address."""
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return False
    # IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1) must be judged on the mapped v4.
    mapped = getattr(ip, "ipv4_mapped", None)
    if mapped is not None:
        ip = mapped
    return not (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


def is_safe_push_endpoint(endpoint) -> bool:
    """Guard against SSRF: a subscription endpoint is a server-issued POST target.

    Require https and ensure the host does not resolve to a private/loopback/
    link-local/reserved address, so a client cannot point the server at internal
    services (Redis, Postgres, cloud metadata, other stacks on the host). When
    ``PUSH_ENDPOINT_ALLOWED_HOSTS`` is configured we additionally require the host
    to match one of the allowlisted push-service suffixes.
    """
    if not isinstance(endpoint, str) or not endpoint:
        return False
    parsed = urlparse(endpoint)
    if parsed.scheme != "https" or not parsed.hostname:
        return False
    host = parsed.hostname.lower()
    if _ALLOWED_HOST_SUFFIXES and not any(
        host == s or host.endswith("." + s) for s in _ALLOWED_HOST_SUFFIXES
    ):
        return False
    # Resolve every address the host maps to; reject if ANY is non-public
    # (defeats a record that mixes a public and an internal answer).
    try:
        infos = socket.getaddrinfo(host, parsed.port or 443, proto=socket.IPPROTO_TCP)
    except (socket.gaierror, UnicodeError, OSError):
        return False
    addresses = {info[4][0] for info in infos}
    if not addresses:
        return False
    return all(_ip_is_public(addr) for addr in addresses)

# Subscriptions: a Redis hash per user, field=endpoint -> json(subscription), so
# re-subscribing the same browser overwrites rather than piling up duplicates.
_SUBS_KEY = "push:subs:{uid}"
# Safety cap so a user with many devices/reinstalls can't grow the set forever.
_MAX_SUBS_PER_USER = 20
# Bound on concurrent web-push sends per event (each call has a 10s timeout).
_MAX_SEND_WORKERS = 8
# The keypair is stored as a single JSON value written with SET NX, so the first
# writer wins and every process reads back the SAME pair (no torn pub/priv).
_VAPID_KEY = "push:vapid:keypair"

_vapid_cache = None  # (public_b64, private_b64) — process-local cache of the pair
_redis_client = None
_redis_lock = threading.Lock()


def _redis():
    """A single shared redis client, built lazily and reused across all calls.

    redis-py clients are thread-safe (pooled), so the daemon push threads and
    the request threads can share one rather than reconnecting per operation.
    """
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    url = getattr(settings, "REDIS_URL", "") or os.getenv("REDIS_URL", "")
    if not url:
        return None
    with _redis_lock:
        if _redis_client is None:
            try:
                import redis

                _redis_client = redis.from_url(url)
            except Exception:
                return None
    return _redis_client


def _generate_vapid_keypair():
    """(public, private) base64url keys for a fresh EC keypair."""
    from cryptography.hazmat.primitives import serialization
    from py_vapid import Vapid01

    v = Vapid01()
    v.generate_keys()
    priv_b64 = (
        base64.urlsafe_b64encode(
            v.private_key.private_numbers().private_value.to_bytes(32, "big")
        )
        .rstrip(b"=")
        .decode()
    )
    pub_b64 = (
        base64.urlsafe_b64encode(
            v.public_key.public_bytes(
                serialization.Encoding.X962,
                serialization.PublicFormat.UncompressedPoint,
            )
        )
        .rstrip(b"=")
        .decode()
    )
    return pub_b64, priv_b64


def _vapid_keys():
    """(public, private) base64url keys, or ('', '') if not provisioned.

    Read-only: never generates. Use ensure_vapid_keys() (the /vapid-key endpoint)
    as the single explicit provisioning point so a plain read/predicate can't mint
    cryptographic material as a side effect.
    """
    global _vapid_cache
    if _vapid_cache:
        return _vapid_cache
    env_pub, env_priv = os.getenv("VAPID_PUBLIC_KEY", ""), os.getenv("VAPID_PRIVATE_KEY", "")
    if env_pub and env_priv:
        _vapid_cache = (env_pub, env_priv)
        return _vapid_cache
    r = _redis()
    if r is None:
        return ("", "")
    try:
        raw = r.get(_VAPID_KEY)
    except Exception:
        return ("", "")
    if raw:
        data = json.loads(raw)
        _vapid_cache = (data["pub"], data["priv"])
        return _vapid_cache
    return ("", "")


def ensure_vapid_keys():
    """Provision the keypair if absent, then return it. Generation is atomic
    across processes: the pair is written with SET NX, so the first writer wins
    and everyone else reads back that same pair — no public/private mismatch."""
    global _vapid_cache
    keys = _vapid_keys()
    if all(keys):
        return keys
    r = _redis()
    if r is None:
        return ("", "")
    try:
        pub_b64, priv_b64 = _generate_vapid_keypair()
        r.set(_VAPID_KEY, json.dumps({"pub": pub_b64, "priv": priv_b64}), nx=True)
        raw = r.get(_VAPID_KEY)  # authoritative value (ours or the winner's)
    except Exception:
        logger.warning("VAPID key provisioning failed", exc_info=True)
        return ("", "")
    if raw:
        data = json.loads(raw)
        _vapid_cache = (data["pub"], data["priv"])
        return _vapid_cache
    return ("", "")


def vapid_public_key() -> str:
    return ensure_vapid_keys()[0]


def push_enabled() -> bool:
    """True when web push can actually be sent (Redis up + a provisioned
    keypair). Read-only — does not generate keys."""
    return _redis() is not None and all(_vapid_keys())


def save_subscription(user_id, subscription: dict):
    """Store one subscription keyed by its endpoint, so re-subscribing the same
    browser is idempotent (no duplicate pushes)."""
    r = _redis()
    if r is None:
        return
    endpoint = subscription.get("endpoint")
    if not endpoint or not is_safe_push_endpoint(endpoint):
        return
    key = _SUBS_KEY.format(uid=user_id)
    try:
        r.hset(key, endpoint, json.dumps(subscription))
        # Trim if over the cap (keep the just-added endpoint, drop arbitrary
        # extras — a stale-device safety valve, not precise LRU).
        excess = r.hlen(key) - _MAX_SUBS_PER_USER
        if excess > 0:
            others = [f for f in r.hkeys(key) if f != endpoint.encode()]
            if others:
                r.hdel(key, *others[:excess])
    except Exception:
        logger.warning("save_subscription failed", exc_info=True)


def remove_subscription(user_id, endpoint):
    r = _redis()
    if r is None or not endpoint:
        return
    try:
        r.hdel(_SUBS_KEY.format(uid=user_id), endpoint)
    except Exception:
        logger.warning("remove_subscription failed", exc_info=True)


def _subscriptions(user_id):
    """[(endpoint, subscription_dict)] for a user."""
    r = _redis()
    if r is None:
        return []
    try:
        raw = r.hgetall(_SUBS_KEY.format(uid=user_id))
    except Exception:
        return []
    items = []
    for endpoint, value in raw.items():
        try:
            items.append((endpoint, json.loads(value)))
        except Exception:
            continue
    return items


def _send_one(user_id, endpoint, sub, payload, private_key):
    import requests
    from pywebpush import WebPushException, webpush

    # Re-validate at send time: the host may have been safe at subscribe time but
    # now resolve to an internal address (DNS rebinding). Skip rather than drop,
    # so a transient DNS failure doesn't evict a legitimate subscription.
    if not is_safe_push_endpoint(sub.get("endpoint")):
        return
    # A session that refuses to follow redirects, so a push host can't 30x the
    # encrypted POST onto an internal target after passing the host check.
    session = requests.Session()
    session.max_redirects = 0
    try:
        webpush(
            subscription_info=sub,
            data=json.dumps(payload),
            vapid_private_key=private_key,
            vapid_claims={"sub": VAPID_SUBJECT},
            timeout=10,
            requests_session=session,
        )
    except WebPushException as exc:
        status = getattr(getattr(exc, "response", None), "status_code", None)
        if status in (404, 410):  # subscription gone — drop it
            remove_subscription(user_id, endpoint)
    except Exception:
        logger.warning("web push send failed", exc_info=True)
    finally:
        session.close()


def _recipient_ids(project_id, owner_id):
    """Users to notify: project members + all admins (role=admin OR superuser),
    minus the actor. Mirrors User.accessible_project_ids()'s admin semantics so
    web push and the live websocket agree on the audience."""
    from django.db.models import Q

    from apps.accounts.models import User
    from apps.projects.models import ProjectMembership

    member_ids = set(
        ProjectMembership.objects.filter(project_id=project_id).values_list(
            "user_id", flat=True
        )
    )
    admin_ids = set(
        User.objects.filter(
            Q(role=User.Role.ADMIN) | Q(is_superuser=True), is_active=True
        ).values_list("id", flat=True)
    )
    return (member_ids | admin_ids) - {owner_id}


def push_activity(kind, project_id, title, owner_id, url="/documents", item_id=None):
    """Notify project members + admins (except the owner) via web push, in a
    daemon thread so it never blocks the HTTP request."""
    if not push_enabled():
        return
    _pub, private_key = _vapid_keys()
    # Same tag as the websocket Notification so an open tab doesn't show two.
    tag = f"dockia-{kind}-{item_id}" if item_id is not None else f"dockia-{kind}"

    def work():
        try:
            targets = _recipient_ids(project_id, owner_id)
            deliveries = [
                (uid, endpoint, sub)
                for uid in targets
                for endpoint, sub in _subscriptions(uid)
            ]
            if not deliveries:
                return  # nobody is subscribed to web push — nothing to send
            payload = {
                "title": f"New {kind}",
                "body": title or "Untitled",
                "url": url,
                "tag": tag,
            }
            # Fan the sends out concurrently so one slow push endpoint (up to a
            # 10s timeout) doesn't serialize the whole batch. _send_one swallows
            # its own errors, and the pool only touches Redis/HTTP (no ORM), so
            # no per-worker DB-connection cleanup is needed here.
            workers = min(_MAX_SEND_WORKERS, len(deliveries))
            with ThreadPoolExecutor(max_workers=workers) as pool:
                for uid, endpoint, sub in deliveries:
                    pool.submit(_send_one, uid, endpoint, sub, payload, private_key)
        except Exception:
            logger.warning("push_activity failed", exc_info=True)
        finally:
            # Runs outside the request cycle, so Django won't reclaim this
            # thread's DB connection for us — close it explicitly to avoid leaks.
            close_old_connections()
            connection.close()

    threading.Thread(target=work, daemon=True).start()
