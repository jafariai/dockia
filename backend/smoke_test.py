"""End-to-end smoke test for the API (auth, sanitization, access control).

Run with:
  DJANGO_SETTINGS_MODULE=config.settings_sqlite python smoke_test.py
"""
import io
import os

import django

os.environ.setdefault("DJANGO_SECRET_KEY", "test")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings_sqlite")
django.setup()

from django.contrib.auth import get_user_model  # noqa: E402
from rest_framework.test import APIClient  # noqa: E402

from apps.categories.models import Category  # noqa: E402
from apps.projects.models import Project, ProjectMembership  # noqa: E402

User = get_user_model()
ok = 0
fail = 0


def check(label, cond):
    global ok, fail
    if cond:
        ok += 1
        print(f"  PASS  {label}")
    else:
        fail += 1
        print(f"  FAIL  {label}")


admin = User.objects.create_superuser("admin@team.internal", "ChangeMe123!",
                                      first_name="A", last_name="Admin")
member = User.objects.create_user("member@team.internal", "Member123!pass",
                                  first_name="M", last_name="Ember")
cat = Category.objects.create(name="Technical")
proj_a = Project.objects.create(name="Alpha", created_by=admin)
proj_b = Project.objects.create(name="Secret", created_by=admin)
ProjectMembership.objects.create(user=member, project=proj_a)  # member: only A

api = APIClient()


def login(email, password):
    r = api.post("/api/auth/login", {"email": email, "password": password},
                 format="json")
    return r


print("\n[1] Authentication")
r = login("member@team.internal", "wrong")
check("bad password rejected (401)", r.status_code == 401)
r = login("member@team.internal", "Member123!pass")
check("valid login returns 200", r.status_code == 200)
check("login returns access+refresh", "access" in r.data and "refresh" in r.data)
member_token = r.data["access"]
check("login embeds user payload", r.data["user"]["email"] == "member@team.internal")

print("\n[2] Auth required everywhere")
anon = APIClient()
check("anon documents list -> 401", anon.get("/api/documents").status_code == 401)

print("\n[3] Upload + sanitization")
api.credentials(HTTP_AUTHORIZATION=f"Bearer {member_token}")
malicious = (
    "<h1>Title</h1><p style='color:red'>safe</p>"
    "<script>alert('xss')</script>"
    "<img src=x onerror='steal()'>"
    "<a href='javascript:evil()'>x</a>"
)
upload = io.BytesIO(malicious.encode())
upload.name = "doc.html"
r = api.post("/api/documents", {
    "title": "My Doc", "description": "d", "category": cat.id,
    "project": proj_a.id, "tags": '["alpha","beta"]', "html_file": upload,
}, format="multipart")
check("member uploads to own project (201)", r.status_code == 201)
doc_id = r.data.get("id")

r = api.get(f"/api/documents/{doc_id}/preview")
body = r.content.decode()
check("preview renders (200)", r.status_code == 200)
check("preview strips <script>", "<script>" not in body and "alert(" not in body)
check("preview strips onerror handler", "onerror" not in body)
check("preview strips javascript: href", "javascript:" not in body)
check("preview keeps safe markup", "<h1>" in body and "safe" in body)
check("preview sets CSP header", "default-src 'none'" in r["Content-Security-Policy"])

print("\n[4] Project-scoped authorization")
upload2 = io.BytesIO(b"<p>secret</p>")
upload2.name = "s.html"
r = api.post("/api/documents", {
    "title": "Nope", "category": cat.id, "project": proj_b.id,
    "html_file": upload2,
}, format="multipart")
check("member cannot upload to project B (400)", r.status_code == 400)

admin_api = APIClient()
at = login("admin@team.internal", "ChangeMe123!").data["access"]
admin_api.credentials(HTTP_AUTHORIZATION=f"Bearer {at}")
up3 = io.BytesIO(b"<p>classified</p>")
up3.name = "c.html"
r = admin_api.post("/api/documents", {
    "title": "Classified", "category": cat.id, "project": proj_b.id,
    "html_file": up3,
}, format="multipart")
secret_doc = r.data["id"]
r = api.get(f"/api/documents/{secret_doc}")
check("member direct-URL to foreign doc -> 404", r.status_code == 404)
r = api.get("/api/documents")
titles = [d["title"] for d in r.data["results"]]
check("member list excludes foreign docs", "Classified" not in titles)

print("\n[5] Admin-only surfaces")
check("member denied user mgmt (403)", api.get("/api/users").status_code == 403)
check("admin allowed user mgmt (200)", admin_api.get("/api/users").status_code == 200)
check("member denied logs (403)", api.get("/api/logs").status_code == 403)
check("admin allowed logs (200)", admin_api.get("/api/logs").status_code == 200)

print("\n[6] Audit trail")
r = admin_api.get("/api/logs")
actions = {row["action"] for row in r.data["results"]}
check("login event logged", "login" in actions)
check("upload_document event logged", "upload_document" in actions)

print("\n[7] Filtering + search")
r = api.get(f"/api/documents?search=My&category={cat.id}")
check("search+category filter works", r.data["count"] >= 1)
# JSONField `contains` (tag filter) is a no-op to validate on SQLite; it is
# fully supported on the production PostgreSQL backend.
from django.db import connection  # noqa: E402

if connection.vendor == "postgresql":
    r = api.get("/api/documents?tag=alpha")
    check("tag filter works", r.data["count"] == 1)
else:
    print("  SKIP  tag filter (JSONField contains needs PostgreSQL)")

print("\n[8] Dashboard")
r = api.get("/api/dashboard/")
check("dashboard returns metrics", "total_documents" in r.data)

print(f"\n==== {ok} passed, {fail} failed ====")
raise SystemExit(1 if fail else 0)
