const paths = {
  map: '<path d="m9 18-6 3V6l6-3 6 3 6-3v15l-6 3-6-3zM9 3v15M15 6v15"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="2.5"/>',
  plan: '<circle cx="6" cy="5" r="2"/><circle cx="18" cy="19" r="2"/><path d="M6 7v4c0 3 12-1 12 3v3"/>',
  ticket:
    '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M9 5v14M13 9h4M13 13h4"/>',
  bus: '<rect x="5" y="3" width="14" height="16" rx="3"/><path d="M5 11h14M8 19v2M16 19v2M8 15h1M15 15h1M9 6h6"/>',
  settings:
    '<path d="M12 2.7 14.2 3.4 15.4 5.6 17.8 5.9 19.4 7.6 19.1 10.0 20.8 12 19.1 14 19.4 16.4 17.8 18.1 15.4 18.4 14.2 20.6 12 21.3 9.8 20.6 8.6 18.4 6.2 18.1 4.6 16.4 4.9 14 3.2 12 4.9 10 4.6 7.6 6.2 5.9 8.6 5.6 9.8 3.4Z"/><circle cx="12" cy="12" r="3.1"/>',
  locate:
    '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  back: '<path d="m14 5-7 7 7 7"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  swap: '<path d="M8 3v18m-4-4 4 4 4-4M16 21V3m-4 4 4-4 4 4"/>',
  save: '<path d="M6 3h12v19l-6-4-6 4z"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 4 4L20 5"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
};
export const icon = (name) =>
  `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.pin}</svg>`;
