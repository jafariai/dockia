"""Single entry point for writing audit records."""
import logging

from .models import AuditLog

logger = logging.getLogger("audit")


def log_action(request, action, target_type="", target_id=None, metadata=None):
    """Persist an audit event. Never raises into the request path."""
    try:
        user = getattr(request, "user", None)
        if user is not None and not getattr(user, "is_authenticated", False):
            user = None
        AuditLog.objects.create(
            user=user,
            action=action,
            target_type=target_type or "",
            target_id="" if target_id is None else str(target_id),
            ip_address=getattr(request, "audit_ip", None),
            metadata=metadata or {},
        )
    except Exception:  # audit must never break the actual operation
        logger.exception("Failed to write audit log for action=%s", action)
