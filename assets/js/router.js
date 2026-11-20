const allowed = ["map", "plan", "routes", "details", "saved", "ticket"];
export function navigate(view) {
  if (location.hash !== `#${view}`) location.hash = view;
  else window.dispatchEvent(new HashChangeEvent("hashchange"));
}
export function startRouter(render) {
  const route = () => {
    const view = location.hash.slice(1);
    render(allowed.includes(view) ? view : "map");
  };
  window.addEventListener("hashchange", route);
  route();
}
