---
paths:
  - "apps/catalog/**"
---

# Catalog — Python FastAPI

**Stack:** Python 3.11, FastAPI, SQLModel, PostgreSQL 15 + pgvector, Alembic

## Commands (run from apps/catalog/)

```bash
make dev          # docker + migrations + server
make run          # uvicorn app.main:app --reload (port 8004)
make migrate      # alembic upgrade head
pytest tests/ -v  # all tests (76 passing)
python -m app.eval.cli --help  # eval CLI
```

## Key paths

```
app/
  api/v1/        # FastAPI routes
  eval/          # eval framework (scorer plugin system)
    scorers/     # one file per scorer — new score = new file here
  models/        # SQLModel table models
  schemas/       # Pydantic request/response schemas
  services/      # business logic
  database/      # database.py exports `engine`
alembic/versions/ # migrations
tests/
  eval/          # eval tests + datasets + prompts + notebook
    weights.json # global scorer weights
    prompts/     # versioned system prompts (v1.md, v2.md …)
```

## Conventions

- DB engine import: `from app.database.database import engine` (not app.core)
- New scorer: create `app/eval/scorers/<name>.py`, register in `scorers/__init__.py`
- Eval routes import from `app.eval.*`, never from eval_service (deleted)
- Tests use SQLite in-memory; pgvector not needed in tests
