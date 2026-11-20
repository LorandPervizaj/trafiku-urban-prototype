import assert from "node:assert/strict";
import fs from "node:fs";
import {nextLineSelection} from "../assets/js/line-selection.js";
import {updateStopCoverage,routeNearbyLines,stopSelectedForLines,
        isExplicitStopForLine} from "../assets/js/stop-coverage.js";

const lines=["1","4","6"];
assert.deepEqual(nextLineSelection(lines,lines,"4"),["4"],
  "A single line tap from All MUST focus that line rather than turn it off");
assert.deepEqual(nextLineSelection(lines,["4"],"6"),["4","6"],
  "Additional line taps make a useful comparison");
assert.deepEqual(nextLineSelection(lines,["4","6"],"4"),["6"],
  "A line tap from partial selection toggles that line off");
assert.deepEqual(nextLineSelection(lines,["4"],"4"),[],
  "Clicking an already isolated line turns it off");
assert.deepEqual(nextLineSelection(lines,[],"all"),lines,
  "All toggles every line on");
assert.deepEqual(nextLineSelection(lines,lines,"all"),[],
  "All toggles every line off");
assert.deepEqual(nextLineSelection(lines,["4"],"all"),lines,
  "All restores all lines from a partial state");

const stop=(id,name,coordinates,assigned=[])=>({
  type:"Feature",properties:{id,name,lines:assigned},
  geometry:{type:"Point",coordinates}
});
const route=(line,coordinates,type="LineString")=>({
  type:"Feature",properties:{line},
  geometry:{type,coordinates}
});
const road=[route("4",[[21.150,42.650],[21.155,42.650]])];
const supplementary=[route("6",[[[21.160,42.649],[21.166,42.649]]],"MultiLineString")];
const stops=[
  stop("north","Street A",[21.152,42.6508]), // 89m to NORTH side
  stop("south","Street B",[21.152,42.6492]), // 89m to SOUTH side
  stop("leftOutside","Outside",[21.152,42.6480]), // 223m away
  stop("offEnd","Outside end",[21.158,42.650]), // >200m past road endpoint
  stop("nearFrag","Other route",[21.164,42.6491]), // 11m to line 6 fragment
  stop("explicit","City Hospital",[21.20,42.70],["4"]),
  stop("opposite","City Hospital (n.kalim)",[21.201,42.70]), // same name, ~82m away
  stop("farSameName","City Hospital",[21.215,42.70]) // same name but >1km away
];
updateStopCoverage(stops,road,supplementary);
for(const s of stops.slice(0,2)) {
  assert(stopSelectedForLines(s,new Set(["4"])),
    "Both sides of a divided road must turn black with Line 4 selected");
  assert(!isExplicitStopForLine(s,"4"),
    "Visual proximity must never invent a boarding service");
}
assert(!stopSelectedForLines(stops[0],new Set(["6"])),
  "The wrong line does not highlight stop on another route");
assert(!stopSelectedForLines(stops[2],new Set(["4"])),
  "An unrelated street more than 200m away stays white");
assert(!stopSelectedForLines(stops[3],new Set(["4"])),
  "Being beyond the road endpoint is not enough to highlight");
assert(stopSelectedForLines(stops[4],new Set(["6"])),
  "Fragment road segments are included in both-side stop highlighting");
assert(stopSelectedForLines(stops[5],new Set(["4"])),
  "OSM-confirmed stop remains selected even if geometry is incomplete");
assert(stopSelectedForLines(stops[6],new Set(["4"])),
  "Opposite-side, same-name stop inherits visual highlighting within 220m");
assert(routeNearbyLines(stops[6]).includes("4"),
  "Paired opposite-side stop is labeled as a nearby line, not verified service");
assert(!stopSelectedForLines(stops[7],new Set(["4"])),
  "Same name far away cannot inherit a route");
assert(stops[6].properties.lines.length===0,
  "Original line associations are never fabricated or overwritten");
assert(!stopSelectedForLines(stops[0],new Set()),
  "Turning all lines off leaves every stop white");

const folder=new URL("../data/",import.meta.url);
const actualStops=JSON.parse(fs.readFileSync(new URL("stops.geojson",folder),"utf8")).features;
const actualRoutes=JSON.parse(fs.readFileSync(new URL("routes.geojson",folder),"utf8")).features;
const actualFragments=JSON.parse(fs.readFileSync(new URL("route-fragments.geojson",folder),"utf8")).features;
updateStopCoverage(actualStops,actualRoutes,actualFragments);
for(const line of ["1","4","6","7","10"]) {
  const chosen=new Set([line]);
  const marked=actualStops.filter(s=>stopSelectedForLines(s,chosen));
  const inferred=marked.filter(s=>!s.properties.lines.includes(line));
  assert(marked.length>0,"Mapped route "+line+" has highlighted stops");
  assert(inferred.length>0,"Mapped line "+line+" finds both-side nearby stops");
  assert(actualStops.filter(s=>stopSelectedForLines(s,new Set())).length===0,
    "All-off mode leaves every map stop white");
  console.log("Line "+line+": "+marked.length+" highlighted, "+inferred.length+
    " route-near/unverified");
}
const line4=actualStops.filter(s=>stopSelectedForLines(s,new Set(["4"])));
assert(line4.length>=42,"Line 4 has more corridor coverage than old 25m data");
const main=fs.readFileSync(new URL("../assets/js/main.js",import.meta.url),"utf8");
const map=fs.readFileSync(new URL("../assets/js/map.js",import.meta.url),"utf8");
assert(main.includes("nextLineSelection(available,state.prefs.lines,id)"),
  "Filter handler uses intuitive single-line focus");
assert(map.includes("stopSelectedForLines(a,selected)"),
  "Nearby served stops sort before white markers");
assert(map.includes("slice(0,300)"),
  "Mapped stops are not dropped from the viewport by old 190 marker cap");
console.log("Bidirectional stop highlighting and line-focus filter tests passed");
