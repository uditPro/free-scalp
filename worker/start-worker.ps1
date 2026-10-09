$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$tokenPath = Join-Path $PSScriptRoot ".worker-token"
if (-not (Test-Path -LiteralPath $tokenPath)) { throw "Run .\worker\setup-worker.ps1 first." }
$env:REACHFLOW_WORKER_TOKEN = (Get-Content -Raw -LiteralPath $tokenPath).Trim()
$env:REACHFLOW_WORKER_PORT = "8787"
$env:Path = (Join-Path $PSScriptRoot ".venv\Scripts") + ";" + $env:Path
& (Join-Path $PSScriptRoot ".venv\Scripts\python.exe") (Join-Path $PSScriptRoot "agent_reach_worker.py")
