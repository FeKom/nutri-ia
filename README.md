# Nutri-IA Monorepo

Monorepo containing the three main services of the Nutri-IA platform.

## 📦 Structure

- **apps/frontend** - Web interface (React + Next.js)
- **apps/backend** - AI agent layer built with [Mastra](https://mastra.ai) (Node.js + TypeScript)
- **apps/catalog** - Nutrition data API with semantic search (FastAPI + PostgreSQL)

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

## 🛠️ Local Dev with mise + Docker

An alternative to the full Docker Compose stack: run only the database in Docker and each app locally via [mise](https://mise.jdx.dev).

### Prerequisites

- [mise](https://mise.jdx.dev/getting-started.html) — manages Node.js 22, Python 3.11 and pnpm automatically
- [Docker](https://docs.docker.com/get-docker/) or [Podman](https://podman.io) — for PostgreSQL only

### Setup (first time)

**1. Configure environment variables**

```bash
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env
cp apps/catalog/.env.example apps/catalog/.env
cp apps/frontend/.env.example apps/frontend/.env
```

Required values to fill in:

| Variable | File | How to get |
|---|---|---|
| `GITHUB_TOKEN` | `apps/backend/.env` | [github.com/settings/tokens](https://github.com/settings/tokens) — Models: Read |
| `BETTER_AUTH_SECRET` | `.env` + `apps/backend/.env` | `openssl rand -base64 32` |

**2. Start the database**

```bash
mise run docker-infra
```

**3. Install all dependencies**

```bash
mise run install
```

**4. Seed the food database**

```bash
mise run seed-taco
```

### Running the apps

Open three terminals:

```bash
# Terminal 1 — Catalog API → http://127.0.0.1:8004
mise run catalog-start

# Terminal 2 — Backend (Mastra) → http://127.0.0.1:4111
mise run backend-start

# Terminal 3 — Frontend (Next.js) → http://localhost:3000
mise run frontend-start
```

`catalog-start` runs Alembic migrations automatically before starting the server.

### All available tasks

```bash
mise tasks   # list everything
```

| Task | Description |
|---|---|
| `mise run install` | Install all dependencies |
| `mise run docker-infra` | Start PostgreSQL via Docker |
| `mise run docker-infra-down` | Stop PostgreSQL |
| `mise run catalog-start` | Migrations + Catalog API |
| `mise run backend-start` | Backend (Mastra) dev server |
| `mise run frontend-start` | Frontend (Next.js) dev server |
| `mise run migrate` | Run Alembic migrations |
| `mise run db-reset` | Drop and re-run all migrations |
| `mise run seed-taco` | Import TACO food database |
| `mise run test` | Run all tests |
| `mise run lint` | Lint all apps |
| `mise run typecheck` | Type-check all apps |
| `mise run docker-up` | Start everything via Docker Compose |
| `mise run docker-down` | Stop all Docker services |

---

## 🤖 GitHub Models Setup (Free LLM Access)

Nutria uses [GitHub Models](https://github.com/marketplace/models) as the LLM provider — no paid API required.

**1. Generate a token**

Go to [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens), create a fine-grained token with **Models → Read** permission.

**2. Add it to the backend**

```bash
# apps/backend/.env
GITHUB_TOKEN=your-token-here
MODEL=github-models/openai/gpt-4.1-mini   # or any other GitHub Models model
```

> Tip: use a `mini` or `nano` model during development to save your free quota.

For the full list of available models, see [github.com/marketplace/models](https://github.com/marketplace/models).

## 📚 Documentation per App

Each app has its own detailed documentation:

- [Frontend README](./apps/frontend/README.md)
- [Backend README](./apps/backend/README.md)
- [Catalog README](./apps/catalog/README.md)

## 🛠️ Development

### Architecture

Nutria is a **nutrition assistant powered by Generative AI**. The system is split into three layers:

```
Frontend (Next.js)
    └── Backend — Mastra agents (Node.js + TypeScript)
            └── Catalog API — food data + semantic search (FastAPI + PostgreSQL)
```

**Backend — Mastra Agents**
- Agents are created with [Mastra](https://mastra.ai), which handles the agent loop, memory, and tool execution
- **LLM provider**: [GitHub Models](https://github.com/marketplace/models) — free tier used for both the main agent model and the Phi-4-mini intent classifier
- **Tool injection by intent**: a `ToolInjectorProcessor` detects the user's intent (regex fast-path for ~90% of cases, Phi-4-mini fallback for ambiguous messages) and injects only the relevant tools per turn — avoiding wasted context tokens
- **Hybrid memory**: message history (last N turns) + semantic recall via pgvector (HNSW index) + structured working memory template
- **Evals**: a stateless eval agent (no memory) runs against a golden dataset to measure agent quality over time

**Catalog API — Semantic Search**
- Food database with embeddings generated by `intfloat/multilingual-e5-small` (via SentenceTransformer)
- **Hybrid search**: 85% pgvector cosine similarity + 15% pg_trgm trigram similarity for robust food name matching
- Query normalization strips quantities and cooking methods before embedding (e.g. "frango grelhado 100g" → "frango")
- E5 asymmetric search: documents indexed with `passage:` prefix, queries use `query:` prefix

**Monorepo setup**
- Each app maintains independence (own `.env`, Dockerfile, docker-compose)
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

## 📊 Eval Experiments

Experiments tracking agent quality over time. Full analysis in [`apps/catalog/tests/eval/analysis/notebooks/eval_dashboard.ipynb`](./apps/catalog/tests/eval/analysis/notebooks/eval_dashboard.ipynb).

| Experiment | Date | Dataset | Retrieval | Runs |
|---|---|---|---|---|
| `FIX_ALPHANUMERIC_SEARCH_RETRIEVAL_JSON` | 2026-04-06 | golden | json | 10 |
| `prompt v2 tool refactor ingested` | 2026-04-06 | golden | pdf | 10 |
| `prompt_v2_tools_refactor` | 2026-04-06 | golden | json | 10 |
| `prompt_v2_multilingual` | 2026-03-27 | golden | json | 20 |
| `prompt_v1_10_tools` | 2026-03-27 | golden | json | 10 |
| `prompt_padrao_v1_10` | 2026-03-27 | golden | json | 20 |
| `prompt_padrao_v1_tools` | 2026-03-26 | golden | json | 60 |
| `prompt_padrao_v1` | 2026-03-26 | golden | json | 100 |

Scores and visualizations are generated by the notebook — open it in Jupyter with the **Nutria Catalog** kernel.

## 📝 Contributing

1. Create a branch from `main`
2. Make your changes
3. Run tests with `make test`
4. Open a Pull Request
