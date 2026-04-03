@echo off
setlocal

call "%~dp0build_project.bat" %*
exit /b %errorlevel%
