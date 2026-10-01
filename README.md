# Life Track

Seguimiento de finanzas personales: movimientos de dinero entre cuentas y categorías, de los que se derivan los indicadores (ingreso, gasto, ahorro, inversión), presupuestos, gastos recurrentes y metas.

Ver [CONTEXT.md](./CONTEXT.md) para el glosario de dominio (Movimiento, Cuenta, Concepto...).

## Stack

- **Backend**: FastAPI + SQLAlchemy + SQLite (`backend/`)
- **Frontend**: React + TypeScript + Vite + Tailwind (`frontend/`)

## Arrancar

Se arranca con **Docker**, y solo necesitas eso instalado: [Docker Desktop](https://www.docker.com/products/docker-desktop/) — ni Python, ni Node, ni versiones que cuadrar.

**Doble click**: [`start-docker.command`](./start-docker.command) (macOS) o [`start-docker.bat`](./start-docker.bat) (Windows) — abre Docker Desktop si hace falta, construye y arranca el contenedor, y abre el navegador en `http://localhost:8000`.

**O a mano**, desde la raíz del repo (con Docker Desktop ya abierto):

```bash
docker compose up --build
```

Abre `http://localhost:8000` (backend y frontend van juntos en un solo contenedor y puerto). La primera vez construye la imagen; después `docker compose up` sin `--build` arranca al momento.

**Para parar**: Ctrl+C, o `docker compose down` desde la carpeta del repo.

La base de datos (`life_track.db`) y los backups viven en `./data/` en tu máquina (montado como volumen), así que **sobreviven a reconstruir la imagen o borrar el contenedor**. Esa carpeta está en `.gitignore` — no se commitea. Para empezar de cero, borra `./data/`.

## Datos de ejemplo

Para llenar la app con datos ficticios (movimientos, presupuestos, metas...) con los que probar, con el contenedor construido:

```bash
docker compose run --rm app python -m app.seed_mock
```

**Borra y sustituye** el contenido de `life_track.db` por datos genéricos — para demo, no para tus datos reales.

## Tests

```bash
docker compose run --rm app python test_goals.py
docker compose run --rm app python test_investments.py
```

## Backup

Backups (JSON) se generan solos una vez por semana. En Docker van a `./data/backup/` (junto a la base de datos); la ruta se configura con `LIFETRACK_BACKUP_DIR`. También hay backup/restore manual vía API. Ver `backend/app/routers/backup.py`.

## Desplegar en Vercel (acceso desde el móvil)

Vercel no tiene disco persistente, así que hace falta una base de datos Postgres aparte (p. ej. [Neon](https://neon.tech), tiene capa gratuita). Docker/SQLite en local no cambian — esto es solo para el despliegue.

1. Crea una base de datos Postgres en Neon y copia su connection string.
2. `vercel login` (con tu cuenta) y `vercel` desde la raíz del repo para enlazar el proyecto.
3. En el dashboard de Vercel, añade la variable de entorno `LIFETRACK_DB_URL` con el connection string de Neon (formato `postgresql://...`).
4. `vercel --prod` para desplegar. `vercel.json` ya construye el frontend (Vite) como estático y `api/index.py` sirve el backend FastAPI como función serverless bajo `/api/*`.

Las tablas se crean solas al primer arranque (`create_all`, igual que en Docker) — no hace falta migrar nada a mano en una base nueva.
