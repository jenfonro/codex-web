param(
  [string]$LocalCaptureDir,
  [int]$Threshold = 6
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$ReferenceRoot = Join-Path $RepoRoot "reference\windows-captures"
$AuditRoot = Join-Path $RepoRoot "reference\codex-reference"
$DiffRoot = Join-Path $AuditRoot "visual-diffs"
$AuditJson = Join-Path $AuditRoot "visual-diff-audit.json"
$AuditMd = Join-Path $AuditRoot "visual-diff-audit.md"

if (-not $LocalCaptureDir) {
  $LatestFile = Join-Path $ReferenceRoot "latest.txt"
  if (-not (Test-Path -LiteralPath $LatestFile)) {
    throw "missing latest capture marker: $LatestFile"
  }
  $LocalCaptureDir = (Get-Content -LiteralPath $LatestFile -Raw).Trim()
}

if (-not (Test-Path -LiteralPath $LocalCaptureDir)) {
  throw "missing local capture dir: $LocalCaptureDir"
}

New-Item -ItemType Directory -Force -Path $DiffRoot | Out-Null
Add-Type -AssemblyName System.Drawing

$Cases = @(
  @{
    Name = "list"
    ReferenceDir = "20260702-184840-codex-session-list-wide-611"
    LocalPanel = "list-panel.png"
    LocalFull = "list-full.png"
    ReferencePanelRect = @(48, 70, 610, 893)
  },
  @{
    Name = "thread"
    ReferenceDir = "20260702-185302-codex-thread-wide-611"
    LocalPanel = "thread-panel.png"
    LocalFull = "thread-full.png"
    ReferencePanelRect = @(48, 70, 610, 893)
  },
  @{
    Name = "plus"
    ReferenceDir = "20260702-185715-codex-thread-plus-menu-wide-611-stable"
    LocalPanel = "plus-panel.png"
    LocalFull = "plus-full.png"
    ReferencePanelRect = @(48, 70, 579, 893)
  },
  @{
    Name = "approval"
    ReferenceDir = "20260702-185942-codex-thread-approval-menu-wide-stable"
    LocalPanel = "approval-panel.png"
    LocalFull = "approval-full.png"
    ReferencePanelRect = @(48, 70, 579, 893)
  },
  @{
    Name = "model"
    ReferenceDir = "20260702-190248-codex-thread-model-menu-right-wide-stable"
    LocalPanel = "model-panel.png"
    LocalFull = "model-full.png"
    ReferencePanelRect = $null
  }
)

function New-BitmapCrop {
  param(
    [Parameter(Mandatory=$true)][System.Drawing.Bitmap]$Bitmap,
    [Parameter(Mandatory=$true)][int[]]$Rect
  )
  $Out = New-Object System.Drawing.Bitmap($Rect[2], $Rect[3], [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $Graphics = [System.Drawing.Graphics]::FromImage($Out)
  try {
    $Graphics.DrawImage(
      $Bitmap,
      (New-Object System.Drawing.Rectangle(0, 0, $Rect[2], $Rect[3])),
      (New-Object System.Drawing.Rectangle($Rect[0], $Rect[1], $Rect[2], $Rect[3])),
      [System.Drawing.GraphicsUnit]::Pixel
    )
  } finally {
    $Graphics.Dispose()
  }
  return $Out
}

function Save-Bitmap {
  param(
    [Parameter(Mandatory=$true)][System.Drawing.Bitmap]$Bitmap,
    [Parameter(Mandatory=$true)][string]$Path
  )
  $Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function Compare-Bitmaps {
  param(
    [Parameter(Mandatory=$true)][System.Drawing.Bitmap]$Reference,
    [Parameter(Mandatory=$true)][System.Drawing.Bitmap]$Current,
    [Parameter(Mandatory=$true)][string]$DiffPath,
    [Parameter(Mandatory=$true)][int]$Threshold
  )

  if ($Reference.Width -ne $Current.Width -or $Reference.Height -ne $Current.Height) {
    return @{
      width = $Current.Width
      height = $Current.Height
      referenceWidth = $Reference.Width
      referenceHeight = $Reference.Height
      comparedPixels = 0
      differentPixels = $null
      differentPercent = $null
      meanChannelDelta = $null
      maxChannelDelta = $null
      error = "dimension mismatch"
    }
  }

  $Width = $Reference.Width
  $Height = $Reference.Height
  $Diff = New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $Different = 0L
  $Compared = [int64]$Width * [int64]$Height
  $TotalDelta = 0L
  $MaxDelta = 0

  for ($Y = 0; $Y -lt $Height; $Y++) {
    for ($X = 0; $X -lt $Width; $X++) {
      $A = $Reference.GetPixel($X, $Y)
      $B = $Current.GetPixel($X, $Y)
      $Dr = [Math]::Abs([int]$A.R - [int]$B.R)
      $Dg = [Math]::Abs([int]$A.G - [int]$B.G)
      $Db = [Math]::Abs([int]$A.B - [int]$B.B)
      $Da = [Math]::Abs([int]$A.A - [int]$B.A)
      $Delta = [Math]::Max([Math]::Max($Dr, $Dg), [Math]::Max($Db, $Da))
      $TotalDelta += $Dr + $Dg + $Db + $Da
      if ($Delta -gt $MaxDelta) {
        $MaxDelta = $Delta
      }
      if ($Delta -gt $Threshold) {
        $Different++
        $Heat = [Math]::Min(255, 72 + ($Delta * 2))
        $Diff.SetPixel($X, $Y, [System.Drawing.Color]::FromArgb(255, $Heat, 0, 0))
      } else {
        $Base = [int](($B.R + $B.G + $B.B) / 3)
        $Muted = [Math]::Min(255, [int](238 + ($Base * 0.04)))
        $Diff.SetPixel($X, $Y, [System.Drawing.Color]::FromArgb(255, $Muted, $Muted, $Muted))
      }
    }
  }

  Save-Bitmap -Bitmap $Diff -Path $DiffPath
  $Diff.Dispose()

  return @{
    width = $Width
    height = $Height
    referenceWidth = $Width
    referenceHeight = $Height
    comparedPixels = $Compared
    differentPixels = $Different
    differentPercent = [Math]::Round(($Different * 100.0) / $Compared, 4)
    meanChannelDelta = [Math]::Round($TotalDelta / ($Compared * 4.0), 4)
    maxChannelDelta = $MaxDelta
    diff = $DiffPath
  }
}

function Use-Bitmap {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][scriptblock]$Block
  )
  $Bitmap = [System.Drawing.Bitmap]::FromFile((Resolve-Path -LiteralPath $Path))
  try {
    return & $Block $Bitmap
  } finally {
    $Bitmap.Dispose()
  }
}

$Rows = @()
foreach ($Case in $Cases) {
  $RefDir = Join-Path $ReferenceRoot $Case.ReferenceDir
  $RefCrop = Join-Path $RefDir "codex-sidebar-crop.png"
  $RefFull = Join-Path $RefDir "screenshot.png"
  $LocalPanel = Join-Path $LocalCaptureDir $Case.LocalPanel
  $LocalFull = Join-Path $LocalCaptureDir $Case.LocalFull

  if (-not (Test-Path -LiteralPath $RefCrop)) { throw "missing reference crop: $RefCrop" }
  if (-not (Test-Path -LiteralPath $LocalPanel)) { throw "missing local panel: $LocalPanel" }
  if (-not (Test-Path -LiteralPath $LocalFull)) { throw "missing local full: $LocalFull" }

  $PanelDiffPath = Join-Path $DiffRoot "$($Case.Name)-panel-diff.png"
  $ShellDiffPath = Join-Path $DiffRoot "$($Case.Name)-shell-diff.png"

  $PanelResult = Use-Bitmap -Path $RefCrop -Block {
    param($RefBitmap)
    $ReferencePanel = $null
    if ($Case.ReferencePanelRect) {
      $ReferencePanel = New-BitmapCrop -Bitmap $RefBitmap -Rect $Case.ReferencePanelRect
    } else {
      $ReferencePanel = New-Object System.Drawing.Bitmap($RefBitmap)
    }
    try {
      return Use-Bitmap -Path $LocalPanel -Block {
        param($LocalBitmap)
        Compare-Bitmaps -Reference $ReferencePanel -Current $LocalBitmap -DiffPath $PanelDiffPath -Threshold $Threshold
      }
    } finally {
      $ReferencePanel.Dispose()
    }
  }

  $ShellResult = $null
  if (Test-Path -LiteralPath $RefFull) {
    $ShellResult = Use-Bitmap -Path $RefFull -Block {
      param($RefBitmap)
      $ReferenceShell = New-BitmapCrop -Bitmap $RefBitmap -Rect @(0, 0, 700, 985)
      try {
        return Use-Bitmap -Path $LocalFull -Block {
          param($LocalBitmap)
          $LocalShell = New-BitmapCrop -Bitmap $LocalBitmap -Rect @(0, 0, 700, 985)
          try {
            Compare-Bitmaps -Reference $ReferenceShell -Current $LocalShell -DiffPath $ShellDiffPath -Threshold $Threshold
          } finally {
            $LocalShell.Dispose()
          }
        }
      } finally {
        $ReferenceShell.Dispose()
      }
    }
  }

  $Rows += @{
    name = $Case.Name
    referenceDir = $Case.ReferenceDir
    localCaptureDir = $LocalCaptureDir
    panel = $PanelResult
    shell = $ShellResult
  }
}

$Audit = @{
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  threshold = $Threshold
  localCaptureDir = $LocalCaptureDir
  rows = $Rows
}

$Audit | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $AuditJson -Encoding UTF8

$Md = New-Object System.Collections.Generic.List[string]
$Md.Add("# Codex Visual Diff Audit")
$Md.Add("")
$Md.Add("Generated: $($Audit.generatedAt)")
$Md.Add("")
$Md.Add("Compares captured code-server reference screenshots against the latest local Codex Web screenshots. This is an auxiliary visual audit; source, DOM, markup, and computed-style audits remain the primary exactness gates.")
$Md.Add("")
$Md.Add("- Threshold: max channel delta > $Threshold counts as different.")
$Md.Add("- Local capture: $LocalCaptureDir")
$Md.Add("")
$Md.Add("| View | Layer | Size | Different Pixels | Different % | Mean Channel Delta | Max Channel Delta | Diff |")
$Md.Add("| --- | --- | --- | ---: | ---: | ---: | ---: | --- |")
foreach ($Row in $Rows) {
  foreach ($Layer in @("panel", "shell")) {
    $Result = $Row[$Layer]
    if (-not $Result) { continue }
    $Size = "$($Result.width)x$($Result.height)"
    $DiffRel = ""
    if ($Result.diff) {
      $DiffRel = $Result.diff
      if ($DiffRel.StartsWith($AuditRoot)) {
        $DiffRel = $DiffRel.Substring($AuditRoot.Length).TrimStart("\", "/")
      }
      $DiffRel = $DiffRel.Replace("\", "/")
    }
    $Md.Add("| $($Row.name) | $Layer | $Size | $($Result.differentPixels) | $($Result.differentPercent) | $($Result.meanChannelDelta) | $($Result.maxChannelDelta) | $DiffRel |")
  }
}
$Md.Add("")
$Md.Add("Interpretation notes:")
$Md.Add("- shell includes activity bar, title/sidebar chrome, editor edge, and status bar.")
$Md.Add("- panel crops the actual ChatGPT/Codex webview area from the reference and compares it with the local panel screenshot.")
$Md.Add("- Dynamic labels and sampled conversation text can create legitimate pixel differences; inspect source/DOM/computed audits before treating visual diffs as actionable.")
$Md -join "`n" | Set-Content -LiteralPath $AuditMd -Encoding UTF8

Write-Output $AuditJson
Write-Output $AuditMd
