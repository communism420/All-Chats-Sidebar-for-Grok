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

Upload `dist/grok-show-all-chats-firefox-1.0.1.zip` to AMO. Its `manifest.json` is generated at build time from the shared manifest and the reviewed Firefox overlay. The archive contains readable, unminified source code and no runtime dependencies.

## Suggested Listing

**Name:** All Chats Sidebar for Grok

**Summary:** Open-source, unofficial extension that shows the complete Grok chat history directly in the sidebar.

**Category:** Other or Productivity, depending on the categories currently offered by AMO.

**Description:**

> All Chats Sidebar for Grok replaces Grok's shortened sidebar history with one continuous list containing all available chats. Pinned chats stay separated at the top, and the rest of the history remains in the same scrollable area.
>
> New chats, title changes, pin state, activity order, and deletions update live across open Grok tabs without requiring a page reload.
>
> Open chats without a page reload, resize the sidebar by dragging its right edge, and use each chat's menu to open it in a new tab, rename it, pin or unpin it, or delete it. The interface supports English, Spanish, German, Brazilian Portuguese, Russian, Ukrainian, and French.
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

## Reviewer Instructions

The extension requires a signed-in Grok account to demonstrate its main feature.

1. Provide a dedicated test account containing several harmless test chats, including at least one pinned chat.
2. Ask the reviewer to open `https://grok.com` after signing in.
3. Explain that the full list replaces the shortened native history in the left sidebar.
4. Ask the reviewer to test chat navigation, the three-dot menu, language selection, and right-edge resizing.

Never put test credentials in this repository, the public listing, screenshots, promotional images, or reviewer notes that are visible publicly.

## Final Checks

- Verify that the public privacy-policy URL works without signing in.
- Confirm that the listing describes Firefox Desktop only and requires version 142 or newer.
- Test the exact ZIP submitted to AMO, not a different development directory.
- Confirm that `manifest.json` is at the archive root and contains the stable Add-on ID.
- Upload only the ZIP produced by `scripts/package.ps1 -Target Firefox`.
- Keep version `1.0.1` unless the project owner explicitly authorizes a version change.
