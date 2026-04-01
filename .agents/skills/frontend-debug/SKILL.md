# frontend-debug

## Purpose
Use this skill when VIBE's frontend loads incorrectly, shows blank content, or hits browser origin/CORS problems.

## Primary Assumption
The intended production-like local workflow is:
- run backend
- open `http://127.0.0.1:18080/`
- do not open the page via `file://`

## What To Inspect
- `frontend/index_v2.html`
- `frontend/js/api.js`
- `frontend/js/main.js`
- backend static hosting in `backend/src/main.cpp`

## Fast Checks
1. The page document URL starts with `http://127.0.0.1:18080/`.
2. Script tags point to same-origin asset paths such as `/js/api.js`.
3. API helper uses relative paths by default.
4. `GET /api/health` succeeds.
5. Browser console does not show `(blocked:origin)`.

## Debug Strategy
- If the page is opened via `file://`, stop and switch to backend-served access.
- If scripts 404, confirm the file lives under `frontend/` and the backend mount path is correct.
- If fetch fails, inspect `frontend/js/api.js` before touching backend CORS.
- Treat CORS as a temporary debugging fallback, not the main solution.

## Expected UI Behaviors
- Navigation between `Home`, `Tasks`, `Audio`, and `Insights`
- Data refresh button updates live backend status
- No full page reloads required for route switching

## Done Criteria
- Document origin is same-origin HTTP.
- Static assets load from backend.
- Console is clean of origin-blocking errors.
