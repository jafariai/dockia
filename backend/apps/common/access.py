"""Shared authorization helpers for serializers."""
from rest_framework import serializers


def validate_project_access(user, project, *, block_archived=False):
    """Ensure *user* may attach content to *project*.

    Members may only use projects they belong to (admins may use any). When
    *block_archived* is set, also reject archived projects. Returns the project
    so it can be used directly in a DRF ``validate_<field>`` method.
    """
    if not user.is_admin and project.id not in set(user.accessible_project_ids()):
        raise serializers.ValidationError("You do not have access to this project.")
    if block_archived and project.is_archived:
        raise serializers.ValidationError("Project is archived.")
    return project
