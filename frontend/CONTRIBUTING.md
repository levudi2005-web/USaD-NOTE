# Contributing

## Setup

Use Node.js 24 or newer, run `npm ci`, then `npm run dev`. The frontend development server
proxies API calls to the local FastAPI backend; backend setup is in `../backend/README.md`.

## Before submitting

- Run `npm run lint` and `npm run build`.
- Run `npm run test:documents` or `npm run test:sharing` when changing those features.
- Add or update a focused test when changing behavior.
- Keep changes NOTE-specific and preserve required upstream license attribution.
