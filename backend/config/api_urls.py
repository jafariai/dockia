"""Top-level /api router."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.accounts.views import UserViewSet
from apps.audit.views import AuditLogViewSet
from apps.categories.views import CategoryViewSet
from apps.documents.views import DashboardView, DocumentViewSet
from apps.files.views import StoredFileViewSet
from apps.projects.views import ProjectLinkViewSet, ProjectViewSet
from apps.prompts.views import PromptViewSet

# Slash-free routes to match the documented REST API
# (/api/documents, /api/documents/1, /api/documents/1/preview).
router = DefaultRouter(trailing_slash=False)
router.register("users", UserViewSet, basename="user")
router.register("projects", ProjectViewSet, basename="project")
router.register("project-links", ProjectLinkViewSet, basename="project-link")
router.register("categories", CategoryViewSet, basename="category")
router.register("documents", DocumentViewSet, basename="document")
router.register("files", StoredFileViewSet, basename="file")
router.register("prompts", PromptViewSet, basename="prompt")
router.register("logs", AuditLogViewSet, basename="log")

urlpatterns = [
    path("auth/", include("apps.accounts.auth_urls")),
    path("push/", include("apps.realtime.urls")),
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("", include(router.urls)),
]
