"""Rebuild local, continuous road segments from the committed OSM relation snapshot.
Never bridge gaps with invented straight lines. This is a partial dataset.
"""
import json, math
from pathlib import Path
root=Path(__file__).resolve().parents[1]
source=json.loads((root/'data/osm-source.json').read_text())
nodepath=root/'data/osm-stops-source.json'
nodes={x['id']:x for x in json.loads(nodepath.read_text()).get('elements',[])} if nodepath.exists() else {}
def distance(a,b):
 rad=math.pi/180
 dy=(b[1]-a[1])*rad; dx=(b[0]-a[0])*rad
 return 12742000*math.asin(math.sqrt(math.sin(dy/2)**2+math.cos(a[1]*rad)*math.cos(b[1]*rad)*math.sin(dx/2)**2))
features=[]; stops={};lines=[]
for relation in sorted(source['elements'],key=lambda e:['4','3','1'].index(e['tags']['ref'])):
 line=relation['tags']['ref']
 pieces=[[[p['lon'],p['lat']] for p in m['geometry']] for m in relation['members'] if m['type']=='way' and m.get('geometry') and not m.get('role','').startswith(('platform','stop'))]
 changed=True
 while changed:
  changed=False
  for i,a in enumerate(pieces):
   found=False
   for j,b in enumerate(pieces):
    if i==j: continue
    if distance(a[-1],b[0])<0.1: c=a+b[1:]
    elif distance(a[-1],b[-1])<0.1: c=a+list(reversed(b))[1:]
    elif distance(a[0],b[-1])<0.1: c=b+a[1:]
    elif distance(a[0],b[0])<0.1: c=list(reversed(b))+a[1:]
    else: continue
    pieces[i]=c; pieces.pop(j); changed=True;found=True;break
   if found: break
 # Line 1's longest component is suburban. Retain its city component instead.
 if line in ['1','4']:
  candidates=[p for p in pieces if len(p)>30]
  coords=min(candidates,key=lambda p:distance(p[len(p)//2],[21.16,42.658]))
 else: coords=max(pieces,key=lambda p:sum(distance(a,b) for a,b in zip(p,p[1:])))
 members=[m for m in relation['members'] if m['type']=='node' and 'lat' in m]
 # Orient geometry according to the ordered stop sequence in the relation.
 order=[]
 for m in members:
  c=[m['lon'],m['lat']]; idx=min(range(len(coords)),key=lambda i:distance(c,coords[i]))
  if distance(c,coords[idx])<130: order.append(idx)
 if len(order)>1 and order[0]>order[-1]: coords.reverse()
 cumulative=[0]
 for a,b in zip(coords,coords[1:]): cumulative.append(cumulative[-1]+distance(a,b))
 selected=[]
 for m in members:
  c=[m['lon'],m['lat']]; idx=min(range(len(coords)),key=lambda i:distance(c,coords[i]))
  if distance(c,coords[idx])>100: continue
  tags=nodes.get(m['ref'],{}).get('tags',{})
  name=tags.get('name') or f'Line {line} stop {len(selected)+1}'
  if any(distance(c,s[2])<65 for s in selected): continue
  selected.append((idx,m,c,name,bool(tags.get('name'))))
 selected.sort(key=lambda s:s[0])
 for idx,m,c,name,verified in selected:
  sid=str(m['ref'])
  if sid in stops:
   if line not in stops[sid]['properties']['lines']: stops[sid]['properties']['lines'].append(line)
  else: stops[sid]={'type':'Feature','properties':{'id':sid,'name':name,'lines':[line],'nameFromOSM':verified},'geometry':{'type':'Point','coordinates':c}}
 distances=sorted(set([0]+[round(cumulative[idx],1) for idx,*_ in selected]+[round(cumulative[-1],1)]))
 features.append({'type':'Feature','properties':{'line':line,'relation':relation['id'],'partial':True,'stopDistances':distances},'geometry':{'type':'LineString','coordinates':coords}})
 names=[s[3] for s in selected]
 lines.append({'id':line,'from':names[0] if names else 'Start of segment','to':names[-1] if names else 'End of segment','officialFrom':relation['tags'].get('from'),'officialTo':relation['tags'].get('to'),'partial':True,'relation':relation['id']})
 print(line,'points',len(coords),'km',round(cumulative[-1]/1000,2),'stops',len(selected),'endpoints',coords[0],coords[-1],names)
(root/'data/routes.geojson').write_text(json.dumps({'type':'FeatureCollection','features':features},ensure_ascii=False),encoding='utf-8')
(root/'data/stops.geojson').write_text(json.dumps({'type':'FeatureCollection','features':list(stops.values())},ensure_ascii=False),encoding='utf-8')
(root/'data/lines.json').write_text(json.dumps(lines,ensure_ascii=False,indent=2),encoding='utf-8')
