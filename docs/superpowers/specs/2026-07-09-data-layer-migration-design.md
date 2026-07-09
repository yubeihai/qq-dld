---
comet_change: data-layer-migration
role: technical-design
canonical_spec: openspec
archived-with: 2026-07-09-data-layer-migration
status: final
---

# Data Layer Migration — Technical Design

## Context

QQ DLD currently uses sql.js (SQLite WASM) with raw SQL in `src/db/index.js`. No migration system exists. All data is tied to a single implicit account. The monorepo scaffolding (change 1) is complete with 3 workspaces.

## Goals / Non-Goals

**Goals:**
- better-sqlite3 connection management via DataLayer singleton
- SQL migration system (numbered files, idempotent)
- Multi-account schema (accounts table + FK everywhere)
- 6 typed repositories (AccountRepo, ModuleConfigRepo, ExecLogRepo, FriendRepo, TaskConfigRepo, SettingsRepo)
- Legacy data migration script (read old DB, transform, insert)

**Non-Goals:**
- No business logic / service layer
- No game module changes
- No API route changes
- No frontend changes

## Architecture

```
packages/server/src/data/
├── data-layer.ts          # DataLayer class (connection + migration runner)
├── migrate-legacy.ts      # One-shot legacy data import
├── index.ts              # Re-exports DataLayer + all repositories
├── migrations/
│   └── 0001-initial-schema.sql
└── repositories/
    ├── repository-base.ts # RepositoryBase<T> abstract class
    ├── account-repo.ts
    ├── module-config-repo.ts
    ├── exec-log-repo.ts
    ├── friend-repo.ts
    ├── task-config-repo.ts
    └── settings-repo.ts
packages/server/data/
└── database.sqlite       # Runtime database (auto-created)
```

## Key Design Decisions

### D1: better-sqlite3 over sql.js
Native C++ binding — synchronous, ~5-10x faster, proper TS types. Compatible with existing sql.js file format.

### D2: Separate DB path
New DB at `packages/server/data/database.sqlite`. Old `data/database.sqlite` stays untouched for the legacy app until full migration is complete.

### D3: Migration system
SQL files in `migrations/` with `NNNN-` prefix. `_migrations` table tracks filename + SHA256 checksum + applied_at. Only new/changed files run on init.

### D4: Repository pattern
`RepositoryBase<T>` with `db` property. Concrete repos define table name and expose typed methods. Transactions via `DataLayer.transaction(cb)`.

### D5: Legacy migration
Uses better-sqlite3 on old DB file (same SQLite format). Deduplicates cookies by uin into accounts table. Links configs/friends/logs by uin→account_id mapping.

## Risks & Trade-offs

| Risk | Mitigation |
|------|------------|
| better-sqlite3 node-gyp fails | Document windows-build-tools prerequisite |
| Schema drift between old/new DBs | Migration script field-named mapping documented |
| Migration script double-reads | Idempotent via `_migrations` legacy marker |

## Migration Plan

1. Add better-sqlite3 + @types/better-sqlite3
2. Create DataLayer + migration runner
3. Create 0001-initial-schema.sql
4. Create RepositoryBase + 6 repos
5. Create migrate-legacy.ts
6. Verify: fresh schema → migrate → verify → re-init idempotent

## Test Strategy

- In-memory DB for CRUD roundtrip tests
- File-based DB for migration idempotency
- Full cycle test: create schema → run legacy migration → verify row counts

