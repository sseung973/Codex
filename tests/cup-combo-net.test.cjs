const {test}=require('node:test'),assert=require('node:assert/strict');
const {Rally,CFG,collideNet,predict,Tournament}=require('../dist/physics.js');
const advance=(m,t)=>{for(let i=0;i<Math.ceil(t/CFG.step);i++)m.update(CFG.step);};
function atNet(direction=1,height=1.57,speed=12){const m=new Rally(()=>{},()=>.5);m.start();m.state='rally';m.lastHit=direction===1?0:1;m.aiWait=100;m.ball={x:.2,y:height,z:-direction*.02,vx:2,vy:0,vz:direction*speed};return m;}
test('tape graze slows and crosses in either direction, then lands short with one point and no bounce',()=>{
 for(const direction of [-1,1]){const m=atNet(direction),events=[];m.onEvent=(type,data)=>events.push({type,data});m.update(CFG.step);assert.equal(m.state,'rally');assert.deepEqual(m.score,[0,0]);assert.equal(m.netCords,1);assert.ok(Math.sign(m.ball.vz)===direction);assert.ok(Math.abs(m.ball.vz)<4);const origin=m.lastNetCord.point;assert.equal(origin.z,0);assert.ok(origin.y>CFG.netHeight);const landing=predict(m.ball,direction===1?1:0).landing;assert.ok(Math.abs(landing.z)<2.2);advance(m,1);assert.equal(m.state,'point');assert.equal(m.ball.y,0);assert.ok(Math.abs(m.ball.z)<2.2);assert.ok(Math.abs(landing.z-m.ball.z)<.05);assert.equal(events.filter(e=>e.type==='netcord').length,1);assert.equal(events.filter(e=>e.type==='point').length,1);assert.equal(m.pointCount,1);}
});
test('low, stalled and steep contacts stay faults; fast swept grazes cannot tunnel',()=>{
 for(const [height,speed,vy]of [[1.3,12,0],[1.57,.5,0],[1.57,12,-10]]){const m=atNet(1,height,speed);m.ball.z=-.001;m.ball.vy=vy;advance(m,.05);assert.equal(m.state,'point');assert.deepEqual(m.score,[0,1]);assert.equal(m.netCords,0);assert.equal(m.summary.netFaults,1);}
 for(const dir of [-1,1]){const m=atNet(dir,1.57,110);m.update(CFG.step);assert.equal(m.netCords,1);assert.equal(m.state,'rally');assert.ok(Math.abs(m.ball.vz)<30);}
 const b={x:0,y:3,z:.2,vx:0,vy:0,vz:12};assert.equal(collideNet(b,{x:0,y:3,z:-.2}),null);
});
test('tape response is fixed-step independent at 30, 60 and 120Hz',()=>{
 const run=fps=>{const m=atNet();for(let i=0;i<fps*.5;i++)m.update(1/fps);return m;};const a=run(30),b=run(60),c=run(120);assert.equal(a.netCords,1);for(const key of Object.keys(a.ball)){assert.ok(Math.abs(a.ball[key]-b.ball[key])<1e-8);assert.ok(Math.abs(a.ball[key]-c.ball[key])<1e-8);}
});
test('an ordinary drop trajectory can graze the tape without injecting a collision result',()=>{
 const m=new Rally(()=>{},()=>.5);m.start();m.ball={x:0,y:2.6,z:-4.2,vx:0,vy:0,vz:0};m.hit(0,{shot:'drop',power:0},'perfect');m.aiWait=100;advance(m,1.6);assert.equal(m.netCords,1);assert.equal(m.pointCount,1);assert.equal(m.summary.netFaults,0);assert.equal(m.score[0],1);assert.ok(m.ball.z>0&&m.ball.z<2);
});
test('consecutive perfect returns build combo; serves, AI, comparison and early buffering do not fake it',()=>{
 const m=new Rally(()=>{},()=>.5);m.start();const hit=q=>{m.ball={x:0,y:2.3,z:-4.4,vx:0,vy:0,vz:0};m.hit(0,{shot:'clear',power:.5},q);};
 hit('perfect');assert.equal(m.combo,1);m.hit(1,{shot:'clear'},'good');assert.equal(m.combo,1);hit('perfect');hit('perfect');assert.equal(m.combo,3);assert.equal(m.bestCombo,3);hit('good');assert.equal(m.combo,0);hit('perfect');m.ball.y=2.3;m.hit(0,{shot:'clear',inputLead:.5},'perfect');assert.equal(m.combo,0);assert.equal(m.shotHistory.at(-1).judgement,'early');m.ball.y=2.3;m.hit(0,{shot:'clear'},'serve');assert.equal(m.combo,0);m.start({mode:'compare'});hit('perfect');assert.equal(m.combo,0);
});
test('combo survives won points and pause, resets on misses/loss/new match and retains its best',()=>{
 const m=new Rally(()=>{},()=>.5);m.start();m.ball.y=2.3;m.hit(0,{shot:'clear'},'perfect');m.award(0,'ground');assert.equal(m.combo,1);m.pause();m.pause();advance(m,3);assert.equal(m.combo,1);m.state='rally';m.lastHit=1;m.failedSwing('drive');assert.equal(m.combo,0);m.combo=2;m.bestCombo=2;m.award(1,'ground');assert.equal(m.combo,0);assert.equal(m.summary.bestCombo,2);m.start();assert.equal(m.bestCombo,0);
});
test('eight-player tournament completes seven fixtures and three player wins exactly once',()=>{
 const t=new Tournament(()=>.25);t.start();assert.equal(t.snapshot.names.length,8);assert.equal(t.bracket[0].length,4);assert.equal(t.advance(),false);
 for(let round=0;round<3;round++){assert.equal(t.current.round,round);assert.equal(t.current.difficulty,['easy','normal','hard'][round]);const opponent=t.current.opponent;assert.ok(opponent&&opponent!=='나');assert.equal(t.finish({winner:0,score:[11,6],stats:{bestCombo:round+1},condition:42}),true);assert.equal(t.finish({winner:0,score:[11,6]}),false);if(round<2){assert.equal(t.status,'between');assert.equal(t.advance(),true);}else assert.equal(t.status,'champion');}
 assert.equal(t.results.length,3);assert.equal(t.bracket.flat().length,7);assert.ok(t.bracket.flat().every(g=>g.winner!==null));assert.equal(t.bracket[2][0].winner,0);assert.equal(t.advance(),false);
});
test('elimination at any round prevents advance and fresh tournament clears its results',()=>{
 for(let losingRound=0;losingRound<3;losingRound++){const t=new Tournament(()=>.8);t.start('hard');for(let i=0;i<losingRound;i++){t.finish({winner:0,score:[11,2]});t.advance();}assert.equal(t.current.difficulty,'hard');t.finish({winner:1,score:[4,11]});assert.equal(t.status,'eliminated');assert.equal(t.advance(),false);t.start('normal');assert.equal(t.results.length,0);assert.equal(t.round,0);assert.equal(t.current.difficulty,'normal');}
});
test('tournament uses real 11-point scoring; fatigue affects scored matches and rest restores it',()=>{
 const m=new Rally(()=>{},()=>.5);m.start({mode:'tournament'});assert.equal(m.server,0);m.condition=0;const p={...m.players[0]};m.movePlayer(0,1,-3,CFG.playerSpeed,CFG.step);const tired=Math.hypot(m.players[0].x-p.x,m.players[0].z-p.z);m.start({mode:'match'});m.condition=100;const q={...m.players[0]};m.movePlayer(0,1,-3,CFG.playerSpeed,CFG.step);const fresh=Math.hypot(m.players[0].x-q.x,m.players[0].z-q.z);assert.ok(tired<fresh);m.start({mode:'tournament'});m.condition=40;m.state='rally';m.score=[10,9];m.lastHit=0;m.award(0,'ground');assert.equal(m.state,'over');assert.deepEqual(m.score,[11,9]);m.start({mode:'tournament'});assert.equal(m.condition,100);assert.deepEqual(m.score,[0,0]);
});
