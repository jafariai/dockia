from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    """Default pagination with an opt-in client-controlled page size."""

    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 200
