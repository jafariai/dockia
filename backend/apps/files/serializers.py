from rest_framework import serializers

from apps.common.access import validate_project_access
from apps.common.fields import AudienceHiddenEmailField

from .models import StoredFile


class StoredFileSerializer(serializers.ModelSerializer):
    """Read representation for list & detail endpoints."""

    category_name = serializers.CharField(source="category.name", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)
    owner_email = AudienceHiddenEmailField(source="owner.email", read_only=True,
                                           default=None)
    owner_name = serializers.CharField(source="owner.full_name", read_only=True,
                                       default=None)
    download_url = serializers.CharField(read_only=True)

    class Meta:
        model = StoredFile
        fields = [
            "id", "name", "description", "category", "category_name",
            "project", "project_name", "owner", "owner_email", "owner_name",
            "size", "content_type", "original_filename", "download_url",
            "created_at", "updated_at",
        ]


class StoredFileWriteSerializer(serializers.ModelSerializer):
    """Create / update. Accepts the upload and derives size/type/filename.

    No size limit is enforced — these are backup/asset blobs of any size."""

    file = serializers.FileField(write_only=True, required=False)
    name = serializers.CharField(required=False, allow_blank=True, max_length=200)

    class Meta:
        model = StoredFile
        fields = ["id", "name", "description", "category", "project", "file"]

    def validate_project(self, project):
        return validate_project_access(
            self.context["request"].user, project, block_archived=True
        )

    def validate(self, attrs):
        if self.instance is None and "file" not in attrs:
            raise serializers.ValidationError({"file": "A file is required."})
        return attrs

    def _ingest(self, validated):
        upload = validated.get("file")
        if upload is None:
            return
        validated["size"] = upload.size
        validated["content_type"] = (
            getattr(upload, "content_type", "") or "application/octet-stream"
        )
        validated["original_filename"] = (upload.name or "")[:255]

    def create(self, validated):
        self._ingest(validated)
        upload = validated.get("file")
        name = (validated.get("name") or "").strip()
        validated["name"] = (name or (upload.name if upload else "") or "Untitled")[:200]
        validated["owner"] = self.context["request"].user
        return super().create(validated)

    def update(self, instance, validated):
        self._ingest(validated)
        # A blank name on update must not wipe the existing one — keep it.
        if "name" in validated and not (validated["name"] or "").strip():
            validated.pop("name")
        return super().update(instance, validated)

    def to_representation(self, instance):
        return StoredFileSerializer(instance, context=self.context).data
