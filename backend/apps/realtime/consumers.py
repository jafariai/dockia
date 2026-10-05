"""WebSocket consumer that pushes activity events to the right users.

On connect, the user joins a channel group per project they can access, so a
"new document" event only reaches teammates with access to that project. Admins
(who can see every project) join a single "broadcast_all" group instead of one
group per project, so an admin's connect is O(1) Redis ops rather than O(projects).
"""
import asyncio
import json
import time

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

BROADCAST_GROUP = "broadcast_all"

# Close code sent when the access token expires — the client just reconnects
# with a fresh token (its normal reconnect path).
TOKEN_EXPIRED_CODE = 4001


class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        if not user or not user.is_authenticated:
            await self.close()
            return
        # Accept first so that, if a group_add fails partway through, Channels
        # still calls disconnect() and we clean up whatever groups we joined.
        self.groups_joined = []
        await self.accept()
        for group in await self._groups_for(user):
            await self.channel_layer.group_add(group, self.channel_name)
            self.groups_joined.append(group)
        self._expiry_task = self._schedule_token_expiry()
        await self.send(text_data=json.dumps({"type": "connected"}))

    async def disconnect(self, code):
        task = getattr(self, "_expiry_task", None)
        if task is not None:
            task.cancel()
        for group in getattr(self, "groups_joined", []):
            await self.channel_layer.group_discard(group, self.channel_name)

    # Group message handler (event["type"] == "activity").
    async def activity(self, event):
        await self.send(text_data=json.dumps(event["payload"]))

    def _schedule_token_expiry(self):
        """Close the socket once the access token expires (re-auth on reconnect)."""
        exp = self.scope.get("token_exp")
        if not exp:
            return None
        delay = max(0, exp - time.time())
        return asyncio.ensure_future(self._close_when_expired(delay))

    async def _close_when_expired(self, delay):
        try:
            await asyncio.sleep(delay)
            await self.close(code=TOKEN_EXPIRED_CODE)
        except asyncio.CancelledError:
            pass

    @database_sync_to_async
    def _groups_for(self, user):
        if user.is_admin:
            return [BROADCAST_GROUP]
        return [f"project_{pid}" for pid in user.accessible_project_ids()]
