# Firefox Add-ons Submission

This checklist covers the package and listing information for Mozilla Add-ons (AMO). Approval and signing are decided by Mozilla and cannot be guaranteed by the project.

## Compatibility

- Firefox Desktop 142 or newer.
- Manifest V3.
- Stable Add-on ID: `all-chats-sidebar-for-grok@communism420.github.io`.
- Firefox-only manifest settings are generated from `manifest.firefox.json`; the shared Chromium manifest remains unchanged.
- Firefox for Android is not currently declared or advertised as supported.

## Verification

Install the pinned development dependencies and Firefox browser used by Playwright:

```powershell
npm ci
npx playwright install firefox
```

Run the complete cross-browser test suite, official AMO linter, and Firefox browser regression test:

```powershell
.\scripts\test.ps1
.\scripts\test-firefox.ps1
```

The Firefox verification script builds an isolated package, runs `web-ext lint` with warnings treated as errors, and exercises the real sidebar code in Firefox.

## Package

Run:

```powershell
.\scripts\package.ps1 -Target Firefox
```

Upload `dist/grok-show-all-chats-firefox-1.0.2.zip` to AMO. Its `manifest.json` is generated at build time from the shared manifest and the reviewed Firefox overlay. The archive contains readable, unminified runtime code and no runtime dependencies.

## Source Code Submission

Select **Yes** when AMO asks whether source code must be submitted. The build generates the Firefox `manifest.json` from `manifest.json` and `manifest.firefox.json`, so Mozilla's generated-file rule applies even though the runtime JavaScript is not bundled or minified.

Create the matching reviewer source archive:

```powershell
.\scripts\package-source.ps1
```

Upload `dist/grok-show-all-chats-firefox-1.0.2-source.zip` in AMO's source-code field. Do not upload the release ZIP a second time.

The source archive contains `SOURCE_BUILD.md` and a dependency-free Node.js builder. A reviewer can extract the archive and run:

```bash
node scripts/build-firefox-source.mjs
```

The rebuilt extension is written to `build/firefox/` and must match all 22 extracted files from the submitted extension without differences. Node.js 20 or newer is sufficient; no npm installation or network access is required for this build.

## Suggested Listing

**Name:** All Chats Sidebar for Grok

**Add-on URL:** `all-chats-sidebar-for-grok`

**Current version:** `1.0.2`

**Summary:** Open-source, unofficial extension that shows the complete Grok chat history directly in the sidebar.

**Categories:** Appearance and Social & Communication.

**Support email:** Use a monitored public support address; do not use a no-reply address.

**Support website:** https://github.com/communism420/All-Chats-Sidebar-for-Grok/issues

**License:** MIT License.

**Submission flags:** Do not mark the extension as experimental or as requiring payment, non-free software, or additional hardware. Mark it as having a privacy policy.

**Description:**

> All Chats Sidebar for Grok replaces Grok's shortened sidebar history with one continuous list containing all available chats. Pinned chats stay separated at the top, and the rest of the history remains in the same scrollable area.
>
> New chats, title changes, pin state, activity order, and deletions update live across open Grok tabs without requiring a page reload.
>
> Open chats without a page reload, resize the sidebar by dragging its right edge, and use each chat's menu to open it in a new tab, rename it, pin or unpin it, or delete it. The interface supports English, Spanish, German, Brazilian Portuguese, Russian, Ukrainian, and French.
>
> To provide these features, the extension handles Grok conversation identifiers, titles, timestamps, pinned status, and user-requested chat-management actions. Requests go directly over HTTPS between Firefox and grok.com through the user's existing signed-in session. This information is not sent to the extension developer. The extension does not read or store chat message bodies and contains no analytics, telemetry, advertising, tracking, or remote executable code.
>
> A signed-in Grok account is required. This extension is unofficial and is not affiliated with, endorsed by, or sponsored by xAI.
>
> The complete source code and reproducible build scripts are available under the MIT License at https://github.com/communism420/All-Chats-Sidebar-for-Grok.

## Permissions And Data Disclosure

**Single purpose:** Display and manage the user's complete Grok chat history directly in the Grok sidebar.

**`storage` permission:** Stores the interface language and sidebar width locally in Firefox. It is not used for analytics, identifiers, or telemetry.

**Access to `https://grok.com/*`:** Required to insert the complete chat list into the Grok sidebar and make same-origin HTTPS requests to Grok using the user's existing signed-in session. The extension does not run on other sites and does not request cookie access.

The Firefox manifest declares these required data categories:

- `personalCommunications`, because chat titles and conversation metadata can reveal communication content.
- `websiteContent`, because the extension reads the Grok sidebar and conversation API responses required for its primary function.

These categories are handled only for the extension's stated functionality. Requests go directly between Firefox and `grok.com`; the developer does not receive the data. There is no optional technical or interaction data collection, telemetry, advertising, profiling, or developer-operated server.

Use this public privacy-policy URL:

https://communism420.github.io/All-Chats-Sidebar-for-Grok/privacy.html

When AMO displays the privacy-policy editor, paste the complete English policy from `PRIVACY.md`; do not provide only the external URL.

## Reviewer Instructions

The extension requires a signed-in Grok account to demonstrate its main feature.

1. Provide a dedicated test account containing several harmless test chats, including at least one pinned chat.
2. Ask the reviewer to open `https://grok.com` after signing in.
3. Explain that the full list replaces the shortened native history in the left sidebar.
4. Ask the reviewer to test chat navigation, the three-dot menu, language selection, and right-edge resizing.

The private reviewer notes should also identify version `1.0.2`, Firefox Desktop 142 or newer, the public source repository, and the build command `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package.ps1 -Target Firefox`. State that the uploaded ZIP contains readable, unminified source code, no runtime dependencies, and no remote executable code.

Because the main feature requires authentication, provide working credentials for a dedicated review account in AMO's private reviewer-notes field. Never put those credentials in this repository, the public listing, screenshots, promotional images, or any field visible publicly.

## Listing Assets

- Use `icons/icon128.png` as the listing icon.
- Use the fictional 1280 x 800 screenshots from `store-assets/screenshots/` to demonstrate the complete history, chat menu, and resizable sidebar.
- Do not use screenshots from a personal Grok account or expose account details, private titles, credentials, or conversation content.

## Final Checks

- Verify that the public privacy-policy URL works without signing in.
- Confirm that the listing describes Firefox Desktop only and requires version 142 or newer.
- Test the exact ZIP submitted to AMO, not a different development directory.
- Upload the matching `grok-show-all-chats-firefox-1.0.2-source.zip` source archive and verify that `SOURCE_BUILD.md` is at its root.
- Confirm that `manifest.json` is at the archive root and contains the stable Add-on ID.
- Upload only the ZIP produced by `scripts/package.ps1 -Target Firefox`.
- Keep version `1.0.2` unless the project owner explicitly authorizes a version change.
