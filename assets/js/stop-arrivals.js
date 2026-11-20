// Stop-specific ETAs derived from the deterministic local bus simulation.
// OSM stop membership is required; do not invent physical stops or schedules.
const projections = new WeakMap();
const HORIZON_SECONDS = 20 * 60;
const METERS_PER_DEGREE = 111320;

export function projectStop(stop, route) {
  if (!stop?.geometry?.coordinates || !route?.coordinates || route.coordinates.length < 2)
    return null;
  let cache = projections.get(route);
  if (!cache) { cache = new Map(); projections.set(route, cache); }
  const key = String(stop.properties?.id ?? stop.geometry.coordinates.join(","));
  if (cache.has(key)) return cache.get(key);
  const target = stop.geometry.coordinates;
  const scale = Math.cos(target[1] * Math.PI / 180);
  let best = null;
  for (let i = 1; i < route.coordinates.length; i++) {
    const a = route.coordinates[i-1], b=route.coordinates[i];
    const x1 = (a[0]-target[0]) * METERS_PER_DEGREE * scale;
    const y1 = (a[1]-target[1]) * METERS_PER_DEGREE;
    const dx = (b[0]-a[0]) * METERS_PER_DEGREE * scale;
    const dy = (b[1]-a[1]) * METERS_PER_DEGREE;
    const len2 = dx*dx + dy*dy;
    if (len2 < 0.00001) continue;
    const factor = Math.max(0, Math.min(1, -(x1*dx+y1*dy) / len2));
    const gap = Math.hypot(x1 + factor*dx, y1 + factor*dy);
    if (!best || gap < best.gap) {
      best = {gap, progress: route.cumulative[i-1] +
        factor*(route.cumulative[i]-route.cumulative[i-1])};
    }
  }
  cache.set(key, best);
  return best;
}

function phaseAtDistance(legs, d, backwards=false) {
  let before=0;
  for (const leg of legs) {
    const span = leg.end - leg.start;
    if (d >= leg.start-0.01 && d <= leg.end+0.01 && span > 0) {
      const ratio = backwards ? (leg.end-d)/span : (d-leg.start)/span;
      return before + Math.max(0, Math.min(1, ratio)) * leg.duration;
    }
    before += leg.duration + leg.dwell;
  }
  return null;
}

export function busArrivalsAtStop(bus, stop, horizon=HORIZON_SECONDS) {
  if (!bus?.track?.route || !Number.isFinite(bus.cycleSeconds)) return [];
  const route=bus.track.route;
  const match=projectStop(stop,route);
  if (!match || match.gap > 125) return [];
  const track=bus.track;
  const cycle=track.oneWay*2;
  if (!(cycle > 0)) return [];
  const targets=[
    phaseAtDistance(track.legs,match.progress,false),
    phaseAtDistance(track.backwards,match.progress,true)
  ];
  const results=[];
  for (let i=0;i<targets.length;i++) {
    if (targets[i]===null) continue;
    const phase=targets[i] + (i===1 ? track.oneWay : 0);
    const seconds=((phase-bus.cycleSeconds)%cycle+cycle)%cycle;
    if (seconds <= horizon) {
      results.push({seconds, minutes:Math.ceil(seconds/60),
        busId:bus.id, direction:i===0?"outbound":"return"});
    }
  }
  return results;
}

export function stopArrivalBoard(stop, lines, buses, horizon=HORIZON_SECONDS) {
  const ids=[...new Set(stop?.properties?.lines || [])];
  const valid=new Set(lines.map(line=>line.id));
  const result=[];
  for (const line of ids.filter(id=>valid.has(id))) {
    const arrival=[];
    for (const bus of buses) {
      if (bus.line!==line) continue;
      arrival.push(...busArrivalsAtStop(bus,stop,horizon));
    }
    arrival.sort((a,b)=>a.seconds-b.seconds);
    const hasGeometry=buses.some(bus=>{
      if(bus.line!==line || !bus.track?.route) return false;
      const match=projectStop(stop,bus.track.route);
      return !!match && match.gap<=125;
    });
    result.push({line, arrivals:arrival.slice(0,3),
      hasGeometry});
  }
  return result;
}

export function arrivalLabel(seconds) {
  if (seconds < 30) return "Due now";
  return Math.ceil(seconds/60)+" min";
}
