# data-layer Specification

## Purpose
TBD - created by archiving change data-layer-migration. Update Purpose after archive.
## Requirements
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

