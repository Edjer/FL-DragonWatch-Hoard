# DragonWatch Extension

DragonWatch is a small, shared WebExtension codebase for Firefox Desktop, Firefox Android, Chrome, and Edge. It augments the page currently open in the browser. It does not crawl, auto-scroll, paginate, navigate to profiles, or collect data in the background.

The extension reads visible profile links only after the page has loaded or a user-visible DOM update occurs. It extracts numeric IDs from `/users/<id>` links and from username-style feed links when the visible story DOM provides a matching stable actor ID, batches missing IDs, and adds a compact DragonWatch status button beside known links.

## Requirements

- Node.js 20+
- npm 10+
- Firefox for primary development

## Configure The Site Host

The build targets FetLife by default. Set `DW_SITE_ORIGIN` when building to use another site, using an `http` or `https` origin without a path:

```sh
export DW_SITE_ORIGIN="https://fetlife.com"
export DW_API_URL="http://localhost:18080"
```

`DW_API_URL` controls the API host permission and defaults to the local DragonWatch server.

For the local FetLife setup, build with the configured host before loading the extension:

```sh
npm run build
```

## Install And Build

```sh
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

Build outputs:

- `dist/firefox/`
- `dist/chromium/`

The build creates the manifest for each target from the shared base manifest. Firefox adds its Gecko extension ID and uses `background.scripts`, which is the Firefox-compatible MV3 background declaration. Chromium uses `background.service_worker` and adds its minimum Chrome version. All application source is shared.

## Firefox Desktop

1. Run `npm run build:firefox` (or set `DW_SITE_ORIGIN` first for another site).
2. Open `about:debugging`.
3. Select **This Firefox**.
4. Select **Load Temporary Add-on**.
5. Choose `dist/firefox/manifest.json`.

Open a page containing links such as `/users/123456` or a feed story with a username-style author link and matching story actor metadata. For server-backed use, leave **Enable mock development mode** disabled and enter the server's API token. Enable mock mode only for local UI testing. IDs `123456`, `234567`, and `345678` demonstrate flagged, watch, and linked indicators.

For Firefox Android, use Firefox's remote debugging workflow to connect the Android browser, then load the built temporary add-on where supported by the Firefox version. The UI uses click, focus, and touch-friendly controls and does not depend on hover.

## Chromium And Edge

For Chrome:

1. Run `npm run build:chromium` (or set `DW_SITE_ORIGIN` first for another site).
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose `dist/chromium/`.

Edge uses the same build at `edge://extensions` and its **Load unpacked** action.

## Settings And API

The popup stores the API URL, Web/PWA URL, API token, and feature toggles in extension storage. The token is never placed in the page DOM, page local storage, or session storage. Content scripts ask the background worker to perform lookups.

The popup also checks `{API_URL}/health` when opened and shows a green, neutral, or error indicator. Live mode sends captures to the authenticated server endpoint. Mock mode reports `Mock mode enabled` and does not write to the server; it is disabled by default.

## Manual FetLife Capture

Opening the extension popup from a supported FetLife profile page performs one deliberate capture of the currently loaded DOM. The popup asks the content script for a normalized snapshot, then asks the background worker to call `POST {API_URL}/api/v1/profiles/fetlife/capture`. It never captures on page load, hover, profile-list appearance, navigation, or unloaded Turbo Frames.

The profile detector requires a positive profile-header marker such as `[data-test-id="profile-header"]`. The extractor preserves section state as `present`, `loading`, or `missing`, collects stable numeric ID candidates, and refuses to write when the ID is missing or conflicting. Username-only paths are not used as identity keys.

The popup reports `Profile added to WatchDragon`, `Profile updated in WatchDragon`, `WatchDragon is already current`, `Could not capture profile`, or `No FetLife profile detected on this page`. Captured data is rendered with text nodes and collapsible sections; raw page HTML and API tokens are never sent or displayed.

The live capture request and response are documented by the server repository. Mock mode provides an in-memory inserted/updated/unchanged response for local UI development without making a write request.

After a successful live capture, the **Open WatchDragon** button opens the saved profile in the web dashboard. The dashboard profile page provides editable review fields and comments; captured FetLife observations remain preserved as source data.

The non-mock client sends one request for a batch of IDs:

```http
POST {API_URL}/api/v1/accounts/lookup
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{ "ids": ["123456", "234567", "345678"] }
```

Expected response:

```json
{
  "accounts": {
    "123456": {
      "platformUserId": "123456",
      "fetlifeUserId": "123456",
      "entityId": "01K...",
      "status": "flagged",
      "disposition": "flagged",
      "confidence": 0.87,
      "displayName": "Example",
      "aliases": ["OldExample"],
      "aliasCount": 1,
      "flagCount": 3,
      "relationshipCount": 5,
      "linkedAccountCount": 2,
      "lastReviewedAt": "2026-09-07T12:00:00Z"
    }
  }
}
```

The DragonWatch server implements this lookup route with authenticated batch reads. Invalid records are discarded and failed lookups do not disrupt the page.

## Privacy Boundary

- Capture is limited to the active page's visible DOM.
- Mutation handling is incremental and debounced; complete-page rescans are not performed for every mutation.
- No analytics, telemetry, screenshots, OCR, automatic navigation, or recursive collection is included.
- Only the configured site and API origins are requested in the generated manifest.
- Fetched summary cards show counts and review date, not private notes or evidence text.
- API calls have an eight-second timeout and use a single batch request for missing IDs.

## Development Commands

```sh
npm run dev:firefox
npm run dev:chromium
npm run build:firefox
npm run build:chromium
npm run build
npm run typecheck
npm run lint
npm test
npm run format:check
```

`npm run dev:*` is useful for compiling while editing. The `build:*` commands currently create debug artifacts with readable JavaScript and source maps for extension troubleshooting; production minification/release packaging is intentionally not enabled yet.

The popup connection panel reports the HTTP status and phase. Examples include `HTTP 200 · Authenticated · authentication`, `HTTP 401 · Not authenticated · authentication`, and `No HTTP response · network`.
