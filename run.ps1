Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Starting Uriel AI Engine & Web Workspace..." -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot'; uv run python main.py"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot\frontend'; npm run dev"

Start-Sleep -Seconds 3
Start-Process "http://localhost:5173"

Write-Host "Uriel running on http://localhost:5173" -ForegroundColor Green
