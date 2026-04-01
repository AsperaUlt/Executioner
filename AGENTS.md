# VIBE Agent Guide

## Repo Layout
- `backend/`: C++ backend built with CMake and `cpp-httplib`.
- `frontend/`: static HTML/JS assets served by the backend.
- `backend/build/Debug/vibe_backend.exe`: current local debug binary on Windows.

## Runtime Contract
- Backend listens on `http://127.0.0.1:18080`.
- Frontend should be opened through the backend, not through `file://`.
- Preferred entry URL: `http://127.0.0.1:18080/`.
- Secondary entry URL: `http://127.0.0.1:18080/index_v2.html`.

## Current Frontend Entry
- Active page: `frontend/index_v2.html`
- API helper: `frontend/js/api.js`
- Do not reintroduce hardcoded browser calls to `file://`.

## Working Rules
- Keep frontend requests same-origin by default.
- If a `file://` fallback is needed for local debugging, isolate it in `frontend/js/api.js`.
- When changing backend startup behavior, preserve the startup logs for:
  - backend listen address
  - static resource directory
  - static mount success
  - suggested local URL
- Prefer mounting the whole `frontend/` directory rather than adding one-off file routes.

## Build And Run
- Build:
  - `cmake --build backend/build --config Debug`
- Run:
  - `.\backend\build\Debug\vibe_backend.exe`

## Verification Baseline
- `GET /` returns `200`
- `GET /index_v2.html` returns `200`
- `GET /js/api.js` returns `200`
- `GET /api/health` returns JSON
- Browser document origin is `http://127.0.0.1:18080`, not `file://`
- UI route switching works: `Home`, `Tasks`, `Audio`, `Insights`

## Cleanup Note
- Root `index.html` is legacy and is not part of the active served frontend flow.
- Root `index_v2.html` is also legacy now that `frontend/index_v2.html` exists.
