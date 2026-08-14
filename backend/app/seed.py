from sqlalchemy.orm import Session

from . import models

# Neutral starter set for a fresh install — generic, not tied to any one person's
# banks or spending. Users rename/add/delete from Configuración.
# (name, type, icon, color) — icon is a lucide-react icon name (see IconPicker.tsx)
DEFAULT_CATEGORIES = [
    # accounts (type = one of models.ACCOUNT_TYPES)
    ("Efectivo", "gasto", "Wallet", "#6b7280"),
    ("Ahorro", "ahorro", "PiggyBank", "#0ea5e9"),
    ("Inversión", "inversion", "TrendingUp", "#8b5cf6"),
    # income
    ("Sueldo", "income", "Briefcase", "#22c55e"),
    ("Intereses", "income", "Percent", "#22c55e"),
    ("Dividendos", "income", "Coins", "#22c55e"),
    ("Otros ingresos", "income", "Plus", "#22c55e"),
    # expense
    ("Vivienda", "expense", "House", "#ef4444"),
    ("Alimentación", "expense", "Utensils", "#22c55e"),
    ("Transporte", "expense", "Car", "#f59e0b"),
    ("Ocio", "expense", "Wine", "#a855f7"),
    ("Salud", "expense", "HeartPulse", "#ec4899"),
    ("Suscripciones", "expense", "Repeat", "#06b6d4"),
    ("Otros gastos", "expense", "Package", "#6b7280"),
]

# income categories seeded as passive (interest, dividends, rent…)
PASSIVE_INCOME = {"Intereses", "Dividendos"}


def seed_categories(db: Session):
    if db.query(models.Category).count() > 0:
        return
    for name, type_, icon, color in DEFAULT_CATEGORIES:
        db.add(models.Category(name=name, type=type_, icon=icon, color=color, es_pasivo=name in PASSIVE_INCOME))
    db.commit()
