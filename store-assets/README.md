# Chrome Web Store Assets

The screenshots in `screenshots/` use fictional, non-sensitive chat titles and a deterministic local Grok-style fixture. The fixture loads the repository's actual `content.js`, `i18n.js`, and `content.css`, so the custom sidebar, chat grouping, menu, and resize behavior shown in the images come from the extension code.

Each screenshot is a 1280 x 800 PNG suitable for the Chrome Web Store listing. The asset fixtures and generators are development-only files and are not included in the extension ZIP.

The text-free promotional images in `promotional/` are generated from `promo/`. `promo-small-440x280.png` is the required small promotional image, and `promo-marquee-1400x560.png` is the optional marquee image. Both files use the project's `logo.png` artwork and a simplified illustration of the unified, resizable chat sidebar.

## Regenerate assets

Install Playwright for the local development environment, make sure Google Chrome is installed, and run:

```powershell
node scripts/generate-store-screenshots.mjs
node scripts/generate-promotional-images.mjs
```

Set `CHROME_PATH` when Chrome is installed in a non-standard location. Never replace the fictional fixture content with personal account data, private chat titles, credentials, or other sensitive information.
