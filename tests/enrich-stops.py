"""Expand TRIP's independent map-stop layer with named OSM bus stops.

This is optional build-time enrichment, not live data. Existing line/stop
relations are preserved. Unverified line associations stay empty, never guessed.
"""
import json, math, urllib.parse, urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"data"/"stops.geojson"
SOURCES=(
 "https://overpass.private.coffee/api/interpreter",
 "https://overpass-api.de/api/interpreter",
)
QUERY="""[out:json][timeout:24];
(
  node["highway"="bus_stop"]["name"](42.56,21.02,42.78,21.35);
  node["public_transport"="platform"]["bus"="yes"]["name"](42.56,21.02,42.78,21.35);
);
out body;"""
def dist(a,b):
    rad=math.pi/180
    dy=(a[1]-b[1])*rad; dx=(a[0]-b[0])*rad
    h=math.sin(dy/2)**2+math.cos(a[1]*rad)*math.cos(b[1]*rad)*math.sin(dx/2)**2
    return 12742000*math.asin(min(1,math.sqrt(h)))
def fetch():
    data=urllib.parse.urlencode({"data":QUERY}).encode()
    for service in SOURCES:
        try:
            req=urllib.request.Request(service,data=data,headers={
                "User-Agent":"TRIP-educational-prototype/1.0 (OpenStreetMap, ODbL)",
                "Content-Type":"application/x-www-form-urlencoded"})
            with urllib.request.urlopen(req,timeout=29) as response:
                result=json.load(response)
            if isinstance(result.get("elements"),list):
                print(f"Fetched {len(result['elements'])} public transport nodes from {service}")
                return result["elements"]
        except Exception as exc:
            print(f"Stop provider unavailable ({service}): {type(exc).__name__}")
    return None
def main():
    found=fetch()
    if found is None:
        print("Stop enrichment skipped; retaining version-controlled map stops.")
        return
    original=json.loads(DATA.read_text(encoding="utf-8"))
    stops=original["features"]
    existing={str(s["properties"]["id"]) for s in stops}
    seen=[s["geometry"]["coordinates"] for s in stops]
    added=0
    for element in found:
        if element.get("type")!="node" or "lat" not in element or "lon" not in element:
            continue
        tags=element.get("tags",{})
        name=tags.get("name","").strip()
        if not name:continue
        sid=str(element["id"])
        if sid in existing:continue
        p=[float(element["lon"]),float(element["lat"])]
        if any(dist(p,old)<12 for old in seen):continue
        stops.append({"type":"Feature",
          "properties":{"id":sid,"name":name,"lines":[],"nameFromOSM":True,"unassigned":True},
          "geometry":{"type":"Point","coordinates":p}})
        existing.add(sid);seen.append(p);added+=1
    if added:
        DATA.write_text(json.dumps(original,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    print(f"Independent OSM stops added: {added}; total named stops: {len(stops)}")
if __name__=="__main__": main()
