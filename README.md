# Life Track

Seguimiento de finanzas personales: movimientos de dinero entre cuentas y categorías, de los que se derivan los indicadores (ingreso, gasto, ahorro, inversión), presupuestos, gastos recurrentes y metas.

Ver [CONTEXT.md](./CONTEXT.md) para el glosario de dominio (Movimiento, Cuenta, Concepto...).

## Stack

- **Backend**: FastAPI + SQLAlchemy + SQLite (`backend/`)
- **Frontend**: React + TypeScript + Vite + Tailwind (`frontend/`)

## Requisitos previos

Necesitas **Python 3.11+** y **Node.js 20+**. Sin base de datos externa ni variables de entorno obligatorias.

**macOS** — con [Homebrew](https://brew.sh):

```bash
brew install python node
```

Sin Homebrew, instaladores directos: [Python](https://www.python.org/downloads/) · [Node.js](https://nodejs.org/) (versión LTS).

**Windows** — con winget (viene con Windows 10/11), en PowerShell:

```powershell
winget install Python.Python.3.12
winget install OpenJS.NodeJS.LTS
```

Sin winget, instaladores directos: [Python](https://www.python.org/downloads/) (marca "Add python.exe to PATH" durante la instalación) · [Node.js](https://nodejs.org/) (versión LTS).

Cierra y vuelve a abrir la terminal después de instalar para que reconozca los comandos nuevos.

## Arrancar en local

**Acceso directo**: doble click en [`start.command`](./start.command) (macOS) o [`start.bat`](./start.bat) (Windows) — arranca backend y frontend a la vez y abre `http://localhost:5173` en el navegador. La primera vez crea el entorno e instala dependencias solo; tarda un poco más.

- macOS: cierra la ventana de Terminal o pulsa Ctrl+C para parar ambos.
- Windows: abre dos ventanas (Backend/Frontend) — ciérralas para parar cada una.

O manualmente:

**Backend** (terminal 1):

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Arranca en `http://127.0.0.1:8000`. La base de datos SQLite (`life_track.db`) y sus tablas se crean solas al primer arranque, con categorías por defecto (sin datos de movimientos).

**Frontend** (terminal 2):

```bash
cd frontend
npm install
npm run dev
```

Arranca en `http://localhost:5173`, con proxy de `/api` al backend (`vite.config.ts`).

Con eso, la app funciona completa contra una base de datos vacía. Para tener datos de ejemplo con los que probar (movimientos, presupuestos, metas...):

```bash
cd backend
python3 -m app.seed_mock
```

Esto **borra y sustituye** los datos actuales del `life_track.db` local por datos ficticios genéricos — pensado para desarrollo/demo, no para producción.

## Tests

```bash
cd backend
pytest   # o: python test_goals.py
```

## Backup

Backups (JSON, fuera del repo) se generan solos una vez por semana al arrancar el backend. Ruta por defecto: carpeta hermana del proyecto; configurable con `LIFETRACK_BACKUP_DIR`. Ver `backend/app/routers/backup.py`.
