from django.db.models import Count
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.audit.services import log_action
from apps.common.permissions import IsAdmin, IsAdminOrReadOnly

from .models import Project, ProjectLink
from .serializers import (
    ProjectLinkSerializer,
    ProjectMemberAssignSerializer,
    ProjectSerializer,
)


class ProjectViewSet(viewsets.ModelViewSet):
    """Projects. Members see only projects they belong to; admins see all.
    Only admins can create / edit / archive / assign members."""

    serializer_class = ProjectSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ["is_archived"]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "created_at"]

    def get_queryset(self):
        # prefetch links so the nested ProjectLinkSerializer doesn't N+1 the
        # projects list (one extra query per project otherwise).
        qs = Project.objects.prefetch_related("links").annotate(
            document_count=Count("documents")
        )
        user = self.request.user
        if not user.is_admin:
            qs = qs.filter(id__in=user.accessible_project_ids())
        return qs

    def perform_create(self, serializer):
        project = serializer.save(created_by=self.request.user)
        log_action(self.request, "create_project", "project", project.id,
                   {"name": project.name})

    def perform_update(self, serializer):
        project = serializer.save()
        log_action(self.request, "update_project", "project", project.id,
                   {"name": project.name})

    def perform_destroy(self, instance):
        project_id, name = instance.id, instance.name
        instance.delete()
        log_action(self.request, "delete_project", "project", project_id,
                   {"name": name})

    @action(detail=True, methods=["post"], permission_classes=[IsAdmin])
    def members(self, request, pk=None):
        project = self.get_object()
        serializer = ProjectMemberAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(project)
        log_action(request, "assign_members", "project", project.id, {})
        return Response(ProjectSerializer(project).data)

    @action(detail=True, methods=["post"], permission_classes=[IsAdmin])
    def archive(self, request, pk=None):
        project = self.get_object()
        project.is_archived = True
        project.save(update_fields=["is_archived"])
        log_action(request, "archive_project", "project", project.id, {})
        return Response(ProjectSerializer(project).data)

    @action(detail=True, methods=["post"], permission_classes=[IsAdmin])
    def unarchive(self, request, pk=None):
        project = self.get_object()
        project.is_archived = False
        project.save(update_fields=["is_archived"])
        log_action(request, "unarchive_project", "project", project.id, {})
        return Response(ProjectSerializer(project).data)


class ProjectLinkViewSet(viewsets.ModelViewSet):
    """External reference links on a project (Figma, Linear, repo, …).

    Any authenticated user may read links for projects they can access; only
    admins may add or remove them (matching project management)."""

    serializer_class = ProjectLinkSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ["project", "link_type"]
    ordering_fields = ["link_type", "label", "created_at"]

    def get_queryset(self):
        qs = ProjectLink.objects.select_related("project")
        user = self.request.user
        if not user.is_admin:
            qs = qs.filter(project_id__in=user.accessible_project_ids())
        return qs

    def perform_create(self, serializer):
        link = serializer.save()
        log_action(self.request, "create_project_link", "project", link.project_id,
                   {"label": link.label, "link_type": link.link_type})

    def perform_destroy(self, instance):
        project_id, label = instance.project_id, instance.label
        instance.delete()
        log_action(self.request, "delete_project_link", "project", project_id,
                   {"label": label})
