@echo off
title ARENA 24/7 Production Service
cd /d "%~dp0"

echo ========================================================
echo        ARENA 24/7 Production Self-Healing System
echo ========================================================
echo.
echo Starting Database, Backend API, Web App, and Cloudflare Tunnel...
echo Monitoring status every 15 seconds.
echo To stop the system, close this window.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\watchdog.ps1"

pause
