(function(root){
'use strict';
const CFG={step:1/120,gravity:9.81,drag:.065,halfWidth:2.59,halfLength:6.7,netHeight:1.55,netCord:{band:.035,overHeight:.005,minForward:1.5,maxFall:8,retain:.22,lift:.8,clearance:.045},condition:{minSpeed:.9,hitCost:.85,moveCost:.18,restRate:2.6},dive:{contactDelay:.08,minHeight:.3,height:1.8,uprightHeight:1.2,triggerGap:.5,extension:1.05,reachExtension:.12,reachTime:.14,accelTime:.05,runWindow:.22,runMargin:.12,brakeTime:.18,poseReach:.22,speed:6.4,maxTravel:.9,duration:.26,getUp:.58,cooldown:3.2,cost:2.8,minCondition:10},block:{maxPower:.42,minDepth:1.3,maxDepth:1.9,baseDuration:.72,distanceTime:.055,clearance:.055,maxDuration:1.8},adaptation:{window:8,decay:.82,minSamples:3,fullSamples:5,dominance:.65,lateral:.95,depth:.7,strength:{easy:.2,normal:.7,hard:1}},lineTolerance:.03,smash:{baseDuration:.56,powerTime:.06,recovery:.28},drop:{minDepth:.85,depthRange:.45,minDuration:.38,maxDuration:2.2,clearance:.07},drive:{lowHeight:1.65,clearance:.07,maxDuration:1.5},contactHeight:2.05,contactRadius:1.5,contactDepth:1.8,buffer:.65,bufferMax:2.6,bufferGrace:.25,perfect:.14,good:.32,playerSpeed:8.5,recoverySpeed:5.6,receive:{depthWeight:2,heightWeight:1,shortDepth:2.3,shortHeightWeight:4,shortReachInset:.25},recoveryDelay:.18,baseDepth:3.7,splitDuration:.20,resumeSeconds:3,serve:{shortDepth:2.2,shortDuration:1.18,stanceX:1.25,shortLine:1.98,inset:.2},risk:{lineStart:.65,lineInset:.04,powerStart:.78,clearDepth:.60,earlyLead:.30,lateLead:-.10,outwardBase:.14,outwardPower:.18,clearOverhit:.28},ai:{easy:{speed:3.4,delay:.34,error:.55},normal:{speed:5,delay:.2,error:.3},hard:{speed:6.7,delay:.09,error:.12}}};
const VENUES={indoor:{label:'클럽 코트'},outdoor:{label:'야외 코트',outdoor:true},sunset:{label:'노을 코트',outdoor:true}};
const CROSSWINDS=[-.85,.85,-1.15,1.15];
function normalizeVenue(venue){return typeof venue==='string'&&Object.hasOwn(VENUES,venue)?venue:'indoor';}
function windForRally(venue,pointCount){return VENUES[normalizeVenue(venue)].outdoor?CROSSWINDS[pointCount%CROSSWINDS.length]:0;}
const SHOTS={clear:{label:'클리어',hint:'높고 멀리 · 상대 뒤쪽',color:'#b7d4c3',contact:2.3,min:.65,max:3.3},drop:{label:'드롭',hint:'짧고 낮게 · 네트 바로 뒤',color:'#a3b4cf',contact:2.6,min:.65,max:3.2},drive:{label:'드라이브',hint:'낮고 빠르게 · 약하게는 블록',color:'#d8be7a',contact:1.9,min:.6,max:2.35},smash:{label:'스매시',hint:'높은 공을 강하게 · 아래로 꽂기',color:'#d5a18e',contact:3.05,min:2.65,max:3.25}};
const SERVES={short:{label:'숏서브',shot:'drop'},long:{label:'롱서브',shot:'clear'}};
const AI_STYLES={
 balanced:{label:'균형형',hint:'빈 공간에 맞춰 타구 선택',baseDepth:3.7,weights:{}},
 attacker:{label:'공격형',hint:'빠른 드라이브와 높은 공 스매시',baseDepth:3.35,weights:{drive:3,smash:5}},
 defender:{label:'수비형',hint:'깊은 클리어로 시간을 벌기',baseDepth:4.25,weights:{clear:4,smash:-3}},
 net:{label:'네트형',hint:'짧은 드롭으로 앞쪽 공략',baseDepth:2.85,weights:{drop:4,drive:1}}
};
const ATHLETES={
 jun:{id:'jun',name:'준',role:'스매시형',number:'01',hair:'short',hint:'스매시·드라이브가 빠르고, 이동과 타격 제어는 조금 낮아요.',stats:{attack:7,footwork:4,control:4}},
 nara:{id:'nara',name:'나래',role:'기동형',number:'07',hair:'tied',hint:'이동·중앙 복귀가 빠르고, 공격 속도와 타격 제어는 조금 낮아요.',stats:{attack:4,footwork:7,control:4}},
 eden:{id:'eden',name:'이든',role:'정교형',number:'12',hair:'sweep',hint:'타이밍 여유가 넓고 코스 오차가 작지만, 공격과 이동은 조금 느려요.',stats:{attack:4,footwork:4,control:7}},
 haru:{id:'haru',name:'하루',role:'균형형',number:'05',hair:'short',hint:'공격·이동·제어가 고른 균형형이에요.',stats:{attack:5,footwork:5,control:5}}
};
function normalizeAthlete(id){return typeof id==='string'&&Object.hasOwn(ATHLETES,id)?id:'jun';}
function athleteFactors(id,neutral=false){const stats=ATHLETES[normalizeAthlete(id)].stats;return Object.fromEntries(Object.entries(stats).map(([key,value])=>[key,neutral?1:1+(value-5)*.04]));}
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=x=>{const t=clamp(x,0,1);return t*t*(3-2*t);};
function diveReach(dive,time){return dive?CFG.dive.reachExtension*smooth((time-dive.time)/CFG.dive.reachTime):0;}
// Integrate a smooth acceleration/braking envelope; the path never changes on hit.
function diveProgress(age){
 const c=CFG.dive,t=clamp(age,0,c.duration),brake=c.duration-c.brakeTime,area=u=>u*u*u-u*u*u*u/2;
 const distance=t<c.accelTime?c.accelTime*area(t/c.accelTime):t<=brake?t-c.accelTime/2:brake-c.accelTime/2+(t-brake)-c.brakeTime*area((t-brake)/c.brakeTime);
 return clamp(distance/(c.duration-(c.accelTime+c.brakeTime)/2),0,1);
}
function readPatterns(history,difficulty='normal',style='balanced'){
 const c=CFG.adaptation,base=AI_STYLES[style]?.baseDepth??CFG.baseDepth,shots=history.slice(-c.window),n=shots.length,cover={x:0,z:base},result={samples:n,shot:null,lateral:'center',depth:'balanced',confidence:0,cover};
 if(n<c.minSamples)return result;
 const bins={shot:{},lateral:{},depth:{}};let total=0;
 shots.forEach((s,i)=>{const weight=Math.pow(c.decay,n-1-i),keys={shot:s.shot,lateral:s.x<-.65?'left':s.x>.65?'right':'center',depth:s.z<2.7?'front':s.z>4.2?'back':'middle'};total+=weight;for(const [axis,key]of Object.entries(keys))bins[axis][key]=(bins[axis][key]||0)+weight;});
 const strength=(c.strength[difficulty]??c.strength.normal)*clamp((n-c.minSamples+1)/(c.fullSamples-c.minSamples+1),0,1);
 for(const axis of Object.keys(bins)){const [key,value]=Object.entries(bins[axis]).sort((a,b)=>b[1]-a[1])[0],confidence=clamp((value/total-c.dominance)/(1-c.dominance),0,1)*strength;if(confidence<=0)continue;result[axis]=key;result.confidence=Math.max(result.confidence,confidence);if(axis==='lateral')cover.x=(key==='left'?-1:key==='right'?1:0)*c.lateral*confidence;if(axis==='depth')cover.z=clamp(base+(key==='front'?-1:key==='back'?1:0)*c.depth*confidence,1.8,5.2);}
 return result;
}
function serviceCourt(side,score){const right=score%2===0,sign=(side===0?1:-1)*(right?1:-1);return {side,right,serverX:sign*CFG.serve.stanceX,receiverX:-sign*CFG.serve.stanceX,minX:sign>0?-CFG.halfWidth:0,maxX:sign>0?0:CFG.halfWidth,minZ:side===0?CFG.serve.shortLine:-CFG.halfLength,maxZ:side===0?CFG.halfLength:-CFG.serve.shortLine};}
function legalService(point,court){return point.x>=court.minX-CFG.lineTolerance&&point.x<=court.maxX+CFG.lineTolerance&&point.z>=court.minZ-CFG.lineTolerance&&point.z<=court.maxZ+CFG.lineTolerance;}
function strokeSide(side,player,ball){const hand=side===0?1:-1,offset=ball.x-player.x;return (Math.abs(offset)>.12?offset:(ball.vx||0)*.15)*hand<-.12?'backhand':'forehand';}
function integrate(b,dt=CFG.step,wind=0){
 const airVx=b.vx-wind,drag=CFG.drag*Math.hypot(airVx,b.vy,b.vz);
 b.vx-=airVx*drag*dt;b.vy-=(CFG.gravity+b.vy*drag)*dt;b.vz-=b.vz*drag*dt;
 b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;
 return b;
}
function collideNet(ball,previous,dt=CFG.step,wind=0){
 if(!(((previous.z<=0&&ball.z>=0)||(previous.z>=0&&ball.z<=0))&&previous.z!==ball.z))return null;
 const u=-previous.z/(ball.z-previous.z),height=previous.y+(ball.y-previous.y)*u,x=previous.x+(ball.x-previous.x)*u;
 if(Math.abs(x)>=3.1||height>=CFG.netHeight+CFG.netCord.band)return null;
 const point={x,y:height,z:0},incoming={vx:ball.vx,vy:ball.vy,vz:ball.vz};
 const over=height>=CFG.netHeight+CFG.netCord.overHeight&&Math.abs(ball.vz)>=CFG.netCord.minForward&&ball.vy>-CFG.netCord.maxFall;
 if(!over){Object.assign(ball,point);return {over:false,point,incoming};}
 const direction=Math.sign(ball.vz);Object.assign(ball,{x,y:CFG.netHeight+CFG.netCord.band+.005,z:direction*CFG.netCord.clearance,vx:ball.vx*CFG.netCord.retain,vy:CFG.netCord.lift,vz:ball.vz*CFG.netCord.retain});
 const outgoing={vx:ball.vx,vy:ball.vy,vz:ball.vz};if(u<1)integrate(ball,dt*(1-u),wind);
 return {over:true,point,incoming,outgoing};
}
function simulate(pos,v,t){const b={...pos,vx:v[0],vy:v[1],vz:v[2]};for(let s=0;s<t-1e-8;s+=CFG.step)integrate(b,Math.min(CFG.step,t-s));return [b.x,b.y,b.z];}
function solve3(A,b){A=A.map((r,i)=>[...r,b[i]]);for(let j=0;j<3;j++){let best=j;for(let i=j+1;i<3;i++)if(Math.abs(A[i][j])>Math.abs(A[best][j]))best=i;[A[j],A[best]]=[A[best],A[j]];const d=A[j][j];if(Math.abs(d)<1e-7)return [0,0,0];for(let k=j;k<4;k++)A[j][k]/=d;for(let i=0;i<3;i++)if(i!==j){const f=A[i][j];for(let k=j;k<4;k++)A[i][k]-=f*A[j][k];}}return A.map(r=>r[3]);}
function velocityTo(pos,target,t){let v=[(target.x-pos.x)/t,(target.y-pos.y)/t+CFG.gravity*t*.5,(target.z-pos.z)/t];for(let iter=0;iter<7;iter++){const base=simulate(pos,v,t),error=[target.x-base[0],target.y-base[1],target.z-base[2]];if(Math.hypot(...error)<.003)break;const columns=v.map((_,i)=>{const q=v.slice();q[i]+=.025;return simulate(pos,q,t).map((x,k)=>(x-base[k])/.025)});const dv=solve3([0,1,2].map(i=>columns.map(c=>c[i])),error);v=v.map((x,i)=>clamp(x+dv[i],-90,90));}return {vx:v[0],vy:v[1],vz:v[2]};}
function netCrossingHeight(pos,velocity){const b={...pos,...velocity};for(let i=0;i<300&&b.y>0;i++){const previous={...b};integrate(b);if(previous.z*b.z<=0&&previous.z!==b.z)return previous.y+(b.y-previous.y)*(-previous.z/(b.z-previous.z));}return -Infinity;}
function driveFlight(pos,target,duration,ensureClearance=false){
 const velocity=velocityTo(pos,target,duration),required=CFG.netHeight+CFG.drive.clearance;
 if(!ensureClearance&&pos.y>=CFG.drive.lowHeight||netCrossingHeight(pos,velocity)>=required)return {velocity,duration};
 let low=duration,high=Math.max(duration,CFG.drive.maxDuration),best=velocityTo(pos,target,high);
 if(netCrossingHeight(pos,best)<required)return {velocity:best,duration:high};
 for(let i=0;i<8;i++){const t=(low+high)/2,v=velocityTo(pos,target,t);if(netCrossingHeight(pos,v)>=required){high=t;best=v;}else low=t;}
 return {velocity:best,duration:high};
}
function blockFlight(pos,target){
 let low=CFG.block.baseDuration+Math.abs(target.z-pos.z)*CFG.block.distanceTime,high=Math.max(low,CFG.block.maxDuration),velocity=velocityTo(pos,target,low),required=CFG.netHeight+CFG.block.clearance;
 if(netCrossingHeight(pos,velocity)>=required)return {velocity,duration:low};
 let best=velocityTo(pos,target,high);if(netCrossingHeight(pos,best)<required)return {velocity:best,duration:high};
 for(let i=0;i<8;i++){const t=(low+high)/2,v=velocityTo(pos,target,t);if(netCrossingHeight(pos,v)>=required){high=t;best=v;}else low=t;}
 return {velocity:best,duration:high};
}
// Use the shortest flight that clears the tape. A front-court touch must not
// inherit the hang time of a drop hit from the back of the court.
function dropFlight(pos,target){
 let low=CFG.drop.minDuration,high=CFG.drop.maxDuration,velocity=velocityTo(pos,target,low);
 const required=CFG.netHeight+CFG.drop.clearance;
 if(netCrossingHeight(pos,velocity)>=required)return {velocity,duration:low};
 let best=velocityTo(pos,target,high);
 if(netCrossingHeight(pos,best)<required)return {velocity:best,duration:high};
 for(let i=0;i<10;i++){const t=(low+high)/2,v=velocityTo(pos,target,t);if(netCrossingHeight(pos,v)>=required){high=t;best=v;}else low=t;}
 return {velocity:best,duration:high};
}
// Do not replace a reachable running reception with a dive/get-up lockout.
function needsDive(ball,gap,speed,minHeight){const window=clamp((ball.y-Math.max(minHeight,CFG.dive.uprightHeight))/Math.max(.5,-ball.vy)-CFG.dive.accelTime,0,CFG.dive.runWindow);return gap>Math.max(CFG.dive.triggerGap,speed*window+CFG.dive.runMargin)&&gap<=CFG.dive.extension;}
// The contact point is where the racket meets the shuttle, not where the feet must stand.
function receiveTarget(point,side,player=null){const z=side===0&&player&&point.z>player.z?Math.max(player.z,point.z-CFG.contactDepth+(point.reachInset||0)):point.z;return {x:clamp(point.x,-2.5,2.5),z:clamp(z,side===0?-6.3:.8,side===0?-.8:6.3)};}
function chooseReceive(candidates,receiver,side,height,landing){
 const short=landing&&Math.abs(landing.z)<CFG.receive.shortDepth,inset=short?CFG.receive.shortReachInset:0,weight=short?CFG.receive.shortHeightWeight:CFG.receive.heightWeight;
 const best=[null,null,null],reachable=[null,null,null],bestScore=[Infinity,Infinity,Infinity],reachScore=[Infinity,Infinity,Infinity],p=receiver.player;
 for(const point of candidates){
  const candidate=inset?{...point,reachInset:inset}:point,target=receiveTarget(candidate,side,p),score=Math.hypot(target.x-p.x,(target.z-p.z)*CFG.receive.depthWeight)+(height-candidate.y)*weight;
  const tier=candidate.y>=(receiver.preferredMinHeight??receiver.minHeight)?0:candidate.y>=receiver.minHeight?1:2;
  if(score<bestScore[tier]){best[tier]=candidate;bestScore[tier]=score;}
  const travel=Math.hypot(Math.max(0,Math.abs(candidate.x-p.x)-CFG.contactRadius),Math.max(0,Math.abs(candidate.z-p.z)-CFG.contactDepth+inset));
  if(travel<=receiver.speed*candidate.t&&score<reachScore[tier]){reachable[tier]=candidate;reachScore[tier]=score;}
 }
 return [0,1,2].map(i=>reachable[i]||best[i]).find(Boolean)||null;
}
function predict(ball,side,height=CFG.contactHeight,receiver=null,wind=0){
 const b={...ball},candidates=[];let landing=null,contact=null;
 for(let i=1;i<600;i++){
  const before={...b};integrate(b,CFG.step,wind);const net=collideNet(b,before,CFG.step,wind);if(net&&!net.over)return {contact:null,landing:null};
  const own=side===0?b.z<-.45:b.z>.45;
  if(own&&b.vy<0&&b.y<=height&&b.y>.25){const candidate={x:b.x,y:b.y,z:b.z,t:i*CFG.step};if(!contact)contact=candidate;if(receiver)candidates.push(candidate);}
  if(b.y<=0){landing={x:b.x,z:b.z,t:i*CFG.step};break;}
 }
 // A genuinely short ball must be taken high, with spare racket reach. Waiting
 // at the exact reach boundary can leave no legal frame before it falls too low.
 return {contact:receiver?chooseReceive(candidates,receiver,side,height,landing):contact,landing};
}
const COMPARE_ORDER=['clear','drop','drive','smash'];
function chooseAIShot({player,ball,difficulty='normal',style='balanced',incoming=null,rally=0,random=Math.random}){
 const identity=AI_STYLES[style]||AI_STYLES.balanced;
 if(difficulty==='easy'){const roll=random(),shot=rally<8||ball.y<1.85?'clear':style==='net'&&roll<.65?'drop':roll<(style==='defender'?.9:style==='attacker'?.35:.7)?'clear':'drive';return {shot,aim:clamp((player.x+(random()-.5)*.45)/2.05,-.8,.8),power:.36,depth:shot==='drop'?1.4:shot==='drive'?4.8:5.4,strategy:'rally',style:AI_STYLES[style]?style:'balanced'};}
 const candidates=[];for(const x of [-1.9,1.9]){
  candidates.push({shot:'clear',x,z:-5.8,flight:2.15});
  if(incoming==='smash'&&ball.y<=2.35&&['defender','net'].includes(style))candidates.push({shot:'drive',block:true,x,z:-1.6,flight:1.05});
  if(ball.y>=1.8)candidates.push({shot:'drop',x,z:-1.35,flight:1.18});
  if(ball.y<=2.35)candidates.push({shot:'drive',x,z:-4.8,flight:.82});
  if((difficulty==='hard'||difficulty==='normal'&&style==='attacker')&&ball.y>=SHOTS.smash.min)candidates.push({shot:'smash',x,z:-4.9,flight:CFG.smash.baseDuration+CFG.smash.powerTime*(1-(difficulty==='hard'?.85:.62))});
 }
 for(const c of candidates){const distance=Math.hypot(c.x-player.x,c.z-player.z);const gap=c.z>-2&&player.z<-4?1.5:c.z<-4&&player.z>-2.5?1.5:0;c.score=(difficulty==='hard'?distance/Math.max(.7,c.flight)+gap:distance+gap+(c.shot==='clear'||c.shot==='drop'?.3:0))+(identity.weights[c.shot]||0)+(c.block?5:0);}
 candidates.sort((a,b)=>b.score-a.score);const c=candidates[difficulty==='normal'&&random()<.18?Math.min(1,candidates.length-1):0];
 return {shot:c.shot,block:!!c.block,aim:clamp((c.x+(random()-.5)*(difficulty==='hard'?.18:.4))/2.05,-1,1),depth:Math.abs(c.z),power:difficulty==='hard'?.85:.62,strategy:(c.z>-2?'front':'back')+(c.x<0?'-left':'-right'),style:AI_STYLES[style]?style:'balanced'};
}
class Rally{
 constructor(onEvent=()=>{},random=Math.random){this.onEvent=onEvent;this.random=random;this.state='menu';this.mode='match';this.difficulty='easy';this.aiStyle='balanced';this.debug=false;this.selectedShot='drive';this.selectedServe='long';this.reset();}
 emit(type,data){this.onEvent(type,data);}
 reset(){this.venue='indoor';this.wind=0;this.athleteId='jun';this.aiReads=[];this.service=null;this.activeServe=null;this.combo=0;this.bestCombo=0;this.netCords=0;this.lastNetCord=null;this.conditions=[100,100];this.resumeRemaining=0;this.time=0;this.accumulator=0;this.players=[{x:-.6,z:-4.5,swing:0},{x:.6,z:4.5,swing:0}].map(p=>({...p,vx:0,vz:0,steps:0,recovery:0,split:0,dive:null,diveCooldown:0}));this.ball={x:-.6,y:1.5,z:-4.2,vx:0,vy:0,vz:0};this.score=[0,0];this.rally=0;this.best=0;this.lastHit=-1;this.server=0;this.feedTimer=0;this.pending=null;this.cooldown=0;this.contact=null;this.landing=null;this.aiWait=0;this.shotHistory=[];this.lastFeedback='';this.pointCount=0;this.comparisons=[];this.activeTrace=null;this.lastDecision=null;this.stats={net:0,out:0,shots:Object.fromEntries(Object.keys(SHOTS).map(type=>[type,{attempts:0,successes:0}]))};this.activePlayerShot=null;}
 start({difficulty='easy',mode='match',aiStyle='balanced',athlete='jun',venue='indoor'}={}){this.reset();this.athleteId=normalizeAthlete(athlete);this.difficulty=CFG.ai[difficulty]?difficulty:'easy';this.aiStyle=AI_STYLES[aiStyle]?aiStyle:'balanced';this.mode=['practice','compare','tournament'].includes(mode)?mode:'match';if(this.mode==='compare')this.selectedShot='clear';else this.venue=normalizeVenue(venue);this.server=this.scored?0:1;this.state='serve';this.emit('start');this.prepareServe();}
 prepareServe(){this.wind=windForRally(this.venue,this.pointCount);this.state='serve';this.pending=null;this.cooldown=0;this.contact=null;this.landing=null;this.rally=0;this.service=this.scored?serviceCourt(this.server,this.score[this.server]):null;this.activeServe=null;this.players[0].x=-.6;this.players[0].z=-4.5;this.players[1].x=.6;this.players[1].z=4.5;if(this.service){this.players[this.server].x=this.service.serverX;this.players[1-this.server].x=this.service.receiverX;}for(const p of this.players){p.impact=null;p.dive=null;p.diveCooldown=0;p.swing=0;p.vx=p.vz=p.steps=p.recovery=p.split=0;}this.ball={x:this.players[this.server].x,y:1.55,z:this.server===0?-4.2:4.2,vx:0,vy:0,vz:0};this.feedTimer=1.1;this.emit('serve',this.server);}
 selectServe(type){if(!SERVES[type]||this.state!=='serve'||this.server!==0)return false;this.selectedServe=type;return true;}
 selectShot(type){if(!SHOTS[type])return;this.selectedShot=type;const incoming=(this.state==='rally'||['paused','countdown'].includes(this.state)&&this.previous==='rally')&&this.lastHit===1;if(incoming)this.retarget(0);if(this.pending){this.pending.shot=type;this.pending.ttl=Math.max(this.pending.ttl,this.swingLifetime());this.pending.inputLead=(this.contact?.t??0)+this.time-(this.pending.inputTime??this.time);if(type==='smash'&&this.contact&&this.contact.y<SHOTS.smash.min){this.pending=null;this.emit('unavailable','smash');}}}
 get adaptation(){return readPatterns(this.scored?this.aiReads:[],this.difficulty,this.mode==='compare'?'balanced':this.aiStyle);}
 observePlayerReturn(){const shot=this.shotHistory.at(-1);if(!this.scored||this.lastHit!==0||!shot||shot.side!==0||shot.serve)return;this.aiReads.push({shot:shot.variant==='block'?'block':shot.type,x:shot.target.x,z:Math.abs(shot.target.z)});if(this.aiReads.length>CFG.adaptation.window)this.aiReads.shift();}
 get condition(){return this.conditions[0];}
 set condition(value){this.conditions[0]=clamp(Number(value)||0,0,100);}
 spendEnergy(side,cost){if(this.scored)this.conditions[side]=Math.max(0,this.conditions[side]-cost);}
 get scored(){return ['match','tournament'].includes(this.mode);}
 failedSwing(type){this.combo=0;if(this.stats.shots[type])this.stats.shots[type].attempts++;}
 settlePlayerShot(success){if(!this.activePlayerShot)return;if(success)this.stats.shots[this.activePlayerShot].successes++;this.activePlayerShot=null;}
 get summary(){return {bestRally:this.best,bestCombo:this.bestCombo,netCords:this.netCords,netFaults:this.stats.net,outFaults:this.stats.out,shots:Object.fromEntries(Object.entries(this.stats.shots).map(([type,row])=>[type,{...row,rate:row.attempts?Math.round(row.successes/row.attempts*100):null}]))};}
 retarget(side){const profile=SHOTS[this.selectedShot],receiver=side===0&&this.mode!=='compare'?{player:this.players[0],speed:this.movementSpeed(0,CFG.playerSpeed),minHeight:profile.min,preferredMinHeight:this.selectedShot==='drive'?CFG.netHeight:profile.min}:null;const p=predict(this.ball,side,side===0?profile.contact:this.difficulty==='hard'||this.difficulty==='normal'&&this.aiStyle==='attacker'?3.15:CFG.contactHeight,receiver,this.wind);this.contact=p.contact;this.landing=p.landing;}
 get athlete(){return ATHLETES[normalizeAthlete(this.athleteId)];}
 get athleteModifiers(){return athleteFactors(this.athleteId,this.mode==='compare');}
 movementSpeed(side,speed){const pace=side===0&&!this.players[0].dive?this.athleteModifiers.footwork:1;return speed*pace*(this.scored?CFG.condition.minSpeed+(1-CFG.condition.minSpeed)*this.conditions[side]/100:1);}
 tryDive(side){
  const p=this.players[side],b=this.ball,min=side===0?SHOTS[this.pending?.shot||this.selectedShot].min:.55;
  if(this.mode==='compare'||p.dive||p.diveCooldown>0||this.conditions[side]<CFG.dive.minCondition||b.y>CFG.dive.height||b.y<min||b.vy>=0||side===0&&!['clear','drive'].includes(this.pending?.shot||this.selectedShot))return false;
  if(this.landing&&(Math.abs(this.landing.x)>CFG.halfWidth+CFG.lineTolerance||Math.abs(this.landing.z)>CFG.halfLength+CFG.lineTolerance))return false;
  const next={...b};for(let i=0;i<6;i++)integrate(next,CFG.step,this.wind);
  const rx=side===0?CFG.contactRadius:1.15,rz=side===0?CFG.contactDepth:1.55,gap=Math.hypot(Math.max(0,Math.abs(next.x-p.x)-rx),Math.max(0,Math.abs(next.z-p.z)-rz));
  if(!needsDive(b,gap,this.movementSpeed(side,side===0?CFG.playerSpeed:CFG.ai[this.difficulty].speed),min))return false;
  const dx=next.x-p.x,dz=next.z-p.z,length=Math.hypot(dx,dz)||1,distance=Math.min(CFG.dive.maxTravel,gap);
  p.dive={time:this.time,startX:p.x,startZ:p.z,x:clamp(p.x+dx/length*distance,-2.5,2.5),z:clamp(p.z+dz/length*distance,side===0?-6.3:.8,side===0?-.8:6.3),direction:Math.abs(next.x-p.x)>.1?Math.sign(next.x-p.x):side===0?1:-1,travel:0,hit:false};p.diveCooldown=CFG.dive.cooldown;this.spendEnergy(side,CFG.dive.cost);this.emit('dive',{side});return true;
 }
 moveDive(side,dt){const p=this.players[side],dive=p.dive;if(!dive||this.time-dive.time>CFG.dive.duration||dive.travel>=CFG.dive.maxTravel)return;const before={x:p.x,z:p.z},progress=diveProgress(this.time-dive.time);this.movePlayer(side,dive.startX+(dive.x-dive.startX)*progress,dive.startZ+(dive.z-dive.startZ)*progress,CFG.dive.speed,dt,1e-7);dive.travel+=Math.hypot(p.x-before.x,p.z-before.z);}
 cancelSwing(){this.pending=null;}
 movePlayer(side,x,z,speed,dt,tolerance=.01){speed=this.movementSpeed(side,speed);const p=this.players[side],dx=x-p.x,dz=z-p.z,len=Math.hypot(dx,dz);if(len<=tolerance)return;const amount=Math.min(1,speed*dt/len);p.vx=dx*amount/dt;p.vz=dz*amount/dt;p.x+=dx*amount;p.z+=dz*amount;p.steps+=len*amount*5.5;this.spendEnergy(side,len*amount*CFG.condition.moveCost);}
 pause(){if(this.state==='countdown'){this.resumeRemaining=0;this.state='paused';this.emit('pause');}else if(['serve','rally','point'].includes(this.state)){this.previous=this.state;this.pending=null;this.state='paused';this.emit('pause');}else if(this.state==='paused'){this.pending=null;this.resumeRemaining=CFG.resumeSeconds;this.state='countdown';this.emit('countdown',Math.ceil(this.resumeRemaining));}}
 swingLifetime(){return Math.max(CFG.buffer,Math.min(CFG.bufferMax,(this.contact?.t??0)+CFG.bufferGrace));}
 strike(input={}){const dive=this.players[0].dive;if(dive&&this.time-dive.time>=CFG.dive.duration){this.emit('recovering');return false;}if(this.state==='serve'&&this.server===0){this.hit(0,{...input,shot:SERVES[this.selectedServe].shot,serve:this.selectedServe},'serve');return true;}if(this.state!=='rally'||this.lastHit!==1||this.cooldown>0)return false;const shot=SHOTS[input.shot]?input.shot:this.selectedShot;if(shot==='smash'&&this.contact&&this.contact.y<SHOTS.smash.min){this.emit('unavailable','smash');return false;}this.pending={kind:input.kind||'keyboard',shot,inputTime:this.time,inputLead:this.contact?.t??0,aim:this.mode==='compare'?0:clamp(input.aim||0,-1,1),power:this.mode==='compare'?.6:clamp(input.power??.55,0,1),block:this.mode!=='compare'&&input.block===true,ttl:this.swingLifetime()};this.emit('swing');return true;}
 hit(side,input={},judgement='good'){const b=this.ball,dir=side===0?1:-1;const type=SHOTS[input.shot]?input.shot:'drive';let power=clamp(input.power??.55,0,1),aim=clamp(input.aim||0,-1,1);if(type==='smash'&&b.y<SHOTS.smash.min){if(side===0)this.emit('unavailable','smash');this.pending=null;return false;}
 if(side===1&&judgement!=='serve')this.observePlayerReturn();
 const control=side===0?this.athleteModifiers.control:1;
 const playerRisk=side===0&&this.mode!=='compare'&&judgement!=='serve',line=playerRisk?Math.pow(clamp((Math.abs(aim)-CFG.risk.lineStart)/(1-CFG.risk.lineStart),0,1),2):0,push=playerRisk&&type==='clear'?Math.pow(clamp((power-CFG.risk.powerStart)/(1-CFG.risk.powerStart),0,1),2):0;
 if((line>0||push>0)&&Number.isFinite(input.inputLead)){if(input.inputLead>CFG.risk.earlyLead)judgement='early';else if(input.inputLead<CFG.risk.lateLead)judgement='late';}
 if(playerRisk&&judgement==='perfect'&&Number.isFinite(input.inputLead)&&Math.abs(input.inputLead)>CFG.perfect*control)judgement=Math.abs(input.inputLead)<=CFG.good*control?'good':input.inputLead>0?'early':'late';
 const block=type==='drive'&&judgement!=='serve'&&this.mode!=='compare'&&(input.block===true||power<=CFG.block.maxPower);
 const badTiming=judgement==='early'||judgement==='late';
 const timingError=(this.mode==='compare'?0:badTiming?(this.random()-.5)*.8:judgement==='good'?(this.random()-.5)*.18:0)/control;const target={x:aim*2.05+timingError,y:.025,z:dir*4.7};let duration=.88-.14*power;
 if(type==='clear'){target.z=dir*(5.2+power*.75);duration=2.05+.18*power;}
 if(type==='drop'){target.z=dir*(CFG.drop.minDepth+power*CFG.drop.depthRange);}
 if(type==='smash'){target.z=dir*(4.4+power*.6);duration=CFG.smash.baseDuration+CFG.smash.powerTime*(1-power);}
 if(side===0&&judgement==='serve'&&input.serve==='short'){target.z=CFG.serve.shortDepth+power*.15;duration=CFG.serve.shortDuration;}
 if(judgement==='serve'&&this.scored){this.activeServe=serviceCourt(side,this.score[side]);const court=this.activeServe;target.x=(court.minX+court.maxX)/2+aim*((court.maxX-court.minX)/2-CFG.serve.inset);}else this.activeServe=null;
 if(playerRisk){target.x+=Math.sign(aim)*line*(CFG.halfWidth-CFG.risk.lineInset-2.05+(badTiming?(CFG.risk.outwardBase+CFG.risk.outwardPower*power)/control:0));if(type==='clear')target.z+=dir*push*(CFG.risk.clearDepth+(badTiming?CFG.risk.clearOverhit:0));}
 if(side===0&&judgement!=='serve'&&this.mode!=='compare'){this.combo=judgement==='perfect'?this.combo+1:0;this.bestCombo=Math.max(this.bestCombo,this.combo);}
 if(judgement!=='serve')this.spendEnergy(side,CFG.condition.hitCost);
 if(side===1)this.settlePlayerShot(true);else if(judgement!=='serve'){this.settlePlayerShot(false);this.stats.shots[type].attempts++;this.activePlayerShot=type;}
 // A high clear or deep defensive contact requires enough time to cross above the net.
 if(side===1&&input.depth)target.z=-clamp(input.depth,1,6.1);
 if(block)target.z=dir*(side===1&&input.depth?clamp(input.depth,CFG.block.minDepth,CFG.block.maxDepth):CFG.block.minDepth+(CFG.block.maxDepth-CFG.block.minDepth)*clamp(power/CFG.block.maxPower,0,1));
 if(type==='drive'&&!block)duration=Math.max(duration,.60+Math.abs(target.z-b.z)*.021);
 if(side===0&&judgement!=='serve'&&!block&&['drive','smash'].includes(type))duration/=this.athleteModifiers.attack;
 const diving=!!this.players[side].dive;if(diving)this.players[side].dive.hit=true;const point={x:b.x,y:b.y,z:b.z},incoming={vx:b.vx,vy:b.vy,vz:b.vz},stroke=strokeSide(side,this.players[side],b);const flight=block?blockFlight(b,target):type==='drop'?dropFlight(b,target):type==='drive'?driveFlight(b,target,duration,side===0&&judgement!=='serve'&&this.mode!=='compare'):{velocity:velocityTo(b,target,duration),duration};duration=flight.duration;const v=flight.velocity;Object.assign(b,v);this.players[side].impact={point:{...point},time:this.time,type,variant:block?'block':null,incoming,stroke,diving,facing:b.x>=this.players[side].x?1:-1};if(this.mode==='compare'&&side===0)this.activeTrace={type,points:[{...point}],peak:point.y,speed:Math.hypot(v.vx,v.vy,v.vz)*3.6,start:this.time,lastSample:this.time};this.lastHit=side;this.rally++;this.best=Math.max(this.best,this.rally);this.players[side].swing=.3;this.players[side].recovery=type==='smash'&&judgement!=='serve'?CFG.smash.recovery:CFG.recoveryDelay;this.players[1-side].split=CFG.splitDuration;if(side===0)this.cooldown=.22;this.pending=null;this.state='rally';this.shotHistory.push({side,type,variant:block?'block':null,stroke,diving,serve:judgement==='serve'?(input.serve||'long'):null,judgement,risk:{line,power:push},kind:input.kind||'ai',strategy:input.strategy||null,duration,time:this.time,origin:{x:b.x,y:b.y,z:b.z},target:{...target},velocity:{...v}});if(this.shotHistory.length>20)this.shotHistory.shift();this.retarget(1-side);this.aiWait=CFG.ai[this.difficulty].delay;this.emit('hit',{side,type,variant:block?'block':null,stroke,diving,combo:side===0?this.combo:0,serve:judgement==='serve'?(input.serve||'long'):null,kind:input.kind||'ai',judgement,power,flight:duration,point:{...point},time:this.time,target:{...target},speed:Math.hypot(b.vx,b.vy,b.vz)*3.6});}
 award(winner,reason){if(this.state!=='rally')return;if(winner===0&&reason==='ground')this.observePlayerReturn();if(winner===1||this.lastHit===0&&(reason==='net'||reason==='out'))this.combo=0;if(this.lastHit===1&&this.pending)this.failedSwing(this.pending.shot);if(this.lastHit===0){if(reason==='net'||reason==='out')this.stats[reason]++;this.settlePlayerShot(reason==='ground'&&winner===0);}this.pointCount++;this.pending=null;this.contact=null;this.landing=null;if(this.scored)this.score[winner]++;this.server=this.scored?winner:1;const max=Math.max(...this.score);const over=this.scored&&((max>=11&&Math.abs(this.score[0]-this.score[1])>=2)||max>=15);this.state=over?'over':'point';this.feedTimer=this.mode==='compare'?2:this.mode==='practice'?1.15:1.7;let compared=false;if(this.mode==='compare'&&this.activeTrace){const record=this.activeTrace;record.points.push({x:this.ball.x,y:this.ball.y,z:this.ball.z});if(reason==='ground'&&this.ball.z>0){const result={type:record.type,points:record.points.map(p=>({...p})),peak:record.peak,speed:record.speed,flight:this.time-record.start,landing:{x:this.ball.x,z:this.ball.z}};this.comparisons=this.comparisons.filter(r=>r.type!==result.type);this.comparisons.push(result);compared=true;this.selectedShot=COMPARE_ORDER.find(type=>!this.comparisons.some(r=>r.type===type))||result.type;if(this.comparisons.length===4)this.state='review';}this.activeTrace=null;}this.emit('point',{winner,reason,over,rally:this.rally});if(compared)this.emit('comparison',{complete:this.state==='review',next:this.selectedShot,results:this.comparisons});}
 update(dt){if(this.state==='countdown'){const before=Math.ceil(this.resumeRemaining);this.resumeRemaining=Math.max(0,this.resumeRemaining-clamp(dt,0,.1));if(this.resumeRemaining<1e-8){this.resumeRemaining=0;this.state=this.previous;this.emit('resume');}else if(Math.ceil(this.resumeRemaining)!==before)this.emit('countdown',Math.ceil(this.resumeRemaining));return;}if(!['serve','rally','point'].includes(this.state))return;this.accumulator+=clamp(dt,0,.1);while(this.accumulator>=CFG.step){this.fixed();this.accumulator-=CFG.step;}}
 fixed(){const dt=CFG.step;if(!['serve','rally','point'].includes(this.state))return;this.time+=dt;this.cooldown=Math.max(0,this.cooldown-dt);for(const p of this.players){p.swing=Math.max(0,p.swing-dt);p.recovery=Math.max(0,p.recovery-dt);p.split=Math.max(0,p.split-dt);p.vx=p.vz=0;p.diveCooldown=Math.max(0,p.diveCooldown-dt);if(p.dive&&this.time-p.dive.time>=CFG.dive.duration+CFG.dive.getUp)p.dive=null;}for(let side=0;side<2;side++)if(this.players[side].dive)this.moveDive(side,dt);if(this.scored&&['serve','point'].includes(this.state))for(let side=0;side<2;side++)this.conditions[side]=Math.min(100,this.conditions[side]+CFG.condition.restRate*dt);if(this.state==='point'){this.feedTimer-=dt;if(this.feedTimer<=0)this.prepareServe();return;}if(this.state==='serve'){if(this.server===1){this.feedTimer-=dt;if(this.feedTimer<=0)this.hit(1,{shot:'clear',aim:0,power:.5},'serve');}return;}
 const b=this.ball,previous={x:b.x,y:b.y,z:b.z};integrate(b,dt,this.wind);if(this.activeTrace){this.activeTrace.peak=Math.max(this.activeTrace.peak,b.y);if(b.y>0&&this.time-this.activeTrace.lastSample>=1/30){this.activeTrace.points.push({x:b.x,y:b.y,z:b.z});this.activeTrace.lastSample=this.time;}}
 const net=collideNet(b,previous,dt,this.wind);if(net){if(!net.over){this.award(1-this.lastHit,'net');return;}this.netCords++;this.lastNetCord={...net,time:this.time};this.retarget(1-this.lastHit);this.emit('netcord',this.lastNetCord);}
 if(b.y<=0){const u=previous.y/(previous.y-b.y);b.x=previous.x+(b.x-previous.x)*u;b.z=previous.z+(b.z-previous.z)*u;b.y=0;const out=Math.abs(b.x)>CFG.halfWidth+CFG.lineTolerance||Math.abs(b.z)>CFG.halfLength+CFG.lineTolerance,serviceFault=this.activeServe&&!legalService(b,this.activeServe);this.award(out||serviceFault?1-this.lastHit:(b.z<0?1:0),out?'out':serviceFault?'service':'ground');return;}
 if(Math.abs(b.z)>12||Math.abs(b.x)>9){this.award(1-this.lastHit,'out');return;}
 if(this.contact){const receiving=1-this.lastHit;const p=this.players[receiving];const ai=CFG.ai[this.difficulty];const wait=receiving===1&&this.aiWait>0;this.aiWait=Math.max(0,this.aiWait-dt);const {x:targetX,z:targetZ}=receiveTarget(this.contact,receiving,receiving===0?p:null);const speed=receiving===0?CFG.playerSpeed:ai.speed;if(!wait){const began=this.tryDive(receiving);if(p.dive){if(began)this.moveDive(receiving,dt);}else this.movePlayer(receiving,targetX,targetZ,speed,dt);}this.contact.t-=dt;}
 const returning=this.players[this.lastHit],cover=this.adaptation.cover;if(returning&&!returning.dive&&returning.recovery<=0)this.movePlayer(this.lastHit,this.lastHit===0?0:cover.x,this.lastHit===0?-CFG.baseDepth:cover.z,this.lastHit===0?CFG.recoverySpeed:Math.min(CFG.recoverySpeed,CFG.ai[this.difficulty].speed*.85),dt);
 const ownNear=b.z<-.25,ownFar=b.z>.25;
 if(this.pending){this.pending.ttl-=dt;const p=this.players[0],profile=SHOTS[this.pending.shot],reach=p.dive&&this.time-p.dive.time<CFG.dive.duration?diveReach(p.dive,this.time):0,canSwing=!p.dive||this.time-p.dive.time>=CFG.dive.contactDelay&&this.time-p.dive.time<CFG.dive.duration;if(canSwing&&this.lastHit===1&&ownNear&&Math.abs(b.x-p.x)<CFG.contactRadius+reach&&Math.abs(b.z-p.z)<CFG.contactDepth+reach&&b.y>=(p.dive&&['clear','drive'].includes(this.pending.shot)?CFG.dive.minHeight:profile.min)&&b.y<=profile.max&&b.vy<2){const timing=this.contact?this.contact.t:0;const q=Math.abs(timing)<CFG.perfect*this.athleteModifiers.control?'perfect':Math.abs(timing)<CFG.good*this.athleteModifiers.control?'good':'early';this.hit(0,this.pending,q);}else if(this.pending.ttl<=0){this.failedSwing(this.pending.shot);this.pending=null;this.emit('miss','early');}}
 if(this.mode!=='compare'&&this.lastHit===0&&ownFar&&this.aiWait<=0&&b.vy<0&&b.y<=(this.difficulty==='hard'||this.difficulty==='normal'&&this.aiStyle==='attacker'?3.2:2.15)&&b.y>.25){const p=this.players[1];const leavingOut=this.landing&&(Math.abs(this.landing.x)>CFG.halfWidth+CFG.lineTolerance+.03||Math.abs(this.landing.z)>CFG.halfLength+CFG.lineTolerance+.03);const reach=p.dive&&this.time-p.dive.time<CFG.dive.duration?diveReach(p.dive,this.time):0,canSwing=!p.dive||this.time-p.dive.time>=CFG.dive.contactDelay&&this.time-p.dive.time<CFG.dive.duration;if(!leavingOut&&canSwing&&b.y>=(p.dive?CFG.dive.minHeight:.55)&&Math.abs(b.x-p.x)<1.15+reach&&Math.abs(b.z-p.z)<1.55+reach){const decision=p.dive?{shot:'clear',aim:0,power:.4,depth:5.4,strategy:'dive-save',style:this.aiStyle}:chooseAIShot({player:this.players[0],ball:b,difficulty:this.difficulty,style:this.aiStyle,incoming:this.shotHistory.at(-1)?.type,rally:this.rally,random:this.random});this.lastDecision={...decision};this.hit(1,decision,'good');}}

 }
}
const ROUND_NAMES=['8강','준결승','결승'];
class Tournament{
 constructor(random=Math.random){this.random=random;this.status='idle';this.round=0;this.bracket=[];this.results=[];}
 start(difficulty='easy'){
  this.difficulty=CFG.ai[difficulty]?difficulty:'easy';this.status='playing';this.round=0;this.results=[];
  this.names=['나','민','루나','도윤','하린','시우','지안','태오'];
  this.bracket=[[[0,1],[2,3],[4,5],[6,7]].map(([a,b])=>({a,b,winner:null,score:null}))];return this.current;
 }
 get current(){const game=this.bracket[this.round]?.find(g=>g.a===0||g.b===0),opponent=game?(game.a===0?game.b:game.a):null;return {round:this.round,label:ROUND_NAMES[this.round],opponent:opponent===null?null:this.names[opponent],aiStyle:['balanced','attacker','defender','net','net','defender','attacker','net'][opponent??0],difficulty:this.difficulty==='hard'?'hard':this.round===2?'hard':this.round===1?'normal':this.difficulty};}
 finish({winner,score,stats,condition=100}){
  if(this.status!=='playing'||![0,1].includes(winner))return false;
  const games=this.bracket[this.round],own=games.find(g=>g.a===0||g.b===0);own.winner=winner===0?0:(own.a===0?own.b:own.a);own.score=own.a===0?[...score]:[score[1],score[0]];
  for(const game of games)if(game!==own){const first=this.random()<.5;game.winner=first?game.a:game.b;const losing=5+Math.floor(this.random()*5);game.score=first?[11,losing]:[losing,11];}
  this.results.push({round:this.round,winner,score:[...score],stats:JSON.parse(JSON.stringify(stats||{})),condition});
  if(winner===1)this.status='eliminated';else if(this.round===2)this.status='champion';else this.status='between';
  if(this.round<2){const winners=games.map(g=>g.winner),next=[];for(let i=0;i<winners.length;i+=2)next.push({a:winners[i],b:winners[i+1],winner:null,score:null});this.bracket[this.round+1]=next;}
  return true;
 }
 advance(){if(this.status!=='between')return false;this.round++;this.status='playing';return true;}
 get snapshot(){return JSON.parse(JSON.stringify({status:this.status,round:this.round,current:this.current,names:this.names||[],bracket:this.bracket,results:this.results}));}
}
const API={Rally,CFG,VENUES,normalizeVenue,windForRally,SHOTS,SERVES,AI_STYLES,ATHLETES,athleteFactors,normalizeAthlete,serviceCourt,legalService,strokeSide,COMPARE_ORDER,collideNet,Tournament,ROUND_NAMES,chooseAIShot,readPatterns,diveProgress,diveReach,integrate,predict,velocityTo,simulate,dropFlight,netCrossingHeight,receiveTarget,needsDive};root.ShuttlePhysics=API;if(typeof module!=='undefined')module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:this);
