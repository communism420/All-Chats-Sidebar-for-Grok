# Changelog

All notable changes to All Chats Sidebar for Grok are documented in this file.

## [1.0.1] - 2026-07-15

Changes compared with version 1.0.0.

### Added

- Live sidebar updates for newly created chats and their generated titles, without requiring a page reload.
- Real-time synchronization for chat creation, renaming, pinning, unpinning, deletion, activity order, and temporary-chat state.
- Cross-tab synchronization between open Grok tabs, including reconciliation when a suspended tab becomes active again.
- Regression and Chromium integration tests for live updates, deletion, scroll preservation, and cross-tab synchronization.

### Changed

- Grok's live conversation data now takes precedence over stale titles or states found in the native sidebar.
- New chats are displayed only after Grok confirms a persistent conversation, preventing temporary routes from appearing as real chats.
- Live list updates preserve the current sidebar scroll position while rows are added, updated, reordered, or removed.
- Repeated store and network updates are deduplicated to reduce flickering and prevent stale data from replacing newer state.

### Fixed

- Fixed new chats appearing in the custom sidebar only after reloading the page.
- Fixed duplicate ghost chats created from temporary or invalid conversation identifiers.
- Fixed ghost-chat deletion attempts failing with `HTTP 400: Invalid uuid`.
- Fixed deleted chats reappearing because of stale native sidebar data.
- Fixed unrelated message-deletion requests incorrectly removing an entire chat from the sidebar.
- Fixed ambiguous local removal events being treated as confirmed chat deletions before Grok's API verified them.
