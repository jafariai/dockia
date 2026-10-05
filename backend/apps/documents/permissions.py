"""Documents reuse the shared project-content access rule.

Documents are project-scoped, owner-authored content, so the shared rule
(read = project access; write = admin or owner; audience strictly read-only,
with queryset scoping making direct-id access 404) applies as-is — no need for
a second copy of the logic.
"""
from apps.common.permissions import ProjectContentAccessPermission

# Backwards-compatible alias used by DocumentViewSet.
DocumentAccessPermission = ProjectContentAccessPermission
