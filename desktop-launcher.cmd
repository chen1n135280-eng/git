@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "$root = Get-ChildItem -LiteralPath ([Environment]::GetFolderPath('MyDocuments')) -Directory | Where-Object { (Test-Path (Join-Path $_.FullName 'api\app\main.py')) -and (Test-Path (Join-Path $_.FullName 'web\package.json')) } | Select-Object -First 1; if (-not $root) { throw 'CPA study project was not found.' }; & (Join-Path $root.FullName 'start.ps1')"
exit /b
