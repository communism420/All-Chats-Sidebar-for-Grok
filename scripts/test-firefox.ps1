[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$webExtScript = Join-Path $projectRoot "node_modules\web-ext\bin\web-ext.js"
if (-not (Test-Path -LiteralPath $webExtScript -PathType Leaf)) {
  throw "Firefox verification dependencies are missing. Run npm ci first."
}

$systemTemp = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$verificationRoot = [System.IO.Path]::GetFullPath((Join-Path $systemTemp (
  "grok-firefox-verification-" + [guid]::NewGuid().ToString("N")
)))
if (-not $verificationRoot.StartsWith($systemTemp, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to create Firefox verification files outside the system temporary directory."
}

$packageRoot = Join-Path $verificationRoot "package"
$sourceRoot = Join-Path $verificationRoot "source"
$previousBrowserEngine = $env:BROWSER_ENGINE
New-Item -ItemType Directory -Path $verificationRoot | Out-Null

Push-Location $projectRoot
try {
  & "scripts/package.ps1" -Target Firefox -OutputDirectory $packageRoot

  $archivePath = Join-Path $packageRoot "grok-show-all-chats-firefox-1.0.2.zip"
  Expand-Archive -LiteralPath $archivePath -DestinationPath $sourceRoot

  & node $webExtScript lint --source-dir $sourceRoot --warnings-as-errors --no-config-discovery
  if ($LASTEXITCODE -ne 0) {
    throw "Firefox web-ext lint failed."
  }

  $env:BROWSER_ENGINE = "firefox"
  & node "tests/realtime-sync.browser.test.mjs"
  if ($LASTEXITCODE -ne 0) {
    throw "Firefox browser regression tests failed."
  }
} finally {
  $env:BROWSER_ENGINE = $previousBrowserEngine
  Pop-Location
  if ($verificationRoot.StartsWith($systemTemp, [System.StringComparison]::OrdinalIgnoreCase) -and
    (Test-Path -LiteralPath $verificationRoot)) {
    Remove-Item -LiteralPath $verificationRoot -Recurse -Force
  }
}

Write-Output "Firefox package lint and browser tests passed."
