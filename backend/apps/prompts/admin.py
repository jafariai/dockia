from django.contrib import admin

from .models import Prompt


@admin.register(Prompt)
class PromptAdmin(admin.ModelAdmin):
    list_display = ["title", "project", "category", "owner", "updated_at"]
    list_filter = ["project", "category", "created_at"]
    search_fields = ["title", "description", "content"]
    readonly_fields = ["created_at", "updated_at"]
