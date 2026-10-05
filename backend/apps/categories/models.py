from django.core.validators import RegexValidator
from django.db import models
from django.utils.text import slugify

hex_color_validator = RegexValidator(
    r"^#(?:[0-9a-fA-F]{6})$", "Enter a valid hex color, e.g. #4f46e5."
)


class Category(models.Model):
    name = models.CharField(max_length=80, unique=True)
    slug = models.SlugField(max_length=100, unique=True, blank=True)
    # Display color used in dashboard charts and labels.
    color = models.CharField(
        max_length=7, default="#10b981", validators=[hex_color_validator]
    )

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)[:100]
        super().save(*args, **kwargs)
