"""Supplement TRIP line snapshots with separately mapped reverse directions.

OSM contains distinct route relations for many lines. We only add long,
continuous, named-stop-bearing road pieces. These remain partial historical
community-mapped segments, not verified present-day terminal-to-terminal
journeys. There are no invented road joins.
"""
from __future__ import annotations

import json
import math
import runpy
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"data"
helpers=runpy.run_path(str(ROOT/"tests"/"expand-lines.py"))
fetch_osm_full=helpers["fetch_osm_full"]
meters=helpers["meters"]
path_length=helpers["path_length"]
# Prioritize opposite direction of line 4 (missing from the existing map).
PAIRS=(("2",10121378),("3A",10166779),
       ("6",10248145),("6A",10248143),
       ("7",10247950),("7A",10247952),("8",10227751),
       ("4",10120492),("1",10120832),("3",11153999),
       ("3B",10187117),("3C",11160462),("1A",10118966),
       ("15",11153453))


def closest(coords,p):
    index=min(range(len(coords)), key=lambda i:meters(coords[i],p))
    return index, meters(coords[index],p)


def main():
    routes_path=DATA/"routes.geojson"
    stops_path=DATA/"stops.geojson"
    routes=json.loads(routes_path.read_text(encoding="utf-8"))
    stops=json.loads(stops_path.read_text(encoding="utf-8"))
    existing={str(f["properties"].get("relation")) for f in routes["features"]}
    known={str(s["properties"]["id"]):s for s in stops["features"]}
    updated=False
    # The original relation is explicitly the demo's initial travel direction.
    for f in routes["features"]:
        if "direction" not in f["properties"]:
            f["properties"]["direction"]="outbound"
            updated=True
    for line,osm_id in PAIRS:
        if str(osm_id) in existing:
            continue
        if not any(f["properties"].get("line")==line for f in routes["features"]):
            continue
        try:
            coords, members=fetch_osm_full(osm_id)
        except Exception as exc:
            print(f"Reverse {line}: OSM unavailable ({type(exc).__name__})")
            continue
        if len(coords)<85 or path_length(coords)<1400 or not all(
            20.85<lon<21.55 and 42.45<lat<43.05 for lon,lat in coords):
            print(f"Reverse {line}: incomplete continuous road component; skipped")
            continue
        projected=[]
        for sid,name,p in members:
            i,d=closest(coords,p)
            if d>110:
                continue
            if any(meters(p,old[2])<48 for old in projected):
                continue
            projected.append([str(sid),name,p,i])
        if len(projected)<2:
            print(f"Reverse {line}: fewer than two route-near named stops; skipped")
            continue
        # The relation's named stops are in service order. Orient the road
        # geometry along that order rather than imposing a fake return path.
        if projected[0][3] > projected[-1][3]:
            coords.reverse()
            for item in projected:
                item[3]=len(coords)-1-item[3]
        projected.sort(key=lambda s:s[3])
        # Distances measured along the retained road (not straight-line).
        cumulative=[0.0]
        for a,b in zip(coords,coords[1:]):
            cumulative.append(cumulative[-1]+meters(a,b))
        distances=sorted(set([0.0,round(cumulative[-1],1)] +
                             [round(cumulative[s[3]],1) for s in projected]))
        if len(distances)<3:
            print(f"Reverse {line}: insufficient stop spacing; skipped")
            continue
        routes["features"].append({
            "type":"Feature",
            "properties":{
                "line":line,"relation":osm_id,"direction":"return",
                "partial":True,"stopDistances":distances,
            },
            "geometry":{"type":"LineString","coordinates":coords}
        })
        for sid,name,p,_ in projected:
            existing_stop=known.get(sid)
            if existing_stop is not None:
                if line not in existing_stop["properties"]["lines"]:
                    existing_stop["properties"]["lines"].append(line)
                if existing_stop["properties"].get("unassigned"):
                    existing_stop["properties"]["unassigned"]=False
            else:
                new={
                    "type":"Feature",
                    "properties":{"id":sid,"name":name,"lines":[line],
                                  "nameFromOSM":True},
                    "geometry":{"type":"Point","coordinates":p}
                }
                stops["features"].append(new)
                known[sid]=new
        existing.add(str(osm_id))
        updated=True
        print(f"Reverse {line}: +{round(cumulative[-1]/1000,2)} km, "
              f"{len(projected)} named stops, {len(coords)} road points")
    if updated:
        routes_path.write_text(json.dumps(routes,ensure_ascii=False,
                                         separators=(",",":")),encoding="utf-8")
        stops_path.write_text(json.dumps(stops,ensure_ascii=False,
                                        separators=(",",":")),encoding="utf-8")
    total=len({f["properties"]["line"] for f in routes["features"]})
    print(f"Direction snapshot: {len(routes['features'])} segments / {total} line IDs")


if __name__=="__main__":
    main()
