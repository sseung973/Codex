'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('/opt/codex/cua_node/lib/node_modules/playwright');
const {createApp}=require('../server/index.cjs'),{chooseAthlete}=require('./browser-fixture.cjs');
const snap=p=>p.evaluate(()=>{const s=shuttleRush.snapshot;return {state:s.state,rally:s.rally,lastHit:s.lastHit,score:s.score,pending:s.pending,input:s.inputState,shot:s.lastShot,contact:s.contact,ball:s.ball,seat:s.online.seat,rtt:s.online.rtt};});
(async()=>{
 const local=process.env.LIVE_ORIGIN?null:createApp();if(local)await new Promise(r=>local.server.listen(0,'127.0.0.1',r));const base=process.env.LIVE_ORIGIN||'http://127.0.0.1:'+local.server.address().port;
 const errors=[],results=[],allContexts=[],browsers=[];
 async function player(i,{width=390,height=844,touch=true}={}){const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});browsers.push(browser);const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch,ignoreHTTPSErrors:!!process.env.LIVE_ORIGIN});allContexts.push(context);const page=await context.newPage();page.qaBrowser=browser;page.on('pageerror',e=>errors.push(e.message));page.acks=[];page.on('websocket',ws=>ws.on('framereceived',({payload})=>{try{const q=JSON.parse(payload);if(q.type==='input')page.acks.push(q);}catch{}}));await page.goto(base,{waitUntil:'networkidle',timeout:120000});await page.locator('#title-enter').click();await chooseAthlete(page,['jun','nara','eden','haru'][i%4]);await page.locator('#lobby-friends-tab').click();await page.locator('#room-name').fill('Return QA '+i);return page;}
 async function room(group,doubles=false){const host=group[0];if(doubles)await host.locator('[name=room-type][value=doubles]').check();await host.locator('#room-create').click();await host.waitForFunction(()=>shuttleRush.snapshot.online.room);const code=await host.locator('#room-number').innerText();for(const p of group.slice(1)){await p.locator('#room-code-input').fill(code);await p.locator('#room-join').click();await p.waitForFunction(()=>shuttleRush.snapshot.online.room);}for(const p of group)await p.locator('#room-ready').click();await host.locator('#room-start').click();for(const p of group)await p.waitForFunction(()=>shuttleRush.snapshot.online.active);}
 async function finger(p){const cd=await p.context().newCDPSession(p),r=await p.locator('#court').boundingBox(),x=r.x+r.width*.6,y=r.y+r.height*.58;let down=false;return {async swing({held=false,delay=45}={}){if(!down){await cd.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});down=true;}await cd.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+55}]});await p.waitForTimeout(delay);await cd.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+5}]});if(!held){await cd.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});down=false;}},async end(){if(down)await cd.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cd.detach();}};}
 async function hit(p,n){await p.waitForFunction(n=>{const s=shuttleRush.snapshot;if(s.state==='point'||s.state==='over')return true;return s.rally>=n;},n,{timeout:14000});const s=await snap(p);assert.ok(s.rally>=n,JSON.stringify(s));return s;}
 async function ready(p){await p.waitForFunction(()=>{const s=shuttleRush.snapshot;return s.state==='rally'&&s.lastHit===1&&s.contact&&s.contact.t<.48;},null,{timeout:12000});}
 try{
  for(const spec of [{shot:'drive',held:false,width:390,height:844},{shot:'drop',held:true,width:390,height:844},{shot:'drop',held:false,width:834,height:1194},{shot:'clear',held:false,width:1280,height:900,touch:false}]){
   const a=await player(0,spec),b=await player(1,{touch:!spec.held});await room([a,b]);await a.locator('[data-shot='+spec.shot+']').click();const fa=spec.touch===false?null:await finger(a),fb=spec.held?null:await finger(b);
   if(fa)await fa.swing({held:spec.held});else await a.keyboard.press('Space');await hit(b,1);const pointer=spec.held?(await snap(a)).input.pointerId:null;
   await ready(b);if(fb)await fb.swing();else await b.keyboard.press('Space');await hit(a,2);await ready(a);const before=await snap(a);if(spec.held){assert.equal(before.input.pointerId,pointer);assert.equal(before.input.fired,false);}if(fa)await fa.swing({held:spec.held,delay:180});else await a.keyboard.press('Space');const after=await hit(a,3);assert.equal(after.lastHit,0);assert.equal(after.shot.type,spec.shot);assert.deepEqual(after.score,[0,0]);assert.ok(a.acks.some(q=>q.accepted));assert.ok(!a.acks.some(q=>q.accepted===false),JSON.stringify(a.acks));if(spec.held)assert.equal((await snap(a)).input.pointerId,pointer);await b.locator('[data-shot=clear]').click();await ready(b);if(fb)await fb.swing();else await b.keyboard.press('Space');await hit(a,4);await a.locator('[data-shot=clear]').click();await ready(a);if(fa)await fa.swing({held:spec.held});else await a.keyboard.press('Space');const fifth=await hit(a,5);assert.deepEqual(fifth.score,[0,0]);results.push({mode:'singles',...spec,rally:fifth.rally,firstCounter:after.shot.type,kind:after.shot.kind,contactHeight:after.shot.origin.y,rtt:after.rtt});await a.screenshot({path:'/workspace/shared/downloads/shuttle-return-'+spec.shot+'-'+spec.width+'-'+spec.held+'.png'});await fa?.end();await fb?.end();await a.context().close();await a.qaBrowser.close();await b.context().close();await b.qaBrowser.close();
  }
  {
   const a=await player(0),b=await player(1,{touch:false});await room([a,b]);await a.locator('[data-shot=smash]').click();const f=await finger(a);await f.swing();await hit(b,1);await ready(b);await b.keyboard.press('Space');await hit(a,2);await f.swing({held:true,delay:15});await a.waitForFunction(()=>document.getElementById('status').textContent.includes('낮은 공'));assert.ok(a.acks.some(q=>!q.accepted&&q.reason==='height'));const rejected=await snap(a);assert.equal(rejected.pending,null);assert.equal(rejected.input.fired,false);assert.equal(rejected.rally,2);results.push({mode:'singles',rejected:'low smash',reason:'height',noFalseAcceptance:true});await a.screenshot({path:'/workspace/shared/downloads/shuttle-low-smash-feedback.png'});await f.end();await a.context().close();await a.qaBrowser.close();await b.context().close();await b.qaBrowser.close();
  }
  const group=[];
  for(let i=0;i<4;i++)group.push(await player(i,{touch:i===0||i===2}));
  await room(group,true);
  const server=group[0],receiver=group[2];
  await server.locator('[data-shot=drop]').click();
  const serverFinger=await finger(server),receiverFinger=await finger(receiver);
  await serverFinger.swing();
  await hit(receiver,1);
  await ready(receiver);
  await receiverFinger.swing();
  await hit(server,2);
  await Promise.all([
   receiver.locator('[data-shot=clear]').click(),
   (async()=>{await ready(server);await serverFinger.swing({delay:180});})()
  ]);
  const third=await hit(server,3);
  assert.equal(third.shot.type,'drop');
  assert.equal(third.lastHit,0);
  assert.deepEqual(third.score,[0,0]);
  await Promise.all([
   server.locator('[data-shot=clear]').click(),
   (async()=>{await ready(receiver);await receiverFinger.swing();})()
  ]);
  await hit(server,4);
  await ready(server);
  await serverFinger.swing();
  const fifth=await hit(server,5);
  assert.deepEqual(fifth.score,[0,0]);
  for(const page of [server,receiver])assert.ok(page.acks.every(q=>q.accepted),JSON.stringify(page.acks));
  results.push({mode:'doubles',clients:4,rally:fifth.rally,firstCounter:third.shot.type,rtt:third.rtt});
  await server.screenshot({path:'/workspace/shared/downloads/shuttle-return-doubles.png'});
  await serverFinger.end();
  await receiverFinger.end();
  assert.deepEqual(errors,[]);const report={base,passed:results.length,results,errors};fs.writeFileSync(process.env.LIVE_ORIGIN?'/workspace/shared/downloads/shuttle-return-live-report.json':path.join(__dirname,'../online-return-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{for(const c of allContexts)await c.close().catch(()=>{});for(const b of browsers)await b.close();if(local)await local.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
