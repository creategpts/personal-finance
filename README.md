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

**App de escritorio (macOS)**: doble click en [`desktop.command`](./desktop.command) — arranca la app en una ventana propia, sin barra de navegador (backend y frontend en un solo proceso, vía [pywebview](https://pywebview.flowrl.com/)). La primera vez instala dependencias, construye el frontend y genera `Life Track.app` en la raíz del repo; a partir de ahí puedes abrir directamente ese `.app` (doble click, o arrástralo al Dock).

`Life Track.app` no se commitea (está en `.gitignore`) — cada máquina genera el suyo al ejecutar `desktop.command`, así que no lleva rutas de nadie más ni carga la cuarentena de Gatekeeper de un `.app` movido/descargado. macOS pedirá permiso de acceso a la carpeta Documentos la primera vez que lo abras (si el repo vive ahí) — acéptalo, si no lo haces `desktop.command` sigue funcionando igual, solo que el `.app` no arranca.

**App de escritorio (Windows)**: doble click en [`desktop.bat`](./desktop.bat) — mismo mecanismo (pywebview), ventana propia sin barra de navegador. La primera vez instala dependencias y construye el frontend; la consola se cierra sola al terminar, la app queda abierta en su ventana. Para arrancarla sin que se vea ni un instante la consola, usa [`Life Track.vbs`](./Life%20Track.vbs) (llama a `desktop.bat` oculto) — pero la primera vez conviene usar `desktop.bat` directamente, para ver si falta algo por instalar.

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
