#!/bin/bash
# Doble click para arrancar Life Track como app de escritorio: ventana propia,
# sin barra de navegador. Primer arranque instala dependencias y construye el
# frontend; los siguientes son directos.
cd "$(dirname "$0")"

if ! command -v python3 >/dev/null; then
  echo "Falta Python 3. Instálalo desde https://www.python.org/downloads/ (o 'brew install python3') y vuelve a abrir esto."
  read -n 1 -s -r -p "Pulsa una tecla para cerrar..."
  exit 1
fi
if ! command -v npm >/dev/null; then
  echo "Falta Node.js. Instálalo desde https://nodejs.org/ (o 'brew install node') y vuelve a abrir esto."
  read -n 1 -s -r -p "Pulsa una tecla para cerrar..."
  exit 1
fi

(
  cd backend
  [ -d venv ] || python3 -m venv venv
  source venv/bin/activate
  pip install -q -r requirements.txt
)

# ponytail: solo construye si falta dist — si tocas el frontend, borra
# frontend/dist (o usa start.command) para forzar un rebuild.
if [ ! -d frontend/dist ]; then
  echo "Primera vez: construyendo el frontend…"
  (
    cd frontend
    [ -d node_modules ] || npm install
    npm run build
  )
fi

# "Life Track.app" se genera aquí en local (no se commitea): sin rutas absolutas
# de nadie dentro, sin cuarentena de Gatekeeper, y con identidad TCC propia de
# esta máquina. Se regenera solo si cambia desktop.applescript.
if [ ! -d "Life Track.app" ] || [ desktop.applescript -nt "Life Track.app" ]; then
  echo "Generando Life Track.app…"
  rm -rf "Life Track.app"
  osacompile -o "Life Track.app" desktop.applescript
  codesign --force --deep --sign - "Life Track.app"
fi

# Mismo backend que start.command — no pueden convivir en el puerto 8000, así
# que si ya hay uno corriendo (p.ej. dejaste start.command abierto), lo cerramos
# para dejarle sitio a este. Solo mata NUESTRO uvicorn (matchea app.main:app),
# nunca otra cosa que ocupe el puerto por casualidad.
if pgrep -f "uvicorn app\.main:app" >/dev/null; then
  echo "Cerrando el Life Track que ya estaba corriendo…"
  pkill -f "uvicorn app\.main:app"
  sleep 1
fi

cd backend
source venv/bin/activate
exec python3 desktop.py
