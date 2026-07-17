Version 1.0.2

Changes since version 1.0.1:

- Added support for Firefox Desktop 142 and newer through the same open-source extension codebase.
- Added a dedicated Mozilla Add-ons package with a stable Firefox Add-on ID and current data-handling declarations.
- Added a cross-browser WebExtension API adapter while preserving Chromium profile synchronization for the language setting.
- Added separate, reproducible Chromium and Firefox release archives with browser-specific manifest validation.
- Added a matching Mozilla reviewer source archive and dependency-free Node.js rebuild instructions.
- Added official Firefox linting and real-browser regression tests alongside the existing Chromium checks.
- Updated the public website, privacy disclosures, installation instructions, and store-submission documentation for both browser families.
- Improved release-script compatibility with Windows PowerShell 5.1.

Version 1.0.1

Changes since version 1.0.0:

- New chats and generated titles now appear in the sidebar immediately, without reloading Grok.
- Chat creation, renaming, pinning, unpinning, deletion, and ordering now update in real time.
- Chat changes now synchronize across open Grok tabs and after returning to an inactive tab.
- The sidebar keeps its scroll position while chats are added, updated, reordered, or removed.
- Fixed duplicate or inaccessible chats caused by temporary conversation identifiers.
- Reduced chat-list flickering and prevented outdated chat data from replacing newer updates.
