"""Authenticate websocket connections from a JWT in the query string.

Browsers can't set Authorization headers on a WebSocket, so the access token is
passed as `?token=<jwt>`. We validate it the same way SimpleJWT does for HTTP.
"""
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        scope["user"] = await self._user_from_scope(scope)
        return await super().__call__(scope, receive, send)

    @database_sync_to_async
    def _user_from_scope(self, scope):
        from rest_framework_simplejwt.tokens import AccessToken

        params = parse_qs(scope.get("query_string", b"").decode())
        token = (params.get("token") or [None])[0]
        if not token:
            return AnonymousUser()
        try:
            access = AccessToken(token)
            user = get_user_model().objects.get(
                id=access["user_id"], is_active=True
            )
            # Surface the token's expiry so the consumer can drop the socket when
            # it lapses (forcing a reconnect + re-auth rather than a 24h session).
            scope["token_exp"] = access.payload.get("exp")
            return user
        except Exception:
            # Bad/expired token, deleted/inactive user, or a transient DB error
            # during startup: fail closed (reject) rather than crash the handshake.
            return AnonymousUser()
