from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0003_alter_user_role"),
    ]

    operations = [
        migrations.AddField(
            model_name="apitoken",
            name="scope",
            field=models.CharField(
                choices=[("full", "Full access"), ("read_only", "Read-only")],
                default="full",
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name="apitoken",
            name="expires_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
