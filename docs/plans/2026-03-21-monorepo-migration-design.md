# Nutri-IA Monorepo Migration Design

**Date:** 2026-03-21
**Status:** Approved
**Migration Approach:** Simplified copy without git history

---

## Overview

Migrate three separate repositories (nutria-frontend, nutria-backend, nutria-catalog) into a single monorepo structure at `/Users/vinic/nutri-ia`.

### Source Repositories
- `/Users/vinic/company/nutria-frontend` - React + Next.js
- `/Users/vinic/company/nutria-backend` - Mastra (Node.js/TypeScript)
- `/Users/vinic/company/nutria-catalog` - FastAPI + Hugging Face + embeddings

---

## 1. Target Directory Structure

```
nutri-ia/
├── apps/
│   ├── frontend/          # React + Next.js
│   │   ├── .env.local     # Environment variables
│   │   ├── Dockerfile
│   │   ├── docker-compose.yml
│   │   ├── package.json
│   │   ├── README.md
│   │   └── ... (frontend code)
│   │
│   ├── backend/           # Mastra
│   │   ├── .env
│   │   ├── Dockerfile
│   │   ├── docker-compose.yml
│   │   ├── package.json
│   │   ├── README.md
│   │   └── ... (backend code)
│   │
│   └── catalog/           # FastAPI + Hugging Face
│       ├── .env
│       ├── Dockerfile
│       ├── docker-compose.yml
│       ├── Makefile       # Existing catalog Makefile
│       ├── requirements.txt
│       ├── README.md
│       └── ... (catalog code)
│
├── .git/                  # Monorepo git
├── .gitignore             # Consolidated gitignore
├── Makefile               # Orchestration for all 3 apps
├── README.md              # Main documentation
└── docs/
    └── plans/
```

### Key Characteristics
- Each app maintains its internal structure unchanged
- Each app keeps its own `.env`, `Dockerfile`, `docker-compose.yml`
- Single `.gitignore` at root (consolidated)
- Root `Makefile` for global commands
- Main README + individual READMEs per app

---

## 2. Migration Process

### Git Migration Strategy
**Approach:** Simplified copy without preserving git history

**Rationale:**
- Simplicity over complexity
- Clean start for the monorepo
- Original repos remain as backup in `/Users/vinic/company/nutria-*`

### Migration Steps

```bash
# Step 1: Prepare structure
cd /Users/vinic/nutri-ia
mkdir -p apps

# Step 2: Copy each repository (without .git history)
cp -r /Users/vinic/company/nutria-frontend apps/frontend
cp -r /Users/vinic/company/nutria-backend apps/backend
cp -r /Users/vinic/company/nutria-catalog apps/catalog

# Step 3: Clean .git folders from copied apps
rm -rf apps/frontend/.git
rm -rf apps/backend/.git
rm -rf apps/catalog/.git

# Step 4: Remove duplicate config files (will consolidate at root)
rm -f apps/frontend/.gitignore
rm -f apps/backend/.gitignore
rm -f apps/catalog/.gitignore
```

**Note:** Original repositories in `/Users/vinic/company/nutria-*` remain intact as backup.

---

## 3. Configuration: .gitignore

### Consolidated .gitignore at Root

```gitignore
# Node.js (frontend + backend)
node_modules/
.next/
.turbo/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*
dist/
build/
out/

# Python (catalog)
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
venv/
env/
.venv/
*.egg-info/
.pytest_cache/
.mypy_cache/
.ruff_cache/

# Environment variables
.env
.env.local
.env.*.local
*.env

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Docker
*.log

# Hugging Face / ML (catalog)
models/
*.pt
*.pth
*.onnx
*.h5
wandb/
```

**Strategy:**
- Single `.gitignore` at root covers all apps
- Organized by technology (Node.js, Python, IDE, OS, ML)
- Includes ML-specific patterns for Hugging Face models

---

## 4. Makefile: Orchestration

### Root Makefile Commands

```makefile
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
```

### Key Features
- `make help` - Display all available commands
- `make install` - Install all dependencies at once
- `make build` - Build all Docker images
- `make start` - Start all services
- `make stop` - Stop all services
- Individual app commands (e.g., `make frontend-start`)
- Based on existing catalog Makefile

---

## 5. Documentation

### Main README.md Structure

```markdown
# Nutri-IA Monorepo

Monorepo containing the three main services of the Nutri-IA platform.

## Structure
- **apps/frontend** - Web interface (React + Next.js)
- **apps/backend** - Main API (Mastra)
- **apps/catalog** - Embeddings and ML service (FastAPI + Hugging Face)

## Quick Start
### Prerequisites
- Node.js 18+
- Python 3.10+
- Docker and Docker Compose

### Installation
make install

### Development
make start

### Commands
make help      # See all commands
make build     # Build all apps
make test      # Run tests
make stop      # Stop services
make logs      # View logs

## Documentation per App
- [Frontend README](./apps/frontend/README.md)
- [Backend README](./apps/backend/README.md)
- [Catalog README](./apps/catalog/README.md)

## Development
Each app maintains independence (own .env, Dockerfile, docker-compose)
Global configuration in root `.gitignore`
Orchestration via `Makefile`

## Environment Variables
Each app has its own `.env` file:
- `apps/frontend/.env.local`
- `apps/backend/.env`
- `apps/catalog/.env`
```

### Per-App Documentation
- Each app keeps its original `README.md` with specific details
- Main README links to individual READMEs

---

## 6. Post-Migration Validation Checklist

```bash
# Directory structure
□ apps/ folder created with frontend, backend, catalog
□ Each app has original files (Dockerfile, docker-compose, etc.)
□ .git folders removed from individual apps
□ Only one .git at monorepo root

# Configuration
□ .gitignore created at root
□ Makefile created at root and functional
□ Main README.md created
□ Each app retains its .env (not committed)

# Git
□ git status shows clean structure
□ Initial commit created
□ No .git folders inside apps/

# Functionality
□ make help works
□ make install works for each app
□ make build works (Docker)
□ make start brings up all 3 services
□ Apps running and accessible
□ make stop stops services correctly

# Backup
□ Original repos in /Users/vinic/company/nutria-* intact
```

---

## 7. What We Will Do

1. Copy code from 3 repos to `apps/frontend`, `apps/backend`, `apps/catalog`
2. Remove individual `.git` folders
3. Create consolidated `.gitignore` at root
4. Create `Makefile` for orchestration
5. Create main `README.md`
6. Initial monorepo commit
7. Validate everything works

## What We Will NOT Do

- Preserve old git history (simplified approach)
- Create centralized docker-compose (each app keeps its own)
- Modify internal app code (only reorganize structure)

---

## Success Criteria

✅ All three apps copied to monorepo structure
✅ Single git repository with clean initial commit
✅ `make start` successfully runs all three services
✅ Each app maintains its independence and functionality
✅ Original repositories preserved as backup
✅ Documentation clear for new developers

---

## Next Steps

After design approval:
1. Create implementation plan with detailed steps
2. Execute migration
3. Validate with checklist
4. Test all services in new structure
