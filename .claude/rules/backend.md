---
paths:
  - "apps/backend/**"
---

# Backend — Mastra.ai Agent (TypeScript)

**Stack:** TypeScript, Mastra.ai, Vercel AI SDK, better-auth, Vitest

## Commands (run from apps/backend/)

```bash
pnpm dev      # mastra dev (dev server)
pnpm build    # mastra build
pnpm test     # vitest run
```

## Key paths

```
src/
  mastra/
    index.ts          # Mastra instance, API routes, middleware
    agents/           # AI agents (nutrition-analyst, eval-agent)
    workflows/        # Mastra workflows
    config/           # memory, storage, guardrails, summarizer, env
  lib/                # jwt-auth, rate-limiter, async-context
  utils/              # user-profile-loader, catalog-client
```

## Conventions

- Agents live in `src/mastra/agents/`
- Workflows live in `src/mastra/workflows/`
- Config (memory, guardrails, env validation) in `src/mastra/config/`
- Rate limiting and JWT auth are middleware in `src/lib/`
- Catalog API calls go through `src/mastra/utils/catalog-client.ts` (not direct HTTP)
- Env vars validated at startup via `src/mastra/config/env.ts`
