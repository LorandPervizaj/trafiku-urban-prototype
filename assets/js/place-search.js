import { findStop } from "./routes.js";
import { distance } from "./simulation.js";

// Search local mapped bus stops first. Public Photon is consulted once at submit,
// never on each keystroke. It is optional and may rate-limit or be unavailable.
const BBOX=[20.88,42.49,21.49,42.97];
export async function resolvePlace(query,stops,signal) {
  const name=String(query||"").trim();
  if(!name)throw Error("Please enter a place or bus stop.");
  const direct=findStop(name);
  if(direct)return {query:name,stop:direct,walkMeters:0,kind:"stop"};
  const url=new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q",name+" Prishtina");
  url.searchParams.set("limit","5");
  url.searchParams.set("lat","42.658");
  url.searchParams.set("lon","21.161");
  url.searchParams.set("bbox",BBOX.join(","));
  url.searchParams.set("lang","en");
  const response=await fetch(url,{signal});
  if(!response.ok)throw Error("Place lookup unavailable. Select a mapped stop.");
  const data=await response.json();
  const items=(data.features||[]).filter(p=>p.geometry?.type==="Point"&&
    p.geometry.coordinates.length===2&&
    p.geometry.coordinates[0]>=BBOX[0]&&p.geometry.coordinates[0]<=BBOX[2]&&
    p.geometry.coordinates[1]>=BBOX[1]&&p.geometry.coordinates[1]<=BBOX[3]);
  if(!items.length)throw Error("Place not found around Prishtina. Try another name.");
  const p=items[0];
  const ranked=stops.map(stop=>({stop,meters:distance(p.geometry.coordinates,stop.geometry.coordinates)}))
    .sort((a,b)=>a.meters-b.meters);
  const nearest=ranked[0];
  if(!nearest||nearest.meters>1000)
    throw Error("No mapped bus stop within 1 km of this place.");
  return {query:name,stop:nearest.stop,walkMeters:Math.round(nearest.meters),
    kind:"place",name:p.properties?.name||name,coordinates:p.geometry.coordinates,
    source:"OpenStreetMap / Photon"};
}
