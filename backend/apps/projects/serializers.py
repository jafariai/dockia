import re

from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.common.access import validate_project_access
from apps.common.fields import AudienceHiddenEmailField

from .models import Project, ProjectLink, ProjectMembership

User = get_user_model()

# Service keys are short slugs (e.g. "search_console"); the frontend owns the
# human labels + icons, so we only enforce a safe shape here.
_LINK_TYPE_RE = re.compile(r"^[a-z0-9_]{1,32}$")


class ProjectLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectLink
        fields = ["id", "project", "label", "url", "link_type", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_link_type(self, value):
        if not _LINK_TYPE_RE.match(value):
            raise serializers.ValidationError(
                "link_type must be a short slug (a-z, 0-9, underscore)."
            )
        return value

    def validate_project(self, project):
        """Only admins manage links, but guard cross-project writes anyway."""
        return validate_project_access(self.context["request"].user, project)


class ProjectSerializer(serializers.ModelSerializer):
    created_by_email = AudienceHiddenEmailField(
        source="created_by.email", read_only=True
    )
    document_count = serializers.IntegerField(read_only=True)
    member_ids = serializers.SerializerMethodField()
    links = ProjectLinkSerializer(many=True, read_only=True)

    class Meta:
        model = Project
        fields = [
            "id", "name", "slug", "description", "color", "is_archived",
            "created_by", "created_by_email", "document_count",
            "member_ids", "links", "created_at",
        ]
        read_only_fields = ["id", "slug", "created_by", "created_at"]

    def get_member_ids(self, obj):
        return list(obj.memberships.values_list("user_id", flat=True))


class ProjectMemberAssignSerializer(serializers.Serializer):
    user_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=User.objects.all()
    )

    def save(self, project):
        users = self.validated_data["user_ids"]
        project.memberships.all().delete()
        ProjectMembership.objects.bulk_create(
            [ProjectMembership(project=project, user=u) for u in users]
        )
        return project
