.PHONY: help start stop install migrate \
        frontend-start backend-start catalog-start \
        frontend-install backend-install catalog-install \
        seed-taco seed-taco-dry \
        test test-backend test-catalog \
        lint lint-frontend lint-backend \
        typecheck typecheck-frontend typecheck-backend \
        check \
        db-reset generate-types \
        dev build restart logs logs-f ps clean \
        logs-frontend logs-backend logs-catalog logs-postgres \
        build-backend build-catalog \
        push-backend push-catalog

# ── Colours ────────────────────────────────────────────────────────────────
CYAN  := \033[0;36m
GREEN := \033[0;32m
RESET := \033[0m

# ── nvm ─────────────────────────────────────────────────────────────────────
# Source nvm so Make subshells use the version pinned in .nvmrc (node 22).
# Homebrew node (25.x) breaks due to a simdjson dylib version mismatch.
NVM_INIT := export NVM_DIR="$$HOME/.nvm"; [ -s "$$NVM_DIR/nvm.sh" ] && . "$$NVM_DIR/nvm.sh"; nvm use --silent

# ── Image config (GHCR) ─────────────────────────────────────────────────────
# Override via: make build-backend GITHUB_USER=youruser TAG=v1.2
GITHUB_USER ?= $(shell git config user.name | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
TAG         ?= $(shell git rev-parse --short HEAD)
BACKEND_IMG  = ghcr.io/$(GITHUB_USER)/nutria-backend:$(TAG)
CATALOG_IMG  = ghcr.io/$(GITHUB_USER)/nutria-catalog:$(TAG)

help:
	@echo ""
	@echo "$(CYAN)Nutri-IA Monorepo$(RESET)"
	@echo ""
	@echo "$(GREEN)Local development (no Docker for apps):$(RESET)"
	@echo "  make start              - Run all three apps concurrently"
	@echo "  make frontend-start     - Run frontend only  (pnpm dev, :3000)"
	@echo "  make backend-start      - Run backend only   (pnpm dev, :4111)"
	@echo "  make catalog-start      - Run catalog only   (uvicorn,  :8004)"
	@echo ""
	@echo "$(GREEN)Quality:$(RESET)"
	@echo "  make check              - lint + typecheck + test (full CI pass)"
	@echo "  make test               - Run all tests"
	@echo "  make test-backend       - vitest (backend)"
	@echo "  make test-catalog       - pytest (catalog)"
	@echo "  make lint               - Lint frontend and backend"
	@echo "  make lint-frontend      - ESLint on frontend"
	@echo "  make lint-backend       - ESLint on backend"
	@echo "  make typecheck          - Type-check frontend and backend"
	@echo "  make typecheck-frontend - tsc --noEmit on frontend"
	@echo "  make typecheck-backend  - tsc --noEmit on backend"
	@echo ""
	@echo "$(GREEN)Database:$(RESET)"
	@echo "  make migrate            - Run Alembic migrations (create/update tables)"
	@echo "  make db-reset           - Drop everything and re-run migrations (DANGER)"
	@echo "  make seed-taco          - Import ~600 TACO Brazilian foods into the DB"
	@echo "  make seed-taco-dry      - Dry-run: validate without writing to DB"
	@echo "  make generate-types     - Regenerate catalog TypeScript types from OpenAPI"
	@echo ""
	@echo "$(GREEN)Dependencies:$(RESET)"
	@echo "  make install            - Install deps for all apps"
	@echo "  make frontend-install   - pnpm install in apps/frontend"
	@echo "  make backend-install    - pnpm install in apps/backend"
	@echo "  make catalog-install    - pip install in apps/catalog venv"
	@echo ""
	@echo "$(GREEN)Docker (full stack):$(RESET)"
	@echo "  make dev                - docker-compose up -d"
	@echo "  make build              - docker-compose build --no-cache"
	@echo "  make stop               - docker-compose down"
	@echo "  make restart            - stop + dev"
	@echo "  make logs               - last 100 lines of all services"
	@echo "  make logs-f             - follow logs"
	@echo "  make ps                 - list running containers"
	@echo "  make clean              - remove containers, volumes and images"
	@echo ""
	@echo "$(GREEN)Production images (GHCR):$(RESET)"
	@echo "  make build-backend      - build backend prod image"
	@echo "  make build-catalog      - build catalog prod image"
	@echo "  make push-backend       - build + push backend to ghcr.io"
	@echo "  make push-catalog       - build + push catalog to ghcr.io"
	@echo "  GITHUB_USER=xxx TAG=v1.0 make push-backend  - explicit user/tag"
	@echo ""

# ── Local development ───────────────────────────────────────────────────────

start: migrate
	@echo "$(CYAN)Starting frontend, backend and catalog...$(RESET)"
	@echo "$(GREEN)  frontend$(RESET) → http://localhost:3000"
	@echo "$(GREEN)  backend $(RESET) → http://localhost:4111"
	@echo "$(GREEN)  catalog $(RESET) → http://localhost:8004"
	@echo "Press Ctrl+C to stop all services."
	@echo ""
	@trap 'kill 0' INT; \
	($(NVM_INIT) && cd apps/frontend && pnpm dev 2>&1 | sed 's/^/\033[0;36m[frontend]\033[0m /') & \
	($(NVM_INIT) && cd apps/backend  && pnpm dev 2>&1 | sed 's/^/\033[0;33m[backend ]\033[0m /') & \
	(cd apps/catalog  && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8004 2>&1 | sed 's/^/\033[0;32m[catalog ]\033[0m /') & \
	wait

frontend-start:
	@$(NVM_INIT) && cd apps/frontend && pnpm dev

backend-start:
	@$(NVM_INIT) && cd apps/backend && pnpm dev

catalog-start: migrate
	cd apps/catalog && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8004

# ── Install ─────────────────────────────────────────────────────────────────

install: frontend-install backend-install catalog-install

migrate:
	@echo "Ensuring postgres is running..."
	docker-compose up -d postgres
	@echo "Running Alembic migrations..."
	cd apps/catalog && uv run alembic upgrade head
	@echo "Migrations done."

db-reset:
	@echo "This will drop all tables and re-run migrations. Continue? [y/N] "; \
	read REPLY; \
	if [ "$$REPLY" = "y" ] || [ "$$REPLY" = "Y" ]; then \
		cd apps/catalog && uv run alembic downgrade base && uv run alembic upgrade head; \
		echo "Database reset complete."; \
	else \
		echo "Cancelled."; \
	fi

# ── Tests ────────────────────────────────────────────────────────────────────

test: test-backend test-catalog

test-backend:
	@$(NVM_INIT) && cd apps/backend && pnpm test

test-catalog:
	cd apps/catalog && uv run pytest tests/ -v --tb=short

# ── Lint ─────────────────────────────────────────────────────────────────────

lint: lint-frontend lint-backend

lint-frontend:
	@$(NVM_INIT) && cd apps/frontend && pnpm exec eslint src/

lint-backend:
	@$(NVM_INIT) && cd apps/backend && pnpm exec eslint src/

# ── Typecheck ────────────────────────────────────────────────────────────────

typecheck: typecheck-frontend typecheck-backend

typecheck-frontend:
	@$(NVM_INIT) && cd apps/frontend && node_modules/.bin/tsc --noEmit

typecheck-backend:
	@$(NVM_INIT) && cd apps/backend && node_modules/.bin/tsc --noEmit

# ── Full CI pass ─────────────────────────────────────────────────────────────

check: lint typecheck test

# ── Code generation ──────────────────────────────────────────────────────────

generate-types:
	@$(NVM_INIT) && cd apps/frontend && pnpm run generate:catalog-types

seed-taco:
	cd apps/catalog && uv run python scripts/import_taco.py

seed-taco-dry:
	cd apps/catalog && uv run python scripts/import_taco.py --dry-run

frontend-install:
	@$(NVM_INIT) && cd apps/frontend && pnpm install

backend-install:
	@$(NVM_INIT) && cd apps/backend && pnpm install

catalog-install:
	cd apps/catalog && uv sync

# ── Docker ──────────────────────────────────────────────────────────────────

dev:
	@echo "Starting all services via Docker..."
	@if [ ! -f .env ]; then \
		echo "Warning: .env not found. Copying from .env.example..."; \
		cp .env.example .env; \
		echo "Configure .env before continuing."; \
		exit 1; \
	fi
	docker-compose up -d
	@echo ""
	@echo "Services available:"
	@echo "  Frontend:  http://localhost:3000"
	@echo "  Backend:   http://localhost:4111"
	@echo "  Catalog:   http://localhost:8004"
	@echo "  Postgres:  localhost:5432"

build:
	docker-compose build --no-cache

stop:
	docker-compose down

restart: stop dev

logs:
	docker-compose logs --tail=100

logs-f:
	docker-compose logs -f

logs-frontend:
	docker-compose logs -f frontend

logs-backend:
	docker-compose logs -f backend

logs-catalog:
	docker-compose logs -f catalog

logs-postgres:
	docker-compose logs -f postgres

ps:
	@docker-compose ps

# ── Production images (GHCR) ─────────────────────────────────────────────────

build-backend:
	@echo "$(CYAN)Building backend prod image → $(BACKEND_IMG)$(RESET)"
	docker build --target prod -t $(BACKEND_IMG) apps/backend

build-catalog:
	@echo "$(CYAN)Building catalog prod image → $(CATALOG_IMG)$(RESET)"
	docker build -t $(CATALOG_IMG) apps/catalog

push-backend: build-backend
	@echo "$(CYAN)Pushing $(BACKEND_IMG) to GHCR...$(RESET)"
	docker push $(BACKEND_IMG)
	@echo "$(GREEN)Done: $(BACKEND_IMG)$(RESET)"

push-catalog: build-catalog
	@echo "$(CYAN)Pushing $(CATALOG_IMG) to GHCR...$(RESET)"
	docker push $(CATALOG_IMG)
	@echo "$(GREEN)Done: $(CATALOG_IMG)$(RESET)"

clean:
	@echo "This will delete all container data. Continue? [y/N] "; \
	read REPLY; \
	if [ "$$REPLY" = "y" ] || [ "$$REPLY" = "Y" ]; then \
		docker-compose down -v --rmi local; \
		rm -rf apps/frontend/node_modules apps/backend/node_modules; \
		rm -rf apps/frontend/.next apps/backend/dist apps/backend/.mastra; \
		echo "Done."; \
	else \
		echo "Cancelled."; \
	fi
