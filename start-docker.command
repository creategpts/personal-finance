#!/bin/bash
# Doble click para arrancar Life Track con Docker: abre Docker Desktop si hace
# falta, levanta el contenedor y abre el navegador. Para parar: ejecuta
# `docker compose down` en esta carpeta (o para el contenedor desde Docker Desktop).
cd "$(dirname "$0")"

if ! command -v docker >/dev/null; then
  echo "Falta Docker. Instala Docker Desktop desde https://www.docker.com/products/docker-desktop/ y vuelve a abrir esto."
  read -n 1 -s -r -p "Pulsa una tecla para cerrar..."
  exit 1
fi

# El daemon (Docker Desktop) tiene que estar corriendo para que `docker compose`
# funcione. Si no lo está, lo arrancamos y esperamos a que responda.
if ! docker info >/dev/null 2>&1; then
  echo "Arrancando Docker Desktop… (puede tardar unos segundos la primera vez)"
  open -a Docker
  for _ in $(seq 1 60); do
    docker info >/dev/null 2>&1 && break
    sleep 2
  done
  if ! docker info >/dev/null 2>&1; then
    echo "Docker no arrancó a tiempo. Ábrelo a mano (icono de la ballena) y vuelve a intentarlo."
    read -n 1 -s -r -p "Pulsa una tecla para cerrar..."
    exit 1
  fi
fi

echo "Construyendo y arrancando Life Track…"
docker compose up -d --build || {
  echo "Falló el arranque. Revisa el mensaje de arriba."
  read -n 1 -s -r -p "Pulsa una tecla para cerrar..."
  exit 1
}

# Esperar a que el backend responda antes de abrir el navegador.
for _ in $(seq 1 30); do
  curl -s -o /dev/null http://localhost:8000/api/health && break
  sleep 1
done

open http://localhost:8000
echo ""
echo "Life Track corriendo en http://localhost:8000"
echo "Para pararlo: 'docker compose down' en esta carpeta, o desde Docker Desktop."
