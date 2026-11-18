const {test}=require('node:test'),assert=require('node:assert/strict');
const {Rally,CFG}=require('../dist/physics.js'),{Swipe,preferences}=require('../dist/input.js'),{SWINGS,follow}=require('../dist/feel.js');
function struck(side=0,aim=0){const m=new Rally(()=>{},()=>.5);m.start({mode:'compare'});const z=side===0?-5.7:5.7;m.players[side].x=2.1;m.players[side].z=z;m.ball={x:2.1,y:2.8,z,vx:0,vy:0,vz:0};m.hit(side,{shot:'clear',power:.6,aim},'perfect');return m;}
function advance(m,seconds){for(let i=0;i<Math.round(seconds/CFG.step);i++)m.update(CFG.step);}
test('both players recover toward base after follow-through, at bounded speed',()=>{for(const side of [0,1]){const m=struck(side),p=m.players[side],start={x:p.x,z:p.z};advance(m,.1);assert.equal(p.x,start.x);assert.equal(p.z,start.z);advance(m,.4);assert.ok(Math.abs(p.x)<Math.abs(start.x));assert.ok(Math.abs(p.z)-CFG.baseDepth<Math.abs(start.z)-CFG.baseDepth);assert.ok(Math.hypot(p.vx,p.vz)<=CFG.recoverySpeed+.001);assert.ok(p.steps>0);}});
test('receiver follows incoming contact rather than returning to base',()=>{const m=struck(1,.8);m.players[0].x=0;m.players[0].z=-CFG.baseDepth;assert.ok(m.contact.x>1);advance(m,.12);assert.ok(m.players[0].x>0);assert.ok(m.players[0].vx>0);assert.ok(m.players[0].split>0);});
test('pause freezes recovery, feet and ready-step state',()=>{const m=struck();advance(m,.3);m.pause();const p=JSON.stringify(m.players);for(let i=0;i<20;i++)m.update(.1);assert.equal(JSON.stringify(m.players),p);m.pause();advance(m,3.1);assert.notEqual(JSON.stringify(m.players),p);});
test('recovery positions are independent of render frame rate',()=>{const results=[];for(const fps of [30,60,120]){const m=struck();for(let i=0;i<fps;i++)m.update(1/fps);results.push(m.players.map(p=>({x:p.x,z:p.z,steps:p.steps})));}assert.deepEqual(results[0],results[1]);assert.deepEqual(results[0],results[2]);});
test('higher sensitivity commits a shorter swipe without reversing its course',()=>{const high=new Swipe({x:100,y:200},0,{sensitivity:1.5}),low=new Swipe({x:100,y:200},0,{sensitivity:.7});const h=high.move({x:105,y:185},80),l=low.move({x:105,y:185},80);assert.equal(h.commit,true);assert.equal(l.commit,false);assert.equal(h.aim,l.aim);assert.ok(h.power>l.power);assert.equal(high.end({x:105,y:185},100),null);assert.equal(low.move({x:105,y:170},120).commit,true);});
test('preference normalization bounds corrupt or missing stored values',()=>{assert.deepEqual(preferences(null),{sensitivity:1,hand:'right',buttonSize:'normal',camera:'normal',keys:{clear:'KeyQ',drop:'KeyW',drive:'KeyE',smash:'KeyR'}});assert.deepEqual(preferences({sensitivity:Infinity,hand:'bad',buttonSize:88}),preferences());assert.equal(preferences({sensitivity:99}).sensitivity,1.5);assert.equal(preferences({sensitivity:-9}).sensitivity,.7);assert.deepEqual(preferences({sensitivity:1.2,hand:'left',buttonSize:'large',camera:'normal',keys:{clear:'KeyQ',drop:'KeyW',drive:'KeyE',smash:'KeyR'}}),{sensitivity:1.2,hand:'left',buttonSize:'large',camera:'normal',keys:{clear:'KeyQ',drop:'KeyW',drive:'KeyE',smash:'KeyR'}});});
test('each swing preserves exact impact anchor before a distinct follow-through',()=>{for(const type of Object.keys(SWINGS)){assert.ok(Object.values(follow(type,0)).every(n=>n===0));assert.ok(Object.values(follow(type,.05)).every(n=>n===0));assert.ok(Number.isFinite(follow(type,.2).x));}assert.ok(follow('drive',.2).x>follow('drop',.2).x*3);assert.ok(follow('smash',.2).y>follow('drop',.2).y*3);assert.ok(SWINGS.smash.lift>SWINGS.clear.lift);assert.equal(SWINGS.drop.lift,0);});

test('the racket and diving support arm keep fixed-length joints as the targets move',()=>{
 const {racketArm,supportArm}=require('../dist/feel.js'),shoulder={x:0,y:0};
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 for(const facing of [-1,1])for(const bendSide of [-1,1]){
  for(const target of [{x:49,y:0},{x:0,y:0},{x:66,y:-20},{x:210*facing,y:-180}]){
   const arm=racketArm(shoulder,target,facing,bendSide),support=supportArm(shoulder,target,facing);
   for(const {hand,elbow} of [arm,support]){
    assert.ok(Math.abs(distance(shoulder,elbow)-36)<1e-8);
    assert.ok(Math.abs(distance(elbow,hand)-36)<1e-8);
    assert.ok(distance(shoulder,hand)<=70.000001);
   }
   assert.ok(Math.abs(distance(arm.hand,arm.head)-49)<1e-8);
   assert.ok(Math.abs(distance(shoulder,arm.head)-Math.min(distance(shoulder,target),119))<1e-8);
   if(distance(shoulder,target)<119)assert.ok(distance(arm.head,target)<1e-8);
  }
 }
});
