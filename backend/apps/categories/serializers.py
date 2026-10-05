from rest_framework import serializers

from .models import Category


class CategorySerializer(serializers.ModelSerializer):
    document_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Category
        fields = ["id", "name", "slug", "color", "document_count"]
        read_only_fields = ["id", "slug"]
