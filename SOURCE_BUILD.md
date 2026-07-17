# Firefox Source Build Instructions

These instructions apply to **All Chats Sidebar for Grok version 1.0.2**.

- Submitted extension: `grok-show-all-chats-firefox-1.0.2.zip`
- Matching source archive: `grok-show-all-chats-firefox-1.0.2-source.zip`
- Public repository: https://github.com/communism420/All-Chats-Sidebar-for-Grok
- License: MIT

## Build requirements

- Node.js 20 or newer. The build script uses only Node.js standard-library modules.
- No `npm install`, network access, transpiler, bundler, minifier, template engine, or private dependency is required.
- The script is platform-independent and is suitable for Mozilla's Ubuntu ARM64 reviewer environment with Node.js 24.

The included `package.json` and `package-lock.json` describe optional development and test dependencies. They are not used by the reviewer build described below.

## Rebuild the submitted Firefox files

Extract the source archive, open a terminal in its root directory, and run:

```bash
node scripts/build-firefox-source.mjs
```

The complete rebuilt extension is written to:

```text
build/firefox/
```

The directory contains 22 files. All JavaScript, CSS, HTML, localization, license, and icon files are copied byte-for-byte from the submitted source. The only generated file is `build/firefox/manifest.json`; it is produced by adding `manifest.firefox.json` to the shared `manifest.json`.

The generated manifest uses deterministic formatting and CRLF line endings to match the manifest in the submitted extension archive exactly.

## Compare with the submitted extension

Extract the submitted extension into a separate directory and compare it with the build output. For example:

```bash
mkdir submitted-extension
unzip grok-show-all-chats-firefox-1.0.2.zip -d submitted-extension
diff -ru submitted-extension build/firefox
```

The comparison must produce no differences.

## Release packaging

The store ZIP is created by the open-source PowerShell script:

```powershell
.\scripts\package.ps1 -Target Firefox
```

That script requires PowerShell and Node.js 20 or newer. It validates the version, permissions, locales, icons, Firefox Add-on ID, data-handling declarations, runtime file set, and manifest before invoking the same Node.js reviewer builder and writing a deterministic ZIP. Archive metadata is not part of the reviewer comparison; the extracted contents are identical.

## Code readability

The extension contains no minified, transpiled, bundled, obfuscated, or remotely downloaded executable code. There are no runtime third-party libraries. Every executable file in the submitted extension is readable in this source archive.
