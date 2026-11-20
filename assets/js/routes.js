import { state } from "./state.js";
import { distance } from "./simulation.js";

const clean = value => String(value||"")
  .normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()
  .replace(/["“”'’.,()[\]{}]/g," ").replace(/[-–/]/g," ")
  .replace(/\b(rruga|rr|stacioni|stop|tek|te|perballe|i|e)\b/g," ")
  .replace(/\s+/g," ").trim();
export const normalizePlace = clean;
function scoreStop(input, stop) {
  const a=clean(input), b=clean(stop.properties.name);
  if (!a||!b) return 0;
  if(a===b) return 100;
  if(b.includes(a)) return 92-0.1*(b.length-a.length);
  if(a.includes(b)) return 85;
  const words=a.split(" ").filter(w=>w.length>=2);
  const matched=words.filter(w=>b.split(" ").some(t=>t===w||t.startsWith(w)||w.startsWith(t)));
  if(!matched.length)return 0;
  const coverage=matched.length/words.length;
  return coverage<0.65 ? 0 : coverage*75-0.7*Math.max(0,b.split(" ").length-matched.length);
}
export function findStop(name) {
  if(!name || !state.stops?.length)return null;
  if(state.lookup?.from?.query===name)return state.lookup.from.stop;
  if(state.lookup?.to?.query===name)return state.lookup.to.stop;
  const ranked=state.stops.map(stop=>({stop,score:scoreStop(name,stop)})).sort((a,b)=>b.score-a.score);
  return ranked[0]?.score>=46 ? ranked[0].stop:null;
}
export function stopSuggestions(query, limit=8) {
  return state.stops.map(stop=>({stop,score:scoreStop(query,stop)}))
    .filter(x=>x.score>0).sort((a,b)=>b.score-a.score)
    .slice(0,limit).map(x=>x.stop);
}
const routeOf = line => state.routes.find(r=>r.properties.line===line);
function indexOnRoute(route,stop) {
  if(!route||!stop) return -1;
  let best=Infinity,idx=0;
  route.geometry.coordinates.forEach((coord,i)=>{
    const d=distance(coord,stop.geometry.coordinates);
    if(d<best){best=d;idx=i;}
  });
  return idx;
}
function legDirection(line,start,end) {
  const route=routeOf(line.id);
  const reverse=indexOnRoute(route,start)>indexOnRoute(route,end);
  return {reverse,direction:reverse?line.from:line.to};
}
export function findRoutes(from,to) {
  const a=findStop(from),b=findStop(to);
  if(!a||!b||a.properties.id===b.properties.id)return [];
  const valid=state.lines.filter(l=>routeOf(l.id));
  const direct=valid.filter(l=>a.properties.lines.includes(l.id)&&b.properties.lines.includes(l.id))
    .map(l=>({...l,...legDirection(l,a,b),type:"direct",from:a.properties.id,to:b.properties.id}));
  if(direct.length)return direct;
  // Walking transfer only where there are independently mapped stops nearby.
  const choices=[];
  const first=valid.filter(l=>a.properties.lines.includes(l.id));
  const last=valid.filter(l=>b.properties.lines.includes(l.id));
  for(const one of first)for(const two of last){
    if(one.id===two.id)continue;
    const as=state.stops.filter(s=>s.properties.lines.includes(one.id));
    const bs=state.stops.filter(s=>s.properties.lines.includes(two.id));
    for(const s1 of as)for(const s2 of bs){
      const walk=distance(s1.geometry.coordinates,s2.geometry.coordinates);
      if(walk>400)continue;
      const fromLeg=legDirection(one,a,s1);
      const toLeg=legDirection(two,s2,b);
      // Avoid using the departure or destination as an absurd transfer.
      if(s1.properties.id===a.properties.id||s2.properties.id===b.properties.id)continue;
      choices.push({id:one.id+">"+two.id,first:one.id,second:two.id,
        type:"transfer",from:a.properties.id,to:b.properties.id,
        direction:fromLeg.direction,finalDirection:toLeg.direction,
        reverse:fromLeg.reverse,secondReverse:toLeg.reverse,
        transfer:{from:s1.properties.name,to:s2.properties.name,meters:Math.round(walk)},
        cost:walk+0.015*(Math.abs(indexOnRoute(routeOf(one.id),a)-indexOnRoute(routeOf(one.id),s1))+
          Math.abs(indexOnRoute(routeOf(two.id),s2)-indexOnRoute(routeOf(two.id),b)))});
    }
  }
  const uniq=new Map();
  for(const r of choices.sort((a,b)=>a.cost-b.cost))
    if(!uniq.has(r.id))uniq.set(r.id,r);
  return [...uniq.values()].slice(0,4);
}
