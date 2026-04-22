---
paths:
  - "apps/frontend/**"
---

# Frontend — Next.js (TypeScript)

**Stack:** Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, better-auth

## Commands (run from apps/frontend/)

```bash
pnpm dev      # next dev --turbopack (port 3000)
pnpm build    # next build
pnpm lint     # eslint
pnpm generate:catalog-types  # regenerate catalog API types from openapi.json
```

## Key paths

```
src/
  app/        # Next.js App Router pages and layouts
  components/ # React components
  lib/        # utilities, auth config
  shared/     # shared types and helpers
  types/      # generated types (catalog.ts from openapi.json)
  web/        # web-specific components
  mobile/     # mobile-specific components
```

## Conventions

- Catalog API types are generated — edit `openapi.json` in catalog, then run `generate:catalog-types`
- Auth via better-auth (same lib as backend)
- Use App Router conventions (`page.tsx`, `layout.tsx`, `loading.tsx`)
