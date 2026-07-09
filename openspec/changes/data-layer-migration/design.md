## Context

The project currently uses sql.js (SQLite compiled to WebAssembly) with raw SQL in `src/db/index.js` and scattered across game modules. There is no migration system — the schema is created inline on first use. No multi-account support exists; cookies and configuration are tied to a single implicit account. The legacy `src/` tree continues running during monorepo migration.

## Goals / Non-Goals

**Goals:**
- Replace sql.js with better-sqlite3 in `packages/server/`
- Provide connection management (singleton per-account or global)
- SQL migration system (versioned, sequential, auto-applied on start)
- Multi-account schema (accounts table + FK references)
- Typed repository layer (one class per table, generic CRUD base)
- Migration script to import existing `data/database.sqlite` content

**Non-Goals:**
- No service/business logic layer (done in later changes)
- No changes to 38 game module internals
- No API route changes
- No frontend changes

## Decisions

### D1: better-sqlite3 over sql.js
better-sqlite3 provides synchronous native API, ~5-10x faster, supports `loadExtension`, and has proper TypeScript types. sql.js is async-over-WASM, slower, and harder to debug.

### D2: Connection management
Create a `DataLayer` class exposing `getConnection(accountId?)`. For now, a single default connection suffices (multi-connection per-account deferred until JWT/account switching arrives).

### D3: Migration system
Numbered SQL files (`0001-initial-schema.sql`, `0002-some-change.sql`) in `migrations/` directory. Run on DataLayer init: read applied migrations from `_migrations` table, apply pending ones in order. Idempotent via checksum.

### D4: Multi-account schema
```
accounts (id, uin, nickname, status, created_at, updated_at)
module_configs (id, account_id FK, module_id, config JSON, enabled)
exec_logs (id, account_id FK, module_id, status, message, started_at, finished_at, duration)
friends (id, account_id FK, uin, nickname, level, last_fight_at)
task_configs (id, account_id FK, module_id, schedule, enabled, params JSON)
settings (key, value — global, not per-account)
```

### D5: Repository pattern
`RepositoryBase` abstract class with `db` property + generic `findAll`, `findById`, `create`, `update`, `delete`. Concrete repos: `AccountRepo`, `ModuleConfigRepo`, `ExecLogRepo`, `FriendRepo`, `TaskConfigRepo`, `SettingsRepo`.

### D6: Migration script
Node.js script at `packages/server/src/data/migrate-legacy.ts` that:
1. Connects to both old (`data/database.sqlite` via sql.js) and new DB
2. Reads accounts/cookies from old `cookies` table
3. Reads module_configs, friends, exec_logs, task_configs, settings
4. Transforms to new schema and inserts via repositories
5. Idempotent: skips if `_migrations` already has a legacy migration record

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| better-sqlite3 node-gyp build failure on Windows | Document `windows-build-tools` prerequisite; fall back to `@vscode/sqlite3` prebuilt if needed |
| Data migration corruption | Test on copy of production DB first; migration script is idempotent |
| Two DB connections (old sql.js + new better-sqlite3) | Legacy `src/` uses sql.js untouched; new `packages/server/` uses better-sqlite3 only |
| Schema drift between old and new | Migration script maps fields by name; schema documented in `000X-` files |

## Migration Plan

1. Add better-sqlite3 + @types/better-sqlite3 to packages/server
2. Create DataLayer class with connection management
3. Create migration runner and `0001-initial-schema.sql`
4. Create RepositoryBase + concrete repositories
5. Create legacy migration script
6. Test full cycle: clean schema → migrate → verify data
7. Write type-checked test for repository CRUD

## Open Questions

- Should settings be per-account or global? Decided: global (key-value store shared across accounts)
- Node version requirement? currently Node 22 — better-sqlite3 latest supports it via prebuild
