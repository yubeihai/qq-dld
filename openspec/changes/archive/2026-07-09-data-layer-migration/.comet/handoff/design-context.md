# Comet Design Handoff

- Change: data-layer-migration
- Phase: design
- Mode: compact
- Context hash: 3d1c5d6c89c340a974191df110d621a5ad080515344d3a853bdf66a4788afdcb

Generated-by: comet-handoff.sh

OpenSpec remains the canonical capability spec. This handoff is a deterministic, source-traceable context pack, not an agent-authored summary.

## openspec/changes/data-layer-migration/proposal.md

- Source: openspec/changes/data-layer-migration/proposal.md
- Lines: 1-26
- SHA256: 243e22ecba94df7bbf28886c6054c1a3337394fb13e02ca6c2fba8ad8feb7c87

```md
## Why

The current project uses sql.js (SQLite compiled to WebAssembly in JavaScript) with raw SQL scattered across the codebase. This approach lacks typed repository abstractions, migration management, and multi-account support — all essential for the new layered architecture. Moving to better-sqlite3 (native C++ SQLite binding) provides synchronous, faster, and more reliable database operations while building a proper data layer foundation.

## What Changes

- **BREAKING**: Add `packages/server/src/data/` directory with connection management, migration system, and typed repositories
- **BREAKING**: Introduce multi-account schema (accounts table with foreign keys on all data tables)
- **BREAKING**: SQL migration files in `packages/server/src/data/migrations/` that run on startup
- **BREAKING**: Repository pattern for all data access (cookie, module_config, exec_log, friend, task_config, settings)
- Write migration script to import existing `data/database.sqlite` data into new structured schema
- Keep old `src/` legacy app running in parallel during transition

## Capabilities

### New Capabilities
- `data-layer`: SQLite connection management, migration system, multi-account schema, typed repository layer, and data migration from legacy database

### Modified Capabilities

## Impact

- `packages/server/`: new `src/data/` directory (connection, migrations, repositories)
- `data/database.sqlite`: existing data will be migrated to new structure
- Old `src/db/`, `src/core/action-base.js`, `src/scheduler/` remain untouched during this change
- `package.json`: add better-sqlite3 dependency

```

## openspec/changes/data-layer-migration/design.md

- Source: openspec/changes/data-layer-migration/design.md
- Lines: 1-75
- SHA256: c6343a55a816a028a993f9de93afe1f18110fb06e4b13bb389bc8a09d3d833de

```md
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

```

## openspec/changes/data-layer-migration/tasks.md

- Source: openspec/changes/data-layer-migration/tasks.md
- Lines: 1-44
- SHA256: ab1cbc257dd4a2317fa8b33ee7eb144bfb9f6ef517a0ac8fce96405484c32471

```md
## 1. Dependency Setup

- [ ] 1.1 Add better-sqlite3 + @types/better-sqlite3 to packages/server/package.json dependencies
- [ ] 1.2 Run npm install at root to hoist better-sqlite3

## 2. DataLayer Class

- [ ] 2.1 Create packages/server/src/data/ directory structure
- [ ] 2.2 Create DataLayer class with singleton connection management and migration runner
- [ ] 2.3 Create DataLayerOptions interface (dbPath, migrateOnConnect)
- [ ] 2.4 Export DataLayer from packages/server/src/data/index.ts

## 3. Migration System

- [ ] 3.1 Create packages/server/src/data/migrations/ directory
- [ ] 3.2 Create 0001-initial-schema.sql with multi-account schema (accounts, module_configs, exec_logs, friends, task_configs, settings, _migrations)
- [ ] 3.3 Implement migration runner in DataLayer (read _migrations table, apply pending files, record checksums)

## 4. Repository Layer

- [ ] 4.1 Create RepositoryBase<T> abstract class with generic CRUD (findAll, findById, create, update, delete)
- [ ] 4.2 Create AccountRepo implementing RepositoryBase<Account>
- [ ] 4.3 Create ModuleConfigRepo implementing RepositoryBase<ModuleConfig>
- [ ] 4.4 Create ExecLogRepo implementing RepositoryBase<ExecLog>
- [ ] 4.5 Create FriendRepo implementing RepositoryBase<Friend>
- [ ] 4.6 Create TaskConfigRepo implementing RepositoryBase<TaskConfig>
- [ ] 4.7 Create SettingsRepo (key-value get/set, not full CRUD)
- [ ] 4.8 Export all repositories from packages/server/src/data/index.ts

## 5. Legacy Data Migration

- [ ] 5.1 Read existing data/database.sqlite schema to map old tables to new structure
- [ ] 5.2 Create packages/server/src/data/migrate-legacy.ts script
- [ ] 5.3 Implement legacy data reader (cookies → accounts, module_configs, friends, exec_logs)
- [ ] 5.4 Implement idempotency check (skip if _migrations has legacy migration record)
- [ ] 5.5 Test migration with actual legacy data

## 6. Verification

- [ ] 6.1 Write basic test: DataLayer initializes and applies migrations on fresh DB
- [ ] 6.2 Write basic test: AccountRepo CRUD roundtrip
- [ ] 6.3 Write basic test: Migration idempotency (re-init doesn't re-apply)
- [ ] 6.4 Verify packages/server tsc --build passes
- [ ] 6.5 Verify npm run build passes (root orchestration)

```

## openspec/changes/data-layer-migration/specs/data-layer/spec.md

- Source: openspec/changes/data-layer-migration/specs/data-layer/spec.md
- Lines: 1-57
- SHA256: 81a3383cc9eefd7eedfab485fe42efc87fe32f02b79f9010832526cafec062f2

```md
## ADDED Requirements

### Requirement: Connection Management
The system SHALL provide a `DataLayer` class that manages a better-sqlite3 connection. The DataLayer SHALL initialize on first access and run pending migrations. It SHALL expose the raw `Database` instance for repository use.

#### Scenario: DataLayer initializes connection
- **WHEN** DataLayer is first instantiated
- **THEN** it SHALL open a better-sqlite3 connection to the configured database file
- **AND** it SHALL apply all pending migrations before returning

### Requirement: Migration System
The system SHALL support versioned SQL migrations. Migration files SHALL be numbered sequentially (`0001-<name>.sql`, `0002-<name>.sql`). The system SHALL track applied migrations in a `_migrations` table with filename, checksum, and applied timestamp. Migrations SHALL run in order on DataLayer init. A migration SHALL NOT re-run if its checksum matches.

#### Scenario: Migrations run on first start
- **WHEN** DataLayer initializes on a fresh database
- **THEN** all migration files in the migrations directory SHALL be applied in order

#### Scenario: Idempotent re-initialization
- **WHEN** DataLayer initializes on an already-migrated database
- **THEN** previously applied migrations SHALL be skipped
- **AND** the `_migrations` table SHALL remain unchanged

### Requirement: Multi-Account Schema
The database SHALL have an `accounts` table with columns: `id INTEGER PRIMARY KEY AUTOINCREMENT`, `uin TEXT NOT NULL UNIQUE`, `nickname TEXT`, `status TEXT DEFAULT 'active'`, `created_at TEXT DEFAULT (datetime('now'))`, `updated_at TEXT`. All data tables (module_configs, exec_logs, friends, task_configs) SHALL reference `accounts.id` via foreign key. A `settings` table SHALL be global (key-value, no account FK).

#### Scenario: Create account
- **WHEN** a new account is inserted with a unique uin
- **THEN** the account SHALL be stored with auto-generated id and timestamps

#### Scenario: Foreign key enforcement
- **WHEN** inserting a module_config with a non-existent account_id
- **THEN** the database SHALL reject the insert with a foreign key constraint violation

### Requirement: Repository Layer
The system SHALL provide a `RepositoryBase<T>` abstract class with generic `findAll`, `findById`, `create`, `update`, `delete` methods. Concrete repositories SHALL exist for each table: `AccountRepo`, `ModuleConfigRepo`, `ExecLogRepo`, `FriendRepo`, `TaskConfigRepo`, `SettingsRepo`. Each repository SHALL accept the `DataLayer` instance in its constructor and use its connection.

#### Scenario: Repository CRUD
- **WHEN** using AccountRepo to create, find by id, find all, update, and delete an account
- **THEN** all operations SHALL succeed against the database

#### Scenario: Repository isolation
- **WHEN** two repositories operate on different tables within the same connection
- **THEN** transactions SHALL work correctly across repository calls

### Requirement: Legacy Data Migration
A `migrate-legacy.ts` script SHALL read the old `data/database.sqlite` (sql.js format), transform data to the new schema, and insert it via repositories. The script SHALL be idempotent: if a legacy migration record exists in `_migrations`, it SHALL skip the migration. The script SHALL preserve all existing data: cookies become accounts, module_configs and friends link to migrated accounts.

#### Scenario: Successful legacy migration
- **WHEN** the migration script runs against a database with existing legacy data
- **THEN** all accounts SHALL be created from cookies table
- **AND** all module_configs, friends, exec_logs SHALL be migrated with correct account_id references
- **AND** a `_migrations` record SHALL be created to mark the legacy migration complete

#### Scenario: Idempotent re-run
- **WHEN** the migration script runs again on an already-migrated database
- **THEN** the script SHALL detect the existing legacy migration record and skip
- **AND** no duplicate data SHALL be created

```
