const {test}=require('node:test'),assert=require('node:assert/strict');
const {normalize,profileFor,resolve,overlaps}=require('../dist/layout.js');
test('stored positions are independent normalized profiles and malformed profiles safely fall back',()=>{
 const row=Object.fromEntries(['clear','drop','drive','smash'].map(id=>[id,{x:2,y:-1}]));const source={desktop:row,'touch-portrait':{clear:{x:0,y:0}}},result=normalize(source);
 assert.deepEqual(Object.keys(result),['desktop']);assert.deepEqual(result.desktop.clear,{x:1,y:0});result.desktop.clear.x=.5;assert.equal(source.desktop.clear.x,2);
 for(const value of [null,'broken',[],{desktop:{clear:{x:Infinity,y:0}}}])assert.deepEqual(normalize(value),{});
});
test('desktop, touch portrait and touch landscape select distinct position profiles',()=>{assert.equal(profileFor(false,1200,800),'desktop');assert.equal(profileFor(false,600,900),'desktop');assert.equal(profileFor(true,390,844),'touch-portrait');assert.equal(profileFor(true,844,390),'touch-landscape');});
test('individual buttons stay in bounds and avoid one another and protected controls on phones and tablets',()=>{
 for(const [width,height]of [[320,568],[844,390],[834,1194],[1440,1000]]){
  const bounds={x:12,y:12,width:width-24,height:height-24},size={width:Math.min(120,(width-44)/4),height:64},blocked=[{x:12,y:12,width:width-24,height:130}],placed=[];
  for(let i=0;i<4;i++){const p=resolve({x:-100,y:-100},size,bounds,[...blocked,...placed]);assert.ok(p.x>=bounds.x&&p.y>=bounds.y);assert.ok(p.x+size.width<=width-12&&p.y+size.height<=height-12);assert.ok([...blocked,...placed].every(b=>!overlaps({...p,...size},b)));placed.push({...p,...size});}
 }
});
test('an available requested position is preserved while off-screen requests clamp to a reachable edge',()=>{const bounds={x:10,y:10,width:300,height:500},size={width:70,height:60};assert.deepEqual(resolve({x:120,y:250},size,bounds),{x:120,y:250});assert.deepEqual(resolve({x:900,y:900},size,bounds),{x:240,y:450});});
