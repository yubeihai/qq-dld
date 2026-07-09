## 1. Dependency Setup

- [x] 1.1 Add better-sqlite3 + @types/better-sqlite3 to packages/server/package.json dependencies
- [x] 1.2 Run npm install at root to hoist better-sqlite3

## 2. DataLayer Class

- [x] 2.1 Create packages/server/src/data/ directory structure
- [x] 2.2 Create DataLayer class with singleton connection management and migration runner
- [x] 2.3 Create DataLayerOptions interface (dbPath, migrateOnConnect)
- [x] 2.4 Export DataLayer from packages/server/src/data/index.ts

## 3. Migration System

- [x] 3.1 Create packages/server/src/data/migrations/ directory
- [x] 3.2 Create 0001-initial-schema.sql with multi-account schema (accounts, module_configs, exec_logs, friends, task_configs, settings, _migrations)
- [x] 3.3 Implement migration runner in DataLayer (read _migrations table, apply pending files, record checksums)

## 4. Repository Layer

- [x] 4.1 Create RepositoryBase<T> abstract class with generic CRUD (findAll, findById, create, update, delete)
- [x] 4.2 Create AccountRepo implementing RepositoryBase<Account>
- [x] 4.3 Create ModuleConfigRepo implementing RepositoryBase<ModuleConfig>
- [x] 4.4 Create ExecLogRepo implementing RepositoryBase<ExecLog>
- [x] 4.5 Create FriendRepo implementing RepositoryBase<Friend>
- [x] 4.6 Create TaskConfigRepo implementing RepositoryBase<TaskConfig>
- [x] 4.7 Create SettingsRepo (key-value get/set, not full CRUD)
- [x] 4.8 Export all repositories from packages/server/src/data/index.ts

## 5. Legacy Data Migration

- [x] 5.1 Read existing data/database.sqlite schema to map old tables to new structure
- [x] 5.2 Create packages/server/src/data/migrate-legacy.ts script
- [x] 5.3 Implement legacy data reader (cookies → accounts, module_configs, friends, exec_logs)
- [x] 5.4 Implement idempotency check (skip if _migrations has legacy migration record)
- [x] 5.5 Test migration with actual legacy data

## 6. Verification

- [x] 6.1 Write basic test: DataLayer initializes and applies migrations on fresh DB
- [x] 6.2 Write basic test: AccountRepo CRUD roundtrip
- [x] 6.3 Write basic test: Migration idempotency (re-init doesn't re-apply)
- [x] 6.4 Verify packages/server tsc --build passes
- [x] 6.5 Verify npm run build passes (root orchestration)
