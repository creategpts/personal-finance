from sqlalchemy.orm import Session

from . import models

# Neutral starter set for a fresh install — generic, not tied to any one person's
# banks or spending. Users rename/add/delete from Configuración.
DEFAULT_CATEGORIES = [
    # accounts (type = one of models.ACCOUNT_TYPES)
    ("Efectivo", "gasto"),
    ("Ahorro", "ahorro"),
    ("Inversión", "inversion"),
    # income
    ("Sueldo", "income"),
    ("Intereses", "income"),
    ("Dividendos", "income"),
    ("Otros ingresos", "income"),
    # expense
    ("Vivienda", "expense"),
    ("Alimentación", "expense"),
    ("Transporte", "expense"),
    ("Ocio", "expense"),
    ("Salud", "expense"),
    ("Suscripciones", "expense"),
    ("Otros gastos", "expense"),
]

# income categories seeded as passive (interest, dividends, rent…)
PASSIVE_INCOME = {"Intereses", "Dividendos"}


def seed_categories(db: Session):
    if db.query(models.Category).count() > 0:
        return
    for name, type_ in DEFAULT_CATEGORIES:
        db.add(models.Category(name=name, type=type_, es_pasivo=name in PASSIVE_INCOME))
    db.commit()
