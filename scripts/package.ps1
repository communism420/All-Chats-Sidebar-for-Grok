[CmdletBinding()]
param(
  [ValidateSet("Chromium", "Firefox")]
  [string]$Target = "Chromium",
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

function New-DeterministicArchive {
  param(
    [Parameter(Mandatory)] [string]$SourceDirectory,
    [Parameter(Mandatory)] [string]$DestinationPath
  )

  Add-Type -AssemblyName System.IO.Compression
  $sourceRoot = [System.IO.Path]::GetFullPath($SourceDirectory)
  $destination = [System.IO.Path]::GetFullPath($DestinationPath)
  $fixedTimestamp = [System.DateTimeOffset]::new(
    2000,
    1,
    1,
    0,
    0,
    0,
    [System.TimeSpan]::Zero
  )
  $files = @(
    Get-ChildItem -LiteralPath $sourceRoot -Recurse -File |
      Sort-Object { [System.IO.Path]::GetRelativePath($sourceRoot, $_.FullName) }
  )

  $outputStream = [System.IO.File]::Open(
    $destination,
    [System.IO.FileMode]::Create,
    [System.IO.FileAccess]::Write,
    [System.IO.FileShare]::None
  )
  try {
    $archive = [System.IO.Compression.ZipArchive]::new(
      $outputStream,
      [System.IO.Compression.ZipArchiveMode]::Create,
      $false
    )
    try {
      foreach ($file in $files) {
        $relativePath = [System.IO.Path]::GetRelativePath($sourceRoot, $file.FullName).Replace("\", "/")
        $entry = $archive.CreateEntry($relativePath, [System.IO.Compression.CompressionLevel]::Optimal)
        $entry.LastWriteTime = $fixedTimestamp
        $entry.ExternalAttributes = 0

        $inputStream = [System.IO.File]::OpenRead($file.FullName)
        $entryStream = $entry.Open()
        try {
          $inputStream.CopyTo($entryStream)
        } finally {
          $entryStream.Dispose()
          $inputStream.Dispose()
        }
      }
    } finally {
      $archive.Dispose()
    }
  } finally {
    $outputStream.Dispose()
  }
}

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$manifestPath = Join-Path $projectRoot "manifest.json"
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$targetName = $Target.ToLowerInvariant()
$expectedVersion = "1.0.1"

if ([string]$manifest.version -ne $expectedVersion) {
  throw "manifest.json version must remain $expectedVersion unless the user explicitly requests a change."
}

$expectedHomepage = "https://github.com/communism420/All-Chats-Sidebar-for-Grok"
if ([string]$manifest.homepage_url -ne $expectedHomepage) {
  throw "manifest.json homepage_url must point to the public source repository."
}

if ($manifest.PSObject.Properties.Name -contains "browser_specific_settings") {
  throw "The shared Chromium manifest must not contain Firefox-only settings."
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
Assert-ExactValues -Actual @($extensionScript.js) -Expected @("webext.js", "i18n.js", "settings-bridge.js", "content.js") -Label "extension content scripts"
Assert-ExactValues -Actual @($extensionScript.css) -Expected @("content.css") -Label "extension content styles"

if ((@($extensionScript.js) -join "`n") -ne (@("webext.js", "i18n.js", "settings-bridge.js", "content.js") -join "`n")) {
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

$firefoxOverlay = $null
if ($targetName -eq "firefox") {
  $firefoxOverlayPath = Join-Path $projectRoot "manifest.firefox.json"
  if (-not (Test-Path -LiteralPath $firefoxOverlayPath -PathType Leaf)) {
    throw "Firefox manifest overlay is missing: manifest.firefox.json"
  }

  $firefoxOverlay = Get-Content -LiteralPath $firefoxOverlayPath -Raw | ConvertFrom-Json
  $overlayProperties = @($firefoxOverlay.PSObject.Properties.Name)
  Assert-ExactValues -Actual $overlayProperties -Expected @("browser_specific_settings") -Label "Firefox overlay keys"

  $gecko = $firefoxOverlay.browser_specific_settings.gecko
  $expectedFirefoxId = "all-chats-sidebar-for-grok@communism420.github.io"
  if ([string]$gecko.id -ne $expectedFirefoxId) {
    throw "Firefox Add-on ID must remain $expectedFirefoxId."
  }
  if ([version]$gecko.strict_min_version -lt [version]"142.0") {
    throw "Firefox strict_min_version must be 142.0 or newer for warning-free built-in data consent."
  }
  Assert-ExactValues `
    -Actual @($gecko.data_collection_permissions.required) `
    -Expected @("personalCommunications", "websiteContent") `
    -Label "Firefox required data collection permissions"
  if ($gecko.data_collection_permissions.PSObject.Properties.Name -contains "optional") {
    throw "Firefox optional data collection permissions must remain absent."
  }
}

$runtimeFiles = @(
  "LICENSE",
  "manifest.json",
  "page-bridge.js",
  "webext.js",
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
$archiveName = if ($targetName -eq "firefox") {
  "grok-show-all-chats-firefox-$expectedVersion.zip"
} else {
  "grok-show-all-chats-$expectedVersion.zip"
}
$archivePath = Join-Path $outputRoot $archiveName
$tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$stagingRoot = Join-Path $tempRoot ("grok-show-all-chats-$targetName-" + [guid]::NewGuid().ToString("N"))
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

  if ($targetName -eq "firefox") {
    $packageManifest = $manifest | ConvertTo-Json -Depth 100 | ConvertFrom-Json
    $packageManifest | Add-Member `
      -MemberType NoteProperty `
      -Name "browser_specific_settings" `
      -Value $firefoxOverlay.browser_specific_settings
    $packageManifestJson = $packageManifest | ConvertTo-Json -Depth 100
    $utf8WithoutBom = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText(
      (Join-Path $stagingRoot "manifest.json"),
      $packageManifestJson + [Environment]::NewLine,
      $utf8WithoutBom
    )
  }

  New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
  New-DeterministicArchive -SourceDirectory $stagingRoot -DestinationPath $archivePath
} finally {
  if (Test-Path -LiteralPath $stagingRoot) {
    Remove-Item -LiteralPath $stagingRoot -Recurse -Force
  }
}

$archive = Get-Item -LiteralPath $archivePath
Write-Output "Created $($archive.FullName) ($($archive.Length) bytes)"
