from django.urls import path

from .auth_views import (
    ApiTokenRevokeView,
    ApiTokenView,
    LoginView,
    LogoutView,
    MeView,
    RefreshView,
)

urlpatterns = [
    path("login", LoginView.as_view(), name="auth-login"),
    path("refresh", RefreshView.as_view(), name="auth-refresh"),
    path("logout", LogoutView.as_view(), name="auth-logout"),
    path("me", MeView.as_view(), name="auth-me"),
    path("tokens", ApiTokenView.as_view(), name="auth-tokens"),
    path("tokens/<int:pk>", ApiTokenRevokeView.as_view(), name="auth-token-revoke"),
]
