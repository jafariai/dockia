from django.conf import settings
from django.db import models


def html_upload_path(instance, filename):
    return f"documents/project_{instance.project_id}/{filename}"


class Document(models.Model):
    class RenderMode(models.TextChoices):
        # Strip all scripts; render inert markup in a no-JS sandbox (safest).
        SANITIZED = "sanitized", "Sanitized (no scripts)"
        # Run the original HTML's scripts inside an isolated, opaque-origin
        # sandbox (allow-scripts, no allow-same-origin) with an anti-exfil CSP.
        INTERACTIVE = "interactive", "Interactive (isolated sandbox)"

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    render_mode = models.CharField(
        max_length=12, choices=RenderMode.choices, default=RenderMode.SANITIZED
    )

    # Original upload (kept for provenance / re-export). Never served raw.
    html_file = models.FileField(upload_to=html_upload_path)
    sanitized_html = models.TextField(blank=True)
    file_size = models.PositiveIntegerField(default=0)

    category = models.ForeignKey(
        "categories.Category", on_delete=models.PROTECT, related_name="documents"
    )
    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="documents"
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        related_name="documents",
    )
    tags = models.JSONField(default=list, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["project", "category"]),
            models.Index(fields=["owner", "-created_at"]),
        ]

    def __str__(self):
        return self.title

    @property
    def preview_url(self) -> str:
        return f"/api/documents/{self.id}/preview"
