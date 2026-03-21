.PHONY: help install build start stop test clean logs

# Default target
help:
	@echo "Nutri-IA Monorepo - Available Commands:"
	@echo ""
	@echo "  make install    - Install dependencies for all apps"
	@echo "  make build      - Build all apps (Docker)"
	@echo "  make start      - Start all apps"
	@echo "  make stop       - Stop all apps"
	@echo "  make test       - Run tests for all apps"
	@echo "  make clean      - Clean builds and dependencies"
	@echo "  make logs       - Show logs from all apps"
	@echo ""
	@echo "Individual commands:"
	@echo "  make frontend-*   - Frontend commands"
	@echo "  make backend-*    - Backend commands"
	@echo "  make catalog-*    - Catalog commands"

# Install dependencies
install: frontend-install backend-install catalog-install

frontend-install:
	@echo "Installing frontend dependencies..."
	cd apps/frontend && npm install

backend-install:
	@echo "Installing backend dependencies..."
	cd apps/backend && npm install

catalog-install:
	@echo "Installing catalog dependencies..."
	cd apps/catalog && pip install -r requirements.txt

# Build (Docker)
build: frontend-build backend-build catalog-build

frontend-build:
	cd apps/frontend && docker-compose build

backend-build:
	cd apps/backend && docker-compose build

catalog-build:
	cd apps/catalog && docker-compose build

# Start services
start: frontend-start backend-start catalog-start

frontend-start:
	cd apps/frontend && docker-compose up -d

backend-start:
	cd apps/backend && docker-compose up -d

catalog-start:
	cd apps/catalog && docker-compose up -d

# Stop services
stop:
	cd apps/frontend && docker-compose down
	cd apps/backend && docker-compose down
	cd apps/catalog && docker-compose down

# Tests
test: frontend-test backend-test catalog-test

frontend-test:
	cd apps/frontend && npm test

backend-test:
	cd apps/backend && npm test

catalog-test:
	cd apps/catalog && pytest

# Logs
logs:
	@echo "=== Frontend Logs ==="
	cd apps/frontend && docker-compose logs --tail=50
	@echo "\n=== Backend Logs ==="
	cd apps/backend && docker-compose logs --tail=50
	@echo "\n=== Catalog Logs ==="
	cd apps/catalog && docker-compose logs --tail=50

# Clean
clean:
	cd apps/frontend && rm -rf node_modules .next
	cd apps/backend && rm -rf node_modules dist
	cd apps/catalog && rm -rf __pycache__ .pytest_cache venv
