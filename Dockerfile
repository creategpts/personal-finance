# Multi-stage: Node builds the frontend to static files, Python serves them +
# the API from a single process. One image, one port (8000), no CORS.

FROM node:20-slim AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
# main.py resolves the frontend from ../../frontend/dist relative to itself, so
# mirror the repo layout: backend at /app/backend, dist at /app/frontend/dist.
COPY --from=frontend /frontend/dist /app/frontend/dist

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
