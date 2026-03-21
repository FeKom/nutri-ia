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
