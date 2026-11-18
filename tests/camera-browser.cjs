const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('/opt/codex/cua_node/lib/node_modules/playwright'),{load}=require('./browser-fixture.cjs');
const snap=p=>p.evaluate(()=>shuttleRush.snapshot);
async function setup(p){
 await p.clock.install({time:new Date('2026-11-16T00:00:00Z')});
 await p.clock.pauseAt(new Date('2026-11-16T00:00:01Z'));
 await load(p,{beforeGame:page=>page.evaluate(()=>{
  const Base=ShuttlePhysics.Rally;
  ShuttlePhysics.Rally=class extends Base{constructor(...args){super(...args);window.__qaMatch=this;}};
  const drawTape=ShuttleCourtArt.drawTape;
  ShuttleCourtArt.drawTape=(ctx,corners,...args)=>{
   const {b,d}=ctx.getTransform();
   const [, ,right,left]=corners;
   window.__qaTapeTilt=b*(right.x-left.x)+d*(right.y-left.y);
   drawTape(ctx,corners,...args);
  };
 })});
 await p.clock.runFor(50);
 await p.locator('#start').click();
 await p.clock.runFor(32);
 assert.ok(Math.abs(await p.evaluate(()=>window.__qaTapeTilt))<.001,'the live net tape is horizontal');
}
async function ground(p,point,{over=false,lastHit=0}={}){await p.evaluate(({point,over,lastHit})=>{const m=window.__qaMatch;m.state='rally';m.lastHit=lastHit;m.contact=null;m.pending=null;m.ball={x:point.x,y:.02,z:point.z,vx:0,vy:-10,vz:0};if(over)m.score=lastHit===0?[0,10]:[10,0];},{point,over,lastHit});await p.clock.runFor(25);}
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});const results=[],errors=[];try{
 for(const [name,width,height,point,touch,lastHit]of [['sideline',1440,1000,{x:2.70,z:4},false],['baseline',320,568,{x:1,z:6.80},true],['landscape',844,390,{x:-2.72,z:3},true],['corner',834,1194,{x:2.68,z:6.78},true],['near-baseline',390,844,{x:-.4,z:-6.8},true,1]]){
  const p=await b.newPage({viewport:{width,height},isMobile:touch,hasTouch:touch});p.on('pageerror',e=>errors.push(e.message));await setup(p);await ground(p,point,{lastHit});let s=await snap(p);assert.equal(s.state,'point');assert.deepEqual(s.score,lastHit===1?[1,0]:[0,1]);assert.equal(s.camera.mode,'line-call');assert.equal(await p.locator('#line-call').isVisible(),true);assert.equal(await p.locator('#point-banner').isVisible(),false);await p.clock.runFor(280);s=await snap(p);assert.ok(s.camera.view.zoom>3);const r=await p.locator('#court').boundingBox(),x=s.visual.ground.x/720*r.width,y=s.visual.ground.y/(720*r.height/r.width)*r.height;assert.equal(s.camera.framing,'oblique-line');assert.ok(Math.abs(x-r.width*.5)<r.width*.12&&Math.abs(y-r.height*.58)<r.height*.12,'line and exact landing share a dedicated oblique close-up');
  const frozen=s.ball;await p.screenshot({path:'/workspace/shared/downloads/shuttle-camera-'+name+'.png'});await p.locator('#pause').click();const paused=(await snap(p)).camera;await p.clock.runFor(1200);assert.deepEqual((await snap(p)).camera,paused);assert.deepEqual((await snap(p)).ball,frozen);await p.locator('#resume').click();await p.clock.runFor(3850);assert.equal((await snap(p)).camera.call,null);assert.equal(await p.locator('#line-call').isVisible(),false);await p.clock.runFor(700);assert.equal((await snap(p)).state,'serve');assert.equal((await snap(p)).camera.view.zoom,1);assert.equal((await snap(p)).pointCount,1);results.push(name+': true physical out, close-up framing, pause/resume and next serve');await p.close();
 }
 const end=await b.newPage({viewport:{width:1280,height:900}});end.on('pageerror',e=>errors.push(e.message));await setup(end);await ground(end,{x:2.7,z:4},{over:true});assert.equal((await snap(end)).state,'over');assert.equal(await end.locator('#pause-overlay').isVisible(),false);await end.clock.runFor(500);assert.equal(await end.locator('#line-call').isVisible(),true);await end.clock.runFor(700);assert.equal(await end.locator('#pause-overlay').isVisible(),true);assert.equal(await end.locator('#line-call').isVisible(),false);assert.equal((await snap(end)).pointCount,1);results.push('match point finishes after close-up and scores exactly once');await end.close();
 const reduced=await b.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});reduced.on('pageerror',e=>errors.push(e.message));await setup(reduced);await ground(reduced,{x:2.7,z:3});await reduced.clock.runFor(280);assert.deepEqual((await snap(reduced)).camera.view,{zoom:1,x:0,y:0,roll:0});assert.equal(await reduced.locator('#line-call-detail').isVisible(),true);assert.ok((await reduced.locator('#line-call-detail circle').count())===2);await reduced.screenshot({path:'/workspace/shared/downloads/shuttle-camera-reduced.png'});results.push('reduced motion uses static line close-up and keeps world camera still');await reduced.close();
 const wide=await b.newPage({viewport:{width:1280,height:900}});wide.on('pageerror',e=>errors.push(e.message));await setup(wide);await ground(wide,{x:3.4,z:3});assert.equal((await snap(wide)).camera.call,null);assert.equal(await wide.locator('#line-call').isVisible(),false);await wide.clock.runFor(1800);await wide.locator('#settings').click();await wide.locator('#start').click();await wide.locator('#court').focus();await wide.keyboard.press('Space');await wide.clock.runFor(250);let s=await snap(wide);assert.ok(s.camera.view.zoom>1.02);assert.equal(s.camera.view.roll,0);assert.ok(Math.abs(await wide.evaluate(()=>window.__qaTapeTilt))<.001);assert.equal(s.lastShot.kind,'keyboard');assert.equal(s.state,'rally');assert.equal(await wide.locator('#line-call').isVisible(),false);results.push('wide out skips close-up; normal served rally enables dynamic camera');await wide.close();
 assert.deepEqual(errors,[]);const report={passed:results.length,results,errors};fs.writeFileSync(path.join(__dirname,'../camera-browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
