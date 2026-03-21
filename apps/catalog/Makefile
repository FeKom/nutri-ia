.PHONY: help install docker-up docker-down migrate run test clean

help:
	@echo "Available commands:"
	@echo "  make install     - Install Python dependencies"
	@echo "  make docker-up   - Start Docker containers"
	@echo "  make docker-down - Stop Docker containers"
	@echo "  make migrate     - Run database migrations"
	@echo "  make run         - Start the API server"
	@echo "  make dev         - Start everything (docker + migrations + server)"
	@echo "  make clean       - Clean up Python cache files"
	@echo "  make reset-db    - Reset database (WARNING: deletes all data)"

install:
	pip install -r requirements.txt

docker-up:
	docker-compose up -d
	@echo "Waiting for PostgreSQL to be ready..."
	@sleep 5

docker-down:
	docker-compose down

migrate:
	alembic upgrade head

run:
	uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev: docker-up
	@echo "Waiting for PostgreSQL to initialize..."
	@sleep 8
	@make migrate
	@make run

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	find . -type f -name "*.pyo" -delete 2>/dev/null || true
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true

reset-db:
	docker-compose down -v
	docker-compose up -d
	@echo "Waiting for PostgreSQL to be ready..."
	@sleep 8
	alembic upgrade head
	@echo "Database reset complete!"
