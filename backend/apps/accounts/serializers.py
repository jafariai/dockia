from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import (
    TokenObtainPairSerializer as BaseTokenObtainPairSerializer,
)

from apps.projects.models import Project, ProjectMembership

from .models import ApiToken

User = get_user_model()


class TokenObtainPairSerializer(BaseTokenObtainPairSerializer):
    """Embed identity claims and reject disabled accounts."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["email"] = user.email
        token["role"] = user.role
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        if not self.user.is_active:
            raise serializers.ValidationError("This account is disabled.")
        data["user"] = UserSerializer(self.user).data
        return data


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    project_ids = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "first_name", "last_name", "email", "full_name", "role",
            "is_active", "project_ids", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_project_ids(self, obj):
        return list(obj.project_memberships.values_list("project_id", flat=True))


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    project_ids = serializers.PrimaryKeyRelatedField(
        many=True, write_only=True, required=False, queryset=Project.objects.all()
    )

    class Meta:
        model = User
        fields = [
            "id", "first_name", "last_name", "email", "password", "role",
            "is_active", "project_ids",
        ]

    def create(self, validated_data):
        projects = validated_data.pop("project_ids", [])
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        ProjectMembership.objects.bulk_create(
            [ProjectMembership(user=user, project=p) for p in projects]
        )
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Admin edits: role, active state, name, project assignments."""

    project_ids = serializers.PrimaryKeyRelatedField(
        many=True, write_only=True, required=False, queryset=Project.objects.all()
    )

    class Meta:
        model = User
        fields = ["first_name", "last_name", "role", "is_active", "project_ids"]

    def update(self, instance, validated_data):
        projects = validated_data.pop("project_ids", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if projects is not None:
            instance.project_memberships.all().delete()
            ProjectMembership.objects.bulk_create(
                [ProjectMembership(user=instance, project=p) for p in projects]
            )
        return instance


class PasswordResetSerializer(serializers.Serializer):
    """Admin-driven password reset for another user."""

    password = serializers.CharField(write_only=True, validators=[validate_password])


class ApiTokenSerializer(serializers.ModelSerializer):
    """Read representation of a service token. Never exposes the secret."""

    class Meta:
        model = ApiToken
        fields = ["id", "name", "prefix", "scope", "created_at", "expires_at",
                  "last_used_at", "revoked"]
        read_only_fields = fields
