(function(root){
'use strict';
// Render and sound profiles share shot identity; neither changes shuttle physics.
const SWINGS={
 block:{duration:.23,windup:.24,backX:-7,backY:-8,followX:14,followY:10,lift:0,tilt:-.18,width:1.2},
 clear:{duration:.48,windup:.75,backX:-42,backY:-55,followX:70,followY:65,lift:.38,tilt:-.3,width:3},
 drop:{duration:.30,windup:.48,backX:-14,backY:-12,followX:22,followY:18,lift:0,tilt:.12,width:1.5},
 drive:{duration:.27,windup:.36,backX:-40,backY:10,followX:100,followY:12,lift:0,tilt:.45,width:3.5},
 smash:{duration:.43,windup:.70,backX:-55,backY:-85,followX:80,followY:125,lift:.42,maxJump:.42,tilt:-.65,width:5}
};
const STROKES={forehand:{backX:1,backY:1,followX:1,followY:1,tilt:1,turn:.12,elbow:1},backhand:{backX:.6,backY:.7,followX:.72,followY:.8,tilt:-.65,turn:-.2,elbow:-1}};
const SOUNDS={
 block:{wave:'sine',from:1150,to:720,duration:.06,gain:.045,noise:.025,filter:1800},
 clear:{wave:'sine',from:1250,to:420,duration:.16,gain:.065,noise:.055,filter:900},
 drop:{wave:'sine',from:1550,to:1050,duration:.065,gain:.045,noise:.014,filter:2400},
 drive:{wave:'triangle',from:950,to:380,duration:.085,gain:.065,noise:.07,filter:3000},
 smash:{wave:'triangle',from:230,to:65,duration:.19,gain:.12,noise:.14,filter:1500},
 point:{wave:'sine',from:660,to:330,duration:.18,gain:.06,noise:0,filter:1000},
 net:{wave:'sine',from:2300,to:900,duration:.055,gain:.035,noise:.04,filter:2600}
};
function jumpHeight(type,height){const p=SWINGS[type]||SWINGS.drive;return Math.min(p.maxJump??Infinity,Math.max(0,height-2.15)*p.lift);}
function follow(type,age,stroke='forehand'){const p=SWINGS[type]||SWINGS.drive,s=STROKES[stroke]||STROKES.forehand,t=Math.max(0,Math.min(1,(age-.055)/(p.duration-.055))),ease=1-(1-t)*(1-t);return {x:p.followX*ease*s.followX,y:p.followY*ease*s.followY,tilt:p.tilt*ease*s.tilt};}
const smooth=n=>{const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t);};
// Dimensions in the athlete drawing's local coordinates.
const ARM_SEGMENT=36, ARM_REACH=70, RACKET_LENGTH=49;
function reachAxis(shoulder,target,facing){
 const x=target.x-shoulder.x,y=target.y-shoulder.y,distance=Math.hypot(x,y);
 return distance>1e-8?{x:x/distance,y:y/distance,distance}:{x:facing,y:0,distance:0};
}
function bendArm(shoulder,axis,extension,side){
 const hand={x:shoulder.x+axis.x*extension,y:shoulder.y+axis.y*extension};
 const bend=Math.sqrt(ARM_SEGMENT**2-extension**2/4)*side;
 const elbow={x:(shoulder.x+hand.x)/2-axis.y*bend,y:(shoulder.y+hand.y)/2+axis.x*bend};
 return {hand,elbow};
}
function supportArm(shoulder,target,facing){
 const axis=reachAxis(shoulder,target,facing);
 return bendArm(shoulder,axis,Math.min(axis.distance,ARM_REACH),facing);
}
function racketArm(shoulder,target,facing,bendSide){
 const axis=reachAxis(shoulder,target,facing);
 const length=Math.min(axis.distance,ARM_REACH+RACKET_LENGTH);
 const head={x:shoulder.x+axis.x*length,y:shoulder.y+axis.y*length};
 // Keep the elbow on the same side of the shaft as the grip passes the shoulder.
 return {...bendArm(shoulder,axis,length-RACKET_LENGTH,facing*bendSide),head,axis};
}
function kneeBetween(hip,foot,bend,guide,weight){
 const dx=foot.x-hip.x,dy=foot.y-hip.y,length=Math.max(.001,Math.hypot(dx,dy)),arc=Math.sqrt(Math.max(0,36*36-length*length/4)),mid={x:(hip.x+foot.x)/2,y:(hip.y+foot.y)/2},sign=dy*bend>=0?-1:1,mix=smooth(weight/.1);
 return {x:guide.x+(mid.x-dy/length*arc*sign-guide.x)*mix,y:guide.y+(mid.y+dx/length*arc*sign-guide.y)*mix};
}
function divePose(dive,time,config,reduced=false){
 if(!dive)return {angle:0,weight:0};
 const age=Math.max(0,time-dive.time),total=config.duration+config.getUp;if(age>=total)return {angle:0,weight:0};
 const phase=age<.045?'prepare':age<config.duration*.7?'reach':age<config.duration+.12?'land':'rise',t=reduced?{prepare:.03,reach:.12,land:.3,rise:.65}[phase]:age,dir=dive.direction;
 const load=smooth(t/.045),reach=smooth((t-.02)/(config.poseReach||.16)),land=smooth((t-.16)/.13),up=smooth((t-config.duration-.08)/Math.max(.01,config.getUp-.08)),hold=1-up,drop=(16*load+37*reach+8*land)*hold;
 const weight=load*hold,angle=dir*(.16*load+1.22*reach)*hold,hip={x:dir*(8*load+17*reach)*hold,y:-88+drop},flight=Math.sin(Math.PI*Math.max(0,Math.min(1,(t-.035)/.16)))*hold;
 const leadFoot={x:dir*(16+25*reach*hold),y:-10-9*flight},trailFoot={x:-dir*(16+20*reach*hold),y:-10-14*flight},leadKnee=kneeBetween({x:hip.x+dir*10,y:hip.y+9},leadFoot,dir,{x:dir*13,y:-43},weight),trailKnee=kneeBetween({x:hip.x-dir*10,y:hip.y+9},trailFoot,-dir,{x:-dir*13,y:-43},weight);
 return {angle,weight,phase,hip,lead:dir,leadKnee,trailKnee,leadFoot,trailFoot,palm:{x:hip.x+dir*63,y:-5},palmWeight:smooth((t-.1)/.16)*(1-smooth(up/.8)),headTilt:-angle*.2};
}
function bodyPoint(point,dive){const hip=dive.hip||{x:0,y:-88},a=dive.angle||0,y=point.y+88;return {x:hip.x+Math.cos(a)*point.x-Math.sin(a)*y,y:hip.y+Math.sin(a)*point.x+Math.cos(a)*y};}
function sound(ctx,kind,output=ctx.destination,time=ctx.currentTime,intensity=0){
 const p=SOUNDS[kind]||SOUNDS.drive,osc=ctx.createOscillator(),gain=ctx.createGain();
 osc.type=p.wave;osc.frequency.setValueAtTime(p.from,time);osc.frequency.exponentialRampToValueAtTime(p.to,time+p.duration);
 gain.gain.setValueAtTime(.0001,time);gain.gain.linearRampToValueAtTime(p.gain*(1+Math.min(5,Math.max(0,intensity))*.045),time+.003);gain.gain.exponentialRampToValueAtTime(.0001,time+p.duration);
 osc.connect(gain);gain.connect(output);osc.start(time);osc.stop(time+p.duration+.01);osc.onended=()=>{osc.disconnect();gain.disconnect();};
 if(p.noise){const count=Math.ceil(ctx.sampleRate*p.duration),buffer=ctx.createBuffer(1,count,ctx.sampleRate),data=buffer.getChannelData(0);let seed=418;
  for(let i=0;i<count;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=(seed/4294967296*2-1)*Math.pow(1-i/count,2);}
  const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),ng=ctx.createGain();source.buffer=buffer;filter.type='bandpass';filter.frequency.value=p.filter;filter.Q.value=.65;ng.gain.value=p.noise;
  source.connect(filter);filter.connect(ng);ng.connect(output);source.start(time);source.onended=()=>{source.disconnect();filter.disconnect();ng.disconnect();};
 }
 return kind;
}
function cheer(ctx,level,output=ctx.destination,time=ctx.currentTime){
 const amount=Math.min(5,Math.max(1,level)),duration=.35+amount*.07,count=Math.ceil(ctx.sampleRate*duration),buffer=ctx.createBuffer(1,count,ctx.sampleRate),data=buffer.getChannelData(0);let seed=1591;
 for(let i=0;i<count;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const t=i/count;data[i]=(seed/4294967296*2-1)*Math.sin(Math.PI*t)*(.75+.25*Math.sin(i/ctx.sampleRate*43));}
 const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=buffer;filter.type='bandpass';filter.frequency.value=900+amount*100;filter.Q.value=.45;gain.gain.value=.025+amount*.012;source.connect(filter);filter.connect(gain);gain.connect(output);source.start(time);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
 return duration;
}
const API={SWINGS,STROKES,SOUNDS,jumpHeight,follow,divePose,bodyPoint,racketArm,supportArm,sound,cheer};root.ShuttleFeel=API;if(typeof module!=='undefined')module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:this);
