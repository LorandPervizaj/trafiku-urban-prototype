# Trafiku Urban

A mobile-first transit prototype for Prishtina, built for RIT Kosovo / ISTE 260, Group Project Part 3. By **Lorand Pervizaj and Donat Bojaj**.

## Run locally

1. Open a terminal in this Part 3 folder.
2. Run `python -m http.server 8080` (Windows) or `python3 -m http.server 8080` (macOS/Linux).
3. Open http://localhost:8080 in a browser. Do not double-click index.html: native modules and local JSON require HTTP.
4. Stop the server with Ctrl+C.

No npm installation, build step, account, database, or server-side application is needed. Python is only a convenient local static file server. The deployed site is static.

## Features

- Map-first Leaflet experience, nine simulated buses on three partial OSM route segments.
- Selectable buses and stops, route filters, stops/routes toggles, recentering, and collapsible nearby departure sheet.
- Six connected views: Map, Plan, Route Options, Departure Details, Saved Journeys, Ticket.
- Shared-stop journey suggestions; editable and reversible planning; helpful unmatched-destination state.
- Saved journeys, favorite stops, filters, map position, accessibility preference, and Light/Dark/System themes persist locally.
- Explicit LIVE / SCHEDULED / UNAVAILABLE demo states. Unavailable has no countdown.
- Ticket handoff to the official municipal wallet; no payment simulation.
- Local Leaflet and Lato assets; maps use viewport-based OpenStreetMap tile requests.

## Suggested demonstration

Open Plan. Its default Hotel Prishtina to Europe House journey offers lines 4 and 3. Choose a route, review boarding guidance, save the journey, then reopen it from Plan. Open map settings for controlled departure states. The original Dardania-to-RIT example is not claimed as a verified connection; entering RIT Kosovo shows the no-match state.

## Structure and modifications

- `index.html`: semantic application shell.
- `assets/css/app.css`: design tokens, layouts, responsive rules, and themes.
- `assets/js/main.js`: startup and interaction wiring.
- `state.js`, `storage.js`, `router.js`: shared state, versioned persistence, hash navigation.
- `map.js`, `simulation.js`, `routes.js`, `departures.js`: map, elapsed-time interpolation, direct-route matching, demo reliability states.
- `assets/js/ui/screens.js`: six screen templates and settings.
- `data/`: local GeoJSON, lines, OSM snapshots, provenance.
- `tests/`: deterministic geometry/simulation tests, browser scenario, packaging, data regeneration.
- `docs/`: architecture, deployment, validation, usability tasks and templates.

To change visual styles edit app.css. To change screen content edit screens.js. To add real data, update the source snapshot and normalization rules, regenerate GeoJSON, and validate continuity. Do not hand-draw geometry and call it verified. The settings departure state is intentionally session-only for repeatable tests.

## Testing

With Node.js installed, run `node tests/unit.mjs` (or optional `npm test`). It checks geometry interpolation, continuity, dwell behavior, bounded positions, and resume cleanup. No packages are required.

For browser testing, start the HTTP server above, then run:

```
npx --yes --package @playwright/cli playwright-cli open http://127.0.0.1:8080 --headed
npx --yes --package @playwright/cli playwright-cli run-code --filename=tests/browser-check.js
```

The browser scenario resets this app's local preferences at the start and captures screenshots in ignored `output/playwright/`. It is development-only. See docs/testing.md for measured outcomes and testing limits.

## Deployment

GitHub repository: https://github.com/LorandPervizaj/trafiku-urban-prototype

Expected Pages URL: https://lorandpervizaj.github.io/trafiku-urban-prototype/

The repository root is this Part 3 folder. Parts 1 and 2 remain outside the repository, unchanged. `.github/workflows/pages.yml` validates and packages production assets into `dist/`, then deploys using Pages Actions. All application paths are relative and work under the repository subdirectory. See docs/deployment.md.

## Data, attribution, and limits

See data/data-sources.md. Contains extracted continuous segments associated with OSM lines 4, 3 and 1, not complete current operational lines. Service in both directions, boarding side, vehicle speed/dwell, and times are illustrative. No reliable RIT Kosovo connection or real GPS feed is provided. LIVE always means LIVE DEMO. Scheduled times are example timetable values; live estimates are derived from simulated progress, not actual traffic. Verify real trips with the operator.

No real usability participants or findings are claimed. Blank research materials are supplied for actual testing.

Offline: after loading, local planning/saved/ticket screens continue working. Cold offline startup is not supported; no service worker or map-tile caching is installed. The external wallet and uncached tiles require internet. Storage failure falls back to in-memory state for the visit.

Map data copyright OpenStreetMap contributors, ODbL 1.0: https://www.openstreetmap.org/copyright. Map tiles: https://tile.openstreetmap.org, normal browser caching only; no bulk downloads. Leaflet 1.9.4 BSD-2-Clause and Lato SIL Open Font License are bundled with license files. The muted basemap remains neutral in both themes. Third-party tile requests disclose viewport/network information to the provider; no analytics are installed.

Fares shown are Part 2 reference values, not a current fare claim. Official wallet URL was checked during implementation. No credentials are stored in this project.


## Next visual refinement (planned, not yet implemented)

- **Route-specific color coding:** give each validated bus line a distinct, accessible
  route color and apply it consistently to bus markers, route polylines, legend/filter
  chips, and route cards. Colors must remain legible in light/dark themes and never
  communicate status without text. Keep the current monochrome markers until
  the mapping and visual contrast are checked.
