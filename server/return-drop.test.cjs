'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {OnlineMatch}=require('./match.cjs'),{Rooms}=require('./rooms.cjs');
const {CFG,SHOTS,dropFlight,integrate,collideNet}=require('../dist/physics.js');
const make=doubles=>new OnlineMatch(Array.from({length:doubles?4:2},(_,id)=>({name:'P'+id,athlete:'haru'})),{doubles,random:()=>.5});
function finishReturn(m){for(let i=0;i<600&&m.state==='rally'&&m.rally<3;i++)m.step();}
test('front and back drops, including low net touches, clear the tape and land short on both sides',()=>{
 for(const dir of [-1,1])for(const z of [-1.2,-3.7,-6.2])for(const y of [.65,1.2,2.6,3.2])for(const x of [-1.9,0,1.9]){
  const origin={x:0,y,z:z*dir},target={x,y:.025,z:1.1*dir},f=dropFlight(origin,target),b={...origin,...f.velocity};let crossed=false;
  for(let i=0;i<400&&b.y>0;i++){const previous={...b};integrate(b);assert.equal(collideNet(b,previous),null,JSON.stringify({dir,z,y,x}));if(previous.z*b.z<=0)crossed=true;}
  assert.ok(crossed);assert.ok(Math.abs(b.z-target.z)<.1);assert.ok(Math.abs(b.x-target.x)<.1);
 }
 const front=dropFlight({x:0,y:2.7,z:-1.2},{x:0,y:.025,z:1.1});assert.ok(front.duration<.6);assert.ok(front.velocity.vy<0,'front touch travels down instead of floating up');
});
for(const doubles of [false,true])test((doubles?'doubles':'singles')+' server accepts the serving player’s first counter as a low drop',()=>{
 const m=make(doubles),receiver=doubles?2:1;m.select(0,'drop');m.strike(0,{shot:'drop',power:.55,aim:0});
 for(let i=0;i<600&&m.rally===1;i++){if(m.contacts[receiver]?.t<.15&&!m.pending[receiver])m.strike(receiver,{shot:'drive',power:.55,aim:0});m.step();}
 assert.equal(m.rally,2);assert.ok(m.contacts[0].y<1.8,'reproduces formerly forbidden drop height');assert.ok(m.strike(0,{shot:'drop',power:.55,aim:0,kind:'swipe'}));finishReturn(m);assert.equal(m.rally,3);assert.equal(m.lastHit,0);assert.equal(m.lastShot.type,'drop');assert.deepEqual(m.score,[0,0]);
});
test('a sharp front drop wins against a displaced back-court defender, but a net-ready defender can return it',()=>{
 for(const z of [1.3,6.1]){const m=make(false);m.state='rally';Object.assign(m.players[0],{x:0,z:-1.2});Object.assign(m.players[1],{x:0,z});m.ball={x:0,y:2.7,z:-1.2,vx:0,vy:0,vz:0};m.hit(0,{shot:'drop',power:.55,aim:.9},'perfect');for(let i=0;i<400&&m.state==='rally'&&m.lastHit===0;i++){if(m.contacts[1]?.t<.2&&!m.pending[1])m.strike(1,{shot:'clear',power:.5,aim:0});m.step();}if(z===1.3)assert.equal(m.lastHit,1);else assert.deepEqual(m.score,[1,0]);}
});
test('a recovering receiver can queue a swing; no physical hit occurs until recovery finishes',()=>{
 const m=make(false);m.state='rally';m.rally=2;m.lastHit=1;m.ball={x:0,y:2,z:-3,vx:0,vy:-1,vz:-1};Object.assign(m.players[0],{x:0,z:-3,recovery:.1});m.retarget();assert.ok(m.strike(0,{shot:'drive',power:.55,aim:0}));m.step();assert.equal(m.rally,2);for(let i=0;i<20&&m.rally===2;i++)m.step();assert.equal(m.rally,3);
});
test('only the sending client receives matching input acceptance or an actionable rejection; no high-shot conversion',()=>{
 const r=new Rooms({send:(p,q)=>p.messages.push(JSON.parse(JSON.stringify(q)))}),a={messages:[]},b={messages:[]},room=r.create(a,{});r.join(b,{code:room.code});r.ready(a);r.ready(b);r.start(a);a.messages=[];b.messages=[];
 r.message(a,{type:'strike',inputId:1,input:{shot:'drive',power:.55,aim:0}});assert.deepEqual(a.messages.at(-1),{type:'input',inputId:1,accepted:true});assert.equal(b.messages.length,0);
 r.message(a,{type:'strike',inputId:2,input:{shot:'drive',power:.55,aim:0}});assert.equal(a.messages.at(-1).reason,'not-turn');assert.equal(a.messages.at(-1).inputId,2);
 const m=room.match;m.lastHit=1;m.ball={x:0,y:1.5,z:-2,vx:0,vy:-1,vz:-3};m.retarget();r.message(a,{type:'strike',inputId:3,input:{shot:'smash',power:.55,aim:0}});assert.equal(a.messages.at(-1).reason,'height');assert.equal(m.pending[0],null);assert.equal(m.lastShot.type,'clear');assert.equal(b.messages.length,0);assert.ok(SHOTS.drop.min<1.8);
});
