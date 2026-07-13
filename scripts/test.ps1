[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
Push-Location $projectRoot

try {
  $manifest = Get-Content -LiteralPath "manifest.json" -Raw | ConvertFrom-Json
  if ([string]$manifest.version -ne "1.0.0") {
    throw "manifest.json version must remain 1.0.0."
  }

  foreach ($script in @("page-bridge.js", "content.js", "i18n.js", "settings-bridge.js", "popup.js")) {
    & node --check $script
    if ($LASTEXITCODE -ne 0) {
      throw "JavaScript syntax check failed: $script"
    }
  }

  & node "tests/navigation.test.js"
  if ($LASTEXITCODE -ne 0) {
    throw "Navigation regression tests failed."
  }
} finally {
  Pop-Location
}

Write-Output "All extension tests passed."
