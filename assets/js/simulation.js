const R = 6371000;
export function distance(a, b) {
  const rad = Math.PI / 180,
    dy = (b[1] - a[1]) * rad,
    dx = (b[0] - a[0]) * rad;
  return (
    2 *
    R *
    Math.asin(
      Math.sqrt(
        Math.sin(dy / 2) ** 2 +
          Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dx / 2) ** 2,
      ),
    )
  );
}
export function prepare(coordinates) {
  let total = 0;
  const cumulative = [0];
  for (let i = 1; i < coordinates.length; i++) {
    total += distance(coordinates[i - 1], coordinates[i]);
    cumulative.push(total);
  }
  return { coordinates, cumulative, total };
}
export function interpolate(route, progress) {
  const d = Math.max(0, Math.min(route.total, progress));
  let lo = 1,
    hi = route.cumulative.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (route.cumulative[mid] < d) lo = mid + 1;
    else hi = mid;
  }
  const i = lo,
    a = route.coordinates[i - 1],
    b = route.coordinates[i],
    length = route.cumulative[i] - route.cumulative[i - 1],
    t = length ? (d - route.cumulative[i - 1]) / length : 0;
  return {
    coordinate: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
    heading: (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI,
  };
} // Each segment uses easing at stops, a fixed dwell, and elapsed wall-clock time.
export function createSimulation(features, update) {
  let epoch = performance.now(),
    frame = 0;
  const buses = features.flatMap((f) =>
    [0, 1, 2].map((n) => {
      const route = prepare(f.geometry.coordinates);
      const stops = (
        f.properties.stopDistances || [
          0,
          route.total / 3,
          (route.total * 2) / 3,
          route.total,
        ]
      ).filter((d, i, a) => i === 0 || d > a[i - 1] + 1);
      if (stops.at(-1) < route.total) stops.push(route.total);
      const legs = stops
        .slice(1)
        .map((end, i) => ({
          start: stops[i],
          end,
          duration: (end - stops[i]) / 8,
          dwell: 12,
        }));
      return {
        id: `${f.properties.line}-${n + 1}`,
        line: f.properties.line,
        route,
        legs,
        reversedLegs: [...legs].reverse(),
        oneWay: legs.reduce((sum, leg) => sum + leg.duration + leg.dwell, 0),
        offset: n * 230,
        speed: 8,
        direction: 1,
        movementState: "moving",
        nextStop: 1,
        eta: 0,
      };
    }),
  );
  function tick(now) {
    const elapsed = (now - epoch) / 1000;
    for (const b of buses) {
      const oneWay = b.oneWay;
      let t = (elapsed + b.offset) % (oneWay * 2);
      const reverse = t >= oneWay;
      b.direction = reverse ? -1 : 1;
      if (reverse) t -= oneWay;
      const legs = reverse ? b.reversedLegs : b.legs;
      let progress = 0;
      for (let i = 0; i < legs.length; i++) {
        const l = legs[i];
        if (t <= l.duration + l.dwell) {
          const fraction = Math.min(t / l.duration, 1);
          const ease =
            fraction < 0.1
              ? 5 * fraction * fraction
              : fraction > 0.9
                ? 0.9 - 5 * (1 - fraction) ** 2
                : fraction - 0.05;
          const normalized = Math.max(0, Math.min(1, ease / 0.9));
          progress = reverse
            ? l.end - (l.end - l.start) * normalized
            : l.start + (l.end - l.start) * normalized;
          b.movementState = t >= l.duration ? "boarding" : "moving";
          b.nextStop = reverse ? b.legs.length - i - 1 : i + 1;
          b.eta = Math.max(0, l.duration - t);
          break;
        }
        t -= l.duration + l.dwell;
      }
      b.progress = progress;
      const p = interpolate(b.route, progress);
      b.position = p.coordinate;
      const heading = p.heading + (reverse ? 180 : 0);
      if (b.heading === undefined) b.heading = heading;
      else {
        const turn = ((heading - b.heading + 540) % 360) - 180;
        b.heading += Math.max(-9, Math.min(9, turn));
      }
      update(b);
    }
    if (!document.hidden) frame = requestAnimationFrame(tick);
  }
  function visibility() {
    cancelAnimationFrame(frame);
    if (!document.hidden) frame = requestAnimationFrame(tick);
  }
  document.addEventListener("visibilitychange", visibility);
  frame = requestAnimationFrame(tick);
  return {
    buses,
    reset() {
      epoch = performance.now();
    },
    stop() {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", visibility);
    },
  };
}
