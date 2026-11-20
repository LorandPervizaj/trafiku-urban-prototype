// Clear filter behavior: choosing a line from "all" focuses that line,
// then additional taps allow multi-line comparisons.
export function nextLineSelection(allLines,current,clicked) {
  const available=[...new Set(allLines||[])];
  const active=new Set((current||[]).filter(id=>available.includes(id)));
  if(clicked==="all") {
    return active.size===available.length ? [] : available;
  }
  if(!available.includes(clicked))return [...active];
  // From all routes, selecting a chip should focus it, not turn it off.
  if(active.size===available.length)return [clicked];
  if(active.has(clicked))active.delete(clicked);
  else active.add(clicked);
  return available.filter(id=>active.has(id));
}
