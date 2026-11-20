# TRIP — Prishtina transit prototype

A mobile-first transit prototype for Prishtina, built for RIT Kosovo / ISTE 260, Group Project Part 3. By **Lorand Pervizaj and Donat Bojaj**.

## Run locally

1. Open a terminal in this Part 3 folder.
2. Run `python -m http.server 8080` (Windows) or `python3 -m http.server 8080` (macOS/Linux).
3. Open http://localhost:8080 in a browser. Do not double-click index.html: native modules and local JSON require HTTP.
4. Stop the server with Ctrl+C.

No npm installation, build step, account, database, or server-side application is needed. Python is only a convenient local static file server. The deployed site is static.

## Features

- Map-first Leaflet experience, 42 simulated buses on nine partial OSM route segments.
- Selectable buses and stops, route filters, stops/routes toggles, recentering, and collapsible nearby departure sheet.
- Six connected views: Map, Plan, Route Options, Departure Details, Saved Journeys, Ticket.
- Shared-stop journey suggestions; editable and reversible planning; helpful unmatched-destination state.
- Saved journeys, favorite stops, filters, map position, accessibility preference, and Light/Dark/System themes persist locally.
- Explicit LIVE / SCHEDULED / UNAVAILABLE demo states. Unavailable has no countdown.
- Ticket handoff to the official municipal wallet; no payment simulation.
- Local Leaflet and Lato assets; maps use viewport-based OpenStreetMap tile requests.

## Suggested demonstration

Open Map and inspect a bus or stop, or use Plan to enter two named stops that share a mapped line (for example Hotel Prishtina and Përballë Europe House). Choose a route, review boarding guidance, save the journey, then reopen it from Plan. Open map settings for controlled departure states. The original Dardania-to-RIT example is not claimed as a verified connection; entering RIT Kosovo shows the no-match state.

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


## November 20 map update

The version-controlled dataset now includes seven OSM-based line segments:
**1, 3, 3B, 3C, 4, 7C and 19**. Each segment uses mapped streets and named stops;
some are incomplete and none is a substitute for current municipal route data.
The app begins with an unselected map, uses compact bus markers and a reduced
map sheet, and preserves line-filter settings across reloads.

The official line descriptions may differ from the historical OSM relations.
Review ongoing roadworks and current timetables before relying on a journey.


## TRIP bilingual UI and fares (November 2026)

TRIP has persistent English/Albanian switching, including the plan, map, settings, tickets, status labels and accessibility text. The map initially has no bottom sheet until the user taps a bus or stop. The All route filter toggles between every mapped line and none.

Official operator fare notice effective **1 July 2026**: https://trafikurban-pr.com/2022/njoftim-per-qytetaret-3/ . Single €0.60 digital / €0.80 physical; calendar-day €1.00 digital / €1.20 physical; airport 1A one-way €5 digital / €6 physical. The app still links to the official Kuleta Digjitale wallet rather than processing payment.


## Coverage as of November 20, 2026

The current local map dataset includes **all nine lines listed on Trafiku Urban's published operator schedule**: 1, 1A, 3, 3B, 3C, 4, 7C, 15 and 19. The newly mapped partial segments are 1A (7.2 km / two named stops) and 15 (21.7 km / 20 named stops). Mapped routes may omit portions of an official itinerary. The 42 vehicle markers are **simulated demo vehicles**, not a real fleet count or location feed.

The English/Albanian toggle persists in localStorage, the **All** chip toggles between every line and none, and the map launches without a bottom card until a vehicle or stop is selected. Ticket prices are verified from the operator's July 2026 announcement.


## Search, stop coverage and settings (November 2026)

- Settings is an in-app screen (#settings), opened from a gear icon and returned from using Back. It does not use a browser-like modal.
- English/Albanian language changes and filter toggles animate gently with preserved DOM nodes; the main All/None button switches its label in both languages.
- The Plan search understands loose/missing punctuation (e.g. **Rrethi 24h** and **Furra Saranda**) and supports an illustrative single walking transfer (maximum 400 m straight-line between mapped stops). It does **not** compute pedestrian streets, traffic, service timetables or exact walking time. General place queries use local stop search first and optional OpenStreetMap Photon on submission only, and can use the nearest known stop within 1 km. Photon may be unavailable or rate-limit; local mapped-stop searches still work.
- The stop map expands beyond route-attached stations when an independently named OSM bus stop is published. Unassigned stops are displayed in muted gray and do not invent a served line. Only viewport stops are rendered, and the dataset is still incomplete.
- The Kuleta Digjitale card references the app's actual App Store icon; the external image requires internet. Ticket payment still takes place only in the official wallet.


## Browser regression scenarios

`tests/browser-check.js` now tests the All/None toggle in both languages, in-app Settings navigation, the sample **Rrethi 24h → Furra Saranda** one-transfer search, saved journeys, midnight ticket wording, and Kuleta Digjitale artwork. `tests/live-check.js` checks the public Pages link. They require Playwright CLI and a Chromium browser; the GitHub Pages workflow runs Node logic tests and syntax checks, not these browser scripts. The live search remains a prototype based on incomplete route geometry and approximately 400 m straight-line transfer links.


## Directional map lines and stable colors

Bus colors use the same token for every vehicle, filter chip, line badge and mapped street segment. Official Trafiku Urban E-Bus color convention: **Line 1 yellow, Line 3 green, Line 4 blue** (https://trafikurban-pr.com/2022/ebus/). Other line colors are TRIP-specific demo choices documented in `assets/js/line-colors.js`. A solid polyline represents the first mapped direction; where a second OSM relation is available, its partial direction is shown as a thinner dashed stroke of the same color. Vehicles are simulated with continuous elapsed-time interpolation, a capped refresh cadence, separate direction geometry where available, and precomputed shared paths. At clipped OSM segment endpoints, a smooth return demonstration is still used; this is not a verified real terminus. Do not treat map animation as GPS tracking.
