import { state } from "./state.js";
export function departure(line, options = {}) {
  const entry=state.lines.find(x=>x.id===line);
  if(entry?.roadOnly) {
    return {
      label:"UNAVAILABLE",
      time:"Stop data unavailable",
      description:"This OSM road segment has no verified stops. No departure estimate can be made.",
      mode:"unavailable"
    };
  }
  const index = state.lines.findIndex((x) => x.id === line);
  const mode =
    state.departureMode === "mixed"
      ? ["live", "scheduled", "unavailable"][Math.max(index, 0) % 3]
      : state.departureMode;
  if (mode === "unavailable")
    return {
      label: "UNAVAILABLE",
      time: "Time unavailable",
      description:
        "No reliable departure estimate. Check the stop and compare another route.",
      mode,
    };
  if (mode === "scheduled")
    return {
      label: "SCHEDULED · DEMO",
      time: "12 min",
      description:
        "Illustrative timetable time; vehicle position is not used for this estimate.",
      mode,
    };
  const buses = (state.buses || []).filter(
    (bus) => bus.line === line && bus.position,
  );
  const origin = state.stops.find(
    (stop) => stop.properties.name === (options.origin || state.journey.from),
  );
  const reverse =
    options.reverse ??
    (state.selected?.id === line && !!state.selected.reverse);
  let seconds = 360;
  if (buses.length && origin) {
    const route = buses[0].route;
    let nearest = 0,
      best = Infinity;
    route.coordinates.forEach((point, index) => {
      const squared =
        (point[0] - origin.geometry.coordinates[0]) ** 2 +
        (point[1] - origin.geometry.coordinates[1]) ** 2;
      if (squared < best) {
        best = squared;
        nearest = index;
      }
    });
    const target = route.cumulative[nearest];
    seconds = Math.min(
      ...buses.map((bus) => {
        let meters;
        if (reverse) {
          meters =
            bus.direction === -1
              ? target <= bus.progress
                ? bus.progress - target
                : bus.progress + 2 * route.total - target
              : 2 * route.total - bus.progress - target;
        } else {
          meters =
            bus.direction === 1
              ? target >= bus.progress
                ? target - bus.progress
                : 2 * route.total - bus.progress + target
              : bus.progress + target;
        }
        return meters / 8 + Math.floor(meters / 400) * 12;
      }),
    );
  }
  return {
    label: "LIVE \u00b7 DEMO",
    time:
      seconds < 30 ? "Due now" : `${Math.max(1, Math.ceil(seconds / 60))} min`,
    description:
      "Estimate from simulated vehicle progress, not municipal tracking. Stop pauses and traffic are approximate.",
    mode,
  };
}
