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

  $siteFiles = @(
    "docs\.nojekyll",
    "docs\assets\logo.png",
    "docs\index.html",
    "docs\privacy.html",
    "docs\styles.css"
  )
  foreach ($siteFile in $siteFiles) {
    if (-not (Test-Path -LiteralPath $siteFile -PathType Leaf)) {
      throw "Required website file is missing: $siteFile"
    }
  }

  foreach ($htmlFile in Get-ChildItem -LiteralPath "docs" -Filter "*.html") {
    $html = Get-Content -LiteralPath $htmlFile.FullName -Raw
    $isGoogleVerificationFile =
      $htmlFile.Name -match '^google[a-z0-9]+\.html$' -and
      $html.Trim() -eq "google-site-verification: $($htmlFile.Name)"
    if ($isGoogleVerificationFile) {
      continue
    }

    if ($html -notmatch '<html\s+lang="en">') {
      throw "$($htmlFile.Name) must declare English as the document language."
    }
    if ($html -match '[\u0400-\u04FF]') {
      throw "$($htmlFile.Name) contains Cyrillic text; the website must remain in English."
    }
    if ($html -match '<script\b') {
      throw "$($htmlFile.Name) must remain a script-free static page."
    }

    foreach ($reference in [regex]::Matches($html, '(?:href|src)="([^"]+)"')) {
      $target = $reference.Groups[1].Value
      if ($target -match '^(?:https?:|#)') {
        continue
      }

      $relativeTarget = (($target -split '#')[0] -split '\?')[0]
      $localTarget = Join-Path $htmlFile.DirectoryName $relativeTarget
      if (-not (Test-Path -LiteralPath $localTarget -PathType Leaf)) {
        throw "Broken local reference in $($htmlFile.Name): $target"
      }
    }
  }

  $privacyPage = Get-Content -LiteralPath "docs\privacy.html" -Raw
  foreach ($requiredStatement in @(
    "Privacy Policy",
    "analytics, telemetry, or tracking",
    "chrome.storage.sync",
    "chrome.storage.local",
    "Chrome Web Store Limited Use"
  )) {
    if (-not $privacyPage.Contains($requiredStatement)) {
      throw "The website privacy policy is missing: $requiredStatement"
    }
  }
} finally {
  Pop-Location
}

Write-Output "All extension and website tests passed."
