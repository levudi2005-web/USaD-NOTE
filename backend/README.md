# NOTE API

FastAPI backend for the NOTE workspace. MariaDB is the source of truth; uploaded
file contents stay under `STORAGE_ROOT`, while file metadata and AI data are
stored in MariaDB.

## Local setup (Windows PowerShell)

1. Use MariaDB 11.4 LTS (also compatible with the project's MySQL-protocol
   SQLAlchemy/PyMySQL driver). For a local instance, set the database values
   and non-empty passwords in `backend/.env`, then run from the repository root:

   ```powershell
   docker compose --env-file backend/.env up -d mariadb
   ```

   The database port is bound only to `127.0.0.1`; its data persists in the
   `mariadb_data` volume. The Compose service does not run schema scripts.
2. Copy `backend/.env.example` to `backend/.env` only if no `.env` exists, and
   set unique random passwords and application secrets. Keep `.env` private.
3. Only for a new, empty database, from `D:\NOTE\database-design\06-sql`, run
   `mariadb --default-character-set=utf8mb4 -u root -p < 07_full_install.sql`.
   This is the single-file current MariaDB install, including schema, indexes,
   foreign keys, constraints, triggers, and reference catalog data. **Never
   run it on an existing database.** It already includes the current schema
   changes from migrations 08/09, so do not run those after a fresh install.
   For an existing NOTE database, back it up and verify its identity/schema
   before applying the matching migrations.
4. Set `APP_SECRET` to a random value of at least 32 characters and
   `AI_ENCRYPTION_KEY` to 64 hexadecimal characters.
5. Create an environment and install dependencies:

   ```powershell
   py -3.12 -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   ```

6. Start the API from `D:\NOTE\backend`:

   ```powershell
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```

   Open `http://127.0.0.1:8000/docs`; `/api/v1/health` reports database
   connectivity.

7. Start the frontend from `D:\NOTE\frontend` with `npm run dev`. Vite proxies
   `/api` to `http://127.0.0.1:8000` by default; set
   `VITE_API_PROXY_TARGET` in `frontend/.env` if FastAPI uses another local
   address. In production, configure the web server to proxy `/api` to the API
   service, or set `VITE_API_BASE_URL` to the deployed API base URL before
   building.

## VPS production requirements

For a new, empty VPS database, transfer only
`database-design/06-sql/07_full_install.sql` and run the same MariaDB import
command from its directory. Do not run `06_rollback.sql`; it drops the schema.
The installer does not create a database application user or credentials.

Before starting the API on a VPS, set `APP_ENV=production` and configure a
dedicated database account, non-placeholder `DB_PASSWORD`, unique
`APP_SECRET` (at least 32 bytes), and unique `AI_ENCRYPTION_KEY` (64
hexadecimal characters). Set `FRONTEND_ORIGIN` to the HTTPS origin(s) of the
deployed site and `STORAGE_ROOT` to a persistent, writable path outside any
replaceable release directory. Production configuration validation rejects the
development secrets, root database user, placeholder password, and local or
non-HTTPS origins.

If existing AI credentials were encrypted with the built-in development key,
rotate/re-enter those provider credentials after deploying with a unique
encryption key. Do not copy the development `.env` to the VPS.

Create a NOTE account from the sign-up page before saving workspace data or
configuring AI. AI API keys are encrypted by the backend and are never stored
in browser storage. Add a provider key in Settings and test it before chatting.

Archive inspection limits uploads by entry count, uncompressed size,
compression ratio, and a maximum directory depth of 20.
