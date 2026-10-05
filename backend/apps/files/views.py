from urllib.parse import quote

from django.conf import settings
from django.core import signing
from django.http import FileResponse, Http404, HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import SAFE_METHODS, AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from apps.accounts.models import User
from apps.audit.services import log_action
from apps.common.permissions import IsAdminOrReadOnly
from apps.realtime.services import broadcast_activity

from .models import StoredFile
from .serializers import StoredFileSerializer, StoredFileWriteSerializer

# Short-lived signed token authorizing a single file download. Lets the browser
# fetch the file via a plain navigation (which can't send the JWT header) and
# stream it straight to disk — no buffering the whole file in JS memory.
DOWNLOAD_SALT = "files.download"
DOWNLOAD_TTL = 120  # seconds


class StoredFileViewSet(viewsets.ModelViewSet):
    """Stored files (backups / assets). Read is scoped to projects the caller
    can access; create / update / delete are admin-only."""

    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ["project", "category"]
    search_fields = ["name", "description", "original_filename"]
    ordering_fields = ["created_at", "name", "size"]
    ordering = ["-created_at"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_throttles(self):
        # Rate-limit writes (upload/update/delete) as a DoS backstop — file SIZE
        # is intentionally uncapped, but the request rate is not. Reads and
        # downloads stay unthrottled.
        if self.request.method not in SAFE_METHODS:
            self.throttle_scope = "file_write"
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        qs = StoredFile.objects.select_related("category", "project", "owner")
        user = self.request.user
        if not user.is_admin:
            qs = qs.filter(project_id__in=user.accessible_project_ids())
        return qs

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return StoredFileWriteSerializer
        return StoredFileSerializer

    def perform_create(self, serializer):
        stored = serializer.save()
        log_action(self.request, "upload_file", "file", stored.id,
                   {"name": stored.name, "project_id": stored.project_id})
        broadcast_activity("file", stored)

    def perform_update(self, serializer):
        stored = serializer.save()
        log_action(self.request, "update_file", "file", stored.id,
                   {"name": stored.name})

    def perform_destroy(self, instance):
        file_id, name = instance.id, instance.name
        instance.file.delete(save=False)  # remove the stored blob, not just the row
        instance.delete()
        log_action(self.request, "delete_file", "file", file_id, {"name": name})

    @action(detail=True, methods=["get"], url_path="download-url")
    def download_url(self, request, pk=None):
        """GET /api/files/:id/download-url — mint a short-lived signed download
        token. get_object() enforces project access first (404 otherwise)."""
        stored = self.get_object()
        token = signing.dumps({"f": stored.id, "u": request.user.id},
                              salt=DOWNLOAD_SALT)
        return Response({"token": token, "expires_in": DOWNLOAD_TTL})

    @action(detail=True, methods=["get"], permission_classes=[AllowAny],
            authentication_classes=[])
    def download(self, request, pk=None):
        """GET /api/files/:id/download?token=… — serve the file as an
        attachment, authorized by the signed token (re-checked against the
        user's live access). Streams via nginx X-Accel-Redirect in production."""
        token = request.query_params.get("token", "")
        try:
            data = signing.loads(token, salt=DOWNLOAD_SALT, max_age=DOWNLOAD_TTL)
        except signing.BadSignature:
            raise Http404("Invalid or expired download link.")
        if str(data.get("f")) != str(pk):
            raise Http404("Invalid download link.")
        try:
            user = User.objects.get(id=data.get("u"), is_active=True)
        except User.DoesNotExist:
            raise Http404("Invalid download link.")

        stored = get_object_or_404(StoredFile, pk=pk)
        # Re-check access at download time — don't trust the token for authz state.
        if not user.is_admin and stored.project_id not in set(user.accessible_project_ids()):
            raise Http404("File not found.")
        return self._serve(stored)

    def _serve(self, stored):
        filename = stored.original_filename or stored.name
        # RFC 5987 / 6266 disposition that survives non-ASCII filenames.
        disposition = (
            "attachment; "
            f"filename=\"{filename.encode('ascii', 'ignore').decode() or 'download'}\"; "
            f"filename*=UTF-8''{quote(filename)}"
        )

        if getattr(settings, "USE_X_ACCEL_REDIRECT", False):
            # Hand the bytes off to nginx (internal location mapped to MEDIA_ROOT)
            # so a worker isn't tied up for the whole transfer.
            response = HttpResponse()
            response["X-Accel-Redirect"] = f"/protected-media/{stored.file.name}"
            response["Content-Type"] = stored.content_type or "application/octet-stream"
            if stored.size:
                response["Content-Length"] = stored.size
        else:
            try:
                handle = stored.file.open("rb")
            except (FileNotFoundError, ValueError):
                raise Http404("File is unavailable.")
            response = FileResponse(handle)
            if stored.content_type:
                response["Content-Type"] = stored.content_type

        response["Content-Disposition"] = disposition
        response["Cache-Control"] = "private, no-store"
        return response
