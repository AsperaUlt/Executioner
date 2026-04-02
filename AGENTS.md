- # VIBE Agent Guide

  ## Project Positioning
  - VIBE is a local desktop-style Web application.
  - During development, frontend/backend integration should be completed through browser-based same-origin access.
  - The long-term target is a single Windows `.exe` application.
  - Future desktop integration should remain compatible with a C++ WebView-based packaging approach.

  ## Repo Layout
  - `backend/`: C++ backend built with CMake and `cpp-httplib`.
  - `frontend/`: static HTML/JS assets served by the backend.
  - `backend/src/main.cpp`: current backend entry and primary API/static hosting integration point.
  - `frontend/index_v2.html`: active frontend entry page.
  - `frontend/js/api.js`: frontend API helper layer.
  - `frontend/js/renderers/`: DOM render modules for SPA sections.

  ## Runtime Contract
  - Backend listens on `http://127.0.0.1:18080`.
  - Frontend should be opened through the backend, not through `file://`.
  - Preferred entry URL: `http://127.0.0.1:18080/`.
  - Secondary entry URL: `http://127.0.0.1:18080/index_v2.html`.
  - Frontend fetch calls should remain same-origin by default, using relative paths such as `/api/...`.

  ## Frontend Architecture Rules
  - Keep the frontend framework-free: Vanilla JS + HTML/CSS SPA.
  - Preserve the global sidebar structure.
  - Sidebar navigation should switch the right-side module without full page reload.
  - Keep page logic modular and low-coupled.
  - `renderers/*.js` should focus on mapping API data into DOM.
  - Do not perform unnecessary UI rewrites when only data binding or small behavior changes are needed.

  ## Backend Architecture Rules
  - APIs should return stable, predictable JSON.
  - Backend should continue to serve static frontend assets in addition to API routes.
  - Prefer clear, directly consumable response structures for the frontend.
  - Avoid backend changes that make later desktop packaging harder.
  - When changing backend startup behavior, preserve the startup logs for:
    - backend listen address
    - static resource directory
    - static mount success
    - suggested local URL

  ## Working Rules
  - Default to the smallest runnable change that solves the current task.
  - Prefer compatibility extensions over replacing existing structures.
  - Do not introduce unnecessary cross-origin solutions.
  - Do not reintroduce hardcoded browser calls to `file://`.
  - If a `file://` fallback is ever needed for local debugging, isolate it in `frontend/js/api.js`.
  - Prefer mounting the whole `frontend/` directory rather than adding one-off file routes.
  - Do not refactor unrelated areas while handling a focused task.
  - Keep future Windows single-`.exe` integration in mind when making changes.

  ## Change Priority
  When working on a feature or bug, inspect files in this order when relevant:
  1. `backend/src/main.cpp`
  2. `frontend/js/api.js`
  3. `frontend/index_v2.html`
  4. `frontend/js/renderers/*.js`
  5. other directly related files only if necessary

  ## Build And Run
  If `CMakeLists.txt` is under `backend/`, prefer:

  ```bash
  cd E:\LLM\VIBE\backend
  cmake -S . -B build
  cmake --build build --config Release
  .\build\Release\vibe_backend.exe
