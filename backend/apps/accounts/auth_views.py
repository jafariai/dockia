import os
from datetime import timedelta

from django.core.cache import cache
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.audit.services import log_action

from .models import ApiToken
from .serializers import (
    ApiTokenSerializer,
    TokenObtainPairSerializer,
    UserSerializer,
)

# Per-account lockout: after this many failed logins within the window, the
# account is temporarily refused regardless of source IP. This complements the
# per-IP throttle, which a distributed (rotating-IP) credential-stuffing attack
# would otherwise sidestep. The counter lives in the shared cache (Redis in prod)
# so it holds across workers.
LOGIN_LOCKOUT_THRESHOLD = int(os.getenv("LOGIN_LOCKOUT_THRESHOLD", "10"))
LOGIN_LOCKOUT_SECONDS = int(os.getenv("LOGIN_LOCKOUT_SECONDS", "900"))  # 15 min


class LoginView(TokenObtainPairView):
    """POST /api/auth/login — issue access + refresh tokens.

    Rate limited per-IP (5/min) AND per-account (lockout after repeated failures)
    to blunt both single-source and distributed credential stuffing.
    """

    serializer_class = TokenObtainPairSerializer
    permission_classes = [AllowAny]
    throttle_scope = "login"

    @staticmethod
    def _lockout_key(email):
        return f"login:fail:{email}"

    def post(self, request, *args, **kwargs):
        email = (request.data.get("email") or "").strip().lower()
        key = self._lockout_key(email) if email else None

        if key and cache.get(key, 0) >= LOGIN_LOCKOUT_THRESHOLD:
            return Response(
                {"detail": "Account temporarily locked after too many failed "
                           "attempts. Try again later."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        response = super().post(request, *args, **kwargs)

        if response.status_code == 200:
            if key:
                cache.delete(key)  # clear the counter on a successful login
            user = response.data.get("user", {})
            log_action(request, "login", "user", user.get("id"),
                       {"email": user.get("email")})
        elif key and response.status_code in (400, 401):
            self._record_failure(key)
        return response

    @staticmethod
    def _record_failure(key):
        """Increment the failure counter, setting a TTL on first failure so the
        window slides forward from the initial bad attempt."""
        try:
            cache.incr(key)
        except ValueError:  # key absent — start the window
            cache.set(key, 1, LOGIN_LOCKOUT_SECONDS)


class RefreshView(TokenRefreshView):
    """POST /api/auth/refresh — rotate refresh token, mint new access."""

    permission_classes = [AllowAny]


class LogoutView(APIView):
    """POST /api/auth/logout — blacklist the supplied refresh token."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = request.data.get("refresh")
        if not token:
            return Response({"detail": "refresh token required"},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            RefreshToken(token).blacklist()
        except TokenError:
            return Response({"detail": "invalid token"},
                            status=status.HTTP_400_BAD_REQUEST)
        log_action(request, "logout", "user", request.user.id, {})
        return Response(status=status.HTTP_205_RESET_CONTENT)


class MeView(APIView):
    """GET /api/auth/me — the authenticated user's own profile."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class ApiTokenView(APIView):
    """Self-service service tokens for the calling user.

    GET  /api/auth/tokens        — list the caller's active tokens
    POST /api/auth/tokens        — mint a token; the plaintext is returned ONCE
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        tokens = request.user.api_tokens.filter(revoked=False)
        return Response(ApiTokenSerializer(tokens, many=True).data)

    def post(self, request):
        name = (request.data.get("name") or "").strip()[:100] or "API token"

        scope = request.data.get("scope") or ApiToken.Scope.FULL
        if scope not in ApiToken.Scope.values:
            return Response({"detail": "Invalid scope."},
                            status=status.HTTP_400_BAD_REQUEST)

        expires_at, err = self._parse_expiry(request.data)
        if err:
            return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)

        token, raw = ApiToken.issue(
            request.user, name, scope=scope, expires_at=expires_at
        )
        log_action(request, "create_api_token", "api_token", token.id,
                   {"name": name, "scope": scope})
        data = ApiTokenSerializer(token).data
        data["token"] = raw  # shown exactly once; never retrievable again
        return Response(data, status=status.HTTP_201_CREATED)

    @staticmethod
    def _parse_expiry(payload):
        """(expires_at|None, error|None) from `expires_in_days` or `expires_at`."""
        days = payload.get("expires_in_days")
        if days is not None:
            try:
                days = int(days)
            except (TypeError, ValueError):
                return None, "expires_in_days must be an integer."
            if days <= 0:
                return None, "expires_in_days must be positive."
            return timezone.now() + timedelta(days=days), None
        raw = payload.get("expires_at")
        if raw:
            parsed = parse_datetime(raw)
            if parsed is None:
                return None, "Invalid expires_at (use ISO 8601)."
            if timezone.is_naive(parsed):
                parsed = timezone.make_aware(parsed)
            if parsed <= timezone.now():
                return None, "expires_at must be in the future."
            return parsed, None
        return None, None  # non-expiring


class ApiTokenRevokeView(APIView):
    """DELETE /api/auth/tokens/:id — revoke one of the caller's tokens."""

    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            token = request.user.api_tokens.get(pk=pk, revoked=False)
        except ApiToken.DoesNotExist:
            return Response({"detail": "Token not found."},
                            status=status.HTTP_404_NOT_FOUND)
        token.revoked = True
        token.save(update_fields=["revoked"])
        log_action(request, "revoke_api_token", "api_token", token.id,
                   {"name": token.name})
        return Response(status=status.HTTP_204_NO_CONTENT)
