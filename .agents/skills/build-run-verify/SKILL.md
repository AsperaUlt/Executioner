---
name: build-run-verify
description: Build, run, and verify the local desktop web app. Use when the app needs to be started, rebuilt, or checked after code changes. Do not use for pure UI styling work.
---

## Purpose
Use this skill when changing backend or frontend behavior that must be proven locally on this Windows repo.

## Repo-Specific Commands
- Build debug backend:
  - `cmake --build backend/build --config Debug`
- Run backend in foreground:
  - `.\backend\build\Debug\vibe_backend.exe`

## Verification Checklist
1. Confirm the binary builds successfully.
2. Start the backend from repo root `F:\LLM\VIBE`.
3. Check startup logs for:
   - `VIBE backend listening on http://127.0.0.1:18080`
   - static resource directory
   - static mount success
   - suggested URL
4. Verify the served routes:
   - `http://127.0.0.1:18080/`
   - `http://127.0.0.1:18080/index_v2.html`
   - `http://127.0.0.1:18080/js/api.js`
   - `http://127.0.0.1:18080/api/health`
5. For browser-facing changes, confirm no `file://` document origin is involved.

## Suggested PowerShell Checks
```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:18080/
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:18080/index_v2.html
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:18080/js/api.js
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:18080/api/health
```

## Failure Modes To Check First
- Build blocked by Windows/MSBuild permission issues.
- Backend process started but not listening on `18080`.
- Frontend files exist in repo root instead of `frontend/`.
- Fetch calls accidentally use absolute host URLs or `file://`.

## Done Criteria
- Code compiles.
- Backend serves frontend assets directly.
- API and frontend work from the same origin.
