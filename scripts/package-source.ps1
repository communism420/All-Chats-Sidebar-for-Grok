[CmdletBinding()]
param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot "../dist")
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Get-ArchiveRelativePath {
  param(
    [Parameter(Mandatory)] [string]$RootPath,
    [Parameter(Mandatory)] [string]$FilePath
  )

  $separator = [System.IO.Path]::DirectorySeparatorChar
  $normalizedRoot = [System.IO.Path]::GetFullPath($RootPath).TrimEnd("\", "/") + $separator
  $normalizedFile = [System.IO.Path]::GetFullPath($FilePath)
  if (-not $normalizedFile.StartsWith($normalizedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Source file is outside the project directory: $normalizedFile"
  }

  return $normalizedFile.Substring($normalizedRoot.Length).Replace("\", "/")
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
      Sort-Object { Get-ArchiveRelativePath -RootPath $sourceRoot -FilePath $_.FullName }
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
        $relativePath = Get-ArchiveRelativePath -RootPath $sourceRoot -FilePath $file.FullName
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
$manifest = Get-Content -LiteralPath (Join-Path $projectRoot "manifest.json") -Raw | ConvertFrom-Json
$expectedVersion = "1.0.2"
if ([string]$manifest.version -ne $expectedVersion) {
  throw "manifest.json version must remain $expectedVersion."
}

$topLevelFiles = @(
  "CHANGELOG.md",
  "CHROME_WEB_STORE.md",
  "content.css",
  "content.js",
  "FIREFOX_ADD_ONS.md",
  "i18n.js",
  "LICENSE",
  "logo.png",
  "manifest.firefox.json",
  "manifest.json",
  "OPEN_SOURCE.md",
  "package-lock.json",
  "package.json",
  "page-bridge.js",
  "popup.css",
  "popup.html",
  "popup.js",
  "PRIVACY.md",
  "README.md",
  "settings-bridge.js",
  "SOURCE_BUILD.md",
  "webext.js"
)
$scriptFiles = @(
  "scripts/build-firefox-source.mjs",
  "scripts/generate-icons.ps1",
  "scripts/package-files.json",
  "scripts/package-source.ps1",
  "scripts/package.ps1",
  "scripts/test-firefox.ps1",
  "scripts/test.ps1"
)
$sourceFiles = @($topLevelFiles + $scriptFiles)

foreach ($directory in @("_locales", "docs", "icons", "tests", "store-assets/fixture")) {
  $directoryPath = Join-Path $projectRoot $directory
  if (-not (Test-Path -LiteralPath $directoryPath -PathType Container)) {
    throw "Required source directory is missing: $directory"
  }
  $sourceFiles += @(
    Get-ChildItem -LiteralPath $directoryPath -Recurse -File |
      ForEach-Object { Get-ArchiveRelativePath -RootPath $projectRoot -FilePath $_.FullName }
  )
}

$sourceFiles = @($sourceFiles | Sort-Object -Unique)
foreach ($relativePath in $sourceFiles) {
  if ($relativePath -match '(^|/)(\.git|node_modules|dist|build)(/|$)' -or
    $relativePath -match '(^|/)(\.env|\.dev\.vars)') {
    throw "Forbidden source-package path: $relativePath"
  }
  if (-not (Test-Path -LiteralPath (Join-Path $projectRoot $relativePath) -PathType Leaf)) {
    throw "Required source file is missing: $relativePath"
  }
}

$requiredReviewFiles = @(
  "SOURCE_BUILD.md",
  "manifest.json",
  "manifest.firefox.json",
  "package-lock.json",
  "scripts/build-firefox-source.mjs",
  "scripts/package-files.json",
  "scripts/package.ps1"
)
foreach ($requiredFile in $requiredReviewFiles) {
  if ($sourceFiles -notcontains $requiredFile) {
    throw "The source package is missing required review file: $requiredFile"
  }
}

$outputRoot = [System.IO.Path]::GetFullPath($OutputDirectory)
$archiveName = "grok-show-all-chats-firefox-$expectedVersion-source.zip"
$archivePath = Join-Path $outputRoot $archiveName
$tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$stagingRoot = Join-Path $tempRoot ("grok-show-all-chats-source-" + [guid]::NewGuid().ToString("N"))
$stagingRoot = [System.IO.Path]::GetFullPath($stagingRoot)

if (-not $stagingRoot.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to use a staging directory outside the system temporary directory."
}

New-Item -ItemType Directory -Path $stagingRoot | Out-Null
try {
  foreach ($relativePath in $sourceFiles) {
    $sourcePath = Join-Path $projectRoot $relativePath
    $destinationPath = Join-Path $stagingRoot $relativePath
    New-Item -ItemType Directory -Path (Split-Path -Parent $destinationPath) -Force | Out-Null
    Copy-Item -LiteralPath $sourcePath -Destination $destinationPath
  }

  New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
  New-DeterministicArchive -SourceDirectory $stagingRoot -DestinationPath $archivePath
} finally {
  if (Test-Path -LiteralPath $stagingRoot) {
    Remove-Item -LiteralPath $stagingRoot -Recurse -Force
  }
}

$archive = Get-Item -LiteralPath $archivePath
Write-Output "Created $($archive.FullName) ($($archive.Length) bytes, $($sourceFiles.Count) source files)"
