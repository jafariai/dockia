import logging
import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
application = get_wsgi_application()

# Only gunicorn (the separate HTTP process) imports this module. If it publishes
# realtime events to an in-memory channel layer, the daphne websocket process
# can't see them — notifications silently vanish. Warn so a missing REDIS_URL in
# production is caught. (Single-process local dev runs via daphne/asgi instead.)
from django.conf import settings  # noqa: E402

_backend = settings.CHANNEL_LAYERS.get("default", {}).get("BACKEND", "")
if "InMemory" in _backend:
    logging.getLogger("apps.realtime").warning(
        "Running under gunicorn with the in-memory channel layer (REDIS_URL "
        "unset): realtime websocket notifications will NOT reach the daphne "
        "process. Set REDIS_URL."
    )
