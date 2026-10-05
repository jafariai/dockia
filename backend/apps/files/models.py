from django.conf import settings
from django.db import models


def file_upload_path(instance, filename):
    # Group stored blobs by project for a tidy local/S3 layout.
    return f"files/project_{instance.project_id}/{filename}"


class StoredFile(models.Model):
    """An arbitrary uploaded file (backup / asset) stored on the server,
    organized by project + category. Unlike documents these are never
    previewed or sanitized — only stored and downloaded."""

    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    file = models.FileField(upload_to=file_upload_path)
    original_filename = models.CharField(max_length=255, blank=True)
    size = models.PositiveBigIntegerField(default=0)  # bytes; any size allowed
    content_type = models.CharField(max_length=120, blank=True)

    category = models.ForeignKey(
        "categories.Category", on_delete=models.PROTECT, related_name="files"
    )
    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="files"
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        related_name="files",
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["project", "category"]),
            models.Index(fields=["owner", "-created_at"]),
        ]

    def __str__(self):
        return self.name

    @property
    def download_url(self) -> str:
        return f"/api/files/{self.id}/download"
