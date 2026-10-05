import hashlib
import secrets

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class UserManager(BaseUserManager):
    """Email-based user manager (no username)."""

    use_in_migrations = True

    def _create_user(self, email, password, **extra):
        if not email:
            raise ValueError("Users must have an email address")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault("role", User.Role.MEMBER)
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.update(
            role=User.Role.ADMIN, is_staff=True, is_superuser=True, is_active=True
        )
        return self._create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        MEMBER = "member", "Member"
        # Read-only viewer: can sign in and browse documents in their assigned
        # projects, but cannot upload, edit, or manage anything.
        AUDIENCE = "audience", "Audience"

    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    email = models.EmailField(unique=True, db_index=True)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.MEMBER)

    # is_active doubles as the "disable user" switch (admin feature).
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)  # Django-admin access

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.email

    @property
    def is_admin(self) -> bool:
        return self.role == self.Role.ADMIN or self.is_superuser

    @property
    def is_audience(self) -> bool:
        """Read-only viewer role (never an admin/superuser)."""
        return self.role == self.Role.AUDIENCE and not self.is_superuser

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip() or self.email

    def accessible_project_ids(self):
        """Project ids this user may see. Admins see everything."""
        from apps.projects.models import Project

        if self.is_admin:
            return list(Project.objects.values_list("id", flat=True))
        return list(self.project_memberships.values_list("project_id", flat=True))


# Token prefix so a leaked credential is recognizable in logs/secret scanners.
API_TOKEN_PREFIX = "idp_"


class ApiToken(models.Model):
    """A revocable service credential for non-browser clients.

    Used by the MCP server (and any scripted integration) to call the REST API
    on a user's behalf. Only the SHA-256 hash is stored; the plaintext is shown
    exactly once at creation. A request authenticated by a token inherits the
    owning user's permissions and project scoping, optionally narrowed to
    read-only and/or bounded by an expiry.
    """

    class Scope(models.TextChoices):
        FULL = "full", "Full access"
        READ_ONLY = "read_only", "Read-only"

    user = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="api_tokens"
    )
    name = models.CharField(max_length=100)
    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    # First few chars of the plaintext, kept for display ("idp_AbC12…").
    prefix = models.CharField(max_length=16)
    scope = models.CharField(max_length=10, choices=Scope.choices, default=Scope.FULL)
    created_at = models.DateTimeField(auto_now_add=True)
    # Null = non-expiring. When set, the token is rejected at/after this instant.
    expires_at = models.DateTimeField(null=True, blank=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    revoked = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.prefix}…)"

    @staticmethod
    def hash_token(raw: str) -> str:
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    @property
    def is_expired(self) -> bool:
        from django.utils import timezone

        return bool(self.expires_at and self.expires_at <= timezone.now())

    @property
    def is_read_only(self) -> bool:
        return self.scope == self.Scope.READ_ONLY

    @classmethod
    def issue(cls, user, name: str, scope=None, expires_at=None):
        """Create a token; returns (instance, plaintext). Store the plaintext now."""
        raw = API_TOKEN_PREFIX + secrets.token_urlsafe(32)
        token = cls.objects.create(
            user=user, name=name, token_hash=cls.hash_token(raw), prefix=raw[:12],
            scope=scope or cls.Scope.FULL, expires_at=expires_at,
        )
        return token, raw
