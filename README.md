# All Chats Sidebar for Grok

Fully open-source cross-browser extension for Chromium-based browsers and Firefox Desktop 142 or newer. It shows the complete Grok chat history directly in the left sidebar. The project is not affiliated with, endorsed by, or sponsored by xAI.

Source code: https://github.com/communism420/All-Chats-Sidebar-for-Grok

Website: https://communism420.github.io/All-Chats-Sidebar-for-Grok/

Current version: `1.0.2`. Do not change it without the project owner's explicit permission.

See [CHANGELOG.md](CHANGELOG.md) for store-ready release notes.

## Installation

### Chromium

1. Open `chrome://extensions` in a Chromium-based browser.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose the directory containing the unpacked extension source code.
5. Open or reload `https://grok.com`.

### Firefox

1. Build the Firefox package with `.\scripts\package.ps1 -Target Firefox`.
2. Extract `dist/grok-show-all-chats-firefox-1.0.2.zip`.
3. Open `about:debugging#/runtime/this-firefox` in Firefox Desktop 142 or newer.
4. Select **Load Temporary Add-on** and choose the extracted `manifest.json`.
5. Open or reload `https://grok.com`.

Temporary add-ons are removed when Firefox closes. Public installation requires a package signed by Mozilla Add-ons.

## Language

Select the extension icon in the browser toolbar and choose a language from the list. The setting is applied to open Grok tabs immediately. Chromium can synchronize it through the browser profile; Firefox keeps it local. By default, the extension uses the browser language and then the website language.

The extension supports English, Spanish, German, Brazilian Portuguese, Russian, Ukrainian, and French.

## How It Works

- The content script runs only on `grok.com`.
- It does not activate **Show all** or open Grok's separate chat-history menu.
- It requests the chat history from `GET /rest/app-chat/conversations` using the browser's existing signed-in session.
- Paginated responses are added to one continuous list inside the native scrollable sidebar area.
- Chat creation, title changes, pin state, activity order, temporary-chat state, and deletion synchronize live without a page reload. Changes are also reconciled across open Grok tabs and after a suspended tab resumes.
- Pinned chats appear in a separate group above the remaining history, while both groups stay in the same list and share one scrollbar.
- The sidebar width can be changed by dragging its right edge along the full sidebar height. The selected width is saved for the current browser. Double-click the edge, or press `Home` while it is focused, to restore Grok's default width.
- Navigation uses Grok's in-page SPA router, keeps the chat-list scroll position fixed, opens the canonical `/c/...` route, and preloads data on pointer hover, focus, or press. Chat selection never falls back to a full-page reload.
- Each chat has a three-dot menu for opening it in a new tab, renaming it, pinning or unpinning it, and deleting it.
- After the complete list is rendered successfully, the shortened native history and the **Show all** control are hidden.

The extension may require an update if xAI changes the conversation endpoint or response format.

## Privacy

The extension processes chat titles and metadata only inside the browser and communicates directly with `grok.com`. It contains no analytics, advertising, telemetry, or developer-operated servers. Chromium stores the interface language in synchronized extension storage; Firefox stores it locally. The selected sidebar width is local in both browser families.

See the complete [Privacy Policy](https://communism420.github.io/All-Chats-Sidebar-for-Grok/privacy.html). The source text is also available in [PRIVACY.md](PRIVACY.md).

## Open Source

All extension code, localizations, artwork, and build scripts are publicly available. The project contains no closed-source modules, remotely hosted executable code, or private developer backend.

The project is distributed under the [MIT License](LICENSE). See the complete [Open-Source Policy](OPEN_SOURCE.md).

## Tests And Release Builds

Run the syntax and navigation regression tests:

```powershell
.\scripts\test.ps1
```

For official Firefox linting and a real Firefox browser regression run:

```powershell
npm ci
npx playwright install firefox
.\scripts\test-firefox.ps1
```

Generate the `16/32/48/128` icon files from the `logo.png` master artwork:

```powershell
.\scripts\generate-icons.ps1
```

Build both store packages from the same source:

```powershell
.\scripts\package.ps1 -Target Chromium
.\scripts\package.ps1 -Target Firefox
```

The Chromium archive is created at `dist/grok-show-all-chats-1.0.2.zip`. The Firefox archive is created at `dist/grok-show-all-chats-firefox-1.0.2.zip`.

See [CHROME_WEB_STORE.md](CHROME_WEB_STORE.md) and [FIREFOX_ADD_ONS.md](FIREFOX_ADD_ONS.md) for store-specific listing, privacy, and reviewer guidance.
