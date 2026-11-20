// Deterministic, lightweight visual simulation. Positions are not live GPS.
// Route geometry is precomputed once per mapped direction, never per vehicle.
const R=6371000;
const FLEET=Object.freeze({"1":7,"1A":2,"3":8,"3B":2,"3C":6,"4":9,"7C":4,"15":2,"19":2});
export function fleetCount(line){return FLEET[String(line)]||3;}
export function distance(a,b){
  const rad=Math.PI/180, dy=(b[1]-a[1])*rad, dx=(b[0]-a[0])*rad;
  const h=Math.sin(dy/2)**2+
    Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(dx/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
}
export function prepare(coordinates){
  let total=0;
  const cumulative=[0];
  for(let i=1;i<coordinates.length;i++){
    total+=distance(coordinates[i-1],coordinates[i]);
    cumulative.push(total);
  }
  return {coordinates,cumulative,total};
}
export function interpolate(route,progress){
  const d=Math.max(0,Math.min(route.total,progress));
  let lo=1, hi=route.cumulative.length-1;
  while(lo<hi){
    const mid=(lo+hi)>>1;
    if(route.cumulative[mid]<d)lo=mid+1;else hi=mid;
  }
  const i=lo,a=route.coordinates[i-1],b=route.coordinates[i];
  const span=route.cumulative[i]-route.cumulative[i-1];
  const t=span?(d-route.cumulative[i-1])/span:0;
  return {
    coordinate:[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],
    heading:Math.atan2(b[0]-a[0],b[1]-a[1])*180/Math.PI
  };
}
function trackForFeature(feature){
  const route=prepare(feature.geometry.coordinates);
  const raw=(feature.properties.stopDistances||[0,route.total/3,route.total*2/3,route.total])
    .filter(Number.isFinite).map(v=>Math.max(0,Math.min(route.total,v))).sort((a,b)=>a-b);
  const stops=[0,...raw.filter((v,i)=>v>1&&v<route.total-1),route.total]
    .filter((v,i,a)=>i===0||v>a[i-1]+1);
  const legs=stops.slice(1).map((end,i)=>({
    start:stops[i],end,duration:Math.max(0.1,(end-stops[i])/7.5),
    dwell:i===stops.length-2?18:9
  }));
  const oneWay=legs.reduce((total,l)=>total+l.duration+l.dwell,0);
  return {
    route, legs, backwards:[...legs].reverse(), oneWay,
    relation:feature.properties.relation,
    namedDirection:feature.properties.direction==="return"?"return":"outbound"
  };
}
export function createSimulation(features,update){
  let epoch=performance.now(),frame=0,lastPaint=0;
  const tracksByLine=new Map();
  for(const f of features){
    if(f.geometry?.type!=="LineString"||f.geometry.coordinates.length<2)continue;
    const id=String(f.properties.line);
    if(!tracksByLine.has(id))tracksByLine.set(id,[]);
    tracksByLine.get(id).push(trackForFeature(f));
  }
  // All directions of one line SHARE the configured fleet; adding a
  // second geometry never accidentally doubles the simulated fleet.
  const buses=[];
  for(const [line,tracks] of tracksByLine){
    const count=fleetCount(line);
    for(let n=0;n<count;n++){
      const track=tracks[n%tracks.length];
      const slot=Math.floor(n/tracks.length);
      const slots=Math.ceil((count-(n%tracks.length))/tracks.length);
      buses.push({
        id:`${line}-${n+1}`,line,track,route:track.route,
        offset:slot*(2*track.oneWay/Math.max(1,slots))+
          (n%tracks.length)*12,
        speed:7.5,direction:track.namedDirection==="return"?-1:1,
        movementState:"moving",nextStop:1,eta:0,
        directionSource:track.namedDirection,
      });
    }
  }
  function tick(now){
    if(document.hidden){frame=0;return;}
    frame=requestAnimationFrame(tick);
    // Continuous elapsed-time simulation with capped DOM paint work.
    // Around 40 FPS is sufficient for tiny markers with short CSS easing.
    if(lastPaint&&now-lastPaint<24)return;
    const elapsed=Math.max(0,(now-epoch)/1000);
    const delta=lastPaint?Math.max(1,now-lastPaint):24;
    lastPaint=now;
    for(const b of buses){
      const track=b.track;
      let t=(elapsed+b.offset)%(track.oneWay*2);
      // Current cycle position is used by the stop-specific demo ETA board.
      b.cycleSeconds=t;
      const backward=t>=track.oneWay;
      if(backward)t-=track.oneWay;
      const legs=backward?track.backwards:track.legs;
      let progress=backward?track.route.total:0;
      for(let i=0;i<legs.length;i++){
        const leg=legs[i];
        if(t<=leg.duration+leg.dwell || i===legs.length-1){
          const fraction=Math.max(0,Math.min(1,t/leg.duration));
          // Ease only during first/last 7% so buses travel consistently
          // between stops without starting/stopping at every OSM vertex.
          const eased=fraction<.07?fraction*fraction/.07/2/.93:
            fraction>.93?1-(1-fraction)*(1-fraction)/.07/2/.93:
              (fraction-.035)/.93;
          const ratio=Math.max(0,Math.min(1,eased));
          progress=backward?leg.end-(leg.end-leg.start)*ratio:
            leg.start+(leg.end-leg.start)*ratio;
          b.movementState=t>=leg.duration?"boarding":"moving";
          b.nextStop=backward?track.legs.length-i-1:i+1;
          b.eta=Math.max(0,leg.duration-t);
          break;
        }
        t-=leg.duration+leg.dwell;
      }
      b.progress=progress;
      b.direction=(track.namedDirection==="return"?-1:1)*(backward?-1:1);
      const p=interpolate(track.route,progress);
      b.position=p.coordinate;
      const target=p.heading+(backward?180:0);
      if(b.heading===undefined)b.heading=target;
      else {
        const turn=((target-b.heading+540)%360)-180;
        b.heading+=turn*Math.min(.45,delta/100);
      }
      update(b);
    }
  }
  function visibility(){
    cancelAnimationFrame(frame);
    frame=0;lastPaint=0;
    // Elapsed-time positions catch up immediately without background CPU use.
    if(!document.hidden)frame=requestAnimationFrame(tick);
  }
  document.addEventListener("visibilitychange",visibility);
  frame=requestAnimationFrame(tick);
  return {
    buses,
    reset(){epoch=performance.now();lastPaint=0;},
    stop(){cancelAnimationFrame(frame);document.removeEventListener("visibilitychange",visibility);}
  };
}
