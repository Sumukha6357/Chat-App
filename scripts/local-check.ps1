$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$reportDir = Join-Path $repoRoot "reports"
$runId = Get-Date -Format "yyyyMMdd-HHmmss"
$reportPath = Join-Path $reportDir "local-check.txt"
$apiLogOutPath = Join-Path $reportDir "api-run.$runId.out.log"
$apiLogErrPath = Join-Path $reportDir "api-run.$runId.err.log"
New-Item -ItemType Directory -Force -Path $reportDir | Out-Null
if (Test-Path $reportPath) { Remove-Item -Force $reportPath }

function Log {
  param([string]$Message)
  $Message | Tee-Object -FilePath $reportPath -Append | Out-Host
}

function Run-Logged {
  param(
    [string]$Command,
    [string[]]$CommandArgs
  )
  $prevErr = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  & $Command @CommandArgs 2>&1 | Tee-Object -FilePath $reportPath -Append | Out-Host
  $ErrorActionPreference = $prevErr
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $Command $($CommandArgs -join ' ')"
  }
}

function Ensure-EnvFile {
  param(
    [string]$EnvPath,
    [string]$ExamplePath
  )
  if (-not (Test-Path $EnvPath)) {
    Copy-Item -Force $ExamplePath $EnvPath
  }
}

function Is-Port-InUse {
  param([int]$Port)
  try {
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop
    return $true
  } catch {
    return $false
  }
}

function Get-FreePort {
  param([int]$Preferred, [int]$MaxPort = 3010)
  for ($p = $Preferred; $p -le $MaxPort; $p++) {
    if (-not (Is-Port-InUse -Port $p)) { return $p }
  }
  throw "No free port found between $Preferred and $MaxPort"
}

Log "== Local Check: Basic =="

Ensure-EnvFile -EnvPath "api\\.env" -ExamplePath "api\\.env.example"
Ensure-EnvFile -EnvPath "web\\.env" -ExamplePath "web\\.env.example"

Log "== Start Mongo + Redis (Docker) =="
Run-Logged -Command "docker" -CommandArgs @("compose","up","-d","mongo","redis")

Log "== Reset DB =="
Run-Logged -Command "docker" -CommandArgs @("compose","exec","-T","mongo","mongosh","--quiet","--eval","db.getSiblingDB('chat').dropDatabase()")

$apiPortLine = Select-String -Path "api\\.env" -Pattern "^PORT=" | Select-Object -First 1
$apiPort = "3001"
if ($apiPortLine) {
  $apiPort = ($apiPortLine.Line -split "=", 2)[1].Trim()
}
$apiPort = [int]$apiPort
if (Is-Port-InUse -Port $apiPort) {
  $apiPort = Get-FreePort -Preferred ($apiPort + 1)
  Log "Port in use. Using free API port $apiPort"
}
$apiUrl = "http://localhost:$apiPort"
$wsUrl = "http://localhost:$apiPort/ws"

Log "== Seed data =="
Push-Location "api"
Run-Logged -Command "npm" -CommandArgs @("run","seed")
Pop-Location

Log "== API build =="
Push-Location "api"
Run-Logged -Command "npm" -CommandArgs @("run","build")
Pop-Location

Log "== Web build =="
Push-Location "web"
Run-Logged -Command "npm" -CommandArgs @("run","build")
Pop-Location

Log "== Start API (prod) =="
$env:PORT = "$apiPort"
$apiProc = Start-Process -FilePath "npm" -ArgumentList "run","start:prod" -WorkingDirectory "api" -PassThru -RedirectStandardOutput $apiLogOutPath -RedirectStandardError $apiLogErrPath

try {
  Log "== Wait for API health =="
  for ($i = 0; $i -lt 30; $i++) {
    try {
      $res = Invoke-WebRequest -Uri "$apiUrl/health" -UseBasicParsing -TimeoutSec 2
      if ($res.StatusCode -eq 200) { break }
    } catch {}
    Start-Sleep -Seconds 2
    if ($i -eq 29) { throw "API not healthy at $apiUrl" }
  }

  Log "== Smoke test =="
  $env:API_URL = $apiUrl
  Run-Logged -Command "powershell" -CommandArgs @("-ExecutionPolicy","Bypass","-File","scripts\\smoke.ps1")

  Log "== API E2E tests =="
  Push-Location "api"
  $env:API_URL = $apiUrl
  $env:WS_URL = $wsUrl
  Run-Logged -Command "npm" -CommandArgs @("run","test:e2e")
  Pop-Location
} finally {
  Log "== Stop API =="
  if ($apiProc -and !$apiProc.HasExited) {
    Stop-Process -Id $apiProc.Id -Force
  }
  $hasOut = Test-Path $apiLogOutPath
  $hasErr = Test-Path $apiLogErrPath
  if ($hasOut -or $hasErr) {
    Log "== API Log (tail) =="
    if ($hasOut) { Get-Content $apiLogOutPath -Tail 200 | Tee-Object -FilePath $reportPath -Append | Out-Host }
    if ($hasErr) { Get-Content $apiLogErrPath -Tail 200 | Tee-Object -FilePath $reportPath -Append | Out-Host }
  }
}

Log "== Done =="
Log "Report written to $reportPath"
