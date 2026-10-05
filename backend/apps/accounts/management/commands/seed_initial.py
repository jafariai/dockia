"""Idempotent bootstrap: admin user, baseline categories and projects.

Safe to run on every container start — it only creates what is missing.
"""
import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.categories.models import Category
from apps.projects.models import Project

User = get_user_model()

DEFAULT_PROJECTS = ["Getting Started"]
DEFAULT_CATEGORIES = ["Technical", "Architecture", "API", "Operations", "Research",
                      "Internal"]


class Command(BaseCommand):
    help = "Seed the bootstrap admin, default projects and categories."

    def handle(self, *args, **options):
        email = os.getenv("ADMIN_EMAIL", "admin@team.internal").lower()
        password = os.getenv("ADMIN_PASSWORD", "ChangeMe123!")

        admin, created = User.objects.get_or_create(
            email=email,
            defaults={
                "first_name": os.getenv("ADMIN_FIRST_NAME", "Platform"),
                "last_name": os.getenv("ADMIN_LAST_NAME", "Admin"),
                "role": User.Role.ADMIN,
                "is_staff": True,
                "is_superuser": True,
                "is_active": True,
            },
        )
        if created:
            admin.set_password(password)
            admin.save()
            self.stdout.write(self.style.SUCCESS(f"Created admin {email}"))
        else:
            self.stdout.write(f"Admin {email} already exists")

        for name in DEFAULT_CATEGORIES:
            Category.objects.get_or_create(name=name)
        for name in DEFAULT_PROJECTS:
            Project.objects.get_or_create(
                name=name, defaults={"created_by": admin}
            )
        self.stdout.write(self.style.SUCCESS("Seed complete."))
