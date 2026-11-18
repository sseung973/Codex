'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {CFG,Rally,predict,legalService,windForRally}=require('../dist/physics.js');
const {OnlineMatch,point}=require('../server/match.cjs');
const {Rooms}=require('../server/rooms.cjs');

test('the outdoor crosswind changes long flights more and comparison remains calm',()=>{
 const match=new Rally(()=>{},()=>.5);
 function landing(venue,shot){
  match.start({venue});
  match.ball={x:0,y:3.05,z:-3,vx:0,vy:0,vz:0};
  match.hit(0,{shot,power:.6,aim:0},'perfect');
  return match.landing.x;
 }
 assert.equal(landing('indoor','clear'),0);
 const clear=landing('outdoor','clear'),drive=landing('outdoor','drive');
 assert.ok(clear<-.5&&drive<-.05&&Math.abs(clear)>Math.abs(drive)*3);
 match.start({mode:'compare',venue:'outdoor'});
 assert.equal(match.venue,'indoor');
 assert.equal(match.wind,0);
});

test('wind and receiver prediction mirror between seats and agree with court scoring',()=>{
 for(const doubles of [false,true]){
  const members=Array.from({length:doubles?4:2},()=>({athlete:'haru'}));
  for(const type of ['long','short']){
   const match=new OnlineMatch(members,{doubles,venue:'outdoor',random:()=>.5});
   for(let rally=0;rally<4;rally++){
    for(const team of [0,1]){
     match.server=team*match.size;
     match.pointCount=rally;
     match.score=[rally%2,rally%2];
     match.prepare();
     match.selectServe(match.server,type);
     assert.equal(match.strike(match.server,{shot:'clear',power:.55,aim:0,kind:'keyboard'}),true);
     const wind=windForRally('outdoor',rally),dir=match.dir(match.server);
     assert.equal(match.wind,wind);
     assert.ok(match.landing&&legalService(match.landing,match.activeServe));
     const local=predict(point(match.ball,dir),1,CFG.contactHeight,null,wind*dir);
     assert.ok(Math.abs(local.landing.x*dir-match.landing.x)<1e-9);
     const landing={...match.landing},winner=match.team(match.server);
     const score=match.score[winner];
     for(let i=0;i<360&&match.state==='rally';i++)match.step();
     assert.equal(match.state,'point');
     assert.equal(match.wind,wind);
     assert.equal(match.score[winner],score+1);
     assert.ok(Math.abs(match.ball.x-landing.x)<=Math.abs(match.ball.vx)*CFG.step+1e-9);
    }
   }
  }
 }
});

test('the room owns the venue and rejoining preserves the active crosswind',()=>{
 const messages=[],rooms=new Rooms({send:(peer,data)=>messages.push({peer,data})});
 const host={},guest={};
 const room=rooms.create(host,{venue:'outdoor'});
 rooms.join(guest,{code:room.code,venue:'indoor'});
 assert.equal(rooms.public(room).venue,'outdoor');
 rooms.ready(host);
 rooms.ready(guest);
 rooms.start(host);
 const wind=room.match.wind,token=room.members[1].token;
 rooms.disconnect(guest);
 const rejoining={};
 rooms.join(rejoining,{code:room.code,token});
 const restored=messages.findLast(message=>message.peer===rejoining&&message.data.type==='state').data.snapshot;
 assert.equal(restored.venue,'outdoor');
 assert.equal(restored.wind,wind);
 assert.equal(restored.state,'paused');
 assert.equal(rooms.create({}, {venue:'unknown'}).venue,'indoor');
});

test('an edge clear can drift out and award the point to the receiver',()=>{
 for(const venue of ['indoor','outdoor']){
  const match=new OnlineMatch([{athlete:'haru'},{athlete:'haru'}],{venue,random:()=>.5});
  match.pointCount=1;
  match.prepare();
  match.ball={x:0,y:3.05,z:-3,vx:0,vy:0,vz:0};
  match.hit(0,{shot:'clear',power:.55,aim:1},'perfect');
  for(let i=0;i<360&&match.state==='rally';i++)match.step();
  assert.deepEqual(match.score,venue==='outdoor'?[0,1]:[1,0]);
 }
});
