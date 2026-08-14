#!/bin/bash
# Doble click para instalar (primera vez) y arrancar Life Track en local.
# ponytail: un script de Terminal, no un instalador con GUI — cierra la ventana o Ctrl+C para parar.
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

cleanup() {
  jobs -p | xargs -r kill 2>/dev/null
}
trap cleanup EXIT INT TERM

if [ ! -d backend/venv ] || [ ! -d frontend/node_modules ]; then
  echo "Primera vez: instalando dependencias (puede tardar uno o dos minutos)…"
fi

(
  cd backend
  [ -d venv ] || python3 -m venv venv
  source venv/bin/activate
  pip install -q -r requirements.txt
  exec uvicorn app.main:app --reload
) &

(
  cd frontend
  [ -d node_modules ] || npm install
  exec npm run dev
) &

sleep 3
open http://localhost:5173 2>/dev/null

echo ""
echo "Life Track arrancando — backend :8000, frontend :5173"
echo "Cierra esta ventana o Ctrl+C para parar todo."
wait
