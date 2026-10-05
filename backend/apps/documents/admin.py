from django.contrib import admin

from .models import Document


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ["title", "project", "category", "owner", "created_at"]
    list_filter = ["project", "category", "created_at"]
    search_fields = ["title", "description"]
    readonly_fields = ["sanitized_html", "file_size", "created_at", "updated_at"]
    raw_id_fields = ["owner"]
