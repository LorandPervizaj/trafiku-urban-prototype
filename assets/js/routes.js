import { state } from "./state.js";
import { distance } from "./simulation.js";
export function findStop(name) {
  return state.stops.find(
    (s) =>
      s.properties.name.toLowerCase() === String(name).trim().toLowerCase(),
  );
}
export function findRoutes(from, to) {
  const a = findStop(from),
    b = findStop(to);
  if (!a || !b || a === b) return [];
  return state.lines
    .filter(
      (l) =>
        a.properties.lines.includes(l.id) && b.properties.lines.includes(l.id),
    )
    .map((l) => {
      const route = state.routes.find((r) => r.properties.line === l.id);
      const near = (s) => {
        let best = Infinity,
          index = 0;
        route.geometry.coordinates.forEach((c, i) => {
          const d = distance(c, s.geometry.coordinates);
          if (d < best) {
            best = d;
            index = i;
          }
        });
        return index;
      };
      const reverse = near(a) > near(b);
      return {
        ...l,
        reverse,
        direction: reverse ? l.from : l.to,
        from: a.properties.id,
        to: b.properties.id,
      };
    });
}
