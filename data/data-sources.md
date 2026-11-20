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

## Stable OSM snapshot created 2026-11-20

The successful GitHub Pages build added **7C, 3B, 3C and 19** to the original
lines **4, 3 and 1**. The additional street segments were fetched from the
official OpenStreetMap API, validated for continuity and named stops, and
saved in the repository. The attempted 1A extraction was rejected because
its usable stops were insufficiently separated. No fabricated geometry was
used. Subsequent deployments use this committed snapshot, without depending
on Overpass or OSM availability.

Committed additional segments:
- 7C: 2.2 km, 4 named stops, OSM relation 11160278
- 3B: 9.1 km, 17 named stops, OSM relation 10187116
- 3C: 7.7 km, 20 named stops, OSM relation 11160426
- 19: 5.6 km, 3 named stops, OSM relation 18704771

These are continuous *partial* pieces from community-mapped relations. They
do not reflect known 2026 detours or confirmed full operating itineraries.
All vehicle locations and departures remain simulated.

## TRIP official-operator coverage expansion

The November 2026 official route listing includes nine municipal operator lines: 1, 1A, 3, 3B, 3C, 4, 7C, 15 and 19. The expansion targets the two previously missing lines **1A** (airport, OSM relation 10118965) and **15** (Keçekollë / Prapashticë, relation 11153452). Only connected OSM geometry is drawn, even when the source is a partial historical route. A route is included only if mapped road geometry passes continuity and stop checks. Line 1A can show a mapped segment with one named stop because the source has fewer named stop nodes; this is not an assertion of complete boarding coverage. The campus/user journey is not treated as verifiable. All bus counts and movement remain simulated.

Ticket prices are the operator's published 1 July 2026 fares: https://trafikurban-pr.com/2022/njoftim-per-qytetaret-3/ . The TRIP interface is an independent coursework prototype, not the official operator.

## Additional stop coverage

TRIP now imports named OSM bus-stop nodes and bus platforms within Greater Prishtina at build time, independently of route relations. These additional stops are marked `unassigned: true` with `lines: []`: they are **physical OSM stops without verified line associations**. They remain searchable and visible on the map, but the app must not invent departures or assert that a particular bus serves them. The import is optional and retains the last committed snapshot if the Overpass service fails. Source: https://overpass.private.coffee/api/interpreter ; copyright OpenStreetMap contributors (ODbL 1.0).

### November 2026 stop importer revision

The fallback importer reads the officially documented OpenStreetMap API `relation/<id>/full` for lines 2, 3A, 6, 6A, 7, 7A, 7B, 8, 10 and 10C and extracts named node stop/platform relation members. It is an educational route-based location snapshot, not a complete inventory of public transit platforms. These locations are added as unassigned until a mapped/verified route serves them. The loader never guesses a line association. Source OSM community contributors, ODbL.
