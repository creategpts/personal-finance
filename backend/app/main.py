from datetime import date
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from . import models
from .database import engine, SessionLocal
from .seed import seed_categories
from .routers import (
    categories,
    movements,
    account_values,
    dashboard,
    budgets,
    recurring,
    backup,
    settings,
    goals,
    investments,
)

models.Base.metadata.create_all(bind=engine)

# ponytail: no migration framework; one idempotent ALTER for the added column.
# Add alembic when the schema drifts more than a handful of columns.
# These backfill columns that predate them on an existing SQLite db — a fresh
# Postgres target (see database.py) already has every column via create_all above,
# and PRAGMA is SQLite-only syntax, so this whole block only runs against sqlite.
if engine.url.get_backend_name() == "sqlite":
    with engine.begin() as conn:
        cols = [r[1] for r in conn.execute(text("PRAGMA table_info(recurring_expenses)"))]
        if "auto_generate" not in cols:
            conn.execute(
                text("ALTER TABLE recurring_expenses ADD COLUMN auto_generate BOOLEAN NOT NULL DEFAULT 1")
            )
        mov_cols = [r[1] for r in conn.execute(text("PRAGMA table_info(movements)"))]
        if "group_name" not in mov_cols:
            conn.execute(text("ALTER TABLE movements ADD COLUMN group_name TEXT"))
        cat_cols = [r[1] for r in conn.execute(text("PRAGMA table_info(categories)"))]
        if "es_ingreso" not in cat_cols:
            conn.execute(text("ALTER TABLE categories ADD COLUMN es_ingreso BOOLEAN NOT NULL DEFAULT 1"))
        if "es_gasto" not in cat_cols:
            conn.execute(text("ALTER TABLE categories ADD COLUMN es_gasto BOOLEAN NOT NULL DEFAULT 1"))
        if "es_pasivo" not in cat_cols:
            conn.execute(text("ALTER TABLE categories ADD COLUMN es_pasivo BOOLEAN NOT NULL DEFAULT 0"))
            # preserve prior behavior: passive income used to be hardcoded to "Intereses"
            conn.execute(text("UPDATE categories SET es_pasivo = 1 WHERE name = 'Intereses'"))
        if "icon" not in cat_cols:
            conn.execute(text("ALTER TABLE categories ADD COLUMN icon TEXT NOT NULL DEFAULT 'Tag'"))
        if "color" not in cat_cols:
            conn.execute(text("ALTER TABLE categories ADD COLUMN color TEXT NOT NULL DEFAULT '#6b7280'"))
        if "parent_id" not in cat_cols:
            conn.execute(text("ALTER TABLE categories ADD COLUMN parent_id INTEGER"))
        # one-time rename: the old AccountType.key values ('saving'/'investment') are
        # replaced by the account type itself ('ahorro'/'inversion'); 'gasto' is unchanged.
        # No-op on repeat runs once no row has the old value left.
        conn.execute(text("UPDATE categories SET type = 'ahorro' WHERE type = 'saving'"))
        conn.execute(text("UPDATE categories SET type = 'inversion' WHERE type = 'investment'"))
        conn.execute(text("DROP TABLE IF EXISTS account_types"))

with SessionLocal() as db:
    seed_categories(db)
    backup.maybe_weekly_backup(db)  # refresh weekly.json if stale (lazy weekly cron)
    for inv in db.query(models.Investment).all():
        if inv.current_price > 0 and not inv.snapshots:
            snap_date = inv.price_updated_at.date() if inv.price_updated_at else date.today()
            db.add(models.PriceSnapshot(investment_id=inv.id, date=snap_date, price=inv.current_price))
    db.commit()

app = FastAPI(title="Life Track API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(categories.router)
app.include_router(movements.router)
app.include_router(account_values.router)
app.include_router(dashboard.router)
app.include_router(budgets.router)
app.include_router(recurring.router)
app.include_router(backup.router)
app.include_router(settings.router)
app.include_router(goals.router)
app.include_router(investments.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


# In the Docker image the built frontend is served by FastAPI itself, so it's one
# container / one port / same origin (no CORS). No-op on host dev: dist doesn't
# exist there (Vite serves :5173 instead), so this whole block is skipped.
# Registered LAST so every /api route above wins the match; the catch-all only
# picks up client-side routes and returns the SPA shell.
DIST_DIR = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if DIST_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        return FileResponse(DIST_DIR / "index.html")
