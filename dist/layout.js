(function(root){
'use strict';
const SHOTS=['clear','drop','drive','smash'],PROFILES=['desktop','touch-portrait','touch-landscape'],KEY='shuttle-rush-layout-v1';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function normalize(value){const out={};for(const profile of PROFILES){const row=value?.[profile];if(row&&SHOTS.every(id=>Number.isFinite(row[id]?.x)&&Number.isFinite(row[id]?.y)))out[profile]=Object.fromEntries(SHOTS.map(id=>[id,{x:clamp(row[id].x,0,1),y:clamp(row[id].y,0,1)}]));}return out;}
function profileFor(touch,width,height){return touch?(width>height?'touch-landscape':'touch-portrait'):'desktop';}
function overlaps(a,b,gap=5){return a.x<b.x+b.width+gap&&a.x+a.width+gap>b.x&&a.y<b.y+b.height+gap&&a.y+a.height+gap>b.y;}
function resolve(point,size,bounds,blocked=[]){
 const maxX=Math.max(bounds.x,bounds.x+bounds.width-size.width),maxY=Math.max(bounds.y,bounds.y+bounds.height-size.height),fit=p=>({x:clamp(p.x,bounds.x,maxX),y:clamp(p.y,bounds.y,maxY)}),desired=fit(point),xs=[desired.x,bounds.x,maxX],ys=[desired.y,bounds.y,maxY];
 for(const b of blocked){xs.push(b.x-size.width-6,b.x+b.width+6);ys.push(b.y-size.height-6,b.y+b.height+6);}
 const choices=xs.flatMap(x=>ys.map(y=>fit({x,y}))).sort((a,b)=>Math.hypot(a.x-desired.x,a.y-desired.y)-Math.hypot(b.x-desired.x,b.y-desired.y));
 return choices.find(p=>blocked.every(b=>!overlaps({...p,...size},b)))||desired;
}
const copy=value=>normalize(value),FREE_PROPS=['left','top','width','height','--free-height','--free-font','--free-icon','--free-icon-height','--free-caption'];
class Editor{
 constructor({stage,selector,bar,names,onFinish,onChange}){
  Object.assign(this,{stage,selector,bar,names,onFinish,onChange});this.buttons=Object.fromEntries(SHOTS.map(id=>[id,selector.querySelector('[data-shot='+id+']')]));this.editing=false;this.drag=null;this.profile='desktop';this.profiles={};this.storable=true;
  let raw=null;try{raw=localStorage.getItem(KEY);}catch{this.storable=false;}try{this.profiles=normalize(JSON.parse(raw));}catch{}
  this.anchor=document.createComment('shot selector home');selector.before(this.anchor);this.placeholder=document.createElement('div');this.placeholder.className='shot-layout-placeholder';this.placeholder.hidden=true;this.anchor.after(this.placeholder);
  stage.addEventListener('pointerdown',e=>this.down(e),true);stage.addEventListener('pointermove',e=>this.move(e),true);stage.addEventListener('pointerup',e=>this.up(e),true);
  for(const name of ['pointercancel','lostpointercapture'])stage.addEventListener(name,e=>{if(this.drag?.id===e.pointerId)this.cancelDrag();},true);
  stage.addEventListener('click',e=>{if(!this.editing)return;const b=e.target.closest('[data-shot]');if(b){e.preventDefault();e.stopImmediatePropagation();this.select(b.dataset.shot);return;}if(e.target.tagName==='CANVAS'&&this.selected){e.preventDefault();e.stopImmediatePropagation();const r=stage.getBoundingClientRect(),size=this.sizes[this.selected];this.place(this.selected,{x:e.clientX-r.left-size.width/2,y:e.clientY-r.top-size.height/2});}},true);
  window.addEventListener('keydown',e=>this.key(e),true);window.addEventListener('blur',()=>this.cancelDrag());
  bar.querySelector('[data-layout=save]').addEventListener('click',()=>this.finish(true));bar.querySelector('[data-layout=cancel]').addEventListener('click',()=>this.finish(false));bar.querySelector('[data-layout=reset]').addEventListener('click',()=>{this.cancelDrag();delete this.drafts[this.profile];this.refresh();this.announce('현재 화면을 기본 배치로 돌렸어요. 저장하면 적용됩니다.');});
  this.observer=new ResizeObserver(()=>{this.cancelDrag();this.refresh();});this.observer.observe(stage);this.refresh();
 }
 measure(){
  this.selector.classList.remove('is-free');for(const b of Object.values(this.buttons))for(const prop of FREE_PROPS)b.style.removeProperty(prop);this.placeholder.hidden=true;this.anchor.after(this.selector);
  const sr=this.stage.getBoundingClientRect(),group=this.selector.getBoundingClientRect(),style=getComputedStyle(this.selector);this.placeholder.style.height=group.height+'px';this.placeholder.style.gridArea=style.gridArea;this.placeholder.style.order=style.order;
  this.sizes={};this.defaults={};for(const id of SHOTS){const b=this.buttons[id],r=b.getBoundingClientRect(),c=getComputedStyle(b),icon=b.querySelector('svg'),small=b.querySelector('small');this.sizes[id]={width:Math.min(r.width,156),height:r.height,font:c.fontSize,icon:getComputedStyle(icon).width,iconHeight:getComputedStyle(icon).height,caption:getComputedStyle(small).fontSize};this.defaults[id]={x:r.left-sr.left,y:r.top-sr.top};}
 }
 refresh(){
  const r=this.stage.getBoundingClientRect();if(r.width<1||r.height<1)return;this.profile=profileFor(matchMedia('(any-pointer:coarse)').matches,r.width,r.height);const data=this.editing?this.drafts:this.profiles;
  if(!this.editing&&!data[this.profile]){this.selector.classList.remove('is-free');for(const b of Object.values(this.buttons))for(const prop of FREE_PROPS)b.style.removeProperty(prop);this.anchor.after(this.selector);this.placeholder.hidden=true;this.stage.classList.remove('has-free-layout');this.positions={};this.onChange?.();return;}
  this.measure();this.stage.append(this.selector);this.selector.classList.add('is-free');this.placeholder.hidden=false;this.stage.classList.add('has-free-layout');const css=getComputedStyle(this.selector),inset=n=>parseFloat(css[n])||10;
  this.bounds={x:inset('paddingLeft'),y:inset('paddingTop'),width:r.width-inset('paddingLeft')-inset('paddingRight'),height:r.height-inset('paddingTop')-inset('paddingBottom')};
  this.protected=[...this.stage.querySelectorAll('.scoreboard,.arena-top>div')].map(e=>{const b=e.getBoundingClientRect();return {x:b.left-r.left,y:b.top-r.top,width:b.width,height:b.height};});
  if(this.editing){const b=this.bar.getBoundingClientRect();this.protected.push({x:b.left-r.left,y:b.top-r.top,width:b.width,height:b.height});}
  const row=data[this.profile];this.positions={};for(const id of SHOTS){const size=this.sizes[id],point=row?this.fromNormalized(row[id],size):this.defaults[id];this.positions[id]=resolve(point,size,this.bounds,[...this.protected,...Object.values(this.positions)]);Object.assign(this.positions[id],{width:size.width,height:size.height});this.paint(id);}
  this.onChange?.();
 }
 fromNormalized(p,size){return {x:this.bounds.x+p.x*Math.max(0,this.bounds.width-size.width),y:this.bounds.y+p.y*Math.max(0,this.bounds.height-size.height)};}
 toNormalized(p,size){return {x:clamp((p.x-this.bounds.x)/Math.max(1,this.bounds.width-size.width),0,1),y:clamp((p.y-this.bounds.y)/Math.max(1,this.bounds.height-size.height),0,1)};}
 paint(id){const p=this.positions[id],size=this.sizes[id],b=this.buttons[id];Object.assign(b.style,{left:p.x+'px',top:p.y+'px',width:size.width+'px',height:size.height+'px'});b.style.setProperty('--free-height',size.height+'px');b.style.setProperty('--free-font',size.font);b.style.setProperty('--free-icon',size.icon);b.style.setProperty('--free-icon-height',size.iconHeight);b.style.setProperty('--free-caption',size.caption);}
 begin(){if(this.editing)return;this.drafts=copy(this.profiles);this.editing=true;this.bar.hidden=false;this.stage.classList.add('is-arranging');document.body.classList.add('is-layout-editing');this.refresh();this.select('clear');this.buttons.clear.focus({preventScroll:true});}
 select(id){this.selected=id;for(const key of SHOTS){this.buttons[key].toggleAttribute('data-layout-selected',key===id);this.buttons[key].setAttribute('aria-describedby','layout-instructions');}this.announce(this.names[id]+' 선택 · 끌거나 빈 곳을 탭해 옮기세요. 방향키로 미세 조정할 수 있어요.');}
 announce(message){this.bar.querySelector('[role=status]').textContent=message;}
 place(id,point){const p=resolve(point,this.sizes[id],this.bounds,[...this.protected,...SHOTS.filter(key=>key!==id).map(key=>this.positions[key])]);this.positions[id]={...p,width:this.sizes[id].width,height:this.sizes[id].height};this.drafts[this.profile]=Object.fromEntries(SHOTS.map(key=>[key,this.toNormalized(this.positions[key],this.sizes[key])]));this.paint(id);}
 down(e){if(!this.editing||e.isPrimary===false||e.pointerType==='mouse'&&e.button!==0)return;const b=e.target.closest('[data-shot]');if(!b||this.drag)return;e.preventDefault();e.stopImmediatePropagation();this.select(b.dataset.shot);const r=b.getBoundingClientRect();this.drag={id:e.pointerId,shot:b.dataset.shot,x:e.clientX,y:e.clientY,dx:e.clientX-r.left,dy:e.clientY-r.top,original:copy(this.drafts)};b.setPointerCapture(e.pointerId);}
 move(e){if(!this.drag||this.drag.id!==e.pointerId)return;e.preventDefault();e.stopImmediatePropagation();if(Math.hypot(e.clientX-this.drag.x,e.clientY-this.drag.y)<4)return;const r=this.stage.getBoundingClientRect();this.place(this.drag.shot,{x:e.clientX-r.left-this.drag.dx,y:e.clientY-r.top-this.drag.dy});}
 up(e){if(!this.drag||this.drag.id!==e.pointerId)return;e.preventDefault();e.stopImmediatePropagation();const b=this.buttons[this.drag.shot],id=this.drag.id;this.drag=null;if(b.hasPointerCapture(id))b.releasePointerCapture(id);}
 cancelDrag(){if(!this.drag)return;const d=this.drag;this.drag=null;this.drafts=d.original;const b=this.buttons[d.shot];if(b.hasPointerCapture(d.id))b.releasePointerCapture(d.id);this.refresh();}
 key(e){if(!this.editing||e.isComposing||e.ctrlKey||e.altKey||e.metaKey)return;const keys={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();this.finish(false);}else if(keys[e.key]&&this.selected){e.preventDefault();e.stopImmediatePropagation();const p=this.positions[this.selected],v=keys[e.key],step=e.shiftKey?1:5;this.place(this.selected,{x:p.x+v[0]*step,y:p.y+v[1]*step});}}
 finish(save){if(!this.editing)return;this.cancelDrag();if(save){this.profiles=copy(this.drafts);try{localStorage.setItem(KEY,JSON.stringify(this.profiles));this.storable=true;}catch{this.storable=false;}}this.editing=false;this.bar.hidden=true;this.stage.classList.remove('is-arranging');document.body.classList.remove('is-layout-editing');for(const b of Object.values(this.buttons)){b.removeAttribute('data-layout-selected');b.removeAttribute('aria-describedby');}this.refresh();this.onFinish?.({saved:save,stored:this.storable});}
 resetAll(){this.profiles={};try{localStorage.removeItem(KEY);this.storable=true;}catch{this.storable=false;}this.refresh();}
 get snapshot(){return {editing:this.editing,profile:this.profile,custom:!!this.profiles[this.profile],stored:this.storable,selected:this.selected||null,profiles:copy(this.profiles),positions:Object.fromEntries(Object.entries(this.positions||{}).map(([k,p])=>[k,{...p}]))};}
}
const API={Editor,normalize,profileFor,resolve,overlaps,KEY};root.ShuttleLayout=API;if(typeof module!=='undefined')module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:this);
