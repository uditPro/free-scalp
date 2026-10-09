$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$tokenPath = Join-Path $PSScriptRoot ".worker-token"
if (-not (Test-Path -LiteralPath $tokenPath)) {
  $bytes = New-Object byte[] 32
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($bytes)
  $rng.Dispose()
  $token = [Convert]::ToBase64String($bytes)
  Set-Content -LiteralPath $tokenPath -Value $token -NoNewline
} else { $token = (Get-Content -Raw -LiteralPath $tokenPath).Trim() }
$envPath = Join-Path $root ".env.local"
$text = if (Test-Path -LiteralPath $envPath) { Get-Content -Raw -LiteralPath $envPath } else { "" }
if ($text -notmatch '(?m)^REACHFLOW_WORKER_URL=') { Add-Content -LiteralPath $envPath -Value "`nREACHFLOW_WORKER_URL=http://127.0.0.1:8787" }
if ($text -notmatch '(?m)^REACHFLOW_WORKER_TOKEN=') { Add-Content -LiteralPath $envPath -Value "REACHFLOW_WORKER_TOKEN=$token" }
if (-not (Get-Command py -ErrorAction SilentlyContinue)) { throw "Python 3.10+ is required. Install it from https://www.python.org/downloads/windows/" }
py -3 -m venv (Join-Path $PSScriptRoot ".venv")
& (Join-Path $PSScriptRoot ".venv\Scripts\python.exe") -m pip install --upgrade pip
& (Join-Path $PSScriptRoot ".venv\Scripts\python.exe") -m pip install "agent-reach @ git+https://github.com/Panniantong/Agent-Reach.git"
Write-Host "Worker configured. Start it with: .\worker\start-worker.ps1"
