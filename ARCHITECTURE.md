# Architecture

## Content Script

`src/content/index.ts` is the page-side coordinator. It requests settings through `runtime.sendMessage`, installs namespaced CSS, tracks references by stable platform ID, reads the cache, and asks the background worker for one lookup batch. It never calls `fetch` and never sees the API token.

## Site Adapter

`src/content/site-adapter.ts` owns site-specific URL knowledge. The adapter recognizes numeric `/users/<id>` links and username-style author links whose nearest story declares both a stable numeric actor ID and a matching author path. It deliberately ignores username-only links without a verifiable ID and exposes the generic `SiteAdapter` interface. Scanning, caching, decoration, and API code do not depend on DOM selectors or username text.

## Scanner

`IncrementalScanner` performs one initial scan and observes added DOM nodes with `MutationObserver`. Added nodes are scanned after a 180 ms debounce. Existing page content is not rescanned for every mutation.

## Background Worker

`src/background/index.ts` is the privileged boundary. It reads extension settings, calls the API client, and opens configured DragonWatch entity URLs in a new tab. The token remains in extension storage and background context.

The same worker handles the popup's `check-api` message. The API client checks the configured `/health` endpoint with a timeout and returns a typed connection result; mock mode reports availability locally.

## API Client

`src/api/watchdragon-client.ts` owns the request path, bearer authentication, timeout, mock selection, and response validation. `src/api/mock-data.ts` contains deterministic development records and is not mixed into the content layer.

## Local Cache

`src/storage/cache.ts` stores summary records in `browser.storage.local` with a 30-minute TTL. The lookup flow decorates fresh cache hits immediately and requests only uncached IDs.

## Injected UI

`Decorator` adds a sibling button without changing the original page link. `HoverCard` renders every value with `textContent`, supports hover, focus, click, touch, outside-click, and Escape close behavior, and shows only a compact summary. Every class and data attribute uses the `wd-`/`watchdragon` namespace.

## Popup Settings

`src/popup/` provides the small settings form. It stores configuration in WebExtension storage and never writes credentials into the host page.

## Manual FetLife Capture

Opening the action popup from a supported profile tab is the only write trigger. The popup asks the active tab's content script for `extract-profile`; `src/content/fetlife-profile-extractor.ts` detects a positive profile header, extracts only loaded DOM content into `FetLifeProfileSnapshot`, and reports missing/loading sections and conflicting ID candidates. The popup sends a valid snapshot to the background worker, which calls the authenticated capture API. No page-load, hover, list-link, navigation, or Turbo-frame callback starts a write.

`src/popup/capture-workflow.ts` keeps tab lookup, extraction, stable-ID refusal, and inserted/updated/unchanged result handling independent from popup rendering. Captured values are rendered with text nodes and collapsible sections; the API token remains in extension storage/background context.

## Cross-Browser Builds

Vite compiles the same TypeScript entries for both targets. `scripts/build.mjs` sets the target output directory, uses the debug build mode for readable troubleshooting artifacts, and composes `manifests/base.json` with one target-specific manifest fragment. Firefox replaces the service-worker declaration with `background.scripts`; Chromium keeps `background.service_worker`. `DW_SITE_ORIGIN` and `DW_API_URL` are substituted at build time, keeping host permissions explicit and avoiding browser checks throughout application code.
