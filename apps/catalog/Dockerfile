# --- Builder (compile native deps) ---
FROM python:3.11-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

COPY pyproject.toml uv.lock* ./
RUN uv sync --frozen --no-dev --no-install-project

# --- Production ---
FROM python:3.11-slim

WORKDIR /app

# Runtime deps only (libpq for psycopg2)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

ENV PATH="/app/.venv/bin:$PATH"

# Copy the virtual environment from builder
COPY --from=builder /app/.venv /app/.venv

# Copy application code
COPY . .

# Non-root user; /cache is owned by appuser so sentence-transformers can write its model cache
RUN addgroup --system --gid 1001 appuser && \
    adduser --system --uid 1001 --gid 1001 --home /home/appuser appuser && \
    mkdir -p /home/appuser /cache/huggingface && \
    chown -R appuser:appuser /home/appuser /cache
USER appuser

ENV HF_HOME=/cache/huggingface

EXPOSE 8000

CMD ["sh", "-c", "uv run alembic upgrade head && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000"]
