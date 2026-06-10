<#
.SYNOPSIS
  Add Windows Defender real-time-scan exclusions for this repo's build artifacts.

.DESCRIPTION
  `next build` on Windows intermittently fails during the "Collecting build
  traces / Finalizing" stage with filesystem races such as:
    ENOENT  rename '.next\export\500.html' -> '.next\server\pages\500.html'
    ENOENT  open   '.next\static\<id>\_ssgManifest.js'
  Root cause: Defender real-time protection briefly holds a handle on a file
  Next.js just wrote inside `.next`, so the immediately-following rename/open
  loses the race. Excluding the repo (and the `.next` output dir specifically)
  from real-time scanning removes the contention.

  Requires administrator rights; the script self-elevates if needed.
  Re-running is safe (Defender de-duplicates exclusion paths).

.NOTES
  Phase 1 fix M-1. See PHASE_1_FIXER_REPORT.md.
#>

$ErrorActionPreference = "Stop"

# Resolve the repo root (parent of this /scripts folder) regardless of CWD.
$repo = Split-Path -Parent $PSScriptRoot

# Self-elevate to admin if we aren't already.
$isAdmin = ([Security.Principal.WindowsPrincipal] `
  [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
  Write-Host "Elevating to administrator..." -ForegroundColor Yellow
  Start-Process -FilePath "powershell.exe" -Verb RunAs -ArgumentList @(
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$PSCommandPath`""
  )
  return
}

$paths = @(
  $repo,
  (Join-Path $repo ".next"),
  (Join-Path $repo "node_modules")
)

foreach ($p in $paths) {
  try {
    Add-MpPreference -ExclusionPath $p
    Write-Host "  + excluded: $p" -ForegroundColor Green
  } catch {
    Write-Warning "  ! could not exclude $p : $($_.Exception.Message)"
  }
}

# Exclude the Node process used by the Next.js compiler/worker pool.
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if ($node) {
  try {
    Add-MpPreference -ExclusionProcess $node
    Write-Host "  + excluded process: $node" -ForegroundColor Green
  } catch {
    Write-Warning "  ! could not exclude process node : $($_.Exception.Message)"
  }
}

Write-Host "`nDone. Defender will no longer real-time-scan the build output." -ForegroundColor Cyan
Write-Host "Verify with:  Get-MpPreference | Select-Object -ExpandProperty ExclusionPath"
Write-Host "Press Enter to close..."
[void][System.Console]::ReadLine()
