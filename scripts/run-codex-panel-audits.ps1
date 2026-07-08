param(
  [int]$CdpPort = 9337,
  [string]$PanelUrl = "http://127.0.0.1:58888/?codexFixture=reference"
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

function Assert-FixtureAssetAvailable {
  if ($PanelUrl -notmatch "(^|[?&])codexFixture=") {
    return
  }
  $PanelUri = [System.Uri]$PanelUrl
  $Builder = [System.UriBuilder]::new($PanelUri)
  $Builder.Path = "/app/codex-fixtures.js"
  $Builder.Query = ""
  $FixtureUrl = $Builder.Uri.AbsoluteUri
  try {
    $Response = Invoke-WebRequest -UseBasicParsing $FixtureUrl -TimeoutSec 5
    if ($Response.StatusCode -eq 200) {
      return
    }
  } catch {
    throw "Fixture audit URL requires $FixtureUrl. Restart codex-web with CODEX_WEB_ENABLE_FIXTURES=1 before running this audit."
  }
  throw "Fixture audit URL requires $FixtureUrl. Restart codex-web with CODEX_WEB_ENABLE_FIXTURES=1 before running this audit."
}

try {
  if (-not (Test-Path -LiteralPath $Chrome)) {
    throw "Chrome not found: $Chrome"
  }

  Set-Location -LiteralPath $RepoRoot
  Assert-FixtureAssetAvailable

  Invoke-Step "node syntax: codex page" { node --check "frontend\src\pages\codex\index.js" }
  Invoke-Step "node syntax: frontend modules" {
    foreach ($File in @(
      "frontend\src\pages\codex\config.js",
      "frontend\src\pages\codex\utils.js",
      "frontend\src\pages\codex\api.js",
      "frontend\src\pages\codex\grouping.js",
      "frontend\src\pages\codex\fixtures.js",
      "frontend\src\pages\codex\renderer.js",
      "frontend\src\components\workspace\layout.js",
      "frontend\src\app\bootstrap.js",
      "frontend\src\store\codex.js",
      "frontend\src\pages\workspace\index.js",
      "frontend\src\pages\nodes\index.js",
      "frontend\src\pages\git\index.js",
      "frontend\src\pages\runs\index.js"
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
  Invoke-Step "node syntax: event mapping audit" { node --check "scripts\audit-codex-event-mapping.cjs" }
  Invoke-Step "node syntax: grouping rules audit" { node --check "scripts\audit-codex-grouping-rules.cjs" }
  Invoke-Step "node syntax: activity summary rules audit" { node --check "scripts\audit-codex-activity-summary-rules.cjs" }
  Invoke-Step "node syntax: markdown reference rules audit" { node --check "scripts\audit-codex-markdown-reference-rules.cjs" }
  Invoke-Step "node syntax: virtual scroll audit" { node --check "scripts\audit-codex-virtual-scroll.cjs" }
  Invoke-Step "node syntax: session sequencing audit" { node --check "scripts\audit-codex-session-sequencing.cjs" }
  Invoke-Step "node syntax: SSE reconnect audit" { node --check "scripts\audit-codex-sse-reconnect.cjs" }
  Invoke-Step "node syntax: system architecture audit" { node --check "scripts\audit-codex-system-architecture.cjs" }
  Invoke-Step "node syntax: completion audit" { node --check "scripts\audit-codex-completion.cjs" }
  Invoke-Step "node syntax: disclosure collapse audit" { node --check "scripts\audit-codex-disclosure-collapse.cjs" }
  Invoke-Step "node syntax: disclosure anchor probe" { node --check "scripts\probe-codex-disclosure-anchor.cjs" }
  Invoke-Step "node syntax: file diff audit" { node --check "scripts\audit-codex-file-diff.cjs" }
  Invoke-Step "node syntax: workspace native interactions audit" { node --check "scripts\audit-workspace-native-interactions.cjs" }
  Invoke-Step "node syntax: final state screenshot capture" { node --check "scripts\capture-codex-final-states.cjs" }
  Invoke-Step "node syntax: collapse capture audit" { node --check "scripts\audit-codex-collapse-capture.cjs" }
  Invoke-Step "node syntax: collapse window rules audit" { node --check "scripts\audit-codex-collapse-window-rules.cjs" }
  Invoke-Step "node syntax: live anchor alignment audit" { node --check "scripts\audit-codex-live-anchor-alignment.cjs" }
  Invoke-Step "python syntax: workspace layout audit" { python -m py_compile "scripts\audit-workspace-layout-styles.py" }
  Invoke-Step "python syntax: Playwright screenshot verifier" { python -m py_compile "scripts\verify-codex-panel-playwright.py" }
  Invoke-Step "python syntax: Runs view verifier" { python -m py_compile "scripts\verify-runs-view.py" }
  Invoke-Step "python syntax: controller views verifier" { python -m py_compile "scripts\verify-controller-views.py" }
  [scriptblock]::Create((Get-Content -LiteralPath "scripts\audit-codex-visual-diff.ps1" -Raw)) | Out-Null

  Invoke-Step "source alignment" { node "scripts\audit-codex-source-alignment.cjs" }
  Invoke-Step "session sequencing audit" { node "scripts\audit-codex-session-sequencing.cjs" }
  Invoke-Step "SSE reconnect audit" { node "scripts\audit-codex-sse-reconnect.cjs" }
  Invoke-Step "system architecture audit" { node "scripts\audit-codex-system-architecture.cjs" }
  Invoke-Step "workspace layout audit" { python "scripts\audit-workspace-layout-styles.py" }
  $env:PANEL_URL = $PanelUrl
  Invoke-Step "Runs view audit" { python "scripts\verify-runs-view.py" }
  Invoke-Step "controller views audit" { python "scripts\verify-controller-views.py" }

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
  Invoke-Step "event mapping audit" { node "scripts\audit-codex-event-mapping.cjs" }
  Invoke-Step "grouping rules audit" { node "scripts\audit-codex-grouping-rules.cjs" }
  Invoke-Step "activity summary rules audit" { node "scripts\audit-codex-activity-summary-rules.cjs" }
  Invoke-Step "markdown reference rules audit" { node "scripts\audit-codex-markdown-reference-rules.cjs" }
  Invoke-Step "virtual scroll audit" { node "scripts\audit-codex-virtual-scroll.cjs" }
  Invoke-Step "disclosure collapse audit" { node "scripts\audit-codex-disclosure-collapse.cjs" }
  Invoke-Step "disclosure anchor probe" { node "scripts\probe-codex-disclosure-anchor.cjs" }
  Invoke-Step "file diff audit" { node "scripts\audit-codex-file-diff.cjs" }
  Invoke-Step "workspace native interactions audit" { node "scripts\audit-workspace-native-interactions.cjs" }
  if ($env:CAPTURE_FINAL_STATE_SCREENSHOTS -eq "1") {
    Invoke-Step "final state screenshot capture" { node "scripts\capture-codex-final-states.cjs" }
  } else {
    Write-Host "[audit] final state screenshot capture skipped: set CAPTURE_FINAL_STATE_SCREENSHOTS=1 to regenerate PNG evidence"
  }
  $CollapseCaptureLatest = "reference\collapse-alignment\latest.txt"
  if ($env:RUN_COLLAPSE_CAPTURE_AUDITS -eq "1" -and (Test-Path -LiteralPath $CollapseCaptureLatest)) {
    $CollapseCaptureDir = (Get-Content -LiteralPath $CollapseCaptureLatest -Raw).Trim()
    $CollapseCaptureSummary = Join-Path $CollapseCaptureDir "summary.json"
    if (Test-Path -LiteralPath $CollapseCaptureSummary) {
      Invoke-Step "collapse capture audit" { node "scripts\audit-codex-collapse-capture.cjs" }
      Invoke-Step "collapse window rules audit" { node "scripts\audit-codex-collapse-window-rules.cjs" }
    } else {
      Write-Host "[audit] collapse capture audit skipped: missing $CollapseCaptureSummary"
    }
  } else {
    Write-Host "[audit] collapse capture audit skipped: set RUN_COLLAPSE_CAPTURE_AUDITS=1 after refreshing reference\collapse-alignment\latest.txt"
  }
  if ($env:RUN_LIVE_ANCHOR_ALIGNMENT -eq "1") {
    Invoke-Step "live anchor alignment audit" { node "scripts\audit-codex-live-anchor-alignment.cjs" }
  } else {
    Write-Host "[audit] live anchor alignment audit skipped: set RUN_LIVE_ANCHOR_ALIGNMENT=1 with prepared source/target CDP pages"
  }

  Write-Host "[audit] complete"
} finally {
  if ($ChromeProcess -and -not $ChromeProcess.HasExited) {
    Stop-Process -Id $ChromeProcess.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item Env:CDP_URL -ErrorAction SilentlyContinue
  Remove-Item Env:PANEL_URL -ErrorAction SilentlyContinue
}
