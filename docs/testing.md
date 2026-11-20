# Validation record

Date: 2026-11-20. Tests performed against the Part 3 static application, served locally on port 8080.

## Automated results

- Deterministic Node tests: 2,833 geometry/simulation assertions passed, plus departure-state assertions. Tested cumulative distances, valid stop references, interpolation on route segments, bounded progress, all nine vehicles, dwell periods, hidden-tab resume, and listener cleanup. Maximum movement at a simulated 60 Hz was 0.148 m per frame across the sampled 100 seconds, including easing boundaries. This is a continuity check, not a measured hardware frame-rate claim.
- Chromium browser: 33 functional/responsive checks passed with no uncaught application JavaScript errors.
- Firefox desktop: the same 33 checks passed.
- Mobile WebKit emulation on Windows: the same 33 checks passed. This is not a physical iPhone or a claim of testing Apple's Safari application.
- Additional Chromium resilience scenario: seven checks passed: System-theme response to OS changes, native Back navigation, reversing both fields, blocked-tile warning and ticket fallback, and saved journeys in memory with localStorage forcibly denied.
- The full browser scenario covers map-first opening, exactly three tabs, moving/selectable buses, selectable stops, filters, sheet collapse, direct-route comparison, boarding limitations, saving/reopening/deleting, persistence, theme persistence, departure states, unmatched destinations, official wallet URL and link security attributes, offline tab navigation, reset, and 360/375/390 px application overflow checks.
- Visual review of generated screenshots covered all six views and the unavailable state in dark mode. A desktop adaptation at 1440 px was also captured. Screenshots are local ignored artifacts in output/playwright/.

A Leaflet inset-map zoom callback initially fired after the preview was removed. Inset zoom animation was disabled and the scenario reran successfully. Initial text-encoding defects were corrected before final visual checks. Browser test scripts are CLI function expressions; do not add a trailing semicolon when reformatting them, because the CLI invokes the expression directly.

## Performance sample

One warmed, local Chromium run measured DOMContentLoaded at 46 ms, a median requestAnimationFrame interval of 16.7 ms and maximum 17.2 ms across 120 samples, with 41 resource entries during that navigation. These are local desktop samples under a controlled scenario, not Lighthouse scores, mobile network results, full-load measurements or production guarantees. Production file size before HTTP compression is approximately 1.57 MB, mostly bundled Lato fonts and Leaflet. No map regions are prefetched. No heap snapshot or long-running memory-leak study was performed.

## Manual checks and remaining limits

Production app uses relative paths, vendored map library/fonts, native ES modules, no runtime npm packages and no backend. OpenStreetMap and Leaflet attribution remains visible. The wallet website was checked against its official municipal-service description. Real purchases were not attempted.

Physical Android/iOS hardware, real mobile keyboards, screen readers, assistive-technology behavior, and constrained cellular networks still require human/device testing. Automated element selection verifies behavior but does not replace real touch accuracy or a complete WCAG audit. Native datalist appearance varies by platform. Map timing depends on the tile provider/network. Cold offline startup is not supported. The small dataset has partial routes and unverified return service/boarding side.

No real usability sessions were conducted. Participant materials and report/observation templates are blank and ready for actual users.

## Live deployment

Published to https://lorandpervizaj.github.io/trafiku-urban-prototype/ and verified on 2026-11-20. GitHub Actions run https://github.com/LorandPervizaj/trafiku-urban-prototype/actions/runs/44716746818 completed successfully for application commit 2277ee6.

Live Chromium verification returned HTTP 200 and confirmed nine bus markers, route planning, saved-journey persistence after reload, terminal-stop return direction, and an actual new-tab wallet handoff to https://kd.pbc.group/index. No uncaught JavaScript errors occurred. `tests/live-check.js` contains the repeatable scenario. `tests/endpoint-check.js` verifies terminal-stop planning locally. Live smoke testing modifies only this test browser's app-local saved trips; it does not buy a ticket.

The endpoint regression was tested after a full page reload so the browser loaded the updated JavaScript module; navigating only the hash in an existing SPA tab retains the old module until reload.
