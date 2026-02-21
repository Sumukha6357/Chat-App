$ErrorActionPreference = "Stop"

$apiUrl = if ($env:API_URL) { $env:API_URL } else { "http://localhost:3001" }
$userEmail = if ($env:USER_EMAIL) { $env:USER_EMAIL } else { "userA@example.com" }
$userPassword = if ($env:USER_PASSWORD) { $env:USER_PASSWORD } else { "Password123!" }

Write-Host "Waiting for API health..."
for ($i = 0; $i -lt 30; $i++) {
  try {
    $res = Invoke-WebRequest -Uri "$apiUrl/health" -UseBasicParsing -TimeoutSec 2
    if ($res.StatusCode -eq 200) {
      Write-Host "API healthy"
      break
    }
  } catch {}
  Start-Sleep -Seconds 2
  if ($i -eq 29) { throw "FAIL: API not healthy" }
}

Write-Host "Logging in..."
$loginBody = @{ email = $userEmail; password = $userPassword } | ConvertTo-Json
$login = Invoke-RestMethod -Uri "$apiUrl/auth/login" -Method Post -ContentType "application/json" -Body $loginBody
$token = $login.accessToken
if (-not $token) { throw "FAIL: Login did not return access token" }

Write-Host "Fetching rooms..."
$rooms = Invoke-RestMethod -Uri "$apiUrl/rooms" -Headers @{ Authorization = "Bearer $token" }
$roomCount = if ($rooms -is [System.Array]) { $rooms.Length } else { 0 }
if ($roomCount -lt 2) { throw "FAIL: Expected at least 2 rooms, got $roomCount" }

$roomId = ($rooms | Where-Object { $_.type -eq "direct" } | Select-Object -First 1)._id
if (-not $roomId) { $roomId = ($rooms | Select-Object -First 1)._id }
if (-not $roomId) { throw "FAIL: Could not find a room id" }

Write-Host "Fetching messages..."
$msgs = Invoke-RestMethod -Uri "$apiUrl/rooms/$roomId/messages" -Headers @{ Authorization = "Bearer $token" }
$msgCount = if ($msgs.items -is [System.Array]) { $msgs.items.Length } else { 0 }
if ($msgCount -lt 5) { throw "FAIL: Expected at least 5 messages, got $msgCount" }

Write-Host "SUCCESS"
