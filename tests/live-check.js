async(page)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:390,height:844});
 const response=await page.goto('https://lorandpervizaj.github.io/trafiku-urban-prototype/');
 if(response.status()!==200)throw Error('Live page did not return 200');
 await page.locator('.bus-marker').first().waitFor();
 if(await page.locator('.bus-marker').count()!==9)throw Error('Live buses missing');
 await page.screenshot({path:'output/playwright/live-map-390.png'});
 await page.getByRole('link',{name:'Plan',exact:true}).click();await page.getByRole('button',{name:'Find routes',exact:true}).click();await page.locator('[data-line="4"]').click();
 await page.getByRole('heading',{name:'Departure details'}).waitFor();
 await page.getByRole('button',{name:'Save journey',exact:true}).click();
 await page.reload();await page.getByRole('link',{name:'Plan',exact:true}).click();
 if(await page.locator('[data-saved]').count()!==1)throw Error('Live persistence failed');
 await page.getByRole('link',{name:'Ticket',exact:true}).click();
 const popupPromise=page.waitForEvent('popup');await page.getByRole('link',{name:'Open Kuleta Digjitale'}).click();const popup=await popupPromise;
 await popup.waitForLoadState('domcontentloaded');
 if(!popup.url().startsWith('https://kd.pbc.group/'))throw Error('Wrong wallet handoff');
 const walletURL=popup.url();await popup.close();
 await page.getByRole('link',{name:'Map',exact:true}).click();
 const terminal=await page.evaluate(async()=>{const {state}=await import('./assets/js/state.js');return state.lines[0].to});
 await page.getByRole('button',{name:terminal,exact:true}).dispatchEvent('click');await page.locator('#sheet-departure').click();await page.getByRole('heading',{name:'Departure details'}).waitFor();
 const endpoint=await page.evaluate(async()=>{const{state}=await import('./assets/js/state.js');return {journey:state.journey,reverse:state.selected.reverse}});
 if(endpoint.journey.from===endpoint.journey.to||!endpoint.reverse)throw Error('Live terminal return direction failed');
 await page.getByRole('link',{name:'Map',exact:true}).click();
 if(errors.length)throw Error(errors.join(';'));
 return {status:response.status(),url:page.url(),buses:9,planning:true,persistence:true,walletURL,endpoint,errors};
}