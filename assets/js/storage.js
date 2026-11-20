export const defaults = () => ({
  version: 1,
  theme: "system",
  language: "en",
  allLines: true,
  lines: ["4", "3", "1"],
  showStops: true,
  showRoutes: true,
  saved: [],
  favorites: [],
  position: null,
  reducedMotion: false,
});
export let storageAvailable = true;
export function read() {
  try {
    const x = JSON.parse(localStorage.getItem("trafiku-urban-v1"));
    if (!x || x.version !== 1) return defaults();
    const d = defaults();
    return {
      ...d,
      theme: ["light", "dark", "system"].includes(x.theme) ? x.theme : d.theme,
      language: ["en","sq"].includes(x.language) ? x.language : "en",
      allLines: typeof x.allLines === "boolean" ? x.allLines :
        (Array.isArray(x.lines) && ([3,7].includes(x.lines.length)) &&
         ["1","3","4"].every(id => x.lines.includes(id)) && x.lines.length !== 0),
      lines: Array.isArray(x.lines)
        ? x.lines.filter((v) => typeof v === "string" && /^[0-9]{1,2}[A-Z]?$/.test(v)).slice(0, 30)
        : d.lines,
      showStops: typeof x.showStops === "boolean" ? x.showStops : true,
      showRoutes: typeof x.showRoutes === "boolean" ? x.showRoutes : true,
      saved: Array.isArray(x.saved)
        ? x.saved
            .filter(
              (s) =>
                s &&
                typeof s.from === "string" &&
                typeof s.to === "string" &&
                typeof s.line === "string",
            )
            .slice(0, 50)
        : [],
      favorites: Array.isArray(x.favorites)
        ? x.favorites.filter((v) => typeof v === "string")
        : [],
      position:
        Array.isArray(x.position) &&
        x.position.length === 3 &&
        x.position.every(Number.isFinite)
          ? x.position
          : null,
      reducedMotion: !!x.reducedMotion,
    };
  } catch {
    storageAvailable = false;
    return defaults();
  }
}
export function write(value) {
  try {
    localStorage.setItem("trafiku-urban-v1", JSON.stringify(value));
    return true;
  } catch {
    storageAvailable = false;
    return false;
  }
}
