"""Publish additional disconnected OSM road segments as light route context.

No connecting lines are invented and no simulated buses drive on these fragments.
The primary continuous routes remain in data/routes.geojson; fragments are a
separate, optional layer loaded after the initial map render.
"""
from __future__ import annotations

import json
import math
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"data"
OUTPUT=DATA/"route-fragments.geojson"
SOURCE=DATA/"routes.geojson"
# Focus on central high-use routes first. Existing snapshots carry relation ids.
FOCUS={"4","3","1","6","6A","7","7A","7B","8","10","10C"}
HEADERS={"User-Agent":"TRIP-educational-prototype/1.2 (OSM ODbL)"}


def dist(a,b):
    rad=math.pi/180
    dy=(a[1]-b[1])*rad; dx=(a[0]-b[0])*rad
    h=math.sin(dy/2)**2+math.cos(a[1]*rad)*math.cos(b[1]*rad)*math.sin(dx/2)**2
    return 12742000*math.asin(min(1,math.sqrt(h)))


def path_length(coords):
    return sum(dist(a,b) for a,b in zip(coords,coords[1:]))


def fetch_relation(rel_id):
    req=urllib.request.Request(
        f"https://api.openstreetmap.org/api/0.6/relation/{rel_id}/full",
        headers=HEADERS)
    with urllib.request.urlopen(req,timeout=22) as response:
        root=ET.fromstring(response.read())
    nodes={}
    for n in root.findall("node"):
        if n.get("lat") and n.get("lon"):
            nodes[n.get("id")]=[float(n.get("lon")),float(n.get("lat"))]
    ways={}
    for w in root.findall("way"):
        points=[nodes[nd.get("ref")] for nd in w.findall("nd")
                if nd.get("ref") in nodes]
        if len(points)>=2:
            ways[w.get("id")]=points
    relation=next((r for r in root.findall("relation")
                   if r.get("id")==str(rel_id)),None)
    if relation is None:return []
    result=[]
    for member in relation.findall("member"):
        if member.get("type")!="way":continue
        if member.get("role","").startswith(("stop","platform")):continue
        pts=ways.get(member.get("ref"))
        if pts and path_length(pts)>25:
            result.append(pts)
    return result


def main():
    primary=json.loads(SOURCE.read_text(encoding="utf-8"))
    stored=json.loads(OUTPUT.read_text(encoding="utf-8")) if OUTPUT.exists() else {
        "type":"FeatureCollection","features":[]}
    byrelation={str(f["properties"].get("relation"))
                for f in stored["features"]}
    added=0
    for primary_feature in primary["features"]:
        line=str(primary_feature["properties"]["line"])
        rel=str(primary_feature["properties"].get("relation"))
        if line not in FOCUS or not rel.isdecimal() or rel in byrelation:
            continue
        coords=primary_feature["geometry"]["coordinates"]
        # Membership in existing primary geometry means the road is already
        # drawn. Do not redraw those pieces or invent missing connectors.
        existing={(round(p[0],6),round(p[1],6)) for p in coords}
        try:
            pieces=fetch_relation(rel)
        except (OSError,ET.ParseError,ValueError) as e:
            print(f"Fragments {line}/{rel}: {type(e).__name__}, skipped")
            continue
        selected=[]
        for piece in pieces:
            included=sum((round(p[0],6),round(p[1],6)) in existing
                         for p in piece)
            if included/len(piece)>=.6:
                continue
            # Do not draw spurious distant ways from a stale relation.
            if not all(20.85<p[0]<21.5 and 42.45<p[1]<43.03 for p in piece):
                continue
            selected.append(piece)
        if not selected:
            print(f"Fragments {line}/{rel}: no additional mapped streets")
            continue
        stored["features"].append({
            "type":"Feature",
            "properties":{
                "line":line,"relation":int(rel),
                "direction":primary_feature["properties"].get("direction","outbound"),
                "fragmentOnly":True,"partial":True
            },
            "geometry":{"type":"MultiLineString","coordinates":selected}
        })
        byrelation.add(rel)
        added+=1
        print(f"Fragments {line}/{rel}: {len(selected)} additional "
              f"road pieces, {round(sum(path_length(p) for p in selected)/1000,1)} km")
    if added:
        OUTPUT.write_text(json.dumps(stored,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    print(f"Route context: {len(stored['features'])} OSM fragment groups "
          f"({added} newly added)")


if __name__=="__main__":
    main()
