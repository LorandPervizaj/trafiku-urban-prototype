# Transit data provenance

Retrieved **2026-11-20** for an educational prototype.

## OpenStreetMap

Source: Overpass API at https://overpass-api.de/api/interpreter. Raw, reproducible relation geometry is committed in osm-source.json; tagged stop nodes in osm-stops-source.json; relation discovery in osm-relations.json. Database license: ODbL 1.0, https://opendatacommons.org/licenses/odbl/1-0/. Attribution: copyright OpenStreetMap contributors, https://www.openstreetmap.org/copyright.

| UI line | OSM relation | Retained geometry |
| --- | --- | --- |
| 4 | https://www.openstreetmap.org/relation/10120493 | ~5.18 km continuous central/Germia segment |
| 3 | https://www.openstreetmap.org/relation/11153998 | ~9.20 km continuous Bardhosh/central segment |
| 1 | https://www.openstreetmap.org/relation/10120831 | ~2.66 km continuous city segment |

The downloaded relations contain disconnected ways. `tests/normalize-data.py` joins only matching road endpoints (under 0.1 m), reverses coordinate order as needed, and retains one continuous component per line. It never bridges a missing section with invented geometry. This deliberately excludes other components and does not represent full routes. Some selected relation metadata may lag current service. An OSM relation association verifies the source of the road geometry, not today's operator itinerary, permissions, temporary diversions, or side-of-street service.

Stop coordinates and names are from relation node members within 100 m of a retained polyline vertex. Stops under 65 m apart within a line are deduplicated; shared node IDs are merged across lines. These thresholds are simplifications for this small prototype, not a comprehensive transit-data ingestion pipeline. `nameFromOSM` records whether an original name exists. Current retained stop names are supplied by OSM. Names may contain community spelling errors. Boarding side is explicitly unverified in the interface.

Service directions, return trips over the same road geometry, turnaround at clipped endpoints, three vehicles per line, dwell durations, and departure estimates are **demonstrations**. A real return route may use different streets. Geometry is retained street data; vehicle movements are not observed GPS locations. Do not use this app for operational travel decisions.

The direct planner returns lines shared by both exact-name stop records and does not plan transfers, walking legs, service calendars or RIT Kosovo connections. It can compare lines 4 and 3 between Hotel Prishtina and Europe House. This replaces the unverified Part 2 campus scenario.

Regenerate with `python tests/normalize-data.py`; validate with `node tests/unit.mjs`. Source query: `[out:json][timeout:60];relation(id:10120493,11153998,10120831);out geom;`. Tagged nodes: select those same relations, then `node(r);out body;`.

## Operator and wallet verification

Official operator page checked 2026-11-20: https://trafikurban-pr.com/2022/orari-dhe-linjat/. Lists line 4 (Mat - Germia), line 3 (Mati roundabout - Bardhosh), and line 1 (Bregu i Diellit - Fushe Kosove). These endpoint descriptions differ from older OSM relation labels, reinforcing the partial-dataset limitation. No timetable image, text, or operator artwork is redistributed.

Official municipal wallet website checked 2026-11-20: https://kd.pbc.group/index. Its description identifies the municipal wallet and bus-ticket service. The app links to that website with a new-tab handoff and does not claim a verified native app deep link. Terms: https://kd.pbc.group/termsAndConditions/.

EUR 0.60 digital and EUR 0.80 physical are labeled **Part 2 reference fares**. Current fares were not established from an authoritative fare publication and are not represented as current.

## Tile policy and dependencies

Standard viewport-only OpenStreetMap tiles, https://tile.openstreetmap.org/{z}/{x}/{y}.png. Policy: https://operations.osmfoundation.org/policies/tiles/. Attribution stays visible. No service worker, prefetch, offline tile downloader or bulk cache. Failed tiles leave a neutral background, route layers and usable local screens. Appropriate for a low-traffic class demonstration; sustained/public production use needs a suitable provider agreement.

Leaflet 1.9.4 is vendored from https://unpkg.com/leaflet@1.9.4/dist/ with upstream BSD-2-Clause license. Lato Regular and Bold are from https://github.com/google/fonts/tree/main/ofl/lato under SIL OFL; their license is included.

## Additional map lines (deployed build)

The deployed GitHub Pages build attempts to extend the committed three-line
OSM dataset with relations **2, 7C, 6, and 3A**. Source relation IDs were
already recorded in \`data/osm-relations.json\`:

- Line 2: https://www.openstreetmap.org/relation/10121377
- Line 7C: https://www.openstreetmap.org/relation/11160278
- Line 6: https://www.openstreetmap.org/relation/10248144
- Line 3A: https://www.openstreetmap.org/relation/10166778

\`tests/expand-lines.py\` downloads OSM relation geometry using the Overpass
API during deployment, retains only street-continuous portions that pass
geometry checks, and adds named OSM stops when available. It never joins
disconnected road fragments with invented links. Source is OSM contributors
(ODbL 1.0). The data is an educational snapshot, **not live fleet tracking**,
not a service timetable, and not confirmation of a current operating route.
The displayed buses remain simulated. When the network service is unavailable,
the build uses the three version-controlled routes instead of failing.

The first map view is deliberately unselected; no particular route or stop
is implied. Users choose a bus or stop to inspect its example departure.

## Additional official-line snapshot (November 2026)

The enhanced route-loader prioritizes lines **7C, 3B, 3C, 1A, and 19**, which appear
on the official operator's timetable page: https://trafikurban-pr.com/2022/orari-dhe-linjat/.

It uses route relation identifiers already recorded in `osm-relations.json`:
7C=11160278, 3B=10187116, 3C=11160426, 1A=10118965, 19=18704771.
The workflow attempts the public OSM GeoJSON endpoint, then the official OSM
relation/full API. It only accepts long, continuous OSM street segments with
at least two named stops, and stores accepted additions as version-controlled
snapshots for future deployments. Any unavailable or incomplete relation is
skipped rather than fabricated. The exact service alignment, updated 2026
diversions, direction-specific streets and GPS positions are not verified.
All vehicles and ETAs remain simulated and educational.
