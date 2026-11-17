const {test}=require('node:test'),assert=require('node:assert/strict');
const {Rally,CFG,integrate}=require('../dist/physics.js');
const {preferences,DEFAULT_KEYS,bindingError}=require('../dist/input.js');
const advance=(m,t,dt=CFG.step)=>{for(let i=0;i<Math.ceil(t/dt);i++)m.update(dt);};
test('short and long serves have distinct legal flights and exclude serve statistics',()=>{
 const flights={};
 for(const serve of ['short','long'])for(const aim of [-1,0,1])for(const power of [0,.55,1]){
  const m=new Rally(()=>{},()=>.5);m.start();m.selectShot('smash');assert.equal(m.selectServe(serve),true);assert.equal(m.strike({aim,power}),true);assert.equal(m.selectedShot,'smash');assert.equal(m.shotHistory.at(-1).serve,serve);assert.equal(m.summary.shots.clear.attempts+m.summary.shots.drop.attempts,0);
  const b={...m.ball};let peak=b.y,net=0;for(let i=0;i<500&&b.y>0;i++){const old={...b};integrate(b);peak=Math.max(peak,b.y);if(old.z<0&&b.z>=0)net=old.y+(b.y-old.y)*-old.z/(b.z-old.z);}
  assert.ok(net>CFG.netHeight+.035);assert.ok(Math.abs(b.x)<CFG.halfWidth);assert.ok(b.z>1.98&&b.z<CFG.halfLength);flights[serve]={peak,depth:b.z};assert.equal(m.selectServe('long'),false);
 }
 assert.ok(flights.long.peak>flights.short.peak+3);assert.ok(flights.short.depth<2.5&&flights.long.depth>5);
});
test('all AI levels can return either serve; comparison feed stays identical',()=>{
 for(const difficulty of ['easy','normal','hard'])for(const serve of ['short','long']){const m=new Rally(()=>{},()=>.5);m.start({difficulty});m.selectServe(serve);m.strike();for(let i=0;i<450&&m.lastHit===0;i++)m.update(CFG.step);assert.equal(m.lastHit,1,difficulty+' '+serve);}
 const feed=serve=>{const m=new Rally(()=>{},()=>.5);m.selectedServe=serve;m.start({mode:'compare'});assert.equal(m.selectServe('short'),false);while(m.state==='serve')m.update(CFG.step);return m.shotHistory[0];};assert.deepEqual(feed('short'),feed('long'));
});
test('resume freezes ball, receiver, prediction, feed and match clock throughout 3/2/1',()=>{
 const events=[],m=new Rally((type,data)=>events.push([type,data]),()=>.5);m.start({mode:'practice'});while(m.state==='serve')m.update(CFG.step);m.strike({shot:'drive'});m.pause();assert.equal(m.pending,null);
 const frozen=JSON.stringify({ball:m.ball,players:m.players,time:m.time,contact:m.contact,feed:m.feedTimer,stats:m.summary});m.pause();assert.equal(m.state,'countdown');assert.equal(m.strike(),false);advance(m,2.9,.1);assert.equal(m.state,'countdown');assert.equal(JSON.stringify({ball:m.ball,players:m.players,time:m.time,contact:m.contact,feed:m.feedTimer,stats:m.summary}),frozen);
 m.update(.1);assert.equal(m.state,'rally');assert.equal(m.pending,null);assert.equal(JSON.stringify({ball:m.ball,players:m.players,time:m.time,contact:m.contact,feed:m.feedTimer,stats:m.summary}),frozen);assert.deepEqual(events.filter(e=>e[0]==='countdown').map(e=>e[1]),[3,2,1]);m.update(CFG.step);assert.notEqual(m.time,JSON.parse(frozen).time);
});
test('cancel countdown restarts a full delay; reset and point/serve resume preserve their states',()=>{
 const m=new Rally();m.start();for(const state of ['serve','point']){m.state=state;m.pause();m.pause();m.update(.1);m.pause();assert.equal(m.state,'paused');assert.equal(m.previous,state);m.pause();assert.equal(m.resumeRemaining,3);advance(m,3,.1);assert.equal(m.state,state);}
 m.pause();m.pause();m.start();assert.equal(m.resumeRemaining,0);assert.equal(m.state,'serve');
});
test('countdown duration is independent of frame rate and paused shot changes retarget',()=>{
 for(const fps of [30,60,120]){const m=new Rally();m.start();m.pause();m.pause();advance(m,3-1/fps,1/fps);assert.equal(m.state,'countdown');m.update(1/fps);assert.equal(m.state,'serve');}
 const m=new Rally();m.start({mode:'practice'});while(m.state==='serve')m.update(CFG.step);m.pause();m.pause();m.selectShot('smash');assert.ok(m.contact.y>2.95);
});
test('key remapping validates duplicates/reserved keys and safely migrates stored preferences',()=>{
 assert.deepEqual(preferences({camera:'fixed'}).keys,DEFAULT_KEYS);const keys={...DEFAULT_KEYS,clear:'KeyA',drop:'KeyS'};assert.deepEqual(preferences({keys}).keys,keys);assert.equal(bindingError(keys,'drive','KeyA'),'duplicate');assert.equal(bindingError(keys,'drive','KeyD'),'reserved');assert.equal(bindingError(keys,'drive','Digit1'),'unsupported');assert.equal(bindingError(keys,'drive','KeyZ'),null);
 for(const bad of [{clear:'KeyP'},{clear:'KeyW'},{clear:'Space'},{clear:'bad'},null])assert.deepEqual(preferences({keys:bad}).keys,DEFAULT_KEYS);
 const first=preferences();first.keys.clear='KeyZ';assert.deepEqual(preferences().keys,DEFAULT_KEYS);
});
