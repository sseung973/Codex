const {test}=require('node:test'),assert=require('node:assert/strict');
const {Rally,CFG}=require('../dist/physics.js');
function incoming(difficulty,shot='drive',selected='drive',mode='match'){
 const m=new Rally(()=>{},()=>.5);m.start({difficulty,mode});m.selectShot(selected);m.players[0].x=0;m.players[0].z=-CFG.baseDepth;m.ball={x:0,y:shot==='smash'?3.1:2.05,z:4.8,vx:0,vy:0,vz:0};m.hit(1,{shot,aim:0,power:.85,depth:shot==='drop'?1.35:4.9},'good');return m;
}
test('deep drives and smashes in normal/hard stay near receiving depth instead of pulling the player to net',()=>{
 for(const difficulty of ['normal','hard'])for(const shot of ['drive','smash']){const m=incoming(difficulty,shot);assert.ok(m.landing.z<-4.8);assert.ok(m.contact.y>=CFG.netHeight,JSON.stringify({difficulty,shot,contact:m.contact}));for(let i=0;i<18;i++)m.update(CFG.step);assert.ok(m.players[0].z<-2.5);}
});
test('a natural hard serve return can be taken from the back court with the chosen drive',()=>{
 const m=new Rally(()=>{},()=>.5);m.start({difficulty:'hard'});m.selectShot('drive');m.strike({power:.5});for(let i=0;i<400&&m.lastHit===0;i++)m.update(CFG.step);assert.equal(m.lastDecision.shot,'smash');assert.ok(m.contact.z<-1);while(m.contact.t>.09)m.update(CFG.step);assert.ok(m.players[0].z<-3);assert.equal(m.strike({shot:'drive',power:.6}),true);for(let i=0;i<90&&m.lastHit===1;i++)m.update(CFG.step);assert.equal(m.lastHit,0);assert.equal(m.shotHistory.at(-1).type,'drive');assert.ok(m.players[0].z<-3);assert.ok(m.shotHistory.at(-1).origin.z<-1);assert.equal(m.state,'rally');for(let i=0;i<200&&m.lastHit===0&&m.state==='rally'&&m.ball.z<=0;i++)m.update(CFG.step);assert.ok(m.ball.z>0);assert.equal(m.score[1],0);
});
test('actual short drops still bring the player forward, and high shot changes retain their height restriction',()=>{
 const m=incoming('normal','drop');assert.ok(m.landing.z>-1.5);assert.ok(m.contact.z>-1.5);for(let i=0;i<55;i++)m.update(CFG.step);assert.ok(m.players[0].z>-CFG.baseDepth+.5);const high=incoming('hard','clear','clear');high.selectShot('smash');assert.ok(high.contact.y>2.95);const low=incoming('hard','drive','smash');assert.ok(low.contact.y<2.65);assert.equal(low.strike({shot:'smash'}),false);
});
test('receiving target is stable across frame rates and slow tournament movement stays bounded',()=>{
 const positions=[];for(const fps of [30,60,120]){const m=incoming('hard','smash');for(let i=0;i<fps/5;i++)m.update(1/fps);positions.push({...m.players[0]});}assert.deepEqual(positions[0],positions[1]);assert.deepEqual(positions[0],positions[2]);const m=incoming('hard','drive','drive','tournament');m.condition=0;m.retarget(0);assert.ok(m.contact.z<-1);m.update(.1);assert.ok(m.players[0].z<-2.5);assert.ok(Math.hypot(m.players[0].vx,m.players[0].vz)<=CFG.playerSpeed+.001);
});
