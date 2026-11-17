(function(root){
'use strict';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const DEFAULT_KEYS={clear:'KeyQ',drop:'KeyW',drive:'KeyE',smash:'KeyR'};
const DEFAULTS={sensitivity:1,hand:'right',buttonSize:'normal',camera:'normal',keys:{...DEFAULT_KEYS}};
function bindingError(keys,shot,code){if(typeof code!=='string'||!/^Key[A-Z]$/.test(code))return 'unsupported';if(['KeyD','KeyP','KeyF'].includes(code))return 'reserved';if(Object.entries(keys).some(([type,key])=>type!==shot&&key===code))return 'duplicate';return null;}
function keyBindings(value){const keys=Object.fromEntries(Object.entries(DEFAULT_KEYS).map(([shot,code])=>[shot,value&&typeof value==='object'?value[shot]??code:code]));return Object.entries(keys).some(([shot,code])=>bindingError(keys,shot,code))?{...DEFAULT_KEYS}:keys;}
function preferences(value={}){value=value&&typeof value==='object'?value:{};return {sensitivity:Number.isFinite(value.sensitivity)?Math.round(clamp(value.sensitivity,.7,1.5)*10)/10:1,hand:value.hand==='left'?'left':'right',buttonSize:value.buttonSize==='large'?'large':'normal',camera:['normal','subtle','fixed'].includes(value.camera)?value.camera:'normal',keys:keyBindings(value.keys)};}
class Swipe{
 constructor(p,t,options={}){this.sensitivity=preferences(options).sensitivity;this.reset(p,t,true);}
 reset(p,t,tapAllowed=false){this.start={...p};this.last={...p};this.lowest={...p};this.peak={...p,t};this.started=t;this.samples=[{...p,t}];this.travel=0;this.fired=false;this.power=0;this.phase='ready';this.tapAllowed=tapAllowed;}
 parameters(p,t,kind='swipe'){const up=this.lowest.y-p.y,dx=p.x-this.lowest.x,previous=this.samples[Math.max(0,this.samples.length-4)],speed=Math.hypot(p.x-previous.x,p.y-previous.y)/Math.max(16,t-previous.t);return {kind,aim:kind==='tap'?0:clamp(dx/Math.max(30,up)*1.2,-1,1),power:kind==='tap'?.35:clamp(.18+this.power*.5+speed*this.sensitivity*.18,0,1)};}
 move(p,t){if(this.fired){if(p.y<this.peak.y)this.peak={...p,t};if(p.y-this.peak.y>=24/this.sensitivity)this.reset(this.peak,this.peak.t);}this.travel+=Math.hypot(p.x-this.last.x,p.y-this.last.y);this.last={...p};if(p.y>this.lowest.y)this.lowest={...p};this.power=clamp((this.lowest.y-this.start.y)/85*this.sensitivity,0,1);const up=this.lowest.y-p.y;this.phase=up>=8/this.sensitivity?'swing':'ready';const input=this.parameters(p,t);this.samples.push({...p,t});if(this.samples.length>12)this.samples.shift();if(!this.fired&&up>=20/this.sensitivity){this.fired=true;this.peak={...p,t};return {...input,commit:true};}return {...input,commit:false};}
 end(p,t){const input=this.move(p,t);if(input.commit)return input;if(this.fired)return null;if(this.lowest.y-p.y>=10/this.sensitivity){this.fired=true;return {...this.parameters(p,t),commit:true};}if(this.tapAllowed&&this.travel<10&&t-this.started<450){this.fired=true;return {...this.parameters(p,t,'tap'),commit:true};}return null;}
}
const API={Swipe,preferences,DEFAULTS,DEFAULT_KEYS,bindingError,keyBindings};root.ShuttleInput=API;if(typeof module!=='undefined')module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:this);
