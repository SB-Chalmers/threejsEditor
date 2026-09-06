const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import fs from 'node:fs';
import assert from 'node:assert/strict';
const out=new URL('.',import.meta.url).pathname;fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
const errors=[],warnings=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text())});
const check=(label)=>{checks.push(label);console.log('PASS',label)};
const click=(name)=>page.getByRole('button',{name,exact:true}).click();
const snapshot=async()=>{const download=page.waitForEvent('download');await click('Export');const file=await download;return JSON.parse(fs.readFileSync(await file.path(),'utf8')).buildings};
const handles=()=>page.locator('.editor-handle');
const centers=async()=>handles().evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}}));
const drag=async(a,b,cancel)=>{await page.mouse.move(a.x,a.y);await page.mouse.down();await page.keyboard.down('Alt');await page.mouse.move(b.x,b.y,{steps:8});if(cancel==='Escape')await page.keyboard.press('Escape');if(cancel==='blur')await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.mouse.up();await page.keyboard.up('Alt');await page.waitForTimeout(100)};
try {
 await page.goto('http://127.0.0.1:5173/');
 await page.waitForFunction(()=>{const b=document.querySelector('[aria-label="Draw building"]');return b&&!b.disabled});
 await page.waitForTimeout(1600);
 await page.evaluate(async()=>{const {RendererManager}=await import('/src/core/RendererManager.ts');const render=RendererManager.prototype.render;RendererManager.prototype.render=function(scene,camera){window.editorAudit={scene,camera,renderer:this};if(window.auditDisableAO)this.getComposer()?.passes.forEach(p=>{if(p.params&&'saoIntensity'in p.params)p.enabled=false});return render.call(this,scene,camera)}});
 await page.waitForFunction(()=>!!window.editorAudit);
 const initialCamera=await page.evaluate(()=>window.editorAudit.camera.position.toArray());
 const baseline=await snapshot();assert.equal(baseline.length,1);
 await page.screenshot({path:out+'baseline.png'});
 await page.evaluate(()=>window.auditDisableAO=true);
 await click('Draw footprint');await click('Rectangle');await page.waitForTimeout(600);
 await page.mouse.click(360,320);await page.mouse.move(530,485);await page.mouse.click(530,485);await page.waitForTimeout(150);
 assert.equal(await handles().count(),4);assert.equal(await page.locator('[data-testid="building-edit-backdrop"]').count(),0);
 const created=await snapshot();assert.equal(created.length,2);const id=created[1].id;
 check('Rectangle creation flows directly into nonmodal reshaping');
 let h=await centers();await drag(h[0],{x:h[0].x-28,y:h[0].y-18});
 const moved=await snapshot();assert.notDeepEqual(moved[1].points,created[1].points);
 await click('Undo');assert.deepEqual((await snapshot())[1].points,created[1].points);
 await click('Redo');assert.deepEqual((await snapshot())[1].points,moved[1].points);
 check('One drag, one undoable command; Redo restores final geometry');
 await click('Reshape');await page.waitForTimeout(500);h=await centers();
 const edge={x:h[0].x*.65+h[1].x*.35,y:h[0].y*.65+h[1].y*.35};await page.mouse.move(edge.x,edge.y);await page.getByRole('button',{name:'Insert point on edge'}).waitFor();
 await page.mouse.down();await page.mouse.move(edge.x-10,edge.y+12,{steps:4});await page.mouse.up();await page.waitForTimeout(100);assert.equal(await handles().count(),5);
 check('Insert and drag a vertex at an arbitrary edge position');
 await page.getByLabel('Point X (m)').fill('-24');await page.getByLabel('Point X (m)').press('Enter');
 assert.equal((await snapshot())[1].points.some(p=>Math.abs(p.x+24)<1e-7),true);
 await page.getByRole('button',{name:'Remove point',exact:true}).click();assert.equal(await handles().count(),4);
 check('Exact point fields and point removal');
 const valid=await snapshot();h=await centers();await drag(h[0],h[2]);assert.deepEqual((await snapshot())[1].points,valid[1].points);
 assert.match(await page.locator('.editor-status').innerText(),/reverted/);check('Invalid duplicate/crossing drag rolls back the whole gesture');
 for(const abort of ['Escape','blur']){h=await centers();await drag(h[0],{x:h[0].x-30,y:h[0].y-15},abort);assert.deepEqual((await snapshot())[1].points,valid[1].points)}
 check('Escape and window blur restore geometry in the live browser');
 await click('Rotate');await page.getByLabel('Rotate by (°)').fill('37');await page.getByLabel('Rotate by (°)').press('Enter');
 const rotated=await snapshot();const area=ps=>Math.abs(ps.reduce((a,p,i)=>{let q=ps[(i+1)%ps.length];return a+p.x*q.z-q.x*p.z},0))/2;
 assert.ok(Math.abs(area(rotated[1].points)-area(valid[1].points))<1e-7);assert.equal(rotated[1].floors,valid[1].floors);assert.equal(rotated[1].id,id);assert.deepEqual(rotated[0],baseline[0]);
 await page.screenshot({path:out+'rotate-ao-disabled-diagnostic.png'});check('Centroid rotation preserves area, properties, IDs and the second building');
 await click('Move');const box=await page.getByRole('button',{name:'Move building',exact:true}).boundingBox();await drag({x:box.x+12,y:box.y+12},{x:box.x+65,y:box.y+30});
 const translated=await snapshot();assert.notDeepEqual(translated[1].points,rotated[1].points);await click('Undo');assert.deepEqual((await snapshot())[1].points,rotated[1].points);check('Move gesture and Undo');
 await click('3D');await page.waitForTimeout(650);const restoredCamera=await page.evaluate(()=>window.editorAudit.camera.position.toArray());
 assert.ok(restoredCamera.every((v,i)=>Math.abs(v-initialCamera[i])<.01));check('3D restores the previous camera');
 await page.mouse.move(850,350);await page.mouse.down({button:'right'});await page.mouse.move(950,400,{steps:8});await page.mouse.up({button:'right'});await page.waitForTimeout(250);
 const orbit=await page.evaluate(()=>window.editorAudit.camera.position.toArray());assert.notDeepEqual(orbit,restoredCamera);check('Right-drag orbits after geometry gestures');
 await click('Select tool');await page.locator('body').click({position:{x:1100,y:120}}); // clear if empty
 // Re-select through Undo/Redo so the test stays independent of a changed camera projection.
 await click('Undo');await click('Redo');
 await click('Delete selection');assert.equal((await snapshot()).length,1);await click('Undo');assert.equal((await snapshot()).length,2);check('Scoped building deletion and restoration');
 await click('Draw building');await click('Polygon');await page.waitForTimeout(500);
 for(const [x,y]of [[350,310],[530,310],[530,480]])await page.mouse.click(x,y);
 await page.mouse.move(400,490);await page.waitForTimeout(50);assert.equal(await page.locator('.editor-cursor').count(),1);
 // Force repeated React rerenders while the latest pointer keeps moving.
 for(let i=0;i<5;i++){await page.getByLabel('Grid snap increment').selectOption(i%2?'1':'0.5');await page.mouse.move(390+i*10,500+i*2)}
 assert.equal(await page.locator('.editor-cursor').count(),1);await page.screenshot({path:out+'polygon-preview.png'});
 await page.keyboard.press('Enter');assert.equal((await snapshot()).length,3);check('Rapid polygon clicks, live preview across rerenders, and Enter completion');
 await page.evaluate(()=>window.auditDisableAO=true);await page.waitForTimeout(150);await page.screenshot({path:out+'reshape-ao-disabled-diagnostic.png'});
 const layouts=[];
 for(const [width,height]of [[1024,768],[768,700],[640,700]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(250);
  const layout=await page.evaluate(()=>{const selectors=['.model-tool-rail','.editor-command-bar','.editor-view-switch','.model-status-bar','.editor-inspector','.editor-status'];const boxes=selectors.map(s=>{const e=document.querySelector(s),r=e?.getBoundingClientRect();return{s,r:r?{x:r.x,y:r.y,w:r.width,h:r.height}:null}});const overlaps=[];for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){let a=boxes[i],b=boxes[j];if(!a.r||!b.r)continue;const area=Math.max(0,Math.min(a.r.x+a.r.w,b.r.x+b.r.w)-Math.max(a.r.x,b.r.x))*Math.max(0,Math.min(a.r.y+a.r.h,b.r.y+b.r.h)-Math.max(a.r.y,b.r.y));if(area>1)overlaps.push([a.s,b.s,area])}const obscuredHandles=[...document.querySelectorAll('.editor-handle')].filter(el=>{const r=el.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit!==el&&!el.contains(hit)}).length;return{boxes,overlaps,obscuredHandles,overflow:document.documentElement.scrollWidth>innerWidth}});
  layouts.push({width,height,...layout});await page.screenshot({path:out+`responsive-${width}.png`});
 }
 const webgl=await page.evaluate(()=>{const a=window.editorAudit,r=a.renderer.getRenderer?.()??a.renderer.renderer,gl=r.getContext();const pixels=new Uint8Array(4),colors=[];r.render(a.scene,a.camera);for(const [x,y]of [[.1,.1],[.3,.3],[.5,.5],[.7,.6],[.8,.8]]){gl.readPixels(Math.floor(gl.drawingBufferWidth*x),Math.floor(gl.drawingBufferHeight*y),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixels);colors.push([...pixels])}return{colors,unique:new Set(colors.map(c=>c.join(','))).size,canvas:{width:gl.drawingBufferWidth,height:gl.drawingBufferHeight}}});
 fs.writeFileSync(out+'verification.json',JSON.stringify({checks,errors,warnings,initialCamera,restoredCamera,layouts,webgl},null,2));
 console.log('LAYOUTS',JSON.stringify(layouts));console.log('ERRORS',JSON.stringify(errors));
 assert.equal(errors.length,0);assert.ok(layouts.every(l=>!l.overflow&&l.overlaps.length===0));assert.ok(webgl.unique>1);check('Responsive layouts, nonblank WebGL and clean console');
} catch(error){await page.screenshot({path:out+'failure.png'});fs.writeFileSync(out+'failure.json',JSON.stringify({checks,errors,warnings,error:String(error)},null,2));throw error} finally{await browser.close()}
