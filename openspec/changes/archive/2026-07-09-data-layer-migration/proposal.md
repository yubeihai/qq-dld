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
