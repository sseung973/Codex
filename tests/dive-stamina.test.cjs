const {test}=require('node:test'),assert=require('node:assert/strict');
const {Rally,CFG}=require('../dist/physics.js'),{divePose}=require('../dist/feel.js');
const advance=(m,t)=>{for(let i=0;i<Math.round(t/CFG.step);i++)m.update(CFG.step);};
function lowBall(side=0){const m=new Rally(()=>{},()=>.5);m.start({difficulty:'hard'});m.selectShot('clear');m.state='rally';m.lastHit=1-side;m.players[side].x=0;m.players[side].z=side===0?-3.7:3.7;m.ball={x:side===0?2.45:2.1,y:1.65,z:m.players[side].z,vx:0,vy:-5,vz:side===0?-2:2};m.retarget(side);m.aiWait=0;return m;}
test('an early low wide ball can be saved without teleporting; an impossibly late one still misses',()=>{
 const m=lowBall();m.strike({shot:'clear',kind:'swipe'});m.update(CFG.step);assert.ok(m.players[0].dive);assert.equal(m.lastHit,1,'dive must prepare before contact');advance(m,.23);assert.equal(m.lastHit,0);assert.equal(m.shotHistory.at(-1).diving,true);assert.ok(m.players[0].dive.travel<=CFG.dive.maxTravel);assert.ok(Math.hypot(m.players[0].vx,m.players[0].vz)<=CFG.dive.speed);
 for(let i=0;i<400&&m.state==='rally'&&m.ball.z<=0;i++)m.update(CFG.step);assert.ok(m.ball.z>0);assert.deepEqual(m.score,[0,0]);
 const late=lowBall();late.ball.y=.9;late.retarget(0);late.strike({shot:'clear'});advance(late,.3);assert.equal(late.lastHit,1);assert.equal(late.score[1],1,'late wide balls must not be saved by instant reach');
 const ordinary=lowBall();ordinary.ball.y=.9;ordinary.retarget(0);ordinary.players[0].diveCooldown=999;ordinary.strike({shot:'clear'});advance(ordinary,.3);assert.equal(ordinary.lastHit,1);assert.equal(ordinary.score[1],1);
});
test('AI gets the same emergency dive and plays a defensive clear with actual racket contact',()=>{const m=lowBall(1);m.update(CFG.step);assert.ok(m.players[1].dive);assert.equal(m.lastHit,0);advance(m,.23);assert.equal(m.lastHit,1);assert.equal(m.lastDecision.strategy,'dive-save');assert.equal(m.players[1].impact.diving,true);assert.ok(m.conditions[1]<100);});
test('normal reach, high balls, out balls, low stamina and overhead selection do not trigger unnecessary dives',()=>{
 for(const change of [m=>m.ball.x=.5,m=>m.ball.y=2,m=>{m.ball.y=1.65;m.ball.vy=-1;},m=>{m.ball.x=4;m.retarget(0);},m=>m.condition=0,m=>m.selectShot('smash')]){const m=lowBall();change(m);m.update(CFG.step);assert.equal(m.players[0].dive,null);}
});
test('dive has bounded travel, get-up time and cooldown; pause/countdown freezes pose and energy',()=>{
 const m=lowBall();m.update(CFG.step);advance(m,.1);const p=m.players[0];assert.ok(p.dive.travel<=CFG.dive.maxTravel+.00001);const angle=divePose(p.dive,m.time,CFG.dive).angle;assert.ok(Math.abs(angle)>.3);m.pause();const frozen=JSON.stringify({players:m.players,conditions:m.conditions,time:m.time});advance(m,1);assert.equal(JSON.stringify({players:m.players,conditions:m.conditions,time:m.time}),frozen);m.pause();advance(m,3);assert.equal(JSON.stringify({players:m.players,conditions:m.conditions,time:m.time}),frozen);advance(m,.2);assert.equal(m.strike({shot:'clear'}),false);advance(m,.6);assert.equal(p.dive,null);assert.ok(p.diveCooldown>0);assert.deepEqual(divePose(null,m.time,CFG.dive),{angle:0,weight:0});
});
test('both players spend equal energy for equal movement and hits, and fatigue slows each by at most ten percent',()=>{
 const m=new Rally();m.start();for(const side of [0,1]){m.players[side].x=0;m.movePlayer(side,2,m.players[side].z,8.5,1);m.ball={x:2,y:2.1,z:side===0?-4:4,vx:0,vy:0,vz:0};m.hit(side,{shot:'clear'},'good');}assert.ok(Math.abs(m.conditions[0]-m.conditions[1])<1e-8);for(const side of [0,1]){m.conditions[side]=100;const fresh=m.movementSpeed(side,8.5);m.conditions[side]=0;const tired=m.movementSpeed(side,8.5);assert.ok(tired>=fresh*.9-.0001);assert.ok(tired<fresh);}
 const durable=new Rally();durable.start();for(let i=0;i<10;i++){durable.spendEnergy(0,CFG.condition.hitCost+3*CFG.condition.moveCost);}assert.ok(durable.condition>85,'ten hits plus 30m travel should not exhaust the player');
});
test('both recover between points and on serve preparation, training is unlimited, new rounds restore full energy',()=>{
 const m=new Rally();m.start();m.conditions=[45,55];advance(m,1);assert.ok(m.conditions[0]>47&&m.conditions[1]>57);m.state='rally';m.lastHit=0;m.award(0,'ground');advance(m,1);assert.ok(m.conditions[0]>50&&m.conditions[1]>60);m.start({mode:'tournament'});assert.deepEqual(m.conditions,[100,100]);for(const mode of ['practice','compare']){m.start({mode});m.spendEnergy(0,100);m.spendEnergy(1,100);assert.deepEqual(m.conditions,[100,100]);}
});
test('dive saves and energy use are independent of display frame rate',()=>{const runs=[];for(const fps of [30,60,120]){const m=lowBall();m.strike({shot:'clear'});for(let i=0;i<fps/2;i++)m.update(1/fps);runs.push({players:m.players,conditions:m.conditions,ball:m.ball,score:m.score});}assert.deepEqual(runs[0],runs[1]);assert.deepEqual(runs[0],runs[2]);});
