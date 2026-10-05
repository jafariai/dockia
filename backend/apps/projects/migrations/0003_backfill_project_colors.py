from django.db import migrations

# Distinct, readable palette assigned to existing projects so the dashboard
# charts are colorful out of the box. New projects default to #6366f1 and can
# be recolored in the UI.
PALETTE = [
    "#6366f1", "#10b981", "#f59e0b", "#ef4444",
    "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6",
]


def backfill(apps, schema_editor):
    Project = apps.get_model("projects", "Project")
    for i, project in enumerate(Project.objects.order_by("id")):
        project.color = PALETTE[i % len(PALETTE)]
        project.save(update_fields=["color"])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [("projects", "0002_project_color")]
    operations = [migrations.RunPython(backfill, noop)]
