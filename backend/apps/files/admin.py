from django.contrib import admin

from .models import StoredFile


@admin.register(StoredFile)
class StoredFileAdmin(admin.ModelAdmin):
    list_display = ["name", "project", "category", "owner", "size", "created_at"]
    list_filter = ["project", "category", "created_at"]
    search_fields = ["name", "description", "original_filename"]
    readonly_fields = ["size", "content_type", "original_filename",
                       "created_at", "updated_at"]
