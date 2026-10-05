"""Captures the client IP onto the request for audit records."""
import ipaddress

from django.conf import settings


class AuditContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.audit_ip = self._client_ip(request)
        return self.get_response(request)

    @staticmethod
    def _client_ip(request):
        """The real client IP, resilient to X-Forwarded-For spoofing.

        nginx appends the connecting client as the LAST X-Forwarded-For entry
        (``$proxy_add_x_forwarded_for``); any entries to its left are supplied by
        the client and must not be trusted. We therefore read the Nth value from
        the right, where N = the number of trusted proxies in front of the app
        (``TRUSTED_PROXY_DEPTH``, default 1). Falls back to REMOTE_ADDR when there
        is no proxy header (e.g. local ``runserver``).
        """
        depth = getattr(settings, "TRUSTED_PROXY_DEPTH", 1)
        forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
        if forwarded and depth > 0:
            parts = [p.strip() for p in forwarded.split(",") if p.strip()]
            if len(parts) >= depth:
                candidate = parts[-depth]
                try:
                    ipaddress.ip_address(candidate)
                    return candidate
                except ValueError:
                    pass  # malformed hop — fall back to the transport address
        return request.META.get("REMOTE_ADDR")
