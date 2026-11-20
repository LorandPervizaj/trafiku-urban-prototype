// Stable TRIP route colors. Lines 1 (yellow), 3 (green) and 4 (blue)
// follow Trafiku Urban's published E-Bus color convention.
// All other values are TRIP prototype choices, not official line colors.
export const LINE_COLORS = Object.freeze({
  "1": "#E4B42A",
  "1A": "#D87C25",
  "2": "#B44F3D",
  "3A": "#1B7463",
  "6": "#246780",
  "6A": "#295C99",
  "7": "#653F9F",
  "7A": "#A23E70",
  "7B": "#843B5E",
  "8": "#68742D",
  "10": "#4C5B9B",
  "10C": "#87502C",
  "3": "#1B8047",
  "3B": "#08777B",
  "3C": "#7254B4",
  "4": "#246BC8",
  "7C": "#B83B8B",
  "15": "#96602D",
  "19": "#B23D46",
});
export function colorForLine(id) {
  return LINE_COLORS[String(id)] || "#4D697F";
}
export function textForLine(id) {
  return ["1","1A"].includes(String(id)) ? "#151919" : "#FFFFFF";
}
export function lineStyle(id) {
  return `--line-color:${colorForLine(id)};--line-text:${textForLine(id)}`;
}
