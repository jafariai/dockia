from django.db.models import Count, ProtectedError
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError

from apps.audit.services import log_action
from apps.common.permissions import IsAdminOrReadOnly

from .models import Category
from .serializers import CategorySerializer


class CategoryViewSet(viewsets.ModelViewSet):
    """Categories are shared taxonomy. Any authenticated user can read;
    only admins can mutate."""

    queryset = Category.objects.annotate(document_count=Count("documents"))
    serializer_class = CategorySerializer
    permission_classes = [IsAdminOrReadOnly]
    search_fields = ["name"]
    ordering_fields = ["name"]

    def perform_create(self, serializer):
        category = serializer.save()
        log_action(self.request, "create_category", "category", category.id,
                   {"name": category.name})

    def perform_destroy(self, instance):
        # Documents / files / prompts reference categories with PROTECT, so a
        # category that's in use can't be removed — surface a clear 400.
        category_id, name = instance.id, instance.name
        try:
            instance.delete()
        except ProtectedError:
            raise ValidationError(
                "This category is in use by documents, files, or prompts. "
                "Reassign or remove those first."
            )
        log_action(self.request, "delete_category", "category", category_id,
                   {"name": name})
