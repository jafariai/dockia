from datetime import timedelta

from django.db.models import Q
from django.db.models.functions import Cast
from django.db.models import TextField
from django.utils import timezone
import django_filters as filters

from .models import Document


class DocumentFilter(filters.FilterSet):
    """Server-side, combinable filters for the document listing page."""

    owner = filters.NumberFilter(field_name="owner_id")
    category = filters.NumberFilter(field_name="category_id")
    project = filters.NumberFilter(field_name="project_id")
    tag = filters.CharFilter(method="filter_tag")

    date = filters.ChoiceFilter(
        method="filter_date_preset",
        choices=[("today", "Today"), ("7d", "Last 7 days"), ("30d", "Last 30 days")],
    )
    created_after = filters.DateFilter(field_name="created_at", lookup_expr="gte")
    created_before = filters.DateFilter(field_name="created_at", lookup_expr="lte")

    search = filters.CharFilter(method="filter_search")

    class Meta:
        model = Document
        fields = ["owner", "category", "project", "tag", "date",
                  "created_after", "created_before", "search"]

    def filter_tag(self, queryset, name, value):
        return queryset.filter(tags__contains=[value])

    def filter_date_preset(self, queryset, name, value):
        now = timezone.now()
        spans = {"today": 1, "7d": 7, "30d": 30}
        days = spans.get(value)
        if not days:
            return queryset
        start = (now - timedelta(days=days)) if value != "today" else \
            now.replace(hour=0, minute=0, second=0, microsecond=0)
        return queryset.filter(created_at__gte=start)

    def filter_search(self, queryset, name, value):
        return queryset.annotate(
            _tags_text=Cast("tags", TextField())
        ).filter(
            Q(title__icontains=value)
            | Q(description__icontains=value)
            | Q(_tags_text__icontains=value)
        )
