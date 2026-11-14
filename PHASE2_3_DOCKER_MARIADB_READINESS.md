# NOTE Phase 2.3 — Docker Desktop & MariaDB readiness

## Result

**Not ready to start MariaDB.** Docker Desktop/CLI and its service were not found in this environment. No Compose command was run, no container/volume was listed or changed, and no database was accessed.

## A. Docker Desktop / Engine

| Check | Result |
|---|---|
| Docker CLI on PATH | Not found |
| Docker Desktop executable at standard install path | Not found |
| `com.docker.service` service | Not found |
| `docker version` / Engine status | Not runnable; CLI missing |
| `docker compose version` | Not runnable; CLI missing |
| `docker info` | Not runnable; CLI missing |

Docker Desktop was not downloaded or installed. Install it using the official Docker Desktop installer, start Docker Desktop, and wait until it reports the Engine is running. Then these read-only commands can verify it:

```powershell
docker version
docker compose version
docker info
```

## B. Compose and database configuration

- [compose.yaml](./compose.yaml) specifies MariaDB `11.4`, database from `DB_NAME`, app account from `DB_USER`, separate root password, host port bound as `127.0.0.1:${DB_PORT}:3306`, named volume `mariadb_data`, a healthcheck, `utf8mb4` / `utf8mb4_unicode_ci`, and server timezone UTC.
- [backend/.env.example](./backend/.env.example) uses `note_db`, `note_app`, and placeholder app/root passwords. Placeholders are not credentials; do not use them to start the service.
- The actual `backend/.env` was inspected without printing secrets: `DB_HOST=127.0.0.1`, `DB_PORT=3306`, `DB_NAME=note_db`, but `DB_USER=root`; required `DB_PASSWORD` and `MARIADB_ROOT_PASSWORD` keys are absent. This does not match the application account expected by the example, and the Compose file requires non-empty root/app credentials.
- Process environment overrides still point to TiDB Cloud (`DB_HOST` on port `4000`, database `banhangonline`) and its `DB_USER` is empty. A password variable is present but its value was not read or recorded. The backend now rejects TiDB hosts, so this process environment must be corrected before starting the API.
- Backend URL/driver are `mysql+pymysql` with `utf8mb4`; SQLAlchemy session configuration uses UTC and bounded connection-pool settings. SQL source scripts and migrations target `note_db`.

## C. Container and volume inventory

- Docker is unavailable, so container and volume inventory commands could not run.
- Whether a NOTE/MariaDB container exists, whether Compose volume `mariadb_data` already exists, and whether it contains data are **unknown**.
- No volume was created, attached, removed, pruned, or recreated. No database was initialized.
- Because volume provenance is unknown and Docker cannot inspect it, no startup attempt is safe yet.

## D. Database, schema, and migrations

- No MariaDB connection was attempted from this phase because there is no Docker Engine and the configured credentials are incomplete.
- `SELECT VERSION(), DATABASE()` result: **not available**. MariaDB is not claimed to be running.
- Database tables/schema, data, backup state, and restore capability: **not verified**.
- No `07_full_install.sql`, migration 08, or migration 09 was run. No SQL import or migration was attempted.

## E. Required confirmations / next steps

1. Install and start Docker Desktop yourself; software was not installed by this task.
2. Confirm that NOTE may use a **new empty named volume** if inventory later proves `mariadb_data` does not exist. If a volume exists, its contents must be identified before any use.
3. Confirm the application database account should be the non-root `note_app` account shown in `.env.example`, rather than the current `root` value. Set app/root passwords directly in your local `backend/.env`; do not send them in chat.
4. Remove or override process-level `DB_*` values that point to TiDB before starting the backend.
5. After Docker is running and local configuration is valid, inspect containers/volumes first. Only with a known, approved volume should the MariaDB service be started. Then verify `SELECT VERSION(), DATABASE()` and inspect the database/tables before considering any schema operation.

For previous connection/migration analysis, see [Phase 2.2 report](./PHASE2_2_MARIADB_VERIFICATION.md).
