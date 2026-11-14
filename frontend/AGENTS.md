# NOTE workspace

NOTE is a knowledge workspace, not a demo template or distributable UI package.

## Commands

- `npm run dev`: start the frontend on http://localhost:8080
- `npm run build`: build the frontend into `dist/`
- `npm run lint`: run ESLint, Prettier, and the Lucide icon check
- `npm run test:documents`: test local document readers
- `npm run test:sharing`: test public sharing security

The frontend proxies `/api` to the FastAPI backend on `http://127.0.0.1:8000`.
Backend setup and MariaDB installation are documented in `../backend/README.md`.

## Project conventions

- Keep changes focused on NOTE features; do not reintroduce template demo pages, example
  dashboards, or upstream marketing content.
- Preserve the Bootstrap and browser-side packages required by NOTE, including document
  readers, OCR, local storage, and sharing.
- Keep document parsing local to the browser unless the feature explicitly requires an API.
- Validate user-visible changes with the narrowest applicable tests and build.
- Preserve `LICENSE` and all upstream copyright notices for reused code.
