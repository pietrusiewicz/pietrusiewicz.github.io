@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-windows.ps1" %*
set "rc=%ERRORLEVEL%"
if not "%rc%"=="0" pause
exit /b %rc%
