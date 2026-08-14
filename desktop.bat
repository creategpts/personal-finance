@echo off
setlocal
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo Falta Python. Instalalo desde https://www.python.org/downloads/ ^(marca "Add python.exe to PATH" durante la instalacion^) o con: winget install Python.Python.3.12
  pause
  exit /b 1
)

if not exist backend\venv (
  echo Primera vez: creando el entorno del backend...
  python -m venv backend\venv
)

echo Instalando dependencias del backend...
backend\venv\Scripts\python.exe -m pip install -q -r backend\requirements.txt

rem ponytail: solo construye si falta dist -- si tocas el frontend, borra
rem frontend\dist (o usa start.bat) para forzar un rebuild.
if not exist frontend\dist (
  where npm >nul 2>nul
  if errorlevel 1 (
    echo Falta Node.js. Instalalo desde https://nodejs.org/ ^(version LTS^) o con: winget install OpenJS.NodeJS.LTS
    pause
    exit /b 1
  )
  if not exist frontend\node_modules (
    echo Primera vez: instalando dependencias del frontend, puede tardar un par de minutos...
    pushd frontend
    call npm install
    popd
  )
  echo Construyendo el frontend...
  pushd frontend
  call npm run build
  popd
)

rem Mismo backend que start.bat -- no pueden convivir en el puerto 8000, asi
rem que si ya hay uno corriendo (start.bat, u otro desktop.bat), lo cerramos.
echo Cerrando Life Track si ya estaba corriendo...
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'uvicorn.*app\.main:app' -or $_.CommandLine -match 'desktop\.py' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

cd backend
rem pythonw (sin consola) en vez de python -- la ventana de la app es la unica
rem que se ve; esta consola se cierra sola al llegar al final del script.
start "" venv\Scripts\pythonw.exe desktop.py
