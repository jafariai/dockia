from django.db import migrations

# Palette offset from projects' so categories look visually distinct.
PALETTE = [
    "#10b981", "#f59e0b", "#ef4444", "#3b82f6",
    "#8b5cf6", "#ec4899", "#14b8a6", "#6366f1",
]


def backfill(apps, schema_editor):
    Category = apps.get_model("categories", "Category")
    for i, category in enumerate(Category.objects.order_by("id")):
        category.color = PALETTE[i % len(PALETTE)]
        category.save(update_fields=["color"])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [("categories", "0002_category_color")]
    operations = [migrations.RunPython(backfill, noop)]
