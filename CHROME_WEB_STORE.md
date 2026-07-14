# Chrome Web Store Submission

This checklist covers the repository and dashboard work needed for a review. Store approval is always decided by Google and cannot be guaranteed by code alone.

## Package

Run:

```powershell
.\scripts\package.ps1
```

Upload `dist/grok-show-all-chats-1.0.1.zip`. The script verifies the fixed version, permissions, host scope, content security policy, required locales, and package contents before creating the ZIP.

## Suggested listing

**Title:** All Chats Sidebar for Grok

**Summary:** Open-source, unofficial extension that shows the complete Grok chat history directly in the sidebar.

**Category:** Productivity

**Detailed description:**

> All Chats Sidebar for Grok replaces Grok's shortened sidebar history with one continuous list containing all available chats. Pinned chats stay separated at the top, and the rest of the history remains in the same scrollable area.
>
> New chats, title changes, pin state, activity order, and deletions update live across open Grok tabs without requiring a page reload.
>
> Open chats without a page reload, resize the sidebar by dragging its right edge, and use each chat's menu to open it in a new tab, rename it, pin or unpin it, or delete it. The interface supports English, Spanish, German, Brazilian Portuguese, Russian, Ukrainian, and French.
>
> A signed-in Grok account is required. This extension is unofficial and is not affiliated with, endorsed by, or sponsored by xAI.
>
> The complete source code and reproducible build scripts are available under the MIT License at https://github.com/communism420/All-Chats-Sidebar-for-Grok.

Keep localized listings consistent with these claims. Do not add capabilities that the extension does not provide.

## Privacy dashboard

**Single purpose:**

> Display and manage the user's complete Grok chat history directly in the Grok sidebar.

**`storage` permission justification:**

> Stores only the user's interface-language preference and chosen sidebar width. The language preference can synchronize through the Chrome profile; the width remains local to the browser.

**`https://grok.com/*` content script site-access justification:**

> Required to insert the complete chat list into the Grok sidebar and make same-origin HTTPS requests to Grok's conversation endpoints using the user's existing signed-in session. The extension does not declare separate host permissions and does not run on other sites.

Disclose at least the following handled data categories in the privacy questionnaire, using the current dashboard wording:

- Website content.
- Personal communications or user-generated content, because chat titles and conversation metadata can reveal communication content.

State that the data is used only for app functionality, is processed locally, is not sold or transferred, is not used for advertising or credit decisions, and is not accessed by humans. The extension does not directly read authentication credentials or cookies.

Use this stable, public privacy-policy URL in the dashboard:

https://communism420.github.io/All-Chats-Sidebar-for-Grok/privacy.html

Complete the Limited Use certification only after confirming that the dashboard answers match this repository and the hosted policy.

## Reviewer instructions

The extension requires a signed-in Grok account to demonstrate its main feature. In the dashboard's private reviewer-instructions field:

1. Provide a dedicated test account that contains several harmless test chats, including at least one pinned chat.
2. Tell the reviewer to open `https://grok.com` after signing in.
3. Explain that the full list replaces the shortened native history in the left sidebar.
4. Ask the reviewer to test chat navigation, the three-dot menu, language selection, and right-edge resizing.

Never put test credentials in this repository, the public listing, screenshots, or promotional images.

## Listing assets

- Use the packaged `icons/icon128.png` as the 128 x 128 store icon. All packaged sizes are generated from the project's `logo.png` master artwork.
- Upload the 1280 x 800 PNG files from `store-assets/screenshots/`. They are generated from a deterministic fixture that runs the extension's actual sidebar code with fictional data.
- Upload `store-assets/promotional/promo-small-440x280.png` as the required small promotional image and `store-assets/promotional/promo-marquee-1400x560.png` as the optional marquee image. Both are text-free 24-bit PNG files without an alpha channel.
- Keep the product name, description, screenshots, and promotional images clearly unofficial and consistent with the extension's actual behavior.

Create screenshots with a dedicated test account. Do not expose an email address, access token, personal chat title, explicit or sexual content, private conversation, or other sensitive information. The earlier development screenshots are not suitable for the store listing.

## Final checks

- Verify the developer account email and support contact in the Chrome Web Store dashboard.
- Confirm that the developer owns or has permission to use every submitted icon and promotional asset; replace any third-party trademark artwork if those rights are not available.
- Verify that the public privacy-policy URL works without signing in.
- Load the unpacked extension from the exact source being packaged and test it on current Chrome.
- Inspect the ZIP and confirm that `manifest.json` is at its root.
- Upload only the ZIP produced by `scripts/package.ps1`.
- Do not change version `1.0.1` without the user's explicit permission.
