import { read, write, defaults } from "./storage.js";
export const state = {
  prefs: read(),
  lines: [],
  stops: [],
  routes: [],
  journey: { from: "", to: "" },
  selected: null,
  departureMode: "mixed",
  view: "map",
};
export function persist() {
  return write(state.prefs);
}
export function reset() {
  state.prefs = defaults();
  persist();
}
export function esc(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
const scheme = matchMedia("(prefers-color-scheme:dark)");
export function applyTheme() {
  document.documentElement.dataset.reducedMotion = String(
    state.prefs.reducedMotion,
  );
  document.documentElement.dataset.theme =
    state.prefs.theme === "system"
      ? scheme.matches
        ? "dark"
        : "light"
      : state.prefs.theme;
}
scheme.addEventListener("change", applyTheme);
