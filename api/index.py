import sys
from pathlib import Path

# ponytail: Vercel's Python runtime only adds this file's own directory to
# sys.path, so backend/app isn't importable without this. Reuses the same
# FastAPI app as Docker — no separate serverless-specific backend code.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.main import app
