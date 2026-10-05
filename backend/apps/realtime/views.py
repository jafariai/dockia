from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from . import push


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def vapid_key(request):
    """The VAPID public (application server) key the browser needs to subscribe."""
    return Response({"publicKey": push.vapid_public_key()})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def subscribe(request):
    subscription = request.data.get("subscription")
    if not isinstance(subscription, dict) or not subscription.get("endpoint"):
        return Response({"detail": "Invalid subscription."}, status=400)
    # Reject endpoints whose host resolves to a private/internal address — the
    # server later POSTs to this URL, so an unvalidated host is an SSRF lever.
    if not push.is_safe_push_endpoint(subscription.get("endpoint")):
        return Response({"detail": "Unsupported push endpoint."}, status=400)
    push.save_subscription(request.user.id, subscription)
    return Response({"ok": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def unsubscribe(request):
    endpoint = request.data.get("endpoint")
    if endpoint:
        push.remove_subscription(request.user.id, endpoint)
    return Response({"ok": True})
