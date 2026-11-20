"""Replace clipped segment endpoints with documented OSM route termini.

Source is the locally recorded OSM relation 'from'/'to' tags, not current
operational validation. Preserve clipped endpoints as separate metadata.
"""
import json
from pathlib import Path

DATA=Path(__file__).resolve().parents[1]/"data"
def main():
    lines_path=DATA/"lines.json"
    lines=json.loads(lines_path.read_text(encoding="utf-8"))
    relations=json.loads((DATA/"osm-relations.json").read_text(encoding="utf-8"))
    names={int(e["id"]):e.get("tags",{}) for e in relations["elements"]
           if e.get("type")=="relation" and e.get("tags",{}).get("ref")}
    changed=0
    for line in lines:
        rel=line.get("relation")
        tags=names.get(int(rel),{}) if rel is not None else {}
        if tags.get("ref")!=line["id"]:continue
        def tidy(value):
            value=(value or "").strip()
            # Strip only an unmatched trailing parenthesis (some old OSM
            # tags have it), retaining meaningful endpoint parentheses.
            while value.endswith(")") and value.count(")")>value.count("("):
                value=value[:-1].rstrip()
            return value
        official_from=tidy(tags.get("from"))
        official_to=tidy(tags.get("to"))
        if not official_from or not official_to:continue
        if line.get("from")==official_from and line.get("to")==official_to:continue
        if "mappedSegmentStart" not in line:
            line["mappedSegmentStart"]=line.get("from")
        if "mappedSegmentEnd" not in line:
            line["mappedSegmentEnd"]=line.get("to")
        line.update({"from":official_from,"to":official_to,
                     "officialFrom":official_from,"officialTo":official_to,
                     "terminiSource":"osm-relation-tags"})
        changed+=1
    if changed:
        lines_path.write_text(json.dumps(lines,ensure_ascii=False,indent=2),
                              encoding="utf-8")
    print(f"OSM-advertised endpoint labels normalized for {changed} lines")
if __name__=="__main__":main()
