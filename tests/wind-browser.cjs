'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('/opt/codex/cua_node/lib/node_modules/playwright');
const {createApp}=require('../server/index.cjs');
const snapshot=page=>page.evaluate(()=>shuttleRush.snapshot);

async function swipe(page){
 const session=await page.context().newCDPSession(page);
 const court=await page.locator('#court').boundingBox();
 const x=court.x+court.width*.64,y=court.y+court.height*.59;
 try{
  for(const [type,offset] of [['touchStart',0],['touchMove',45],['touchMove',4],['touchEnd',0]]){
   await session.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y:y+offset}]});
  }
 }finally{await session.detach();}
}

(async()=>{
 const app=process.env.LIVE_ORIGIN?null:createApp();
 if(app)await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base=process.env.LIVE_ORIGIN||'http://127.0.0.1:'+app.server.address().port;
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 const errors=[];
 async function createPage(width,height,touch=false){
  const page=await browser.newPage({viewport:{width,height},hasTouch:touch,isMobile:touch,ignoreHTTPSErrors:!app});
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base,{timeout:90000});
  await page.waitForFunction(()=>window.shuttleRush?.snapshot?.screen==='title');
  await page.locator('#title-enter').click();
  return page;
 }
 try{
  const phone=await createPage(320,568,true);
  assert.equal(await phone.locator('#arena-outdoor-art').getAttribute('src'),null);
  await phone.locator('[name=venue][value=indoor]').focus();
  await phone.keyboard.press('ArrowRight');
  assert.equal(await phone.locator('[name=venue][value=outdoor]').isChecked(),true);
  assert.equal(await phone.locator('#lobby-outdoor-art').isVisible(),true);
  await phone.waitForFunction(()=>document.getElementById('lobby-outdoor-art').naturalWidth===1440);
  await phone.waitForFunction(()=>document.getElementById('arena-outdoor-art').naturalWidth===1440);
  await phone.locator('[name=mode][value=practice]').check();
  await phone.locator('#start').tap();
  await phone.waitForFunction(()=>shuttleRush.snapshot.venue==='outdoor'&&shuttleRush.snapshot.wind<0);
  assert.match(await phone.locator('#wind-status').textContent(),/왼쪽/);
  assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  if(process.env.WIND_SCREENSHOTS)await phone.screenshot({path:'/tmp/shuttle-outdoor-phone.png'});
  await phone.waitForFunction(()=>{
   const {lastHit,contact}=shuttleRush.snapshot;
   return lastHit===1&&contact?.t<.45&&contact.t>.08;
  },null,{timeout:10000});
  await swipe(phone);
  await phone.waitForFunction(()=>shuttleRush.snapshot.rally===2,null,{timeout:10000});
  assert.equal((await snapshot(phone)).lastShot.kind,'swipe');
  await phone.locator('#settings').tap();
  await phone.locator('[name=mode][value=compare]').check();
  assert.equal(await phone.locator('#lobby-venue').isHidden(),true);
  await phone.locator('#start').tap();
  assert.equal((await snapshot(phone)).venue,'indoor');
  assert.equal((await snapshot(phone)).wind,0);
  await phone.close();
  console.log('PASS keyboard venue choice, mobile artwork and live court, calm shot comparison');

  const host=await createPage(1440,900),guest=await createPage(390,844,true);
  for(const player of [host,guest])await player.locator('#lobby-friends-tab').click();
  await host.locator('[name=room-venue][value=outdoor]').check();
  await host.locator('#room-create').click();
  await host.locator('#room-number').waitFor({state:'visible'});
  await guest.locator('#room-code-input').fill(await host.locator('#room-number').innerText());
  await guest.locator('#room-join').tap();
  await guest.waitForFunction(()=>shuttleRush.snapshot.online.room?.venue==='outdoor');
  assert.match(await guest.locator('#room-kind').textContent(),/야외 코트/);
  assert.equal(await guest.locator('#lobby-outdoor-art').isVisible(),true);
  await host.locator('#room-ready').click();
  await guest.locator('#room-ready').tap();
  await host.locator('#room-start').click();
  await Promise.all([host,guest].map(player=>player.waitForFunction(()=>shuttleRush.snapshot.online.active)));
  const opening=(await snapshot(host)).wind;
  assert.ok(opening<0);
  assert.equal((await snapshot(guest)).wind,-opening);
  await guest.waitForFunction(()=>document.getElementById('wind-status').textContent.includes('오른쪽'));
  if(process.env.WIND_SCREENSHOTS)await host.screenshot({path:'/tmp/shuttle-outdoor-desktop.png'});

  await host.keyboard.press('Space');
  await guest.waitForFunction(()=>{
   const {lastHit,contact}=shuttleRush.snapshot;
   return lastHit===1&&contact?.t<.30&&contact.t>.04;
  },null,{timeout:10000});
  await swipe(guest);
  await host.waitForFunction(()=>shuttleRush.snapshot.rally===2,null,{timeout:10000});
  assert.equal((await snapshot(host)).lastShot.kind,'swipe');
  assert.equal((await snapshot(host)).wind,opening);
  await host.waitForFunction(wind=>shuttleRush.snapshot.state==='serve'&&shuttleRush.snapshot.wind!==wind,opening,{timeout:10000});
  await guest.waitForFunction(wind=>shuttleRush.snapshot.wind===wind,opening);
  assert.deepEqual((await snapshot(host)).score,[...(await snapshot(guest)).score].reverse());
  assert.deepEqual(errors,[]);
  console.log('PASS server-owned outdoor venue, mirrored wind, phone return, shared scoring and next-point change');
 }finally{
  await browser.close();
  if(app)await app.close();
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
