"""Reusable serializer fields."""
from rest_framework import serializers


class AudienceHiddenEmailField(serializers.EmailField):
    """An email field that is withheld from the read-only ``audience`` role.

    Members and admins see the address normally; for an audience (viewer-only)
    user it serializes to ``None`` so teammate email addresses are not exposed to
    that role. DRF emits ``None`` directly when the underlying value is already
    ``None``, so ``to_representation`` only runs when there is an address to hide.
    """

    def to_representation(self, value):
        request = self.context.get("request")
        if request is not None and getattr(request.user, "is_audience", False):
            return None
        return super().to_representation(value)
