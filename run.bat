@echo off
title Uriel - Neural Document Intelligence
echo ==========================================================
echo Starting Uriel AI Engine & Web Workspace...
echo ==========================================================

start "Uriel Backend (FastAPI)" cmd /k "cd /d %~dp0 && uv run python main.py"
start "Uriel Frontend (Vite React)" cmd /k "cd /d %~dp0frontend && npm run dev"

timeout /t 3 >nul
start http://localhost:5173
echo.
echo Uriel is running at http://localhost:5173
echo Backend API at http://127.0.0.1:8000
echo.
