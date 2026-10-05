"""Local tooling/CI settings: same app, SQLite instead of Postgres.

Used only for generating migrations and running checks/tests off-container.
Production always uses config.settings (PostgreSQL).
"""
from .settings import *  # noqa: F401,F403

DATABASES["default"] = {  # noqa: F405
    "ENGINE": "django.db.backends.sqlite3",
    "NAME": BASE_DIR / "dev.sqlite3",  # noqa: F405
}

ALLOWED_HOSTS = ["*"]  # tooling/test only
