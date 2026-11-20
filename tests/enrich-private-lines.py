"""Extend TRIP with independently mapped contracted Prishtina bus lines.

Source of the line IDs and advertised termini: the municipality's 2024
private-operator agreements and existing OpenStreetMap relation snapshots.
Road geometry and named stops come from OSM relation/full, never straight-line
bridges. These are partial educational demo geometries, not current GPS or
verified complete operating itineraries.

Idempotent. Accepted routes are saved in version-controlled GeoJSON and only
unseen line ids are fetched again. A failed OSM request never breaks deployment.
"""
from __future__ import annotations

import json
import math
import runpy
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"data"
refdata=json.loads((DATA/"osm-relations.json").read_text(encoding="utf-8"))
tags_by_id={
    int(e["id"]):e.get("tags",{})
    for e in refdata.get("elements",[])
    if e.get("type")=="relation" and e.get("tags",{}).get("ref")
}
helpers=runpy.run_path(str(ROOT/"tests"/"expand-lines.py"))
fetch_osm_full=helpers["fetch_osm_full"]
meters=helpers["meters"]
path_length=helpers["path_length"]

# All these lines occur in the municipality's private transport documentation.
# OSM relation IDs are locally recorded in osm-relations.json.
CANDIDATES=(
    ("2", 10121377),
    ("3A", 10166778),
    ("6", 10248144),
    ("6A", 10248142),
    ("7", 10247949),
    ("7A", 10247951),
    ("7B", 19397163),
    ("8", 10227750),
    ("10", 10248181),
    ("10C", 18634744),
)

def route_key(line):
    num="".join(ch for ch in line if ch.isdigit())
    suffix="".join(ch for ch in line if ch.isalpha())
    return (int(num or 999), suffix)

def closest(coords,point):
    i=min(range(len(coords)),key=lambda k:meters(coords[k],point))
    return i,meters(coords[i],point)

def main():
    lines_path=DATA/"lines.json"
    routes_path=DATA/"routes.geojson"
    stops_path=DATA/"stops.geojson"
    lines=json.loads(lines_path.read_text(encoding="utf-8"))
    routes=json.loads(routes_path.read_text(encoding="utf-8"))
    stops=json.loads(stops_path.read_text(encoding="utf-8"))
    mapped={str(item["id"]) for item in lines}
    existing_stops={str(s["properties"]["id"]):s for s in stops["features"]}
    added=[]
    for line,relation in CANDIDATES:
        if line in mapped:continue
        tags=tags_by_id.get(relation,{})
        if str(tags.get("ref"))!=line:
            print(f"Contracted line {line}: conflicting OSM relation {relation}, skipping")
            continue
        try:
            coords,named_stops=fetch_osm_full(relation)
        except Exception as exc:
            print(f"Contracted line {line}: OSM unavailable ({type(exc).__name__})")
            continue
        if len(coords)<35 or path_length(coords)<750:
            print(f"Contracted line {line}: too little continuous mapped road")
            continue
        if not all(20.75<=p[0]<=21.7 and 42.36<=p[1]<=43.18 for p in coords):
            print(f"Contracted line {line}: road extends outside supported map bounds")
            continue
        # Use only actual OSM relation members within 125m of this road piece.
        selected=[]
        for sid,name,point in named_stops:
            idx,d=closest(coords,point)
            if d>125:continue
            if any(meters(point,old[2])<28 for old in selected):
                continue
            selected.append([str(sid),name,point,idx])
        selected.sort(key=lambda s:s[3])
        # Named stops can be scarce in old route relations. A long continuous
        # route is still useful as a map segment, but never invent stops.
        if len(selected)==0:
            print(f"Contracted line {line}: no named OSM stop members near road, skipped")
            continue
        cumulative=[0.0]
        for a,b in zip(coords,coords[1:]):
            cumulative.append(cumulative[-1]+meters(a,b))
        total=cumulative[-1]
        stop_distances=sorted(set([0.0,round(total,1)]+
                                  [round(cumulative[s[3]],1) for s in selected]))
        if len(stop_distances)<2:continue
        # Historical OSM relation tags, NOT primary geometry endpoints.
        from_label=tags.get("from") or "Mapped route segment"
        to_label=tags.get("to") or "Mapped route segment"
        routes["features"].append({
            "type":"Feature",
            "properties":{
                "line":line,"relation":relation,"partial":True,
                "direction":"outbound","operatorType":"contracted-private",
                "stopDistances":stop_distances
            },
            "geometry":{"type":"LineString","coordinates":coords}
        })
        for sid,name,point,_ in selected:
            existing=existing_stops.get(sid)
            if existing:
                ids=existing["properties"].setdefault("lines",[])
                if line not in ids:ids.append(line)
                existing["properties"].pop("unassigned",None)
            else:
                stop={
                    "type":"Feature",
                    "properties":{
                        "id":sid,"name":name,"lines":[line],
                        "nameFromOSM":True,"sourceRelation":relation
                    },
                    "geometry":{"type":"Point","coordinates":point}
                }
                stops["features"].append(stop)
                existing_stops[sid]=stop
        lines.append({
            "id":line,
            "from":from_label,
            "to":to_label,
            "officialFrom":from_label,
            "officialTo":to_label,
            "relation":relation,
            "partial":True,
            "operatorType":"contracted-private",
            "mappedSegmentStart":selected[0][1],
            "mappedSegmentEnd":selected[-1][1],
            "stopsLimited":len(selected)<2
        })
        mapped.add(line)
        added.append(line)
        print(f"Contracted line {line}: {total/1000:.1f} km continuous OSM "
              f"road, {len(selected)} named stops, advertised {from_label} -> {to_label}")
    if added:
        lines.sort(key=lambda l:route_key(str(l["id"])))
        lines_path.write_text(json.dumps(lines,ensure_ascii=False,indent=2),encoding="utf-8")
        routes_path.write_text(json.dumps(routes,ensure_ascii=False,
                                         separators=(",",":")),encoding="utf-8")
        stops_path.write_text(json.dumps(stops,ensure_ascii=False,
                                        separators=(",",":")),encoding="utf-8")
    print("New contracted lines with independently mapped roads:",
          ", ".join(added) if added else "none")
    print("Total mapped line IDs:",len(mapped))

if __name__=="__main__":
    main()
