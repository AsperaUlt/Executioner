@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "BACKEND_DIR=%ROOT_DIR%backend"
set "BUILD_DIR=%BACKEND_DIR%\build"
set "CONFIG=%~1"

if "%CONFIG%"=="" set "CONFIG=Release"

where cmake >nul 2>nul
if errorlevel 1 (
  echo [ERROR] cmake was not found in PATH.
  exit /b 1
)

if not exist "%BACKEND_DIR%\CMakeLists.txt" (
  echo [ERROR] Missing backend\CMakeLists.txt
  exit /b 1
)

echo [VIBE] Configure backend project...
cmake -S "%BACKEND_DIR%" -B "%BUILD_DIR%"
if errorlevel 1 (
  echo [ERROR] CMake configure failed.
  exit /b 1
)

echo [VIBE] Build backend project with config %CONFIG%...
cmake --build "%BUILD_DIR%" --config %CONFIG%
if errorlevel 1 (
  echo [ERROR] CMake build failed.
  exit /b 1
)

echo [OK] Build completed.
echo [INFO] Binary path: "%BUILD_DIR%\%CONFIG%\vibe_backend.exe"
exit /b 0
