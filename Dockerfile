# Multi-stage Dockerfile for Uriel Full-Stack Production Deploy

# --- Stage 1: Build React Frontend ---
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# --- Stage 2: Python Backend & Unified Production Image ---
FROM python:3.10-slim AS runner

WORKDIR /app

# Install system build dependencies and curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast Python package resolution
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy Python project specs and install dependencies into system environment
COPY pyproject.toml uv.lock ./
RUN uv pip install --system -r pyproject.toml

# Copy project files
COPY backend ./backend
COPY data ./data
COPY main.py .

# Copy built frontend from Stage 1 into the runner
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Pre-download NLTK stopwords & wordnet so container startup is instant
RUN python -c "import nltk; nltk.download('stopwords', quiet=True); nltk.download('wordnet', quiet=True)"

# Create persistent storage directories
RUN mkdir -p /app/backend/app/data /app/data/documents

# Set production environment variables
ENV ENV=production
ENV HOST=0.0.0.0
ENV PORT=10000
ENV AUTO_INDEX_ON_STARTUP=true
ENV ENABLE_FILE_WATCHER=false
ENV DB_PATH=/app/backend/app/data/uriel.db
ENV DATA_DIR=/app/data/documents

EXPOSE 10000

CMD ["python", "main.py"]
