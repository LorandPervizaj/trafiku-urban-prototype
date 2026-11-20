"""Add named bus stops from OpenStreetMap route relations to the TRIP stop map.

These OSM stops are independent map locations until their route association is
verified in TRIP's actual route geometry. We never invent bus lines or ETAs.
"""
import json
import math
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"data"/"stops.geojson"
# Public, already-known route relation IDs for municipal and contracted lines.
# These supply the *location* of tagged stops; only nine verified lines are
# currently drawable as bus polylines in this project.
RELATIONS=(
    10121377,  # 2
    10166778,  # 3A
    10248144,  # 6
    10248142,  # 6A
    10247949,  # 7
    10247951,  # 7A
    10227750,  # 8
    19397163,  # 7B
    18634744,  # 10C
    10248181,  # 10
)
def dist(a,b):
    rad=math.pi/180
    dy=(a[1]-b[1])*rad;dx=(a[0]-b[0])*rad
    h=math.sin(dy/2)**2+math.cos(a[1]*rad)*math.cos(b[1]*rad)*math.sin(dx/2)**2
    return 12742000*math.asin(min(1,math.sqrt(h)))
def get_named(relation):
    req=urllib.request.Request(
        f"https://api.openstreetmap.org/api/0.6/relation/{relation}/full",
        headers={"User-Agent":"TRIP-educational-prototype/1.1 (OSM ODbL)"})
    with urllib.request.urlopen(req,timeout=14) as response:
        root=ET.fromstring(response.read())
    names={}
    for node in root.findall("node"):
        if "lat" not in node.attrib or "lon" not in node.attrib:continue
        tags={t.get("k"):t.get("v") for t in node.findall("tag")}
        if tags.get("name"):
            names[node.attrib["id"]]=(tags["name"],[
                float(node.attrib["lon"]),float(node.attrib["lat"])])
    main=next((r for r in root.findall("relation")
               if r.attrib.get("id")==str(relation)),None)
    if main is None:return []
    result=[]
    for member in main.findall("member"):
        if member.attrib.get("type")!="node":continue
        ref=member.attrib.get("ref")
        if ref not in names:continue
        name,coords=names[ref]
        role=member.attrib.get("role","")
        if role and not any(t in role for t in ("stop","platform")):continue
        if not (20.9<coords[0]<21.55 and 42.46<coords[1]<43.02):continue
        result.append((ref,name,coords))
    return result
def main():
    original=json.loads(DATA.read_text(encoding="utf-8"))
    stops=original["features"]
    known={str(s["properties"]["id"]) for s in stops}
    positions=[s["geometry"]["coordinates"] for s in stops]
    accepted=0;successful=0
    for relation in RELATIONS:
        try:
            nodes=get_named(relation)
            successful+=1
        except (OSError,ET.ParseError,ValueError) as exc:
            print(f"Relation {relation} unavailable: {type(exc).__name__}")
            continue
        for sid,name,p in nodes:
            if sid in known:continue
            if any(dist(p,old)<11 for old in positions):continue
            stops.append({"type":"Feature",
                "properties":{"id":sid,"name":name,"lines":[],
                              "nameFromOSM":True,"unassigned":True},
                "geometry":{"type":"Point","coordinates":p}})
            known.add(sid);positions.append(p);accepted+=1
        print(f"Relation {relation}: {len(nodes)} named stop members")
    if accepted:
        DATA.write_text(json.dumps(original,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    print(f"Independent named OSM stops added: {accepted}; OSM relations read: {successful}; total: {len(stops)}")
if __name__=="__main__":main()
