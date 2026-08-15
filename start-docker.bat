@echo off
setlocal
cd /d "%~dp0"

where docker >nul 2>nul
if errorlevel 1 (
  echo Falta Docker. Instala Docker Desktop desde https://www.docker.com/products/docker-desktop/ y vuelve a abrir esto.
  pause
  exit /b 1
)

rem El daemon (Docker Desktop) tiene que estar corriendo. Si no, lo arrancamos y esperamos.
docker info >nul 2>nul
if errorlevel 1 (
  echo Arrancando Docker Desktop... puede tardar unos segundos la primera vez.
  start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
  for /l %%i in (1,1,60) do (
    timeout /t 2 /nobreak >nul
    docker info >nul 2>nul && goto :ready
  )
  echo Docker no arranco a tiempo. Abrelo a mano y vuelve a intentarlo.
  pause
  exit /b 1
)
:ready

echo Construyendo y arrancando Life Track...
docker compose up -d --build
if errorlevel 1 (
  echo Fallo el arranque. Revisa el mensaje de arriba.
  pause
  exit /b 1
)

rem Esperar a que el backend responda antes de abrir el navegador.
for /l %%i in (1,1,30) do (
  curl -s -o nul http://localhost:8000/api/health && goto :open
  timeout /t 1 /nobreak >nul
)
:open

start "" http://localhost:8000
echo.
echo Life Track corriendo en http://localhost:8000
echo Para pararlo: 'docker compose down' en esta carpeta, o desde Docker Desktop.
pause
