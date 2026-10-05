from rest_framework import serializers

from apps.common.access import validate_project_access
from apps.common.fields import AudienceHiddenEmailField

from .models import Prompt

MAX_TAGS = 25


class PromptSerializer(serializers.ModelSerializer):
    """Read representation used by list & detail endpoints."""

    category_name = serializers.CharField(source="category.name", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)
    owner_email = AudienceHiddenEmailField(source="owner.email", read_only=True,
                                           default=None)
    owner_name = serializers.CharField(source="owner.full_name", read_only=True,
                                       default=None)

    class Meta:
        model = Prompt
        fields = [
            "id", "title", "description", "content", "category", "category_name",
            "project", "project_name", "owner", "owner_email", "owner_name",
            "tags", "created_at", "updated_at",
        ]


class PromptListSerializer(PromptSerializer):
    """Lighter representation for the listing — omits the (potentially large)
    prompt body, which the list view doesn't render."""

    class Meta(PromptSerializer.Meta):
        fields = [f for f in PromptSerializer.Meta.fields if f != "content"]


class PromptWriteSerializer(serializers.ModelSerializer):
    """Create / update."""

    class Meta:
        model = Prompt
        fields = ["id", "title", "description", "content", "category", "project",
                  "tags"]

    def validate_project(self, project):
        return validate_project_access(
            self.context["request"].user, project, block_archived=True
        )

    def validate_tags(self, tags):
        if not isinstance(tags, list):
            raise serializers.ValidationError("Tags must be a list of strings.")
        if len(tags) > MAX_TAGS:
            raise serializers.ValidationError(f"At most {MAX_TAGS} tags allowed.")
        return [str(t).strip()[:40] for t in tags if str(t).strip()]

    def create(self, validated):
        validated["owner"] = self.context["request"].user
        return super().create(validated)

    def to_representation(self, instance):
        return PromptSerializer(instance, context=self.context).data
