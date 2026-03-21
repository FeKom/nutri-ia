# Monorepo Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate nutria-frontend, nutria-backend, and nutria-catalog into a unified monorepo structure without preserving git history.

**Architecture:** Simple copy-based migration. Copy three independent repos into `apps/` subdirectories, remove their `.git` folders, create consolidated root configuration (`.gitignore`, `Makefile`, `README.md`), and commit as initial monorepo state.

**Tech Stack:** Bash, Git, Make

---

## Pre-Migration Verification

### Task 0: Verify Source Repositories Exist

**Files:**
- Check: `/Users/vinic/company/nutria-frontend`
- Check: `/Users/vinic/company/nutria-backend`
- Check: `/Users/vinic/company/nutria-catalog`

**Step 1: Verify all source repos exist**

Run:
```bash
ls -la /Users/vinic/company/nutria-frontend
ls -la /Users/vinic/company/nutria-backend
ls -la /Users/vinic/company/nutria-catalog
```

Expected: All three directories exist and contain code.

**Step 2: Verify current working directory**

Run:
```bash
pwd
```

Expected: `/Users/vinic/nutri-ia`

**Step 3: Verify git status is clean**

Run:
```bash
git status
```

Expected: Clean working tree (only docs/plans/ committed).

---

## Migration: Copy Repository Code

### Task 1: Create Apps Directory Structure

**Files:**
- Create: `apps/` directory

**Step 1: Create apps directory**

Run:
```bash
mkdir -p apps
```

Expected: Directory created successfully.

**Step 2: Verify directory created**

Run:
```bash
ls -la apps
```

Expected: Empty directory exists.

---

### Task 2: Copy Frontend Repository

**Files:**
- Create: `apps/frontend/` (entire directory from source)

**Step 1: Copy frontend repository**

Run:
```bash
cp -r /Users/vinic/company/nutria-frontend apps/frontend
```

Expected: Frontend code copied to `apps/frontend/`.

**Step 2: Verify frontend copied**

Run:
```bash
ls -la apps/frontend
```

Expected: See `package.json`, `Dockerfile`, `docker-compose.yml`, and other frontend files.

**Step 3: Check for .git folder**

Run:
```bash
ls -la apps/frontend/.git
```

Expected: `.git` folder exists (will be removed in next task).

---

### Task 3: Copy Backend Repository

**Files:**
- Create: `apps/backend/` (entire directory from source)

**Step 1: Copy backend repository**

Run:
```bash
cp -r /Users/vinic/company/nutria-backend apps/backend
```

Expected: Backend code copied to `apps/backend/`.

**Step 2: Verify backend copied**

Run:
```bash
ls -la apps/backend
```

Expected: See `package.json`, `Dockerfile`, `docker-compose.yml`, and other backend files.

---

### Task 4: Copy Catalog Repository

**Files:**
- Create: `apps/catalog/` (entire directory from source)

**Step 1: Copy catalog repository**

Run:
```bash
cp -r /Users/vinic/company/nutria-catalog apps/catalog
```

Expected: Catalog code copied to `apps/catalog/`.

**Step 2: Verify catalog copied**

Run:
```bash
ls -la apps/catalog
```

Expected: See `requirements.txt`, `Dockerfile`, `docker-compose.yml`, `Makefile`, and other catalog files.

---

## Migration: Clean Git History

### Task 5: Remove Individual Git Folders

**Files:**
- Delete: `apps/frontend/.git/`
- Delete: `apps/backend/.git/`
- Delete: `apps/catalog/.git/`

**Step 1: Remove frontend .git folder**

Run:
```bash
rm -rf apps/frontend/.git
```

Expected: `.git` folder removed from frontend.

**Step 2: Verify frontend .git removed**

Run:
```bash
ls -la apps/frontend/.git
```

Expected: "No such file or directory" error.

**Step 3: Remove backend .git folder**

Run:
```bash
rm -rf apps/backend/.git
```

Expected: `.git` folder removed from backend.

**Step 4: Remove catalog .git folder**

Run:
```bash
rm -rf apps/catalog/.git
```

Expected: `.git` folder removed from catalog.

**Step 5: Verify only root .git exists**

Run:
```bash
find . -name ".git" -type d
```

Expected: Only `./.git` shown (root level only).

---

### Task 6: Remove Individual Gitignore Files

**Files:**
- Delete: `apps/frontend/.gitignore`
- Delete: `apps/backend/.gitignore`
- Delete: `apps/catalog/.gitignore`

**Step 1: Remove frontend .gitignore**

Run:
```bash
rm -f apps/frontend/.gitignore
```

Expected: File removed (or no error if doesn't exist).

**Step 2: Remove backend .gitignore**

Run:
```bash
rm -f apps/backend/.gitignore
```

Expected: File removed (or no error if doesn't exist).

**Step 3: Remove catalog .gitignore**

Run:
```bash
rm -f apps/catalog/.gitignore
```

Expected: File removed (or no error if doesn't exist).

**Step 4: Verify no .gitignore in apps subdirectories**

Run:
```bash
find apps -name ".gitignore" -type f
```

Expected: No output (no .gitignore files found).

---

## Configuration: Root Files

### Task 7: Create Consolidated .gitignore

**Files:**
- Create: `.gitignore`

**Step 1: Create .gitignore file**

Write to `.gitignore`:
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

**Step 2: Verify .gitignore created**

Run:
```bash
cat .gitignore | head -20
```

Expected: See Node.js section at the top.

---

### Task 8: Create Root Makefile

**Files:**
- Create: `Makefile`

**Step 1: Create Makefile**

Write to `Makefile`:
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

**Step 2: Verify Makefile created**

Run:
```bash
head -20 Makefile
```

Expected: See `.PHONY` declaration and help target.

**Step 3: Test help command**

Run:
```bash
make help
```

Expected: Display all available commands with descriptions.

---

### Task 9: Create Root README

**Files:**
- Create: `README.md`

**Step 1: Create README.md**

Write to `README.md`:
```markdown
# Nutri-IA Monorepo

Monorepo containing the three main services of the Nutri-IA platform.

## 📦 Structure

- **apps/frontend** - Web interface (React + Next.js)
- **apps/backend** - Main API (Mastra)
- **apps/catalog** - Embeddings and ML service (FastAPI + Hugging Face)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (for frontend and backend)
- Python 3.10+ (for catalog)
- Docker and Docker Compose

### Installation

```bash
# Install all dependencies
make install

# Or install individually
make frontend-install
make backend-install
make catalog-install
```

### Development

```bash
# Start all services
make start

# Or individually
make frontend-start
make backend-start
make catalog-start
```

### Other Commands

```bash
make help      # See all commands
make build     # Build all apps (Docker)
make test      # Run tests
make stop      # Stop all services
make logs      # View logs
make clean     # Clean builds and dependencies
```

## 📚 Documentation per App

Each app has its own detailed documentation:

- [Frontend README](./apps/frontend/README.md)
- [Backend README](./apps/backend/README.md)
- [Catalog README](./apps/catalog/README.md)

## 🛠️ Development

### Architecture
- Each app maintains independence (own .env, Dockerfile, docker-compose)
- Global configuration in root `.gitignore`
- Orchestration via `Makefile`

### Environment Variables
Each app has its own `.env` file:
- `apps/frontend/.env.local`
- `apps/backend/.env`
- `apps/catalog/.env`

**Note:** `.env` files are gitignored and must be created locally.

## 🧪 Testing

```bash
# Run all tests
make test

# Run individual app tests
make frontend-test
make backend-test
make catalog-test
```

## 📝 Contributing

1. Create a branch from `main`
2. Make your changes
3. Run tests with `make test`
4. Open a Pull Request
```

**Step 2: Verify README created**

Run:
```bash
head -30 README.md
```

Expected: See title and structure section.

---

## Git: Initial Commit

### Task 10: Stage All Files

**Files:**
- Stage: `apps/`
- Stage: `.gitignore`
- Stage: `Makefile`
- Stage: `README.md`

**Step 1: Check git status**

Run:
```bash
git status
```

Expected: Shows untracked `apps/`, `.gitignore`, `Makefile`, `README.md`.

**Step 2: Add all files to git**

Run:
```bash
git add .
```

Expected: All files staged.

**Step 3: Verify staged files**

Run:
```bash
git status
```

Expected: Shows all new files staged for commit.

---

### Task 11: Create Initial Monorepo Commit

**Files:**
- Commit: All staged files

**Step 1: Create initial commit**

Run:
```bash
git commit -m "$(cat <<'EOF'
feat: initial monorepo setup

Migrate nutria-frontend, nutria-backend, and nutria-catalog into
unified monorepo structure.

Structure:
- apps/frontend: React + Next.js web interface
- apps/backend: Mastra API
- apps/catalog: FastAPI + Hugging Face ML service

Configuration:
- Root .gitignore (consolidated)
- Root Makefile (orchestration)
- Root README.md (main documentation)

Each app maintains its own:
- .env (environment variables)
- Dockerfile
- docker-compose.yml
- README.md (app-specific docs)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

Expected: Commit created successfully.

**Step 2: Verify commit**

Run:
```bash
git log --oneline -2
```

Expected: See "feat: initial monorepo setup" as latest commit.

**Step 3: Verify clean status**

Run:
```bash
git status
```

Expected: "nothing to commit, working tree clean".

---

## Post-Migration Validation

### Task 12: Verify Directory Structure

**Files:**
- Verify: `apps/frontend/`
- Verify: `apps/backend/`
- Verify: `apps/catalog/`

**Step 1: Check apps directory structure**

Run:
```bash
ls -la apps/
```

Expected: See `frontend/`, `backend/`, `catalog/` directories.

**Step 2: Verify frontend has key files**

Run:
```bash
ls apps/frontend/package.json apps/frontend/Dockerfile apps/frontend/docker-compose.yml
```

Expected: All files exist.

**Step 3: Verify backend has key files**

Run:
```bash
ls apps/backend/package.json apps/backend/Dockerfile apps/backend/docker-compose.yml
```

Expected: All files exist.

**Step 4: Verify catalog has key files**

Run:
```bash
ls apps/catalog/requirements.txt apps/catalog/Dockerfile apps/catalog/docker-compose.yml apps/catalog/Makefile
```

Expected: All files exist.

**Step 5: Verify no .git in apps**

Run:
```bash
find apps -name ".git" -type d
```

Expected: No output (no .git folders in apps).

---

### Task 13: Verify Configuration Files

**Files:**
- Verify: `.gitignore`
- Verify: `Makefile`
- Verify: `README.md`

**Step 1: Verify .gitignore exists**

Run:
```bash
test -f .gitignore && echo "EXISTS" || echo "MISSING"
```

Expected: "EXISTS"

**Step 2: Verify Makefile exists**

Run:
```bash
test -f Makefile && echo "EXISTS" || echo "MISSING"
```

Expected: "EXISTS"

**Step 3: Verify README exists**

Run:
```bash
test -f README.md && echo "EXISTS" || echo "MISSING"
```

Expected: "EXISTS"

**Step 4: Test Makefile help command**

Run:
```bash
make help
```

Expected: Display command list without errors.

---

### Task 14: Verify Git State

**Files:**
- Verify: `.git/` (root only)
- Verify: Git history

**Step 1: Check only root .git exists**

Run:
```bash
find . -name ".git" -type d
```

Expected: Only `./.git` (root level).

**Step 2: Verify git log**

Run:
```bash
git log --oneline
```

Expected: See design doc commit and initial monorepo commit.

**Step 3: Verify working tree is clean**

Run:
```bash
git status
```

Expected: "nothing to commit, working tree clean".

---

### Task 15: Verify Source Repos Intact (Backup Check)

**Files:**
- Verify: `/Users/vinic/company/nutria-frontend`
- Verify: `/Users/vinic/company/nutria-backend`
- Verify: `/Users/vinic/company/nutria-catalog`

**Step 1: Verify frontend source intact**

Run:
```bash
ls -la /Users/vinic/company/nutria-frontend/.git
```

Expected: `.git` folder exists (original repo untouched).

**Step 2: Verify backend source intact**

Run:
```bash
ls -la /Users/vinic/company/nutria-backend/.git
```

Expected: `.git` folder exists (original repo untouched).

**Step 3: Verify catalog source intact**

Run:
```bash
ls -la /Users/vinic/company/nutria-catalog/.git
```

Expected: `.git` folder exists (original repo untouched).

---

## Summary

**Migration Complete Checklist:**

✅ Task 0: Verified source repositories exist
✅ Task 1: Created apps/ directory
✅ Task 2: Copied frontend repository
✅ Task 3: Copied backend repository
✅ Task 4: Copied catalog repository
✅ Task 5: Removed individual .git folders
✅ Task 6: Removed individual .gitignore files
✅ Task 7: Created consolidated .gitignore
✅ Task 8: Created root Makefile
✅ Task 9: Created root README
✅ Task 10: Staged all files
✅ Task 11: Created initial commit
✅ Task 12: Verified directory structure
✅ Task 13: Verified configuration files
✅ Task 14: Verified git state
✅ Task 15: Verified source repos intact

**Next Steps After Migration:**

1. Test functionality: `make help`
2. Verify apps can build: `make build` (requires Docker running)
3. Configure .env files for each app if needed
4. Test starting services: `make start`
5. Validate apps are accessible
6. Run tests: `make test`

**Backup Location:**
Original repos preserved at:
- `/Users/vinic/company/nutria-frontend`
- `/Users/vinic/company/nutria-backend`
- `/Users/vinic/company/nutria-catalog`
