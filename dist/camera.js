(function(root){
'use strict';
const CAM={nearMargin:.28,closeDuration:1.05,closeIn:.20,closeOut:.27,closeZoom:3.15,followRate:5.5,settleRate:10};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t,smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const STRENGTHS={normal:1,subtle:.4,fixed:0};
const neutral=()=>({zoom:1,x:0,y:0,roll:0});
function classifyNearOut({reason,landing,lastHit},cfg,halfWidth=cfg.halfWidth){
 if(reason!=='out'||!landing||Math.abs(landing.y??0)>.001||![0,1].includes(lastHit)||![landing.x,landing.y??0,landing.z].every(Number.isFinite))return null;
 const tolerance=cfg.lineTolerance??.03,dx=Math.max(0,Math.abs(landing.x)-halfWidth-tolerance),dz=Math.max(0,Math.abs(landing.z)-cfg.halfLength-tolerance),gap=Math.hypot(dx,dz);
 if(gap<=1e-8||gap>CAM.nearMargin+1e-8)return null;
 return {halfWidth,landing:{x:landing.x,y:0,z:landing.z},edge:{x:clamp(landing.x,-halfWidth,halfWidth),y:0,z:clamp(landing.z,-cfg.halfLength,cfg.halfLength)},gap,lastHit};
}
function transformPoint(p,view,width,height){const x=(p.x-width/2)*view.zoom,y=(p.y-height/2)*view.zoom,c=Math.cos(view.roll),s=Math.sin(view.roll);return {...p,x:width/2+view.x*width+x*c-y*s,y:height/2+view.y*height+x*s+y*c,s:p.s===undefined?undefined:p.s*view.zoom};}
function lineViewPoint(p,call,width,height){
 const side=Math.abs(call.landing.x-call.edge.x)>=Math.abs(call.landing.z-call.edge.z),angle=side?Math.sign(call.landing.x)*.62:Math.sign(call.landing.z)*.42;
 const scale=Math.min(width/(width/height>1.05?1.9:1.2),height*.85)*(1+.045*(call.strength??1)*smooth((call.age||0)/.8)),cx=(call.landing.x+call.edge.x)/2,cz=(call.landing.z+call.edge.z)/2,dx=p.x-cx,dz=(p.z||0)-cz;
 return {x:width*.5+(dx*Math.cos(angle)-dz*Math.sin(angle))*scale,y:height*.58+(dx*Math.sin(angle)+dz*Math.cos(angle))*scale*.72-(p.y||0)*scale*.7,s:scale};
}
class CameraDirector{
 constructor(cfg,{reduced=false,strength=1}={}){this.cfg=cfg;this.systemReduced=reduced;this.strength=1;this.reset();this.setStrength(strength);}
 get reduced(){return this.systemReduced||this.strength===0;}
 setStrength(value){this.strength=Number.isFinite(value)?clamp(value,0,1):1;if(this.call){this.call.strength=this.strength;this.call.start={...this.view};}if(this.reduced){this.view=neutral();this.kick=0;}}
 reset(){this.view=neutral();this.call=null;this.lastCall=null;this.kick=0;this.mode='wide';}
 hit(data,mode){if(mode!=='compare')this.kick=Math.min(1,(data.type==='smash'?1:.45)+(data.power||0)*.25);}
 point(data,halfWidth){const call=classifyNearOut(data,this.cfg,halfWidth);if(!call)return null;this.call={...call,age:0,strength:this.strength,start:{...this.view}};this.lastCall={...call};this.mode='line-call';return this.call;}
 update(dt,frame={}){
  if(frame.frozen)return;dt=clamp(dt,0,.1);this.kick*=Math.exp(-7*dt);
  if(this.call){
   const call=this.call;call.age+=dt;
   if(call.age>=CAM.closeDuration||frame.state==='serve'||frame.state==='menu'||frame.state==='review'){this.call=null;this.view=neutral();this.mode='wide';return;}
   if(this.reduced){this.view=neutral();return;}
   const focus=frame.focus||{x:.5,y:.5},inward=smooth(call.age/CAM.closeIn),outward=smooth((call.age-(CAM.closeDuration-CAM.closeOut))/CAM.closeOut);
   const zoom=1+(CAM.closeZoom-1)*this.strength,target={zoom,x:(.5-focus.x)*zoom,y:.08+(.5-focus.y)*zoom,roll:0};
   for(const key of Object.keys(target))this.view[key]=mix(mix(call.start[key],target[key],inward),neutral()[key],outward);
   return;
  }
  if(this.reduced||frame.mode==='compare'){this.view=neutral();this.mode='wide';return;}
  const target=neutral();let rate=CAM.followRate;
  if(frame.state==='rally'){
   const b=frame.ball||{},screen=frame.ballScreen||{x:.5,y:.5},high=clamp(((b.y||0)-3.2)/4,0,1),speed=Math.hypot(b.vx||0,b.vy||0,b.vz||0);
   const settle=frame.lastHit===1&&Number.isFinite(frame.contactT)?1-clamp(frame.contactT/.55,0,1):0,weight=1-settle;
   target.zoom=1+( .06+clamp(speed/35,0,1)*.035-high*.035+this.kick*.035)*weight*this.strength;
   target.x=-clamp(screen.x-.5,-.5,.5)*.055*weight*this.strength;
   target.y=-clamp(screen.y-.45,-.4,.4)*.055*weight*this.strength;
   target.roll=clamp((b.vx||0)/16,-1,1)*.007*weight*this.strength;
   if(settle>.35)rate=CAM.settleRate;this.mode=settle>.65?'settle':'follow';
  }else this.mode='wide';
  const a=1-Math.exp(-rate*dt);for(const key of Object.keys(target))this.view[key]=mix(this.view[key],target[key],a);
 }
 get detailWeight(){if(!this.call||this.reduced)return 0;return smooth(this.call.age/CAM.closeIn)*(1-smooth((this.call.age-(CAM.closeDuration-CAM.closeOut))/CAM.closeOut));}
 get snapshot(){return {framing:this.call?(this.reduced?'static-line':'oblique-line'):'court',mode:this.mode,reduced:this.reduced,strength:this.strength,view:{...this.view},call:this.call?JSON.parse(JSON.stringify(this.call)):null,lastCall:this.lastCall?JSON.parse(JSON.stringify(this.lastCall)):null};}
}
const API={CAM,STRENGTHS,CameraDirector,classifyNearOut,transformPoint,lineViewPoint};root.ShuttleCamera=API;if(typeof module!=='undefined')module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:this);
