param(
  [int]$CdpPort = 9337,
  [string]$PanelUrl = "http://127.0.0.1:58888/"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$Chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$Profile = Join-Path $RepoRoot "build\tmp\codex-panel-audit-chrome-$CdpPort"
$CdpUrl = "http://127.0.0.1:$CdpPort"
$ChromeProcess = $null

function Invoke-Step {
  param(
    [Parameter(Mandatory=$true)][string]$Name,
    [Parameter(Mandatory=$true)][scriptblock]$Command
  )
  Write-Host "[audit] $Name"
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Name failed with exit code $LASTEXITCODE"
  }
}

try {
  if (-not (Test-Path -LiteralPath $Chrome)) {
    throw "Chrome not found: $Chrome"
  }

  Set-Location -LiteralPath $RepoRoot

  Invoke-Step "node syntax: codex page" { node --check "frontend\src\pages\codex\index.js" }
  Invoke-Step "node syntax: frontend modules" {
    foreach ($File in @(
      "frontend\src\pages\codex\config.js",
      "frontend\src\pages\codex\utils.js",
      "frontend\src\pages\codex\api.js",
      "frontend\src\pages\codex\fixtures.js",
      "frontend\src\pages\codex\renderer.js",
      "frontend\src\app\shell.js",
      "frontend\src\store\codex.js"
    )) {
      node --check $File
      if ($LASTEXITCODE -ne 0) { throw "$File failed syntax check" }
    }
  }
  Invoke-Step "node syntax: source audit" { node --check "scripts\audit-codex-source-alignment.cjs" }
  Invoke-Step "node syntax: DOM audit" { node --check "scripts\audit-codex-dom-structure.cjs" }
  Invoke-Step "node syntax: markup audit" { node --check "scripts\audit-codex-markup-alignment.cjs" }
  Invoke-Step "node syntax: computed audit" { node --check "scripts\audit-codex-computed-styles.cjs" }
  Invoke-Step "node syntax: dynamic audit" { node --check "scripts\audit-codex-dynamic-states.cjs" }
  Invoke-Step "python syntax: shell style audit" { python -m py_compile "scripts\audit-code-server-shell-styles.py" }
  Invoke-Step "python syntax: Playwright screenshot verifier" { python -m py_compile "scripts\verify-codex-panel-playwright.py" }
  [scriptblock]::Create((Get-Content -LiteralPath "scripts\audit-codex-visual-diff.ps1" -Raw)) | Out-Null

  Invoke-Step "source alignment" { node "scripts\audit-codex-source-alignment.cjs" }
  Invoke-Step "code-server shell style audit" { python "scripts\audit-code-server-shell-styles.py" }

  New-Item -ItemType Directory -Force -Path $Profile | Out-Null
  $ChromeProcess = Start-Process -FilePath $Chrome -ArgumentList @(
    "--headless=new",
    "--remote-debugging-port=$CdpPort",
    "--disable-gpu",
    "--force-device-scale-factor=1",
    "--user-data-dir=$Profile",
    "about:blank"
  ) -PassThru -WindowStyle Hidden

  $Deadline = (Get-Date).AddSeconds(10)
  do {
    try {
      $Response = Invoke-WebRequest -UseBasicParsing "$CdpUrl/json/version" -TimeoutSec 2
      if ($Response.StatusCode -eq 200) { break }
    } catch {
      Start-Sleep -Milliseconds 250
    }
  } while ((Get-Date) -lt $Deadline)

  try {
    Invoke-WebRequest -UseBasicParsing "$CdpUrl/json/version" -TimeoutSec 2 | Out-Null
  } catch {
    throw "Chrome CDP did not start at $CdpUrl"
  }

  $env:CDP_URL = $CdpUrl
  $env:PANEL_URL = $PanelUrl
  Invoke-Step "DOM structure audit" { node "scripts\audit-codex-dom-structure.cjs" }
  Invoke-Step "markup alignment audit" { node "scripts\audit-codex-markup-alignment.cjs" }
  Invoke-Step "computed style audit" { node "scripts\audit-codex-computed-styles.cjs" }
  Invoke-Step "dynamic state audit" { node "scripts\audit-codex-dynamic-states.cjs" }

  Write-Host "[audit] complete"
} finally {
  if ($ChromeProcess -and -not $ChromeProcess.HasExited) {
    Stop-Process -Id $ChromeProcess.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item Env:CDP_URL -ErrorAction SilentlyContinue
  Remove-Item Env:PANEL_URL -ErrorAction SilentlyContinue
}
