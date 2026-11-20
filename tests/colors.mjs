import assert from "node:assert/strict";
import fs from "node:fs";
import {LINE_COLORS,colorForLine,textForLine} from "../assets/js/line-colors.js";
const lums=x=>{
  const a=[1,3,5].map(i=>parseInt(x.slice(i,i+2),16)/255)
    .map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return .2126*a[0]+.7152*a[1]+.0722*a[2];
};
const contrast=(a,b)=>{const x=lums(a),y=lums(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
const lines=JSON.parse(fs.readFileSync(new URL("../data/lines.json",import.meta.url)));
for(const line of lines){
  const c=colorForLine(line.id);
  assert(/^#[0-9a-f]{6}$/i.test(c),"Color for "+line.id);
  assert(contrast(c,textForLine(line.id))>=4.5,"Text contrast for "+line.id);
}
assert.equal(new Set(Object.values(LINE_COLORS)).size,Object.keys(LINE_COLORS).length,"Distinct route colors");
assert.equal(colorForLine("1"),"#E4B42A","1 keeps official yellow");
assert.equal(colorForLine("3"),"#1B8047","3 keeps official green");
assert.equal(colorForLine("4"),"#246BC8","4 keeps official blue");
const f=fs.readFileSync(new URL("../assets/js/main.js",import.meta.url),"utf-8");
assert(f.includes("lineStyle(id)"),"Colored filters");
const map=fs.readFileSync(new URL("../assets/js/map.js",import.meta.url),"utf-8");
assert(map.includes("colorForLine(f.properties.line)"),"Colored map routes");
assert(map.includes("lineStyle(b.line)"),"Colored bus markers");
console.log("Line colors, contrast and matching bus/route/filter styling passed");
