async (page) => {
  const results = [];
  await page.emulateMedia({ reducedMotion: "reduce" });
  const check = (ok, name) => {
    if (!ok) throw Error(name);
    results.push(name);
  };
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:8080/");
  await page.evaluate(() => localStorage.removeItem("trafiku-urban-v1"));
  await page.reload();
  await page.locator(".bus-marker").first().waitFor();
  check(await page.locator("#map-screen").isVisible(), "Opens on map");
  check(
    (await page.locator("#navigation a").count()) === 3,
    "Exactly three tabs",
  );
  check(
    (await page.locator(".bus-marker").count()) === 9,
    "Nine simulated buses",
  );
  const before = await page
    .locator(".bus-marker")
    .first()
    .getAttribute("style");
  await page.waitForFunction(
    (v) => document.querySelector(".bus-marker").getAttribute("style") !== v,
    before,
  );
  check(true, "Bus positions change");
  await page.getByRole("button", { name: "None", exact: true }).click();
  check(
    (await page.locator(".bus-marker").count()) === 0,
    "None filter removes buses",
  );
  await page.getByRole("button", { name: "4", exact: true }).click();
  check(
    (await page.locator(".bus-marker").count()) === 3,
    "Line filter shows three buses",
  );
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page
    .getByRole("button", { name: "Collapse nearby departures" })
    .click();
  check(
    await page
      .locator("#stop-sheet")
      .evaluate((e) => e.classList.contains("collapsed")),
    "Sheet collapses",
  );
  await page.getByRole("button", { name: "Expand nearby departures" }).click();
  await page.locator(".bus-marker").first().dispatchEvent("click");
  check(
    (await page.locator("#sheet-content").textContent()).includes(
      "SIMULATED VEHICLE",
    ),
    "Bus selection opens details",
  );
  await page.locator(".stop-marker").first().dispatchEvent("click");
  check(
    (await page.locator("#sheet-content").textContent()).includes(
      "DEPARTURE BOARD",
    ),
    "Stop selection opens board",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "output/playwright/map-390.png" });
  await page.getByRole("link", { name: "Plan", exact: true }).click();
  await page.getByRole("heading", { name: "Plan your ride" }).waitFor();
  await page.screenshot({ path: "output/playwright/plan-390.png" });
  await page.getByRole("button", { name: "Find routes", exact: true }).click();
  await page.getByRole("heading", { name: "Your route options" }).waitFor();
  check(
    (await page.locator("[data-line]").count()) === 2,
    "Two routes for shared-stop journey",
  );
  await page.screenshot({ path: "output/playwright/routes-390.png" });
  await page.locator('[data-line="4"]').click();
  await page.getByRole("heading", { name: "Departure details" }).waitFor();
  check(
    (await page.locator("#page").textContent()).includes(
      "Boarding side is not verified",
    ),
    "Boarding limitations disclosed",
  );
  await page.screenshot({ path: "output/playwright/details-390.png" });
  await page.getByRole("button", { name: "Save journey", exact: true }).click();
  await page.getByRole("button", { name: "Save stop", exact: true }).click();
  await page.getByRole("link", { name: "Plan", exact: true }).click();
  await page.getByRole("button", { name: "See all" }).click();
  await page.getByRole("heading", { name: "Saved journeys" }).waitFor();
  check(
    (await page.locator("[data-saved]").count()) === 1,
    "Saved journey appears",
  );
  await page.screenshot({ path: "output/playwright/saved-390.png" });
  await page.reload();
  await page.locator("[data-saved]").waitFor();
  check(
    (await page.locator("[data-saved]").count()) === 1,
    "Saved journeys persist after reload",
  );
  await page.locator("[data-saved]").click();
  await page.getByRole("heading", { name: "Departure details" }).waitFor();
  await page.getByRole("link", { name: "Map", exact: true }).click();
  await page.getByRole("button", { name: "Open map settings" }).click();
  await page.locator("#theme").selectOption("dark");
  check(
    (await page.locator("html").getAttribute("data-theme")) === "dark",
    "Dark theme applies",
  );
  await page.getByRole("button", { name: "Close settings" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Open map settings" }).waitFor();
  check(
    (await page.locator("html").getAttribute("data-theme")) === "dark",
    "Theme persists",
  );
  await page.getByRole("button", { name: "Open map settings" }).click();
  await page.locator("summary").click();
  await page.locator("#departure-mode").selectOption("unavailable");
  await page.getByRole("button", { name: "Close settings" }).click();
  await page.getByRole("link", { name: "Plan", exact: true }).click();
  await page.locator("[data-saved]").click();
  await page.getByRole("heading", { name: "Departure details" }).waitFor();
  check(
    (await page.locator(".large-time").textContent()).trim() ===
      "Time unavailable",
    "Unavailable never fabricates countdown",
  );
  await page.screenshot({ path: "output/playwright/unavailable-dark-390.png" });
  await page.getByRole("link", { name: "Map", exact: true }).click();
  await page.getByRole("button", { name: "Open map settings" }).click();
  await page.locator("summary").click();
  await page.locator("#departure-mode").selectOption("scheduled");
  await page.getByRole("button", { name: "Close settings" }).click();
  await page.getByRole("link", { name: "Plan", exact: true }).click();
  await page.locator("[data-saved]").click();
  await page.getByRole("heading", { name: "Departure details" }).waitFor();
  check(
    (await page.locator("#page").textContent()).includes("SCHEDULED"),
    "Scheduled state renders",
  );
  await page.getByRole("link", { name: "Plan", exact: true }).click();
  await page.getByRole("button", { name: "See all" }).click();
  await page.locator("[data-delete]").click();
  check(
    (await page.locator("[data-saved]").count()) === 0,
    "Delete saved journey works",
  );
  await page.getByRole("button", { name: "Plan another" }).click();
  await page
    .getByRole("combobox", { name: "TO", exact: true })
    .fill("RIT Kosovo");
  await page.getByRole("button", { name: "Find routes", exact: true }).click();
  await page.getByRole("heading", { name: "No direct route found" }).waitFor();
  check(true, "Unknown destination has helpful empty state");
  await page.getByRole("link", { name: "Ticket", exact: true }).click();
  await page.getByRole("heading", { name: "Tickets", exact: true }).waitFor();
  const wallet = page.getByRole("link", { name: "Open Kuleta Digjitale" });
  check(
    (await wallet.getAttribute("href")) === "https://kd.pbc.group/index",
    "Official wallet URL and external link",
  );
  check(
    (await wallet.getAttribute("rel")).includes("noopener"),
    "Wallet security attributes",
  );
  await page.screenshot({ path: "output/playwright/ticket-dark-390.png" });
  await page.context().setOffline(true);
  await page.getByRole("link", { name: "Plan", exact: true }).click();
  await page.getByRole("heading", { name: "Plan your ride" }).waitFor();
  check(
    await page.locator("#connection").isVisible(),
    "Offline status and planning work",
  );
  await page.context().setOffline(false);
  await page.getByRole("link", { name: "Map", exact: true }).click();
  await page.getByRole("button", { name: "Open map settings" }).click();
  await page
    .getByRole("button", { name: "Reset preferences", exact: true })
    .click();
  check(
    (await page.locator("html").getAttribute("data-theme")) !== "dark",
    "Reset preferences applies default system theme",
  );
  for (const width of [360, 375, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const view of ["map", "plan", "ticket"]) {
      await page
        .getByRole("link", {
          name: view[0].toUpperCase() + view.slice(1),
          exact: true,
        })
        .click();
      await page.waitForFunction(
        (v) =>
          v === "map"
            ? !document.querySelector("#map-screen").hidden
            : !document.querySelector("#page").hidden &&
              location.hash === "#" + v,
        view,
      );
      check(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${width}px ${view} fits viewport`,
      );
    }
  }
  await page.getByRole("link", { name: "Ticket", exact: true }).click();
  await page.screenshot({ path: "output/playwright/ticket-390.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("link", { name: "Map", exact: true }).click();
  await page.screenshot({ path: "output/playwright/map-desktop.png" });
  check(errors.length === 0, "No uncaught JavaScript errors");
  return { passed: results.length, results, errors };
}
