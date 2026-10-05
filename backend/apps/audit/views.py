import csv

from django.http import HttpResponse
from rest_framework import mixins, viewsets
from rest_framework.decorators import action

from apps.common.permissions import IsAdmin

from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Read-only audit log access. Admin only.
    Supports filtering by action/user and full-text search of metadata."""

    queryset = AuditLog.objects.select_related("user")
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdmin]
    filterset_fields = ["action", "user", "target_type"]
    search_fields = ["action", "target_type", "target_id", "user__email"]
    ordering_fields = ["timestamp"]

    @action(detail=False, methods=["get"])
    def export(self, request):
        """GET /api/logs/export — CSV download of the filtered log set."""
        queryset = self.filter_queryset(self.get_queryset())[:10000]
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="audit_logs.csv"'
        writer = csv.writer(response)
        writer.writerow(["timestamp", "user", "action", "target_type",
                         "target_id", "ip_address", "metadata"])
        for row in queryset:
            writer.writerow([
                row.timestamp.isoformat(),
                row.user.email if row.user else "",
                row.action, row.target_type, row.target_id,
                row.ip_address or "", row.metadata,
            ])
        return response
