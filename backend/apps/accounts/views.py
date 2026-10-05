from django.contrib.auth import get_user_model
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.audit.services import log_action
from apps.common.permissions import IsAdmin

from .serializers import (
    PasswordResetSerializer,
    UserCreateSerializer,
    UserSerializer,
    UserUpdateSerializer,
)

User = get_user_model()


class UserViewSet(viewsets.ModelViewSet):
    """User management. Read is admin-only; the caller's own record is
    available via /api/auth/me. All writes require the admin role."""

    queryset = User.objects.all().prefetch_related("project_memberships")
    permission_classes = [IsAdmin]
    filterset_fields = ["role", "is_active"]
    search_fields = ["email", "first_name", "last_name"]
    ordering_fields = ["created_at", "email"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        if self.action in {"update", "partial_update"}:
            return UserUpdateSerializer
        return UserSerializer

    def perform_create(self, serializer):
        user = serializer.save()
        log_action(self.request, "create_user", "user", user.id, {"email": user.email})

    def perform_update(self, serializer):
        user = serializer.save()
        log_action(self.request, "update_user", "user", user.id, {"email": user.email})

    def perform_destroy(self, instance):
        # Disable rather than hard-delete to preserve audit integrity.
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        log_action(self.request, "disable_user", "user", instance.id,
                   {"email": instance.email})

    @action(detail=True, methods=["post"], url_path="reset-password")
    def reset_password(self, request, pk=None):
        user = self.get_object()
        serializer = PasswordResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user.set_password(serializer.validated_data["password"])
        user.save(update_fields=["password"])
        log_action(request, "reset_password", "user", user.id, {"email": user.email})
        return Response({"detail": "Password updated."}, status=status.HTTP_200_OK)
