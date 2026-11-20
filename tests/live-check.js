async (page) => {
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.setViewportSize({width:390,height:844});
  const response=await page.goto("https://lorandpervizaj.github.io/trafiku-urban-prototype/");
  if(response.status()!==200)throw Error("Live page not HTTP 200");
  await page.locator(".bus-marker").first().waitFor();
  const snapshot=await page.evaluate(async()=>{
    const {state}=await import("./assets/js/state.js");
    return {lines:state.lines.map(l=>l.id),buses:state.buses.length};
  });
  if(snapshot.lines.length<9||snapshot.buses<40)throw Error("Live fleet/lines incomplete: "+JSON.stringify(snapshot));
  if(!(await page.locator("#stop-sheet").isHidden()))throw Error("Map should have no default bottom card");
  await page.locator('[data-lang="sq"]').click();
  if(!await page.getByRole("link",{name:"Harta",exact:true}).isVisible())throw Error("Albanian did not apply");
  await page.getByRole("link",{name:"Bileta",exact:true}).click();
  if(!(await page.locator("#page").innerText()).includes("€6.00"))throw Error("Airport fare missing");
  await page.getByRole("link",{name:"Harta",exact:true}).click();
  await page.locator('[data-lang="en"]').click();
  await page.locator('[data-filter="all"]').click();
  if(await page.locator(".bus-marker").count())throw Error("All did not clear the map");
  await page.locator('[data-filter="all"]').click();
  if(await page.locator(".bus-marker").count()!==snapshot.buses)throw Error("All did not restore buses");
  if(errors.length)throw Error(errors.join("; "));
  return {status:200,...snapshot,errors};
};
