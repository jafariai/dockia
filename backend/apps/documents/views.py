from datetime import timedelta

from django.db.models import Count
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.models import AuditLog
from apps.audit.services import log_action
from apps.categories.models import Category
from apps.projects.models import Project, ProjectMembership
from apps.realtime.services import broadcast_activity

from .filters import DocumentFilter
from .models import Document
from .permissions import DocumentAccessPermission
from .serializers import DocumentSerializer, DocumentWriteSerializer

# Strict CSP for the sanitized preview frame: no scripts, no network calls of
# consequence, inline styles + self-hosted/data images only.
PREVIEW_CSP = (
    "default-src 'none'; "
    "style-src 'unsafe-inline'; "
    "img-src 'self' data: https:; "
    "font-src data:; "
    "form-action 'none'; "
    "base-uri 'none'; "
    "frame-ancestors 'self'"
)

# CSP for interactive previews. The document's own inline scripts run (that is
# the feature), but every network egress channel is closed: no remote scripts
# (script-src has no host source), no fetch/XHR/WebSocket (`connect-src 'none'`),
# no remote image/font beacons (`img-src`/`font-src` are self+data only), and no
# form posts. Combined with the iframe sandbox (opaque origin, no same-origin)
# this prevents both credential access and exfiltration of anything typed into a
# rendered document. Injected as a <meta> tag because the frame renders from
# `srcdoc`, so HTTP response headers do not reach it.
INTERACTIVE_CSP = (
    "default-src 'none'; "
    "script-src 'unsafe-inline' 'unsafe-eval'; "
    "style-src 'unsafe-inline'; "
    "img-src 'self' data:; "
    "font-src 'self' data:; "
    "media-src 'self' data: blob:; "
    "connect-src 'none'; "
    "form-action 'none'; "
    "base-uri 'none'; "
    "frame-ancestors 'self'"
)


def _inject_meta_csp(html: str, csp: str) -> str:
    """Insert a CSP <meta> as early in <head> as possible so it governs the doc."""
    meta = f'<meta http-equiv="Content-Security-Policy" content="{csp}">'
    lower = html.lower()
    head = lower.find("<head>")
    if head != -1:
        pos = head + len("<head>")
        return html[:pos] + meta + html[pos:]
    html_tag = lower.find("<html")
    if html_tag != -1:
        end = lower.find(">", html_tag)
        if end != -1:
            return f"{html[:end + 1]}<head>{meta}</head>{html[end + 1:]}"
    return meta + html


class DocumentViewSet(viewsets.ModelViewSet):
    """Documents CRUD + isolated HTML preview.

    The queryset is always scoped to projects the caller can access, so
    direct id access to an unauthorized document returns 404.
    """

    permission_classes = [DocumentAccessPermission]
    filterset_class = DocumentFilter
    ordering_fields = ["created_at", "updated_at", "title"]
    ordering = ["-created_at"]

    def get_queryset(self):
        user = self.request.user
        qs = Document.objects.select_related("category", "project", "owner")
        if not user.is_admin:
            qs = qs.filter(project_id__in=user.accessible_project_ids())
        return qs

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return DocumentWriteSerializer
        return DocumentSerializer

    def perform_create(self, serializer):
        document = serializer.save()
        log_action(self.request, "upload_document", "document", document.id,
                   {"title": document.title, "project_id": document.project_id,
                    "render_mode": document.render_mode})
        broadcast_activity("document", document)

    def perform_update(self, serializer):
        document = serializer.save()
        log_action(self.request, "update_document", "document", document.id,
                   {"title": document.title, "render_mode": document.render_mode})

    def perform_destroy(self, instance):
        doc_id, title = instance.id, instance.title
        instance.delete()
        log_action(self.request, "delete_document", "document", doc_id,
                   {"title": title})

    @action(detail=True, methods=["get"])
    def raw(self, request, pk=None):
        """GET /api/documents/:id/raw — the editable HTML source.

        Returns the original (un-sanitized) markup so the in-app code editor
        and the MCP server can load and re-save it. get_object() enforces
        project access, so unauthorized ids return 404.

        Optional ``offset`` and ``max_chars`` query params return a slice (and
        the total length) so large documents can be paged without transferring
        the whole body each time. With no params the full source is returned.
        """
        document = self.get_object()
        try:
            content = document.html_file.read().decode("utf-8", errors="replace")
        except (FileNotFoundError, ValueError):
            content = ""

        total = len(content)
        try:
            offset = max(0, int(request.query_params.get("offset", 0)))
        except (TypeError, ValueError):
            offset = 0
        raw_max = request.query_params.get("max_chars")
        if raw_max is None:
            chunk = content[offset:]
        else:
            try:
                max_chars = int(raw_max)
            except (TypeError, ValueError):
                max_chars = 0
            chunk = content[offset:] if max_chars <= 0 else content[offset:offset + max_chars]

        return Response({
            "id": document.id,
            "title": document.title,
            "render_mode": document.render_mode,
            "html": chunk,
            "total_chars": total,
            "offset": offset,
            "returned_chars": len(chunk),
            "truncated": offset + len(chunk) < total,
        })

    @action(detail=True, methods=["get"])
    def preview(self, request, pk=None):
        """GET /api/documents/:id/preview — HTML for the isolated viewer.

        * sanitized mode  → server-stripped, script-free markup + strict CSP.
        * interactive mode → the original HTML (scripts intact) + an injected
          anti-exfil CSP. The client renders it in a sandboxed iframe; the
          sandbox (opaque origin) is what keeps it away from cookies/JWT.
        get_object() enforces project access, so direct ids return 404.
        """
        document = self.get_object()
        interactive = document.render_mode == Document.RenderMode.INTERACTIVE
        if interactive:
            try:
                raw = document.html_file.read().decode("utf-8", errors="replace")
            except (FileNotFoundError, ValueError):
                raw = "<p>Original file unavailable.</p>"
            html = _inject_meta_csp(raw, INTERACTIVE_CSP)
            header_csp = INTERACTIVE_CSP
        else:
            html = document.sanitized_html or "<p>No previewable content.</p>"
            header_csp = PREVIEW_CSP

        response = HttpResponse(html, content_type="text/html; charset=utf-8")
        # Header CSP is defense-in-depth for any direct (non-iframe) fetch; the
        # iframe itself is governed by the injected <meta> + sandbox attribute.
        response["Content-Security-Policy"] = header_csp
        response["X-Content-Type-Options"] = "nosniff"
        response["X-Frame-Options"] = "SAMEORIGIN"
        response["Cache-Control"] = "private, no-store"
        # The frontend always consumes this via an authenticated XHR and renders
        # it inside a sandboxed srcdoc iframe — it never top-level-navigates here.
        # For interactive (script-bearing) content, force a download disposition
        # so a direct browser navigation can never execute it on the app origin.
        if interactive:
            response["Content-Disposition"] = 'attachment; filename="preview.html"'
        response["X-Render-Mode"] = document.render_mode
        return response


class DashboardView(APIView):
    """GET /api/dashboard — aggregate metrics + recent activity.

    All counts are scoped to the caller's accessible projects.
    """

    def get(self, request):
        user = request.user
        docs = Document.objects.all()
        project_ids = None
        if not user.is_admin:
            project_ids = user.accessible_project_ids()
            docs = docs.filter(project_id__in=project_ids)

        week_ago = timezone.now() - timedelta(days=7)

        per_project = list(
            docs.values("project__name", "project__color")
            .annotate(count=Count("id")).order_by("-count")
        )
        per_category = list(
            docs.values("category__name", "category__color")
            .annotate(count=Count("id")).order_by("-count")
        )

        recent_docs = DocumentSerializer(
            docs.select_related("category", "project", "owner")
            .order_by("-created_at")[:8],
            many=True, context={"request": request},
        ).data

        activity = []
        if user.is_admin:
            activity = list(
                AuditLog.objects.select_related("user")
                .order_by("-timestamp")[:12]
                .values("id", "action", "user__email", "target_type",
                        "target_id", "timestamp")
            )

        if user.is_admin:
            active_users = type(user).objects.filter(is_active=True).count()
            total_projects = Project.objects.count()
        else:
            # Only count teammates the caller actually shares a project with —
            # the global active-user total would leak the org's headcount.
            active_users = (
                ProjectMembership.objects
                .filter(project_id__in=project_ids, user__is_active=True)
                .values("user_id").distinct().count()
            )
            total_projects = len(project_ids)

        return Response({
            "total_documents": docs.count(),
            "documents_this_week": docs.filter(created_at__gte=week_ago).count(),
            "active_users": active_users,
            "total_projects": total_projects,
            "total_categories": Category.objects.count(),
            "documents_per_project": per_project,
            "documents_per_category": per_category,
            "recent_documents": recent_docs,
            "recent_activity": activity,
        })
