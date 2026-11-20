import assert from "node:assert/strict";
import fs from "node:fs";
import { updateStopCoverage, routeNearbyLines, stopSelectedForLines,
         isExplicitStopForLine } from "../assets/js/stop-coverage.js";

const stop=(id,point,lines=[])=>({
  type:"Feature",properties:{id,name:"Test "+id,lines},
  geometry:{type:"Point",coordinates:point}
});
const route=(line,coordinates,type="LineString")=>({
  type:"Feature",properties:{line},
  geometry:{type,coordinates}
});
const routes=[route("4",[[21.150,42.650],[21.155,42.650]])];
const fragments=[route("6",[[[21.160,42.649],[21.166,42.649]]],"MultiLineString")];
const stops=[
  stop("near4",[21.152,42.65015]), // ~17m from mapped road
  stop("far4",[21.152,42.652]), // >200m from route
  stop("near6",[21.164,42.6491]), // ~11m near fragmented 6
  stop("explicit",[21.20,42.70],["4"]), // explicit assignment beats geometry
];
updateStopCoverage(stops,routes,fragments,25);
assert(routeNearbyLines(stops[0]).includes("4"),
  "Unassigned but physically close to line 4 is visually highlighted");
assert(stopSelectedForLines(stops[0],new Set(["4"])),
  "Nearby Line 4 stop gets black marker on Line 4 selection");
assert(!stopSelectedForLines(stops[0],new Set(["6"])),
  "Other line selection keeps unrelated stop white");
assert(!stopSelectedForLines(stops[1],new Set(["4"])),
  "Distant stop stays white");
assert(routeNearbyLines(stops[2]).includes("6") &&
  stopSelectedForLines(stops[2],new Set(["6"])),
  "Disconnected extra OSM road segments affect map marker highlight");
assert(stopSelectedForLines(stops[3],new Set(["4"])),
  "Explicit route membership keeps stop black even when road is partial");
assert(isExplicitStopForLine(stops[3],"4"),"Existing OSM service remains explicit");
assert(!isExplicitStopForLine(stops[0],"4"),"Nearby road does not invent boarding service");
assert(!stopSelectedForLines(stops[0],new Set()),"None means every stop is white");
assert(!routeNearbyLines(stops[3]).includes("4"),"Explicit lines not duplicated as inferred");

const data=new URL("../data/",import.meta.url);
const actualStops=JSON.parse(fs.readFileSync(new URL("stops.geojson",data),"utf8")).features;
const actualRoutes=JSON.parse(fs.readFileSync(new URL("routes.geojson",data),"utf8")).features;
const actualFragments=JSON.parse(fs.readFileSync(new URL("route-fragments.geojson",data),"utf8")).features;
updateStopCoverage(actualStops,actualRoutes,actualFragments,25);
const line4=actualStops.filter(s=>!s.properties.lines.includes("4")&&routeNearbyLines(s).includes("4"));
assert(line4.length>=8, "Actual Line 4 map includes additional route-near stops missing line ID");
for(const s of line4) {
  assert(stopSelectedForLines(s,new Set(["4"])),"Actual Line 4 route-near stop turns black");
  assert(!isExplicitStopForLine(s,"4"),"Actual route-near stop not falsely marked as confirmed boarding");
}
const main=fs.readFileSync(new URL("../assets/js/main.js",import.meta.url),"utf8");
assert(main.includes("Route passes nearby · stop not verified"),
  "Stop sheet explains nearby route without inventing boarding");
assert(main.includes("No verified ETA"),"Nearby-only line never gets an invented ETA");
const map=fs.readFileSync(new URL("../assets/js/map.js",import.meta.url),"utf8");
assert(map.includes("updateStopCoverage(state.stops,state.routes,state.fragments||NO_FRAGMENTS)"),
  "Route proximity index updated when route fragments arrive");
console.log("Black/white route-proximity checks passed; Line 4 additional nearby stops:",line4.length);
