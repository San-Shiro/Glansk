# ADR-001: Monorepo Architecture & Licensing Model

## Status
Accepted

## Date
2026-09-19

## Context
Glansk started as an experimental single-folder application. As the platform grew to incorporate a custom sandboxed iframe Widget SDK (`@glansk/widget-sdk`), a React 18 Studio editor, a high-performance Bun core engine, and diverse test suites, code organization and package boundaries needed to be formalized. Additionally, opening the project to the public required a clear, permissive, and legally robust licensing model.

## Decision
1. **Repository Layout**:
   Adopt a Bun workspace monorepo layout:
   - `apps/server`: Core Bun backend, state brokers, storage, proxy, and vault.
   - `apps/studio`: React 18 + Vite studio editor SPA.
   - `packages/widget-sdk`: Standalone, distributable TypeScript SDK for widget developers.
   - `packages/shared`: Shared schema types and single-source-of-truth version constants.
   - `docs/`: Centralized knowledge hub for AI agents, ADRs, dev logs, and specifications.

2. **License Choice**:
   Adopt the **Apache License 2.0**:
   - Provides explicit patent defense and royalty-free patent licensing from contributors.
   - Protects the project name and trademark "Glansk".
   - Enables third-party commercial and homelab developers to build proprietary or open-source widgets without viral copyleft contamination.

## Consequences
- Clean separation between core backend runtime and frontend editor.
- The Widget SDK can be published independently to npm.
- Single command `bun run bump <version>` maintains version parity across all workspace packages.
