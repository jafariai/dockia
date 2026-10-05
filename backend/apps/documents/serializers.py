import os

from django.core.files.base import ContentFile
from django.utils.text import slugify
from rest_framework import serializers

from apps.categories.models import Category
from apps.common.access import validate_project_access
from apps.common.fields import AudienceHiddenEmailField
from apps.projects.models import Project

from .models import Document
from .sanitization import sanitize_html

ALLOWED_EXTENSIONS = (".html", ".htm")
MAX_TAGS = 25


class DocumentSerializer(serializers.ModelSerializer):
    """Read representation used by list & detail endpoints."""

    category_name = serializers.CharField(source="category.name", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)
    owner_email = AudienceHiddenEmailField(source="owner.email", read_only=True,
                                           default=None)
    owner_name = serializers.CharField(source="owner.full_name", read_only=True,
                                       default=None)
    preview_url = serializers.CharField(read_only=True)

    class Meta:
        model = Document
        fields = [
            "id", "title", "description", "category", "category_name",
            "project", "project_name", "owner", "owner_email", "owner_name",
            "tags", "file_size", "render_mode", "preview_url",
            "created_at", "updated_at",
        ]


class DocumentWriteSerializer(serializers.ModelSerializer):
    """Create / update. Handles validation + sanitization of the HTML.

    HTML may be supplied two ways, interchangeably:
      * ``html_file``    — a multipart upload (browser upload dialog).
      * ``html_content`` — a raw HTML string (in-app code editor + the MCP
        server). On save it becomes the new original *and* is re-sanitized.
    ``html_content`` wins if both are sent.
    """

    html_file = serializers.FileField(write_only=True, required=False)
    html_content = serializers.CharField(
        write_only=True, required=False, allow_blank=True, trim_whitespace=False
    )

    class Meta:
        model = Document
        fields = ["id", "title", "description", "category", "project", "tags",
                  "render_mode", "html_file", "html_content"]

    def validate_html_file(self, file):
        from django.conf import settings

        name = (file.name or "").lower()
        if not name.endswith(ALLOWED_EXTENSIONS):
            raise serializers.ValidationError("Only .html or .htm files are allowed.")
        # DOCUMENT_MAX_BYTES is None when uploads are unbounded.
        if settings.DOCUMENT_MAX_BYTES and file.size > settings.DOCUMENT_MAX_BYTES:
            raise serializers.ValidationError("File exceeds the maximum allowed size.")
        return file

    def validate_html_content(self, content):
        from django.conf import settings

        if (
            settings.DOCUMENT_MAX_BYTES
            and len(content.encode("utf-8")) > settings.DOCUMENT_MAX_BYTES
        ):
            raise serializers.ValidationError("HTML exceeds the maximum allowed size.")
        return content

    def validate_tags(self, tags):
        if not isinstance(tags, list):
            raise serializers.ValidationError("Tags must be a list of strings.")
        if len(tags) > MAX_TAGS:
            raise serializers.ValidationError(f"At most {MAX_TAGS} tags allowed.")
        cleaned = [str(t).strip()[:40] for t in tags if str(t).strip()]
        return cleaned

    def validate_project(self, project):
        """A member may only attach documents to projects they belong to."""
        return validate_project_access(
            self.context["request"].user, project, block_archived=True
        )

    def validate(self, attrs):
        if self.instance is None and not attrs.get("html_file") and "html_content" not in attrs:
            raise serializers.ValidationError(
                {"html_file": "Provide an HTML file (html_file) or raw HTML (html_content)."}
            )
        self._guard_interactive(attrs)
        return attrs

    def _guard_interactive(self, attrs):
        """Interactive mode runs the document's own scripts in the viewer. Restrict
        who can put a document into (or keep it in) that state to admins: a
        non-admin may neither switch a document to interactive nor change the
        script-bearing content of one that already is. Metadata-only edits of an
        existing interactive doc (title, tags…) stay allowed.
        """
        user = self.context["request"].user
        if user.is_admin:
            return
        current = self.instance.render_mode if self.instance else None
        target = attrs.get("render_mode", current) or Document.RenderMode.SANITIZED
        if target != Document.RenderMode.INTERACTIVE:
            return
        content_changing = attrs.get("html_file") is not None or "html_content" in attrs
        enabling = attrs.get("render_mode") == Document.RenderMode.INTERACTIVE
        if enabling or content_changing:
            raise serializers.ValidationError(
                {"render_mode": "Only administrators may create or modify "
                                "interactive (script-executing) documents."}
            )

    def _derive_filename(self, validated) -> str:
        """Reuse the existing stored filename on edit; otherwise slug the title."""
        if self.instance and self.instance.html_file:
            return os.path.basename(self.instance.html_file.name)
        title = validated.get("title") or (self.instance and self.instance.title) or "document"
        return f"{slugify(title) or 'document'}.html"

    def _ingest(self, validated):
        """Normalize whichever HTML source was supplied into stored fields.

        ``html_content`` takes precedence over ``html_file``. Sets the
        sanitized copy, byte size, and (for content edits) rewrites the
        original FileField from the new bytes.
        """
        content = validated.pop("html_content", None)
        if content is not None:
            validated["sanitized_html"] = sanitize_html(content)
            data = content.encode("utf-8")
            validated["file_size"] = len(data)
            validated["html_file"] = ContentFile(data, name=self._derive_filename(validated))
            return
        upload = validated.get("html_file")
        if upload is not None:
            raw = upload.read().decode("utf-8", errors="replace")
            validated["sanitized_html"] = sanitize_html(raw)
            validated["file_size"] = upload.size
            upload.seek(0)  # rewind so FileField stores the original bytes

    def create(self, validated):
        self._ingest(validated)
        validated["owner"] = self.context["request"].user
        return super().create(validated)

    def update(self, instance, validated):
        self._ingest(validated)
        return super().update(instance, validated)

    def to_representation(self, instance):
        return DocumentSerializer(instance, context=self.context).data
