# NOTE

NOTE is a personal knowledge workspace for notes, documents, AI assistance, and study tools.
The frontend is built with Vite and Bootstrap; the API is FastAPI with MariaDB.

## Run the frontend

Requirements: Node.js 24 or newer.

```powershell
npm ci
npm run dev
```

The development server starts at `http://localhost:8080` and proxies `/api` to the backend at
`http://127.0.0.1:8000`.

## Backend and database

Follow [backend setup](../backend/README.md). For a new, empty MariaDB database,
use the single-file [`07_full_install.sql`](../database-design/06-sql/07_full_install.sql)
installer. Do not run it on an existing database; configure `backend/.env`,
then start the FastAPI server.

## Build and checks

```powershell
npm run build
npm run lint
npm run test:documents
npm run test:sharing
```

The production frontend is written to `dist/`.

## VPS deployment

Build the frontend with Node.js 24 or newer, then deploy only `dist/` to the static web
server. Do not copy `node_modules/`, `.git/`, tests, or build tooling to the VPS. The
FastAPI backend is deployed separately; keep its environment configuration and persistent
storage on the server. OCR and document-reader assets required by the frontend are included
in `dist/`.

## Project layout

- `src/`: NOTE pages, UI, styles, and browser-side document readers.
- `backend/`: FastAPI endpoints and database integration.
- `database-design/`: MariaDB schema, install scripts, and design documentation.
- `storage/`: local backend storage directories.

The project retains the upstream MIT license and required copyright attribution for reused
code.
