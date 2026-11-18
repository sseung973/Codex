'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {OnlineMatch}=require('./match.cjs');
const {Rally,CFG,integrate,collideNet}=require('../dist/physics.js');
function flight(shot,athlete='haru',z=-3.7,power=1){const m=new Rally(()=>{},()=>.5);m.start({athlete});m.ball={x:0,y:3.05,z,vx:0,vy:-1,vz:0};m.hit(0,{shot,power,aim:0},'perfect');return m;}
test('smash leaves time to defend while retaining a descending, faster-than-drive attack',()=>{
 const m=flight('smash'),drive=flight('drive'),speed=Math.hypot(m.ball.vx,m.ball.vy,m.ball.vz)*3.6;
 assert.ok(speed>75&&speed<82,'neutral centre full-power smash was previously 92.5km/h');assert.ok(m.ball.vy<0);assert.ok(m.shotHistory.at(-1).duration<drive.shotHistory.at(-1).duration*.85);assert.ok(m.shotHistory.at(-1).duration>=.55);
});
test('all four athletes retain legal front/back smashes and the attack specialist keeps a modest advantage',()=>{
 for(const athlete of ['jun','nara','eden','haru'])for(const z of [-1.2,-3.7,-6])for(const power of [.2,.6,1]){const m=flight('smash',athlete,z,power),b={...m.ball},target=m.shotHistory.at(-1).target;let landing=null;for(let i=0;i<300&&b.y>0;i++){const before={...b};integrate(b);assert.equal(collideNet(b,before),null);if(b.y<=0){const t=before.y/(before.y-b.y);landing=before.z+(b.z-before.z)*t;}}assert.ok(landing>4&&landing<5.2);assert.ok(Math.abs(landing-target.z)<.08);}
 assert.ok(flight('smash','jun').shotHistory.at(-1).duration<flight('smash','haru').shotHistory.at(-1).duration);
});
for(const doubles of [false,true])test((doubles?'doubles':'singles')+' receives a full-power smash with a deliberate 450ms block instead of an automatic point',()=>{
 for(const team of [0,1])for(const aim of [-.8,0,.8]){const size=doubles?2:1,attacker=team*size,receiver=(1-team)*size,dir=team===0?1:-1;
 const m=new OnlineMatch(Array.from({length:size*2},(_,id)=>({name:'P'+id,athlete:'haru'})),{doubles,random:()=>.5});m.state='rally';Object.assign(m.players[attacker],{x:0,z:-3.7*dir});Object.assign(m.players[receiver],{x:0,z:3.7*dir});if(doubles)Object.assign(m.players[receiver+1],{x:2.8,z:6.2*dir});m.ball={x:0,y:3.05,z:-3.7*dir,vx:0,vy:-1,vz:0};m.hit(attacker,{shot:'smash',power:1,aim},'perfect');assert.equal(m.players[attacker].recovery,.28);
 for(let i=0;i<54;i++)m.step();assert.ok(m.strike(receiver,{shot:'drive',block:true,power:.35,aim:0}));for(let i=0;i<120&&m.state==='rally'&&m.rally===1;i++)m.step();assert.equal(m.rally,2);assert.equal(m.lastHit,receiver);assert.equal(m.lastShot.variant,'block');assert.deepEqual(m.score,[0,0]);}
});
test('smash follow-through is shared with AI and online, without adding fatigue or slowing other strokes',()=>{
 for(const side of [0,1]){const m=new Rally(()=>{},()=>.5);m.start({athlete:'haru'});m.ball={x:0,y:3.05,z:side?3.7:-3.7,vx:0,vy:-1,vz:0};m.hit(side,{shot:'smash',power:.6},'perfect');assert.equal(m.players[side].recovery,.28);assert.ok(Math.abs(m.conditions[side]-(100-CFG.condition.hitCost))<1e-9);}
 for(const type of ['clear','drop','drive'])assert.equal(flight(type).players[0].recovery,CFG.recoveryDelay);
});
