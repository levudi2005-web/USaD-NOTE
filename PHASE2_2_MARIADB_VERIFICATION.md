# NOTE Phase 2.2 — MariaDB verification

## Status

**Blocked before startup and migration. No live MariaDB is available in this environment.** Docker is not installed/on PATH, port 3306 is closed, and no DB query succeeded. No database or schema was created or modified.

## Step 1 — Configuration inspection

- `compose.yaml` uses `mariadb:11.4`, persists data in named volume `mariadb_data`, configures `utf8mb4` / `utf8mb4_unicode_ci` / UTC, has a MariaDB healthcheck, and binds host port only to `127.0.0.1`.
- `backend/.env.example` contains placeholders rather than actual credentials. `backend/app/core/config.py` builds `mysql+pymysql` URLs from `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`; SQLAlchemy/PyMySQL are declared in requirements. The `DATABASE_URL` override was removed and TiDB Cloud hostnames are rejected.
- Process-level configuration currently reports `DB_HOST=gateway01.ap-southeast-1.prod.aws.tidbcloud.com`, port `4000`, database `banhangonline`, and an empty `DB_USER`. Password values were not printed or recorded. This source is not MariaDB.
- Required Compose variables include `MARIADB_ROOT_PASSWORD`; that key was not present among the inspected environment variable names. Compose was not invoked because Docker is unavailable and its inputs are incomplete.

## Step 2 — Start and identify MariaDB

- `docker` executable: **not found**. Docker Desktop/server status cannot be queried.
- `127.0.0.1:3306`: **closed**.
- Read-only `SELECT VERSION(), DATABASE()` via the configured target failed with PyMySQL error **2003** (connection failure).
- The same query against `127.0.0.1:3306` failed with error **2003**.
- Therefore MariaDB version, active database name, service health, and Compose volume state are **not verified**. MariaDB 11.4 is only the proposed Compose image, not a running-server result.

## Step 3 — Existing database, schema, and backup

- No live database could be reached. Existing tables/columns, constraints, indexes, data, and migration history could not be inspected.
- No backup or restore verification could be performed.
- No data was deleted, copied, or changed. No database or schema was created.

## Step 4 — Migration readiness

- Migration 08 adds workspace columns if absent and alters the archive ratio constraint. It must precede application code that depends on those columns, but its exact compatibility and starting-schema assumptions were not checked against a live server.
- Migration 09 replaces the archive-ratio trigger with the 50x policy. It logically follows migration 08/current schema preparation; it is DDL and should not be assumed rollback-safe or transaction-atomic.
- Both files target `note_db`. Neither migration was run. Idempotency, SQLAlchemy compatibility, post-migration FKs/indexes/constraints, and rollback remain unverified.
- `07_full_install.sql` was not run and must only be considered for a verified empty database.
- **Do not migrate until** a MariaDB target and its schema are identified and a backup has been restored in a rehearsal or otherwise proven restorable.

## Step 5 — Tests and verification

| Check | Result |
|---|---|
| Focused DB settings/offline-handler tests | **4 passed** |
| Phase 2.1 backend unit/API suite | **34 passed** |
| Phase 2.1 frontend API/document/sharing suite | **17 passed** |
| Phase 2.1 frontend lint | **Passed** |
| Phase 2.1 frontend production build | **Passed**, existing large-chunk warning |
| MariaDB connection / `SELECT VERSION(), DATABASE()` | **Not passed; no server reachable (2003)** |
| Schema inspection / backup and restore | **Not run** |
| Migrations 08/09 | **Not run** |
| CRUD, sync/bootstrap, knowledge graph against MariaDB | **Not run** |
| Database-stop API test against MariaDB | Unit-level failure handling only; live DB outage test **not run** |
| Edge/Playwright E2E | **Not run** |

## Remaining blockers

1. Install/start Docker Desktop or provide an already-running MariaDB; software was not installed by this task.
2. Set valid MariaDB environment values locally, including non-empty app/root passwords, without sharing them in chat. Ensure process-level `DB_*` values no longer point to TiDB.
3. Before starting Compose, inspect whether the named volume already exists and determine whether it contains data. Do not initialize a new schema or reuse an unknown volume without review.
4. Once MariaDB is available, verify `SELECT VERSION(), DATABASE()`, inspect schema and data, and prove a backup can be restored.
5. Only then assess and apply migrations 08/09, followed by schema verification and the requested live API/CRUD/multi-account tests.

For the earlier HTTP 502 trace and code changes, see [Phase 2.1 report](./PHASE2_1_HTTP_MARIADB_REPORT.md).
