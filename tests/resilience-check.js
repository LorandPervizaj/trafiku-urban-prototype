async (page) => {
  const results = [];
  const check = (ok, name) => {
    if (!ok) throw Error(name);
    results.push(name);
  };
  await page.goto("http://127.0.0.1:8080/#map");
  await page.locator(".bus-marker").first().waitFor();
  await page.getByRole("button", { name: "Open map settings" }).click();
  await page.locator("#theme").selectOption("system");
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "dark",
  );
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "light",
  );
  check(true, "System theme follows OS changes");
  await page.getByRole("button", { name: "Close settings" }).click();
  await page.getByRole("link", { name: "Plan", exact: true }).click();
  await page.getByRole("button", { name: "Find routes", exact: true }).click();
  await page.getByRole("heading", { name: "Your route options" }).waitFor();
  await page.goBack();
  await page.getByRole("heading", { name: "Plan your ride" }).waitFor();
  check(true, "Native browser Back restores Plan");
  const oldFrom = await page
    .getByRole("combobox", { name: "FROM", exact: true })
    .inputValue();
  const oldTo = await page
    .getByRole("combobox", { name: "TO", exact: true })
    .inputValue();
  await page.getByRole("button", { name: "Reverse journey" }).click();
  check(
    (await page
      .getByRole("combobox", { name: "FROM", exact: true })
      .inputValue()) === oldTo,
    "Reverse origin",
  );
  check(
    (await page
      .getByRole("combobox", { name: "TO", exact: true })
      .inputValue()) === oldFrom,
    "Reverse destination",
  );
  await page.route("https://tile.openstreetmap.org/**", (r) => r.abort());
  await page.reload();
  await page.getByRole("heading", { name: "Plan your ride" }).waitFor();
  await page.getByRole("link", { name: "Map", exact: true }).click();
  await page.locator("#map-warning").waitFor();
  check(true, "Tile failure warns without crashing");
  await page.getByRole("link", { name: "Ticket", exact: true }).click();
  await page.getByRole("heading", { name: "Tickets", exact: true }).waitFor();
  check(true, "Ticket survives tile failure");
  await page.unroute("https://tile.openstreetmap.org/**");
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Blocked for test", "SecurityError");
      },
    });
  });
  await page.reload();
  await page.getByRole("heading", { name: "Tickets", exact: true }).waitFor();
  await page.getByRole("link", { name: "Plan", exact: true }).click();
  await page.getByRole("button", { name: "Find routes", exact: true }).click();
  await page.locator('[data-line="4"]').click();
  await page.getByRole("button", { name: "Save journey", exact: true }).click();
  await page.getByRole("link", { name: "Plan", exact: true }).click();
  check(
    (await page.locator("[data-saved]").count()) === 1,
    "Blocked storage keeps session saved journey",
  );
  await page.getByRole("link", { name: "Map", exact: true }).click();
  const metrics = await page.evaluate(async () => {
    const samples = [];
    let last = performance.now();
    for (let i = 0; i < 120; i++)
      await new Promise((resolve) =>
        requestAnimationFrame((t) => {
          samples.push(t - last);
          last = t;
          resolve();
        }),
      );
    const p = performance.getEntriesByType("navigation")[0];
    return {
      domContentLoadedMs: Math.round(p.domContentLoadedEventEnd),
      medianFrameMs: samples.sort((a, b) => a - b)[60],
      maxFrameMs: Math.max(...samples),
      resources: performance.getEntriesByType("resource").length,
    };
  });
  return { passed: results.length, results, metrics };
}
