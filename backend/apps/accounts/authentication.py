"""Service-token authentication for non-browser API clients (e.g. the MCP server).

Uses the ``Authorization: Token <token>`` scheme so it never collides with
SimpleJWT's ``Bearer`` scheme — both classes can sit in DEFAULT_AUTHENTICATION_CLASSES
and each ignores the other's header.
"""
from datetime import timedelta

from django.utils import timezone
from rest_framework import authentication, exceptions
from rest_framework.permissions import SAFE_METHODS

from .models import ApiToken

# Don't write last_used_at on every request — only stamp it when it's stale by
# this much. Keeps token-authenticated reads (MCP polling) off the write path.
LAST_USED_THROTTLE = timedelta(minutes=5)


class ApiTokenAuthentication(authentication.BaseAuthentication):
    keyword = b"token"

    def authenticate(self, request):
        parts = authentication.get_authorization_header(request).split()
        if not parts or parts[0].lower() != self.keyword:
            return None  # not a token request; let other authenticators try
        if len(parts) != 2:
            raise exceptions.AuthenticationFailed("Invalid token header.")

        raw = parts[1].decode("latin-1")
        try:
            token = ApiToken.objects.select_related("user").get(
                token_hash=ApiToken.hash_token(raw), revoked=False
            )
        except ApiToken.DoesNotExist:
            raise exceptions.AuthenticationFailed("Invalid or revoked API token.")

        if not token.user.is_active:
            raise exceptions.AuthenticationFailed("User account is disabled.")

        if token.is_expired:
            raise exceptions.AuthenticationFailed("API token has expired.")

        # Read-only tokens may only perform safe (non-mutating) requests. Enforced
        # here so it applies uniformly regardless of each view's permission_classes
        # (a view-level class would otherwise override DEFAULT_PERMISSION_CLASSES).
        if token.is_read_only and request.method not in SAFE_METHODS:
            raise exceptions.PermissionDenied("This API token is read-only.")

        # Best-effort last-used stamp, throttled so frequent reads don't each
        # incur a DB write. Only updates when the stamp is missing or stale.
        now = timezone.now()
        if token.last_used_at is None or now - token.last_used_at > LAST_USED_THROTTLE:
            token.last_used_at = now
            token.save(update_fields=["last_used_at"])
        return (token.user, token)

    def authenticate_header(self, request):
        return 'Token realm="api"'
