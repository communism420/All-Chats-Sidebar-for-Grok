[CmdletBinding()]
param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\dist")
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Assert-ExactValues {
  param(
    [Parameter(Mandatory)] [object[]]$Actual,
    [Parameter(Mandatory)] [string[]]$Expected,
    [Parameter(Mandatory)] [string]$Label
  )

  $actualValues = @($Actual | ForEach-Object { [string]$_ } | Sort-Object)
  $expectedValues = @($Expected | Sort-Object)
  if (($actualValues -join "`n") -ne ($expectedValues -join "`n")) {
    throw "$Label must be exactly: $($Expected -join ', '). Found: $($actualValues -join ', ')"
  }
}

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$manifestPath = Join-Path $projectRoot "manifest.json"
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json

if ([string]$manifest.version -ne "1.0.0") {
  throw "manifest.json version must remain 1.0.0 unless the user explicitly requests a change."
}

$expectedHomepage = "https://github.com/communism420/All-Chats-Sidebar-for-Grok"
if ([string]$manifest.homepage_url -ne $expectedHomepage) {
  throw "manifest.json homepage_url must point to the public source repository."
}

Assert-ExactValues -Actual @($manifest.permissions) -Expected @("storage") -Label "permissions"
if (@($manifest.content_scripts).Count -ne 2) {
  throw "manifest.json must contain exactly two content script declarations."
}

$pageBridgeScript = $manifest.content_scripts[0]
$extensionScript = $manifest.content_scripts[1]
Assert-ExactValues -Actual @($pageBridgeScript.matches) -Expected @("https://grok.com/*") -Label "page bridge matches"
Assert-ExactValues -Actual @($pageBridgeScript.js) -Expected @("page-bridge.js") -Label "page bridge scripts"
Assert-ExactValues -Actual @($extensionScript.matches) -Expected @("https://grok.com/*") -Label "extension content script matches"
Assert-ExactValues -Actual @($extensionScript.js) -Expected @("i18n.js", "settings-bridge.js", "content.js") -Label "extension content scripts"
Assert-ExactValues -Actual @($extensionScript.css) -Expected @("content.css") -Label "extension content styles"

if ((@($extensionScript.js) -join "`n") -ne (@("i18n.js", "settings-bridge.js", "content.js") -join "`n")) {
  throw "The isolated extension content scripts are in the wrong load order."
}

if ([string]$pageBridgeScript.run_at -ne "document_start" -or [string]$pageBridgeScript.world -ne "MAIN") {
  throw "page-bridge.js must run in the MAIN world at document_start."
}
if ([string]$extensionScript.run_at -ne "document_idle") {
  throw "The isolated extension content scripts must run at document_idle."
}

if ($manifest.PSObject.Properties.Name -contains "host_permissions") {
  throw "host_permissions must remain absent; the content script uses only same-origin requests."
}

$expectedCsp = "script-src 'self'; object-src 'none'"
if ([string]$manifest.content_security_policy.extension_pages -ne $expectedCsp) {
  throw "Extension page CSP must be: $expectedCsp"
}

$runtimeFiles = @(
  "LICENSE",
  "manifest.json",
  "page-bridge.js",
  "icons\icon16.png",
  "icons\icon32.png",
  "icons\icon48.png",
  "icons\icon128.png",
  "content.js",
  "content.css",
  "i18n.js",
  "settings-bridge.js",
  "popup.js",
  "popup.html",
  "popup.css"
)
$requiredLocales = @("de", "en", "es", "fr", "pt_BR", "ru", "uk")
$requiredIconSizes = @(16, 32, 48, 128)

foreach ($relativePath in $runtimeFiles) {
  if (-not (Test-Path -LiteralPath (Join-Path $projectRoot $relativePath) -PathType Leaf)) {
    throw "Required package file is missing: $relativePath"
  }
}

Add-Type -AssemblyName System.Drawing
foreach ($size in $requiredIconSizes) {
  $iconPath = Join-Path $projectRoot "icons\icon$size.png"
  $icon = [System.Drawing.Image]::FromFile($iconPath)
  try {
    if ($icon.Width -ne $size -or $icon.Height -ne $size) {
      throw "icons/icon$size.png must be ${size}x${size}. Found $($icon.Width)x$($icon.Height)."
    }
  } finally {
    $icon.Dispose()
  }
}

$localeRoot = Join-Path $projectRoot "_locales"
$actualLocales = @(
  Get-ChildItem -LiteralPath $localeRoot -Directory |
    Select-Object -ExpandProperty Name
)
Assert-ExactValues -Actual $actualLocales -Expected $requiredLocales -Label "locale directories"

foreach ($locale in $requiredLocales) {
  $messagePath = Join-Path $localeRoot "$locale\messages.json"
  if (-not (Test-Path -LiteralPath $messagePath -PathType Leaf)) {
    throw "Required locale file is missing: _locales/$locale/messages.json"
  }
  $null = Get-Content -LiteralPath $messagePath -Raw | ConvertFrom-Json
}

$outputRoot = [System.IO.Path]::GetFullPath($OutputDirectory)
$archivePath = Join-Path $outputRoot "grok-show-all-chats-1.0.0.zip"
$tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$stagingRoot = Join-Path $tempRoot ("grok-show-all-chats-" + [guid]::NewGuid().ToString("N"))
$stagingRoot = [System.IO.Path]::GetFullPath($stagingRoot)

if (-not $stagingRoot.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to use a staging directory outside the system temporary directory."
}

New-Item -ItemType Directory -Path $stagingRoot | Out-Null

try {
  foreach ($relativePath in $runtimeFiles) {
    $sourcePath = Join-Path $projectRoot $relativePath
    $destinationPath = Join-Path $stagingRoot $relativePath
    $destinationDirectory = Split-Path -Parent $destinationPath
    New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
    Copy-Item -LiteralPath $sourcePath -Destination $destinationPath
  }

  foreach ($locale in $requiredLocales) {
    $relativePath = "_locales\$locale\messages.json"
    $sourcePath = Join-Path $projectRoot $relativePath
    $destinationPath = Join-Path $stagingRoot $relativePath
    New-Item -ItemType Directory -Path (Split-Path -Parent $destinationPath) -Force | Out-Null
    Copy-Item -LiteralPath $sourcePath -Destination $destinationPath
  }

  New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
  if (Test-Path -LiteralPath $archivePath) {
    Remove-Item -LiteralPath $archivePath -Force
  }

  Compress-Archive -Path (Join-Path $stagingRoot "*") -DestinationPath $archivePath -CompressionLevel Optimal
} finally {
  if (Test-Path -LiteralPath $stagingRoot) {
    Remove-Item -LiteralPath $stagingRoot -Recurse -Force
  }
}

$archive = Get-Item -LiteralPath $archivePath
Write-Output "Created $($archive.FullName) ($($archive.Length) bytes)"
