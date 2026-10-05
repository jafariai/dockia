from rest_framework import viewsets

from apps.audit.services import log_action
from apps.common.permissions import ProjectContentAccessPermission

from .models import Prompt
from .serializers import (
    PromptListSerializer,
    PromptSerializer,
    PromptWriteSerializer,
)


class PromptViewSet(viewsets.ModelViewSet):
    """Shared prompts / instructions. Read is scoped to projects the caller can
    access; write is limited to admins or the prompt's owner."""

    permission_classes = [ProjectContentAccessPermission]
    filterset_fields = ["project", "category", "owner"]
    search_fields = ["title", "description", "content"]
    ordering_fields = ["created_at", "updated_at", "title"]
    ordering = ["-updated_at"]

    def get_queryset(self):
        qs = Prompt.objects.select_related("category", "project", "owner")
        user = self.request.user
        if not user.is_admin:
            qs = qs.filter(project_id__in=user.accessible_project_ids())
        return qs

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return PromptWriteSerializer
        if self.action == "list":
            return PromptListSerializer
        return PromptSerializer

    def perform_create(self, serializer):
        prompt = serializer.save()
        log_action(self.request, "create_prompt", "prompt", prompt.id,
                   {"title": prompt.title, "project_id": prompt.project_id})

    def perform_update(self, serializer):
        prompt = serializer.save()
        log_action(self.request, "update_prompt", "prompt", prompt.id,
                   {"title": prompt.title})

    def perform_destroy(self, instance):
        prompt_id, title = instance.id, instance.title
        instance.delete()
        log_action(self.request, "delete_prompt", "prompt", prompt_id,
                   {"title": title})
