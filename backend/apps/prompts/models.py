from django.conf import settings
from django.db import models


class Prompt(models.Model):
    """A reusable prompt / instruction (plain text) shared with the team,
    organized by project + category. Unlike documents, the content is plain
    text stored directly — no HTML rendering or sanitization."""

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    content = models.TextField()  # the prompt / instruction text

    category = models.ForeignKey(
        "categories.Category", on_delete=models.PROTECT, related_name="prompts"
    )
    project = models.ForeignKey(
        "projects.Project", on_delete=models.CASCADE, related_name="prompts"
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        related_name="prompts",
    )
    tags = models.JSONField(default=list, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["project", "category"]),
            models.Index(fields=["owner", "-updated_at"]),
        ]

    def __str__(self):
        return self.title
