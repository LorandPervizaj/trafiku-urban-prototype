"""Extend the committed three-line demonstration with OSM-derived route segments.

Runs during GitHub Pages packaging. Additional routes are included only when
their downloaded OSM geometry is continuous and passes basic checks.
If Overpass is unavailable, retain the version-controlled three-line dataset.
Nothing here claims these are current operating routes or GPS positions.
"""
from __future__ import annotations

import json
import math
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
EXTRA = {"2": 10121377, "7C": 11160278, "6": 10248144, "3A": 10166778}
QUERY = (
    "[out:json][timeout:65];"
    "relation(id:" + ",".join(map(str, EXTRA.values())) + ")->.buslines;"
    ".buslines out geom;"
    "node(r.buslines);out body;"
)
ENDPOINTS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
)


def meters(a, b):
    rad = math.pi / 180
    dy, dx = (b[1]-a[1])*rad, (b[0]-a[0])*rad
    h = math.sin(dy/2)**2 + math.cos(a[1]*rad)*math.cos(b[1]*rad)*math.sin(dx/2)**2
    return 12742000 * math.asin(min(1, math.sqrt(h)))


def length(points):
    return sum(meters(a,b) for a,b in zip(points, points[1:]))


def fetch():
    body = urllib.parse.urlencode({"data": QUERY}).encode()
    for endpoint in ENDPOINTS:
        try:
            request = urllib.request.Request(endpoint, data=body, headers={
                "User-Agent":"TrafikuUrbanEducationPrototype/1.0 (OSM route geometry)",
                "Content-Type":"application/x-www-form-urlencoded",
            })
            with urllib.request.urlopen(request, timeout=70) as response:
                data = json.load(response)
            if data.get("elements"):
                return data
        except (OSError, ValueError, TimeoutError) as exc:
            print(f"Extra route provider unavailable ({endpoint}): {exc}")
    return None


def joined_segments(relation):
    fragments = []
    for member in relation.get("members", []):
        if member.get("type") != "way" or not member.get("geometry"):
            continue
        if member.get("role","").startswith(("stop", "platform")):
            continue
        points = [[n["lon"],n["lat"]] for n in member["geometry"] if "lon" in n and "lat" in n]
        if len(points) > 1:
            fragments.append(points)
    # Merge only matching OSM endpoints; do not bridge disconnected streets.
    changed = True
    while changed:
        changed = False
        for i in range(len(fragments)):
            if changed: break
            a = fragments[i]
            for j in range(i+1, len(fragments)):
                b = fragments[j]
                if meters(a[-1], b[0]) < 0.4:
                    merged = a + b[1:]
                elif meters(a[-1], b[-1]) < 0.4:
                    merged = a + list(reversed(b))[1:]
                elif meters(a[0], b[-1]) < 0.4:
                    merged = b + a[1:]
                elif meters(a[0], b[0]) < 0.4:
                    merged = list(reversed(b)) + a[1:]
                else:
                    continue
                fragments[i] = merged
                fragments.pop(j)
                changed = True
                break
    if not fragments:
        return []
    # Retain the longest street-continuous component without inventing missing links.
    return max(fragments, key=length)


def main():
    source = fetch()
    if source is None:
        print("No new OSM route data. Keeping the original three verified segments.")
        return
    routes = json.loads((DATA/"routes.geojson").read_text())
    stops_data = json.loads((DATA/"stops.geojson").read_text())
    lines = json.loads((DATA/"lines.json").read_text())
    existing = {item["id"] for item in lines}
    stops_by_id = {stop["properties"]["id"]: stop for stop in stops_data["features"]}
    nodes = {item["id"]:item for item in source["elements"] if item.get("type")=="node"}
    added = []
    for line, osm_id in EXTRA.items():
        if line in existing:
            continue
        relation = next((r for r in source["elements"] if r.get("type")=="relation" and r.get("id")==osm_id),None)
        if not relation:
            print(f"Line {line}: OSM relation unavailable, skipping.")
            continue
        coords = joined_segments(relation)
        total = length(coords)
        if total < 1000 or len(coords) < 45 or not all(
            20.85 < x < 21.45 and 42.45 < y < 42.95 for x,y in coords
        ):
            print(f"Line {line}: incomplete or out-of-bounds OSM geometry, skipping.")
            continue
        cumulative=[0]
        for a,b in zip(coords,coords[1:]):
            cumulative.append(cumulative[-1]+meters(a,b))
        selected=[]
        for m in relation.get("members",[]):
            if m.get("type")!="node" or "lat" not in m or "lon" not in m:
                continue
            node=nodes.get(m.get("ref"),{})
            name=node.get("tags",{}).get("name")
            if not name: continue
            point=[m["lon"],m["lat"]]
            ix=min(range(len(coords)),key=lambda k:meters(point,coords[k]))
            if meters(point,coords[ix])>105: continue
            if any(meters(point, s[2])<65 for s in selected): continue
            selected.append((ix,m,point,name))
        selected.sort(key=lambda x:x[0])
        if len(selected)>=2 and selected[0][0]>selected[-1][0]:
            coords.reverse()
        dists=sorted(set([0,round(total,1)] + [round(cumulative[x[0]],1) for x in selected]))
        if len(dists)<3:
            dists=[0,round(total,1)]
        routes["features"].append({
            "type":"Feature",
            "properties":{"line":line,"relation":osm_id,"partial":True,"stopDistances":dists},
            "geometry":{"type":"LineString","coordinates":coords},
        })
        for idx,member,point,name in selected:
            sid=str(member["ref"])
            if sid in stops_by_id:
                if line not in stops_by_id[sid]["properties"]["lines"]:
                    stops_by_id[sid]["properties"]["lines"].append(line)
            else:
                stop={"type":"Feature","properties":{
                    "id":sid,"name":name,"lines":[line],"nameFromOSM":True,
                },"geometry":{"type":"Point","coordinates":point}}
                stops_data["features"].append(stop)
                stops_by_id[sid]=stop
        tags=relation.get("tags",{})
        lines.append({
            "id":line,
            "from":selected[0][3] if selected else "Mapped segment start",
            "to":selected[-1][3] if selected else "Mapped segment end",
            "officialFrom":tags.get("from"),
            "officialTo":tags.get("to"),
            "partial":True,"relation":osm_id,
        })
        added.append(line)
        print(f"Added OSM line {line} ({total/1000:.1f} km, {len(selected)} named stops)")
    if not added:
        print("No additional continuous geometries were verified.")
        return
    (DATA/"routes.geojson").write_text(json.dumps(routes,ensure_ascii=False))
    (DATA/"stops.geojson").write_text(json.dumps(stops_data,ensure_ascii=False))
    (DATA/"lines.json").write_text(json.dumps(lines,ensure_ascii=False,indent=2))
    print("Additional mapped lines in published artifact:",", ".join(added))


if __name__=="__main__":
    main()
