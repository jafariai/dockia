from django.conf import settings
from django.core.validators import RegexValidator
from django.db import models
from django.utils.text import slugify

# Shared 6-digit hex color validator (e.g. #4f46e5) for charts/labels.
hex_color_validator = RegexValidator(
    r"^#(?:[0-9a-fA-F]{6})$", "Enter a valid hex color, e.g. #4f46e5."
)


class Project(models.Model):
    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=140, unique=True, blank=True)
    description = models.TextField(blank=True)
    # Display color used in dashboard charts and labels.
    color = models.CharField(
        max_length=7, default="#6366f1", validators=[hex_color_validator]
    )
    is_archived = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        related_name="created_projects",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)[:140]
        super().save(*args, **kwargs)


class ProjectLink(models.Model):
    """An external reference / service integration attached to a project
    (Figma, Linear, GitHub, Search Console, Google Analytics, Ads, …)."""

    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="links"
    )
    label = models.CharField(max_length=120)
    url = models.URLField(max_length=500)
    # Open-ended service key (e.g. "figma", "search_console", "google_ads").
    # The frontend catalog defines the pickable set + icons; unknown keys fall
    # back to a generic icon, so new services need no migration.
    link_type = models.CharField(max_length=32, default="other")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["link_type", "label"]

    def __str__(self):
        return f"{self.label} ({self.link_type})"


class ProjectMembership(models.Model):
    """Grants a member access to a project. Admins bypass this entirely."""

    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="memberships"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="project_memberships",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("project", "user")

    def __str__(self):
        return f"{self.user} -> {self.project}"
