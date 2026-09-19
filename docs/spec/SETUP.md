# Development setup

## Prerequisites

- Bun 1.x
- A recent TypeScript-compatible editor
- Linux is the deployment target; local development also works on Windows/macOS.

## Commands

```sh
bun install          # install development dependencies
bun run dev          # watch mode
bun run start        # start once
bun test             # unit tests
bun run typecheck    # strict TypeScript check
bun run build        # emit build/main.js
bun run validate     # typecheck, tests, then build
```

Configuration:

- `GLANSK_HOST` defaults to `127.0.0.1`.
- `GLANSK_PORT` defaults to `3000`.
- `GLANSK_DATA_DIR` defaults to `runtime/data` (reserved for persistence wiring).

## Bootstrap API

- `GET /health`
- `PUT /api/v1/canvases/:id/draft`
- `POST /api/v1/canvases/:id/publish`
- `GET /api/v1/canvases/:id/published`
- `GET|PUT|PATCH /api/v1/state/:encodedChannel`

These routes support foundation testing only and are not a finalized public API. Do not expose the service beyond localhost: authentication and production security boundaries are pending.
