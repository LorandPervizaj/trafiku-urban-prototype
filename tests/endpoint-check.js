async(page)=>{
 await page.goto('http://127.0.0.1:8080/#map');await page.reload();await page.locator('.bus-marker').first().waitFor();
 const terminal=await page.evaluate(async()=>{const s=await import('/assets/js/state.js');return s.state.lines[0].to});
 await page.getByRole('button',{name:terminal,exact:true}).dispatchEvent('click');
 await page.locator('#sheet-departure').click();await page.getByRole('heading',{name:'Departure details'}).waitFor();
 const data=await page.evaluate(async()=>{const {state}=await import('/assets/js/state.js');return {journey:state.journey,selected:state.selected}});
 if(data.journey.from===data.journey.to||!data.selected.reverse)throw Error('Terminal should show the return journey');
 return {passed:1,journey:data.journey,reverse:data.selected.reverse};
}