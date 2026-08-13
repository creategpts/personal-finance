# CLAUDE.md

Guía para trabajar en este repo con Claude Code. Ver [README.md](./README.md) para arrancar el proyecto y [CONTEXT.md](./CONTEXT.md) para el glosario de dominio (léelo antes de tocar lógica de Movimientos/Cuentas/Concepto — los términos son precisos y hay uno con nombre colisionado, ver ahí).

## Estructura

```
backend/app/
  models.py          # SQLAlchemy: Category, Movement, Budget, RecurringExpense, Goal, GoalTarget, Setting
  database.py         # engine SQLite + get_db()
  kpi_logic.py        # clasificación Ingreso/Gasto/Ahorro/Inversión (Concepto, ver CONTEXT.md)
  goals_logic.py       # progreso de Metas mes a mes
  recurring_logic.py   # generación automática de Movimientos desde Gastos recurrentes
  seed.py             # categorías por defecto (fresh install)
  seed_mock.py         # datos ficticios para dev/demo (borra y sustituye life_track.db local)
  routers/            # un router por recurso, montado en main.py
frontend/src/
  pages/              # Panel, Movimientos, Planificación, Evolución, Configuración
  components/          # modales y piezas de UI compartidas
  api.ts               # llamadas al backend
```

Sin framework de migraciones (ver comentario `ponytail:` en `main.py`): los cambios de schema se hacen con `ALTER TABLE` idempotentes al arrancar. Si el schema crece mucho, valorar Alembic.

## Datos y privacidad

`backend/life_track.db` es la base de datos local — puede contener datos financieros reales del usuario. Está en `.gitignore`, **nunca se commitea**. Si necesitas datos para probar algo, usa `python -m app.seed_mock` (los sustituye por datos ficticios) en vez de generar/pedir datos reales.

Los backups (JSON) se escriben fuera del repo por diseño (`backend/app/routers/backup.py`, `DEFAULT_BACKUP_DIR`) — no cambiar eso a una ruta dentro del repo.

## Convenciones

- App de un solo usuario: no hay tabla de usuarios/auth. `Setting` es global.
- `Category.type` es la fuente de verdad para agrupar cuentas (`ahorro`/`gasto`/`inversion`) — no añadir una capa de indirección tipo "behavior" (se probó y se quitó, ver CONTEXT.md).
- Comentarios `ponytail: ...` marcan simplificaciones deliberadas con techo conocido — léelos antes de "arreglar" esa zona; si el techo empieza a doler, esa es la señal para escalarlo, no motivo para asumir que es descuido.
- Tests son scripts runnables (`test_goals.py`), no un framework con fixtures — mantener ese estilo salvo que se pida lo contrario.

## Fuera de alcance de este documento

`.claude/` (skills/config local de Claude Code) es tooling de la sesión de quien lo use, no forma parte del proyecto — no lo describas aquí ni asumas que estará presente en el checkout de otra persona.
