# Privacy Policy for All Chats Sidebar for Grok

Effective date: July 14, 2026

## Summary

All Chats Sidebar for Grok is an unofficial browser extension that displays and manages a user's Grok chat list in the Grok sidebar. It is not affiliated with, endorsed by, or sponsored by xAI.

The extension has no developer-operated server, advertising, analytics, telemetry, or tracking. It does not sell or share user data.

## Open source

The complete extension source and build scripts are public under the MIT License:

https://github.com/communism420/All-Chats-Sidebar-for-Grok

The published source contains all executable extension code. There are no closed-source runtime components or private production dependencies.

## Data the extension handles

While the user is signed in to `https://grok.com`, the extension handles the minimum data needed to provide its single purpose:

- Grok conversation identifiers, titles, creation and modification timestamps, and pinned status.
- The current Grok page route and existing sidebar links, so the extension can identify the selected chat and integrate its list into the page.
- Rename, pin, unpin, delete, and navigation actions that the user explicitly initiates through the extension interface.

This information can include website content, user-generated content, or personal communication metadata. The extension does not extract, inspect, store, or transmit chat message bodies. Grok itself may load or prefetch a conversation as part of normal navigation when the user selects or points to a chat.

The extension does not directly read passwords, authentication tokens, payment information, health information, or precise location. Requests to Grok use the signed-in browser session in the same way as the Grok page; the extension does not request access to browser cookies.

## How data is used and transmitted

Conversation data is used only to render the complete chat list, open chats, and perform the chat-management action selected by the user.

Network requests are sent directly over HTTPS between the user's browser and `grok.com`. Conversation data is not sent to the extension developer or to unrelated third parties. Data is sent back to Grok only when needed to load the list, navigate, prefetch a selected chat, or perform a chat-management action initiated by the user.

The extension does not use user data for advertising, creditworthiness, lending, profiling, or any purpose unrelated to its disclosed single purpose. The developer and anyone acting on the developer's behalf cannot access the user's conversation data through the extension.

## Storage and retention

- Conversation metadata is kept only in the memory of the active Grok page and is discarded when the page is closed or reloaded.
- The selected interface language is stored with `chrome.storage.sync`. Depending on the user's Chrome settings, Google Chrome may synchronize that preference through the user's browser profile.
- The selected sidebar width is stored locally with `chrome.storage.local`.
- Settings remain until the user clears extension data or uninstalls the extension.

## Security

All executable extension code is included in the extension package. The extension does not download or execute remote code. Its content script site access is limited to `https://grok.com/*`.

## Chrome Web Store Limited Use

The extension's use of information received from Chrome APIs complies with the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Changes to this policy

If this policy changes, the updated policy will be published at the same public URL with a revised effective date. Material changes to data handling will also be disclosed in the extension and its Chrome Web Store listing as required.

## Contact

Questions about this policy can be submitted through the repository's public issue tracker or the developer support contact shown on the extension's Chrome Web Store listing:

https://github.com/communism420/All-Chats-Sidebar-for-Grok/issues
