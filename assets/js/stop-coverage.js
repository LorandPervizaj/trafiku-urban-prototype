// Fast, cached visual route proximity for mapped stops.
//
// A mapped road passing next to a stop does NOT prove that a bus boards
// there. Keep explicit OSM stop/line relationships separate from inferred
// nearby roads. Nearby lines affect only visual focus and are identified
// separately in the station panel; no ETAs are invented for them.
const THRESHOLD_METERS = 125;
const PAIR_DISTANCE_METERS = 220;
const METERS_LAT = 111320;
let cache = null;
let sourceStops, sourceRoutes, sourceFragments;

function addGeometry(segments, line, geometry, threshold) {
  if (!geometry || !line) return;
  const ways = geometry.type === "LineString"
    ? [geometry.coordinates]
    : geometry.type === "MultiLineString"
      ? geometry.coordinates
      : [];
  let group = segments.get(line);
  if (!group) { group=[]; segments.set(line,group); }
  const padLat=threshold/METERS_LAT;
  const padLon=threshold/79000; // conservative for Greater Prishtina
  for (const points of ways) {
    for (let i=1;i<points.length;i++) {
      const a=points[i-1],b=points[i];
      if (!a || !b || !a.every(Number.isFinite) || !b.every(Number.isFinite)) continue;
      group.push({
        a,b, minX:Math.min(a[0],b[0])-padLon,maxX:Math.max(a[0],b[0])+padLon,
        minY:Math.min(a[1],b[1])-padLat,maxY:Math.max(a[1],b[1])+padLat
      });
    }
  }
}

function closeToLine(point, parts, threshold) {
  if (!parts?.length) return false;
  const [lng,lat] = point;
  const lonScale=METERS_LAT*Math.cos(lat*Math.PI/180);
  for (const part of parts) {
    if(lng<part.minX||lng>part.maxX||lat<part.minY||lat>part.maxY)continue;
    const ax=(part.a[0]-lng)*lonScale;
    const ay=(part.a[1]-lat)*METERS_LAT;
    const dx=(part.b[0]-part.a[0])*lonScale;
    const dy=(part.b[1]-part.a[1])*METERS_LAT;
    const span=dx*dx+dy*dy;
    const t=span>0?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/span)):0;
    if (Math.hypot(ax+dx*t,ay+dy*t)<=threshold) return true;
  }
  return false;
}

function stopKey(stop) {
  return String(stop?.properties?.id ?? stop?.geometry?.coordinates?.join(",") ?? "");
}

function stopNameKey(name) {
  return String(name||"")
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase().replace(/\([^)]*\)/g," ")
    .replace(/\b(perballe|perball|nkalim|n|kalim|stacioni|rruga|rr)\b/g," ")
    .replace(/[^a-z0-9]+/g," ").trim();
}
function distanceMeters(a,b) {
  const latitude=(a[1]+b[1])/2*Math.PI/180;
  return Math.hypot(
    (a[0]-b[0])*METERS_LAT*Math.cos(latitude),
    (a[1]-b[1])*METERS_LAT
  );
}

export function updateStopCoverage(stops=[],routes=[],fragments=[],threshold=THRESHOLD_METERS) {
  if(cache && sourceStops===stops && sourceRoutes===routes &&
     sourceFragments===fragments && cache.threshold===threshold)return;
  sourceStops=stops;sourceRoutes=routes;sourceFragments=fragments;
  const byLine=new Map(),inferred=new Map();
  for(const f of [...routes,...fragments]){
    if(typeof f?.properties?.line!=="string")continue;
    addGeometry(byLine,f.properties.line,f.geometry,threshold);
  }
  // A road corridor is symmetrical: stops on BOTH sides count as near
  // the drawn route. Proximity is visual only, not boarding evidence.
  const keyedStops=[];
  for(const stop of stops){
    const point=stop?.geometry?.coordinates;
    if(!point||point.length!==2||!point.every(Number.isFinite))continue;
    const explicit=new Set(stop.properties?.lines||[]);
    const nearby=new Set();
    for(const [id,segments] of byLine){
      if(!explicit.has(id)&&closeToLine(point,segments,threshold))nearby.add(id);
    }
    if(nearby.size)inferred.set(stopKey(stop),nearby);
    keyedStops.push({
      stop,point,name:stopNameKey(stop.properties?.name),
      lines:new Set([...explicit,...nearby])
    });
  }
  // If OSM models two platforms on opposite sides of a street with
  // matching names, associate the unassigned side visually as well.
  // Never mutate stop.properties.lines or create arrival estimates.
  const byName=new Map();
  for(const item of keyedStops){
    if(item.name.length<3)continue;
    if(!byName.has(item.name))byName.set(item.name,[]);
    byName.get(item.name).push(item);
  }
  for(const group of byName.values()){
    if(group.length<2)continue;
    for(const item of group){
      for(const other of group){
        if(other===item ||
           distanceMeters(item.point,other.point)>PAIR_DISTANCE_METERS)continue;
        const existing=new Set(item.stop.properties?.lines||[]);
        const near=inferred.get(stopKey(item.stop))||new Set();
        for(const line of other.lines)if(!existing.has(line))near.add(line);
        if(near.size)inferred.set(stopKey(item.stop),near);
      }
    }
  }
  cache={inferred,threshold};
}

export function routeNearbyLines(stop) {
  return [...(cache?.inferred.get(stopKey(stop))||[])];
}

export function stopSelectedForLines(stop,selectedLines) {
  const chosen=selectedLines instanceof Set?selectedLines:new Set(selectedLines||[]);
  if(!chosen.size)return false;
  if((stop?.properties?.lines||[]).some(id=>chosen.has(id)))return true;
  return routeNearbyLines(stop).some(id=>chosen.has(id));
}

export function isExplicitStopForLine(stop,line) {
  return !!stop?.properties?.lines?.includes(line);
}
