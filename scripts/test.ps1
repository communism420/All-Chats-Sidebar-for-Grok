[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Get-Sha256Hex {
  param([Parameter(Mandatory)] [string]$Path)

  $stream = [System.IO.File]::OpenRead([System.IO.Path]::GetFullPath($Path))
  $algorithm = [System.Security.Cryptography.SHA256]::Create()
  try {
    return [System.BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace("-", "")
  } finally {
    $algorithm.Dispose()
    $stream.Dispose()
  }
}

function Get-TreeRelativePath {
  param(
    [Parameter(Mandatory)] [string]$RootPath,
    [Parameter(Mandatory)] [string]$FilePath
  )

  $separator = [System.IO.Path]::DirectorySeparatorChar
  $normalizedRoot = [System.IO.Path]::GetFullPath($RootPath).TrimEnd("\", "/") + $separator
  $normalizedFile = [System.IO.Path]::GetFullPath($FilePath)
  if (-not $normalizedFile.StartsWith($normalizedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "File is outside the expected tree: $normalizedFile"
  }
  return $normalizedFile.Substring($normalizedRoot.Length).Replace("\", "/")
}

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
Push-Location $projectRoot

try {
  $manifest = Get-Content -LiteralPath "manifest.json" -Raw | ConvertFrom-Json
  $expectedVersion = "1.0.2"
  if ([string]$manifest.version -ne $expectedVersion) {
    throw "manifest.json version must remain $expectedVersion."
  }

  $extensionScripts = @($manifest.content_scripts[1].js)
  $expectedExtensionScripts = @("webext.js", "i18n.js", "settings-bridge.js", "content.js")
  if (($extensionScripts -join "`n") -ne ($expectedExtensionScripts -join "`n")) {
    throw "Cross-browser content scripts are missing or loaded in the wrong order."
  }

  $popupHtml = Get-Content -LiteralPath "popup.html" -Raw
  $popupAdapterIndex = $popupHtml.IndexOf('src="webext.js"')
  $popupI18nIndex = $popupHtml.IndexOf('src="i18n.js"')
  if ($popupAdapterIndex -lt 0 -or $popupI18nIndex -lt 0 -or $popupAdapterIndex -gt $popupI18nIndex) {
    throw "popup.html must load webext.js before scripts that access extension storage."
  }

  $packageMetadata = Get-Content -LiteralPath "package.json" -Raw | ConvertFrom-Json
  if ([string]$packageMetadata.version -ne $expectedVersion) {
    throw "package.json version must remain $expectedVersion."
  }

  foreach ($script in @("page-bridge.js", "webext.js", "content.js", "i18n.js", "settings-bridge.js", "popup.js")) {
    & node --check $script
    if ($LASTEXITCODE -ne 0) {
      throw "JavaScript syntax check failed: $script"
    }
  }

  & node --check "scripts/build-firefox-source.mjs"
  if ($LASTEXITCODE -ne 0) {
    throw "Firefox reviewer build-script syntax check failed."
  }

  & node "tests/webext.test.js"
  if ($LASTEXITCODE -ne 0) {
    throw "Cross-browser WebExtension adapter tests failed."
  }

  & node "tests/navigation.test.js"
  if ($LASTEXITCODE -ne 0) {
    throw "Navigation regression tests failed."
  }

  if ($env:RUN_BROWSER_TESTS -eq "1") {
    $previousBrowserEngine = $env:BROWSER_ENGINE
    try {
      foreach ($browserEngine in @("chromium", "firefox")) {
        $env:BROWSER_ENGINE = $browserEngine
        & node "tests/realtime-sync.browser.test.mjs"
        if ($LASTEXITCODE -ne 0) {
          throw "$browserEngine live-sync tests failed."
        }
      }
    } finally {
      $env:BROWSER_ENGINE = $previousBrowserEngine
    }
  }

  $systemTemp = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
  $packageTestRoot = [System.IO.Path]::GetFullPath((Join-Path $systemTemp (
    "grok-cross-browser-tests-" + [guid]::NewGuid().ToString("N")
  )))
  if (-not $packageTestRoot.StartsWith($systemTemp, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to create package-test files outside the system temporary directory."
  }

  New-Item -ItemType Directory -Path $packageTestRoot | Out-Null
  try {
    & "scripts/package.ps1" -Target Chromium -OutputDirectory (Join-Path $packageTestRoot "chromium")
    & "scripts/package.ps1" -Target Firefox -OutputDirectory (Join-Path $packageTestRoot "firefox")
    & "scripts/package-source.ps1" -OutputDirectory (Join-Path $packageTestRoot "source")

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $packageExpectations = @(
      @{
        FileName = "grok-show-all-chats-$expectedVersion.zip"
        Path = Join-Path $packageTestRoot "chromium\grok-show-all-chats-$expectedVersion.zip"
        Firefox = $false
      },
      @{
        FileName = "grok-show-all-chats-firefox-$expectedVersion.zip"
        Path = Join-Path $packageTestRoot "firefox\grok-show-all-chats-firefox-$expectedVersion.zip"
        Firefox = $true
      }
    )
    foreach ($expectation in $packageExpectations) {
      $archive = [System.IO.Compression.ZipFile]::OpenRead($expectation.Path)
      try {
        $manifestEntry = $archive.GetEntry("manifest.json")
        if (-not $manifestEntry) {
          throw "Packaged manifest.json is not at the archive root: $($expectation.Path)"
        }
        $reader = [System.IO.StreamReader]::new($manifestEntry.Open())
        try {
          $packagedManifest = $reader.ReadToEnd() | ConvertFrom-Json
        } finally {
          $reader.Dispose()
        }
        $hasFirefoxSettings = $packagedManifest.PSObject.Properties.Name -contains "browser_specific_settings"
        if ($hasFirefoxSettings -ne $expectation.Firefox) {
          throw "Browser-specific manifest settings are in the wrong package."
        }
        if ($expectation.Firefox -and [string]$packagedManifest.browser_specific_settings.gecko.id -ne
          "all-chats-sidebar-for-grok@communism420.github.io") {
          throw "The Firefox package has an invalid Add-on ID."
        }
      } finally {
        $archive.Dispose()
      }
    }

    $sourceFileName = "grok-show-all-chats-firefox-$expectedVersion-source.zip"
    $sourceArchivePath = Join-Path $packageTestRoot "source\$sourceFileName"
    $sourceArchive = [System.IO.Compression.ZipFile]::OpenRead($sourceArchivePath)
    try {
      $sourceEntries = @(
        $sourceArchive.Entries |
          Where-Object { $_.Name } |
          Select-Object -ExpandProperty FullName
      )
      foreach ($requiredSourceEntry in @(
        "SOURCE_BUILD.md",
        "manifest.json",
        "manifest.firefox.json",
        "package-lock.json",
        "scripts/build-firefox-source.mjs",
        "scripts/package-files.json",
        "scripts/package.ps1"
      )) {
        if ($sourceEntries -notcontains $requiredSourceEntry) {
          throw "The reviewer source archive is missing: $requiredSourceEntry"
        }
      }
      foreach ($sourceEntry in $sourceEntries) {
        if ($sourceEntry -match '(^|/)(\.git|node_modules|dist|build)(/|$)' -or
          $sourceEntry -match '(^|/)(\.env|\.dev\.vars)') {
          throw "The reviewer source archive contains a forbidden path: $sourceEntry"
        }
      }
    } finally {
      $sourceArchive.Dispose()
    }

    $repeatRoot = Join-Path $packageTestRoot "repeat"
    & "scripts/package.ps1" -Target Chromium -OutputDirectory $repeatRoot
    & "scripts/package.ps1" -Target Firefox -OutputDirectory $repeatRoot
    & "scripts/package-source.ps1" -OutputDirectory $repeatRoot
    foreach ($expectation in $packageExpectations) {
      $repeatPath = Join-Path $repeatRoot $expectation.FileName
      $firstHash = Get-Sha256Hex -Path $expectation.Path
      $repeatHash = Get-Sha256Hex -Path $repeatPath
      if ($firstHash -ne $repeatHash) {
        throw "The $($expectation.FileName) package is not byte-for-byte reproducible."
      }
    }
    $repeatSourcePath = Join-Path $repeatRoot $sourceFileName
    if ((Get-Sha256Hex -Path $sourceArchivePath) -ne (Get-Sha256Hex -Path $repeatSourcePath)) {
      throw "The $sourceFileName package is not byte-for-byte reproducible."
    }

    $sourceExtractRoot = Join-Path $packageTestRoot "source-extracted"
    $releaseExtractRoot = Join-Path $packageTestRoot "release-extracted"
    Expand-Archive -LiteralPath $sourceArchivePath -DestinationPath $sourceExtractRoot
    Expand-Archive -LiteralPath $packageExpectations[1].Path -DestinationPath $releaseExtractRoot
    Push-Location $sourceExtractRoot
    try {
      & node "scripts/build-firefox-source.mjs"
      if ($LASTEXITCODE -ne 0) {
        throw "The Firefox reviewer source build failed."
      }
    } finally {
      Pop-Location
    }

    $rebuiltRoot = Join-Path $sourceExtractRoot "build\firefox"
    $releaseFiles = @(
      Get-ChildItem -LiteralPath $releaseExtractRoot -Recurse -File |
        ForEach-Object { Get-TreeRelativePath -RootPath $releaseExtractRoot -FilePath $_.FullName } |
        Sort-Object
    )
    $rebuiltFiles = @(
      Get-ChildItem -LiteralPath $rebuiltRoot -Recurse -File |
        ForEach-Object { Get-TreeRelativePath -RootPath $rebuiltRoot -FilePath $_.FullName } |
        Sort-Object
    )
    if (($releaseFiles -join "`n") -ne ($rebuiltFiles -join "`n")) {
      throw "The Firefox reviewer build has a different file list from the submitted extension."
    }
    foreach ($relativePath in $releaseFiles) {
      $releaseHash = Get-Sha256Hex -Path (Join-Path $releaseExtractRoot $relativePath)
      $rebuiltHash = Get-Sha256Hex -Path (Join-Path $rebuiltRoot $relativePath)
      if ($releaseHash -ne $rebuiltHash) {
        throw "The Firefox reviewer build differs from the submitted extension: $relativePath"
      }
    }
    Write-Output "Firefox reviewer source rebuild matched all $($releaseFiles.Count) extension files."
  } finally {
    if ($packageTestRoot.StartsWith($systemTemp, [System.StringComparison]::OrdinalIgnoreCase) -and
      (Test-Path -LiteralPath $packageTestRoot)) {
      Remove-Item -LiteralPath $packageTestRoot -Recurse -Force
    }
  }

  $siteFiles = @(
    "docs\.nojekyll",
    "docs\assets\chat-actions.png",
    "docs\assets\logo.png",
    "docs\assets\resizable-sidebar.png",
    "docs\assets\sidebar-overview.png",
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

  $homePage = Get-Content -LiteralPath "docs\index.html" -Raw
  foreach ($requiredStatement in @(
    "Version 1.0.2",
    "Chromium and Firefox",
    "Firefox Desktop 142 or newer",
    "Firefox for Android is not currently supported",
    "New chats, generated titles, pin state, ordering, renames, and deletions",
    "analytics, telemetry, advertising, tracking, remote code"
  )) {
    if (-not $homePage.Contains($requiredStatement)) {
      throw "The website home page is missing: $requiredStatement"
    }
  }

  $privacyPage = Get-Content -LiteralPath "docs\privacy.html" -Raw
  foreach ($requiredStatement in @(
    "Privacy Policy",
    "analytics, telemetry, or tracking",
    "Browser settings storage",
    "Chrome Web Store Limited Use",
    "Firefox Add-ons data disclosure"
  )) {
    if (-not $privacyPage.Contains($requiredStatement)) {
      throw "The website privacy policy is missing: $requiredStatement"
    }
  }
} finally {
  Pop-Location
}

Write-Output "All extension and website tests passed."
