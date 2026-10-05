"""Reusable server-side authorization primitives."""
from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsAdmin(BasePermission):
    """Allow only authenticated users with the admin role."""

    message = "Administrator role required."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_admin)


class IsAdminOrReadOnly(BasePermission):
    """Admins may write; any authenticated user may read."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.is_admin


class ProjectContentAccessPermission(BasePermission):
    """Authorization for project-scoped, owner-authored content (documents,
    prompts, …) on a model exposing ``project_id`` and ``owner_id``.

    * Read   — the caller must have access to the object's project.
    * Write  — admins, or the object's owner.
    * Audience — strictly read-only (every unsafe method denied, incl. create).
    Project membership is re-checked at the queryset level so direct-id access
    returns 404, not 403.
    """

    message = "This action is not permitted for your role."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if request.method not in SAFE_METHODS and user.is_audience:
            return False
        return True

    def has_object_permission(self, request, view, obj):
        user = request.user
        if obj.project_id not in set(user.accessible_project_ids()):
            return False
        if request.method in SAFE_METHODS:
            return True
        if user.is_audience:
            return False
        return user.is_admin or obj.owner_id == user.id


class IsSelfOrAdmin(BasePermission):
    """Object-level: a user may act on their own record; admins on any."""

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.is_admin:
            return True
        return getattr(obj, "id", None) == user.id
