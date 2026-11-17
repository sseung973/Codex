const {test}=require('node:test'),assert=require('node:assert/strict');
const {Rally,CFG,readPatterns,diveProgress}=require('../dist/physics.js');
const {divePose,bodyPoint}=require('../dist/feel.js');
const advance=(m,t)=>{for(let i=0;i<Math.round(t/CFG.step);i++)m.update(CFG.step);};
function reply(m,shot='drive',aim=.85){m.state='rally';m.ball={x:0,y:shot==='drop'?2.4:2,z:-3.7,vx:0,vy:-1,vz:-1};m.hit(0,{shot,aim,power:.65},'perfect');m.ball={x:1,y:2,z:4,vx:0,vy:-1,vz:1};m.hit(1,{shot:'clear'},'good');}
function wide(side=0){const m=new Rally(()=>{},()=>.5);m.start({difficulty:'hard'});m.state='rally';m.lastHit=1-side;m.players[side].x=0;m.players[side].z=side===0?-3.7:3.7;m.ball={x:side===0?2.45:2.1,y:1.65,z:m.players[side].z,vx:0,vy:-5,vz:side===0?-2:2};m.aiWait=0;m.retarget(side);if(side===0)m.strike({shot:'drive',block:true});return m;}
test('dive starts at rest, accelerates and brakes instead of covering the whole slide in 120ms',()=>{
 for(const side of [0,1]){const m=wide(side),p=m.players[side];let previous={x:p.x,z:p.z,speed:0},maxSpeed=0,after100=0;
  for(let i=0;i<34;i++){m.update(CFG.step);const speed=Math.hypot(p.vx,p.vz);assert.ok(speed<=CFG.dive.speed+.001);assert.ok(Math.abs(speed-previous.speed)<1.7,'no instant velocity change at takeoff, contact or landing');assert.ok(Math.hypot(p.x-previous.x,p.z-previous.z)<=CFG.dive.speed*CFG.step+.001);if(i===0)assert.equal(speed,0);if(i===11)after100=p.dive.travel;maxSpeed=Math.max(maxSpeed,speed);previous={x:p.x,z:p.z,speed};}
  assert.ok(after100<.45);assert.ok(p.dive.travel<=.9);assert.ok(maxSpeed>2&&maxSpeed<6.4);assert.equal(p.dive.hit,true);assert.equal(m.shotHistory.at(-1).side,side);assert.equal(m.shotHistory.at(-1).diving,true);
 }
 assert.equal(diveProgress(0),0);assert.equal(diveProgress(CFG.dive.duration),1);assert.ok(diveProgress(.12)<.65);
});
test('physical slide, rendered shoulder and recovery stay continuous at 30/60/120Hz',()=>{
 const end=[];for(const fps of [30,60,120]){const m=wide();let previous=null,maxDelta=0;for(let i=0;i<fps;i++){m.update(1/fps);const p=m.players[0],pose=divePose(p.dive,m.time,CFG.dive),shoulder=bodyPoint({x:21,y:-127},pose),point={x:p.x+shoulder.x/100,y:shoulder.y/100};if(previous)maxDelta=Math.max(maxDelta,Math.hypot(point.x-previous.x,point.y-previous.y));previous=point;}assert.ok(maxDelta<.46);assert.equal(m.players[0].dive,null);end.push({players:m.players,ball:m.ball,conditions:m.conditions,score:m.score});}assert.deepEqual(end[0],end[1]);assert.deepEqual(end[0],end[2]);
});
test('repeated direction and shot depth shift a bounded ready position, at each difficulty strength',()=>{
 const history=Array.from({length:5},()=>({shot:'drive',x:2,z:4.7}));for(const difficulty of ['easy','normal','hard']){const r=readPatterns(history,difficulty,'balanced');assert.equal(r.shot,'drive');assert.equal(r.lateral,'right');assert.equal(r.depth,'back');assert.ok(Math.abs(r.cover.x-.95*CFG.adaptation.strength[difficulty])<1e-8);assert.ok(r.cover.z>3.7&&r.cover.z<=4.4);}
 const front=readPatterns(history.map(s=>({...s,shot:'drop',z:1.4,x:-2})),'hard','net');assert.equal(front.shot,'drop');assert.equal(front.lateral,'left');assert.ok(front.cover.z<2.85&&front.cover.z>=1.8);assert.equal(readPatterns(history.slice(0,2)).confidence,0);
});
test('recent mixed play releases a learned bias and a new opposite pattern replaces it',()=>{
 const right=Array.from({length:5},()=>({shot:'clear',x:2,z:5.6})),left=right.map(s=>({...s,x:-2}));assert.ok(readPatterns(right).cover.x>0);assert.ok(readPatterns([...right,...left]).cover.x<0);
 const mixed=Array.from({length:8},(_,i)=>({shot:i%2?'drop':'drive',x:i%2?-2:2,z:i%2?1.4:4.7})),r=readPatterns(mixed);assert.equal(r.cover.x,0);assert.equal(r.cover.z,3.7);assert.equal(r.shot,null);
});
test('AI learns only completed player returns, with bounded per-match memory and no serve/input leakage',()=>{
 const m=new Rally(()=>{},()=>.5);m.start({difficulty:'normal'});m.strike({shot:'drive'});assert.equal(m.adaptation.samples,0);m.state='rally';m.ball={x:0,y:2,z:-3.7,vx:0,vy:-1,vz:0};m.hit(0,{shot:'drive',aim:1},'perfect');assert.equal(m.adaptation.samples,0,'current airborne shot cannot alter an earlier read');m.ball={x:0,y:2,z:4,vx:0,vy:0,vz:0};m.hit(1,{shot:'clear'},'good');assert.equal(m.adaptation.samples,1);
 for(let i=0;i<11;i++)reply(m);assert.equal(m.adaptation.samples,CFG.adaptation.window);assert.ok(m.adaptation.cover.x>.6);const previous=JSON.stringify(m.adaptation);m.prepareServe();assert.equal(JSON.stringify(m.adaptation),previous);m.ball.y=2;m.hit(1,{shot:'clear'},'serve');assert.equal(JSON.stringify(m.adaptation),previous);
 m.start({mode:'tournament'});assert.equal(m.adaptation.samples,0);for(const mode of ['practice','compare']){m.start({mode,aiStyle:'defender'});for(let i=0;i<5;i++)reply(m);assert.equal(m.adaptation.samples,0);assert.equal(m.adaptation.confidence,0);assert.equal(m.adaptation.cover.z,mode==='compare'?CFG.baseDepth:4.25);}
});
test('legal winning returns teach once; net faults, out faults and the following AI serve do not',()=>{
 for(const reason of ['ground','net','out']){const m=new Rally(()=>{},()=>.5);m.start();m.state='rally';m.ball={x:0,y:2,z:-3,vx:0,vy:-1,vz:0};m.hit(0,{shot:'drop',aim:-.8},'perfect');m.award(reason==='ground'?0:1,reason);assert.equal(m.adaptation.samples,reason==='ground'?1:0);m.prepareServe();m.ball.y=2;m.hit(1,{shot:'clear'},'serve');assert.equal(m.adaptation.samples,reason==='ground'?1:0);}
});
test('learned coverage uses normal movement and leaves real travel to the opposite corner after reaction delay',()=>{
 const m=new Rally(()=>{},()=>.5);m.start({difficulty:'normal'});for(let i=0;i<5;i++)reply(m);m.players[1].x=0;m.players[1].z=3.7;advance(m,.4);assert.ok(m.players[1].x>.1);assert.ok(m.players[1].x<=m.adaptation.cover.x+.001);assert.ok(Math.hypot(m.players[1].vx,m.players[1].vz)<=CFG.ai.normal.speed);
 const cover=m.adaptation.cover;m.players[1].x=cover.x;m.players[1].z=cover.z;m.ball={x:0,y:2,z:-3.7,vx:0,vy:-1,vz:0};m.hit(0,{shot:'drive',aim:-1,power:.8},'perfect');assert.ok(Math.abs(m.shotHistory.at(-1).target.x-cover.x)>Math.abs(m.shotHistory.at(-1).target.x));const before={x:m.players[1].x,z:m.players[1].z,read:JSON.stringify(m.adaptation)};advance(m,.1);assert.equal(m.players[1].x,before.x);assert.equal(m.players[1].z,before.z);assert.equal(JSON.stringify(m.adaptation),before.read);m.pause();advance(m,1);assert.equal(JSON.stringify(m.adaptation),before.read);
});
