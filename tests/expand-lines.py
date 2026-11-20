"""Add additional OSM-derived Prishtina transit segments to the static dataset.

Official service names are checked separately; OSM route geometry is a historical
community-maintained map, not a promise of a present-day route or GPS position.
Only contiguous road geometry and nearby named OSM stops are accepted.
This script is idempotent once routes have been checked into data/*.json.
"""
from __future__ import annotations

import json
import math
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
# Named on the operator's published route page as of November 2026.
TARGETS = (
    ("7C", 11160278),
    ("3B", 10187116),
    ("3C", 11160426),
    ("19", 18704771),
)
USER_AGENT = "TrafikuUrbanEducationalPrototype/1.1 (route geometry, ODbL)"


def meters(a, b):
    rad = math.pi / 180
    dy = (b[1] - a[1]) * rad
    dx = (b[0] - a[0]) * rad
    h = math.sin(dy / 2) ** 2 + math.cos(a[1] * rad) * math.cos(b[1] * rad) * math.sin(dx / 2) ** 2
    return 12742000 * math.asin(min(1, math.sqrt(h)))


def path_length(points):
    return sum(meters(a, b) for a, b in zip(points, points[1:]))


def request(url, timeout=19):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.read()


def split_jumps(coords, threshold=200):
    if not coords:
        return []
    groups, group = [], [coords[0]]
    for point in coords[1:]:
        if meters(group[-1], point) > threshold:
            if len(group) >= 2:
                groups.append(group)
            group = [point]
        else:
            group.append(point)
    if len(group) >= 2:
        groups.append(group)
    return groups


def merge_connected(fragments):
    fragments = [piece for piece in fragments if len(piece) >= 2]
    changed = True
    while changed:
        changed = False
        for i in range(len(fragments)):
            if changed:
                break
            a = fragments[i]
            for j in range(i + 1, len(fragments)):
                b = fragments[j]
                if meters(a[-1], b[0]) < 0.75:
                    merged = a + b[1:]
                elif meters(a[-1], b[-1]) < 0.75:
                    merged = a + list(reversed(b))[1:]
                elif meters(a[0], b[-1]) < 0.75:
                    merged = b + a[1:]
                elif meters(a[0], b[0]) < 0.75:
                    merged = list(reversed(b)) + a[1:]
                else:
                    continue
                fragments[i] = merged
                fragments.pop(j)
                changed = True
                break
    return max(fragments, key=path_length) if fragments else []


def fetch_geopublic(relation_id):
    url = f"https://openstreetmap.tools/public_transport_geojson/api/route/{relation_id}"
    obj = json.loads(request(url, timeout=17))
    collection = obj.get("geojson", {})
    geometries = []
    for f in collection.get("features", []):
        g = f.get("geometry", {})
        if g.get("type") == "LineString":
            geometries += split_jumps(g.get("coordinates", []))
        elif g.get("type") == "MultiLineString":
            for part in g.get("coordinates", []):
                geometries += split_jumps(part)
    coords = max(geometries, key=path_length) if geometries else []
    stops = [
        (f"relation-{relation_id}-stop-{i}", s["name"], [float(s["lon"]), float(s["lat"])])
        for i, s in enumerate(obj.get("stops", []))
        if s.get("name") and s.get("lat") is not None and s.get("lon") is not None
    ]
    return coords, stops


def fetch_osm_full(relation_id):
    xml = ET.fromstring(request(f"https://api.openstreetmap.org/api/0.6/relation/{relation_id}/full", timeout=27))
    node_elements = {node.attrib["id"]: node for node in xml.findall("node")}
    nodes = {
        key: [float(node.attrib["lon"]), float(node.attrib["lat"])]
        for key, node in node_elements.items()
        if node.attrib.get("lon") and node.attrib.get("lat")
    }
    ways = {}
    for way in xml.findall("way"):
        points = [nodes[nd.attrib["ref"]] for nd in way.findall("nd") if nd.attrib["ref"] in nodes]
        if len(points) >= 2:
            ways[way.attrib["id"]] = points
    rel = next((r for r in xml.findall("relation") if r.attrib.get("id") == str(relation_id)), None)
    if rel is None:
        return [], []
    fragments = []
    stops = []
    for m in rel.findall("member"):
        typ, ref, role = m.attrib.get("type"), m.attrib.get("ref"), m.attrib.get("role","")
        if typ == "way" and ref in ways and not role.startswith(("platform", "stop")):
            fragments.append(ways[ref])
        elif typ == "node" and ref in nodes:
            tag = node_elements[ref].find("./tag[@k='name']")
            if tag is not None and tag.attrib.get("v"):
                stops.append((ref, tag.attrib["v"], nodes[ref]))
    return merge_connected(fragments), stops


def nearest_vertex(coords, stop):
    return min(range(len(coords)), key=lambda i: meters(coords[i], stop))


def main():
    lines_path = DATA / "lines.json"
    stops_path = DATA / "stops.geojson"
    routes_path = DATA / "routes.geojson"
    lines = json.loads(lines_path.read_text())
    stops_json = json.loads(stops_path.read_text())
    routes_json = json.loads(routes_path.read_text())
    ids = {x["id"] for x in lines}
    known_stops = {str(s["properties"]["id"]): s for s in stops_json["features"]}
    added = []
    for line, rid in TARGETS:
        if line in ids:
            continue
        coords, stops = [], []
        for label, loader in [("OpenStreetMap Tools", fetch_geopublic), ("OSM official API", fetch_osm_full)]:
            try:
                coords, stops = loader(rid)
                if len(coords) > 100 and len(stops) >= 2:
                    print(f"Line {line}: loaded from {label}")
                    break
            except (OSError, ValueError, KeyError, ET.ParseError) as exc:
                print(f"Line {line}: {label} unavailable ({type(exc).__name__})")
                coords, stops = [], []
        if len(coords) < 101:
            print(f"Line {line}: not enough verified route geometry, skipped")
            continue
        if not all(20.85 < point[0] < 21.50 and 42.45 < point[1] < 43.00 for point in coords):
            print(f"Line {line}: geometry outside Prishtina area, skipped")
            continue
        total = path_length(coords)
        if total < 1400:
            print(f"Line {line}: continuous segment too short, skipped")
            continue
        selected = []
        for sid, name, position in stops:
            idx = nearest_vertex(coords, position)
            if meters(coords[idx], position) > 115:
                continue
            if any(meters(position, existing[2]) < 55 for existing in selected):
                continue
            selected.append((str(sid), name, position, idx))
        # Require at least two real named OSM stops so a route is useful.
        if len(selected) < 2:
            print(f"Line {line}: insufficient named stops, skipped")
            continue
        selected.sort(key=lambda item: item[3])
        # OSM stop order is not a reliable direction guarantee: use documented
        # partial map endpoints, not unverified official end-to-end service.
        cumulative = [0.0]
        for a, b in zip(coords, coords[1:]):
            cumulative.append(cumulative[-1] + meters(a,b))
        distances = sorted(set([0.0, round(total, 1)] + [round(cumulative[s[3]],1) for s in selected]))
        if len(distances) < 3:
            print(f"Line {line}: invalid stop spacing, skipped")
            continue
        routes_json["features"].append({
            "type": "Feature",
            "properties": {"line": line, "relation": rid, "partial": True, "stopDistances": distances},
            "geometry": {"type": "LineString", "coordinates": coords},
        })
        for sid, name, position, _ in selected:
            if sid in known_stops:
                if line not in known_stops[sid]["properties"]["lines"]:
                    known_stops[sid]["properties"]["lines"].append(line)
            else:
                new_stop = {
                    "type": "Feature",
                    "properties": {"id": sid, "name": name, "lines": [line], "nameFromOSM": True},
                    "geometry": {"type": "Point", "coordinates": position},
                }
                stops_json["features"].append(new_stop)
                known_stops[sid] = new_stop
        lines.append({
            "id": line, "from": selected[0][1], "to": selected[-1][1],
            "partial": True, "relation": rid,
        })
        ids.add(line)
        added.append(line)
        print(f"Line {line}: accepted {len(coords)} points / {round(total/1000,1)} km / {len(selected)} stops")
    if added:
        routes_path.write_text(json.dumps(routes_json, ensure_ascii=False))
        stops_path.write_text(json.dumps(stops_json, ensure_ascii=False))
        lines_path.write_text(json.dumps(lines, ensure_ascii=False, indent=2))
    print("Additional map lines:", ", ".join(added) if added else "none (source unavailable)")


if __name__ == "__main__":
    main()
