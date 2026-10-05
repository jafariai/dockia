"""Broadcast activity events to connected websocket clients.

Called from the HTTP request path (sync), so it wraps the async channel-layer
call. Best-effort: never let a notification failure break the create request.
"""
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .consumers import BROADCAST_GROUP
from .push import push_activity


def _broadcast_ws(kind, instance, title):
    """Fire the live websocket event to the project's members and to admins
    (who listen on a single broadcast group). No-op if no channel layer."""
    layer = get_channel_layer()
    if layer is None:
        return
    payload = {
        "type": "activity.created",
        "kind": kind,
        "id": instance.id,
        "title": title,
        "project_id": instance.project_id,
        "project_name": instance.project.name if instance.project_id else None,
        "owner_id": instance.owner_id,
        "owner_email": getattr(instance.owner, "email", None),
        "created_at": instance.created_at.isoformat(),
    }
    message = {"type": "activity", "payload": payload}
    for group in (f"project_{instance.project_id}", BROADCAST_GROUP):
        try:
            async_to_sync(layer.group_send)(group, message)
        except Exception:
            # Redis down / layer error must not fail the upload.
            pass


def broadcast_activity(kind, instance):
    """kind: "document" | "file". instance must have project_id, owner_id, etc.

    Fires both the live websocket event (in-app, when the tab is open) and a
    web push (OS notification, even when the tab is closed). Both best-effort.
    """
    title = getattr(instance, "title", None) or getattr(instance, "name", None)
    _broadcast_ws(kind, instance, title)

    url = "/files" if kind == "file" else "/documents"
    push_activity(kind, instance.project_id, title, instance.owner_id, url=url,
                  item_id=instance.id)
