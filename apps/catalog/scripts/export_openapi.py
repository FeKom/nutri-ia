"""
Export the FastAPI OpenAPI spec to openapi.json at the catalog root.

Usage (from apps/catalog/):
    python scripts/export_openapi.py

Does not require a running server or database connection — FastAPI generates
the spec statically from the route and schema definitions.
"""
import json
import os
import sys

# Ensure app/ is importable without DATABASE_URL being valid
os.environ.setdefault("DATABASE_URL", "postgresql://dummy:dummy@localhost/dummy")
os.environ.setdefault("JWKS_URL", "http://localhost:3000/api/auth/jwks")
os.environ.setdefault("JWT_ISSUER", "http://localhost:3000")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app  # noqa: E402

spec = app.openapi()
out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "openapi.json")
with open(out, "w") as f:
    json.dump(spec, f, indent=2)
    f.write("\n")

print(f"OpenAPI spec written to {out}")
