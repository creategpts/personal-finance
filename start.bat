@echo off
setlocal
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo Falta Python. Instalalo desde https://www.python.org/downloads/ ^(marca "Add python.exe to PATH" durante la instalacion^) o con: winget install Python.Python.3.12
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo Falta Node.js. Instalalo desde https://nodejs.org/ ^(version LTS^) o con: winget install OpenJS.NodeJS.LTS
  pause
  exit /b 1
)

if not exist backend\venv (
  echo Primera vez: creando el entorno del backend...
  python -m venv backend\venv
)

echo Instalando dependencias del backend...
backend\venv\Scripts\python.exe -m pip install -q -r backend\requirements.txt

if not exist frontend\node_modules (
  echo Primera vez: instalando dependencias del frontend, puede tardar un par de minutos...
  pushd frontend
  call npm install
  popd
)

start "Life Track - Backend" cmd /k "cd /d backend && venv\Scripts\activate && uvicorn app.main:app --reload"
start "Life Track - Frontend" cmd /k "cd /d frontend && npm run dev"

timeout /t 3 /nobreak >nul
start "" http://localhost:5173

echo.
echo Life Track arrancando en dos ventanas nuevas (backend :8000, frontend :5173).
echo Cierra esas dos ventanas para parar los servidores.
pause
