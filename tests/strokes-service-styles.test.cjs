const {test}=require('node:test'),assert=require('node:assert/strict');
const {Rally,CFG,AI_STYLES,Tournament,serviceCourt,legalService,strokeSide,chooseAIShot,integrate,collideNet}=require('../dist/physics.js');
const {follow,SWINGS}=require('../dist/feel.js');
const advance=(m,t)=>{for(let i=0;i<Math.round(t/CFG.step);i++)m.update(CFG.step);};

test('each server uses their own score and right/left perspective to select diagonal courts',()=>{
 const m=new Rally();m.start();
 for(const side of [0,1])for(const points of [0,1,2,11]){
  m.server=side;m.score[side]=points;m.score[1-side]=points+1;m.prepareServe();
  const sign=(side===0?1:-1)*(points%2===0?1:-1);
  assert.equal(Math.sign(m.players[side].x),sign);assert.equal(Math.sign(m.players[1-side].x),-sign);
  assert.equal(m.service.right,points%2===0);assert.equal(Math.sign((m.service.minX+m.service.maxX)/2),-sign);
 }
 const pointMatch=new Rally();pointMatch.start();pointMatch.state='rally';pointMatch.award(0,'ground');advance(pointMatch,1.8);
 assert.deepEqual(pointMatch.score,[1,0]);assert.equal(pointMatch.server,0);assert.equal(pointMatch.service.right,false);
});

test('both diagonal player serves and AI serves really cross net and land in service court across input extremes',()=>{
 for(const side of [0,1])for(const points of [0,1])for(const serve of side===0?['short','long']:['long'])for(const aim of [-1,0,1])for(const power of [0,.55,1]){
  const m=new Rally(()=>{},()=>.5);m.start();m.server=side;m.score[side]=points;m.prepareServe();
  if(side===0){m.selectServe(serve);m.strike({aim,power});}else m.hit(1,{shot:'clear',aim,power},'serve');
  const b={...m.ball},court=m.activeServe;let crossing=null;
  for(let i=0;i<600&&b.y>0;i++){const prev={...b};integrate(b);const net=collideNet(b,prev);assert.ok(!net||net.over);if(prev.z*b.z<=0)crossing=b.y;}
  assert.ok(crossing>CFG.netHeight);assert.ok(legalService(b,court),JSON.stringify({side,points,serve,aim,power,b,court}));
 }
});

test('service boundaries include their lines and actual wrong-side/short landings award opponent',()=>{
 for(const side of [0,1]){
  const court=serviceCourt(side,0);for(const x of [court.minX,court.maxX])for(const z of [court.minZ,court.maxZ])assert.equal(legalService({x,z},court),true);
  for(const position of [{x:court.serverX,z:side===0?3:-3},{x:court.receiverX,z:side===0?1:-1}]){
   const points=[],m=new Rally((type,data)=>{if(type==='point')points.push(data);});m.start();m.state='rally';m.lastHit=side;m.activeServe=court;m.ball={...position,y:.001,vx:0,vy:-10,vz:0};m.update(CFG.step);
   assert.equal(points[0].reason,'service');assert.equal(m.score[1-side],1);
  }
 }
 const m=new Rally();m.start();m.strike();assert.ok(m.activeServe);m.ball={x:0,y:2,z:4,vx:0,vy:0,vz:5};m.hit(1,{shot:'drive'});assert.equal(m.activeServe,null);
});

test('practice and comparison preserve identical central coach feeds and are exempt from service boxes',()=>{
 for(const mode of ['practice','compare']){const feeds=[];for(const aiStyle of Object.keys(AI_STYLES)){const m=new Rally(()=>{},()=>.5);m.start({mode,aiStyle});assert.equal(m.service,null);advance(m,1.2);assert.equal(m.activeServe,null);feeds.push(m.shotHistory[0]);}for(const f of feeds){assert.deepEqual(f.origin,feeds[0].origin);assert.deepEqual(f.velocity,feeds[0].velocity);}}
});

test('forehand/backhand follows a fixed racket hand for both court perspectives and is captured at impact',()=>{
 for(const side of [0,1])for(const stroke of ['forehand','backhand']){
  const hand=side===0?1:-1,offset=(stroke==='forehand'?1:-1)*hand;
  assert.equal(strokeSide(side,{x:0},{x:offset,vx:0}),stroke);
  const m=new Rally();m.start({mode:'practice'});m.players[side].x=0;m.ball={x:offset,y:2,z:side===0?-3:3,vx:offset*3,vy:-2,vz:side===0?-5:5};m.hit(side,{shot:'drive'},'perfect');
  assert.equal(m.players[side].impact.stroke,stroke);assert.equal(m.shotHistory.at(-1).stroke,stroke);
  const captured=JSON.stringify(m.players[side].impact);m.players[side].x=3;assert.equal(JSON.stringify(m.players[side].impact),captured);
 }
 assert.equal(strokeSide(0,{x:0},{x:0,vx:-3}),'backhand');
 for(const type of Object.keys(SWINGS))for(const stroke of ['forehand','backhand'])for(const age of [0,.05])assert.ok(Object.values(follow(type,age,stroke)).every(value=>value===0));
 assert.notDeepEqual(follow('drive',.2,'forehand'),follow('drive',.2,'backhand'));
});

test('style changes shot choice at the same difficulty without permitting low smashes or drops',()=>{
 for(const difficulty of ['normal','hard']){
  const common={player:{x:0,z:-3.7},ball:{y:2.05},difficulty,random:()=>.5};
  assert.equal(chooseAIShot({...common,style:'attacker'}).shot,'drive');assert.equal(chooseAIShot({...common,style:'defender'}).shot,'clear');assert.equal(chooseAIShot({...common,style:'net'}).shot,'drop');
  assert.equal(chooseAIShot({...common,ball:{y:3.1},style:'attacker'}).shot,'smash');
  for(const style of Object.keys(AI_STYLES)){const low=chooseAIShot({...common,ball:{y:1.4},style});assert.ok(!['smash','drop'].includes(low.shot));}
 }
 for(const style of Object.keys(AI_STYLES))assert.equal(chooseAIShot({player:{x:0,z:-4},ball:{y:2},difficulty:'easy',style,rally:4,random:()=>.5}).shot,'clear');
});

test('live normal attacking AI uses overhead contact, styles recover to different bounded bases, and tournament retains opponent identity',()=>{
 const attacker=new Rally(()=>{},()=>.5);attacker.start({difficulty:'normal',aiStyle:'attacker'});attacker.strike();for(let i=0;i<600&&attacker.lastHit===0&&attacker.state==='rally';i++)attacker.update(CFG.step);assert.equal(attacker.lastDecision?.shot,'smash');assert.ok(attacker.players[1].impact.point.y>=2.65);
 const depths=[];for(const aiStyle of ['attacker','defender','net']){const m=new Rally(()=>{},()=>.5);m.start({difficulty:'hard',aiStyle});m.ball={x:0,y:2.1,z:4.2,vx:0,vy:0,vz:0};m.hit(1,{shot:'clear'});advance(m,1);depths.push(m.players[1].z);assert.ok(Math.abs(m.players[1].z-AI_STYLES[aiStyle].baseDepth)<.1);}assert.ok(depths[1]>depths[0]&&depths[0]>depths[2]);
 const cup=new Tournament(()=>.5);cup.start();const identity=cup.current;assert.ok(AI_STYLES[identity.aiStyle]);cup.finish({winner:0,score:[11,5]});cup.advance();assert.notEqual(cup.current.opponent,identity.opponent);assert.ok(AI_STYLES[cup.current.aiStyle]);
});
