(function(root){
'use strict';
const FORMATS={1:{label:'한 세트',wins:1},3:{label:'3판 2선승',wins:2}};
const FORMATIONS={
 'front-back':{label:'앞뒤 공격형',roles:['앞코트','뒤코트'],homes:[{x:0,z:-2.2},{x:0,z:-4.7}]},
 'side-side':{label:'좌우 수비형',roles:['왼쪽','오른쪽'],homes:[{x:-1.35,z:-3.7},{x:1.35,z:-3.7}]}
};
const RULES={points:11,cap:15,setBreak:8,frontDepth:3.3,rolePenalty:.9,spacing:1.1,coverLane:1};
function bestOf(value,fallback=3){return value===1||value===3?value:fallback;}
function formation(value,team){return {type:Object.hasOwn(FORMATIONS,value?.type)?value.type:'front-back',lead:[team*2,team*2+1].includes(value?.lead)?value.lead:team*2};}
function role(value,id){return id===value.lead?0:1;}
function home(value,id){return {...FORMATIONS[value.type].homes[role(value,id)]};}
function preferred(value,point){return value.type==='front-back'?(Math.abs(point.z)<RULES.frontDepth?0:1):(point.x<0?0:1);}
function resultText(series){return series?.bestOf===3?'세트 '+series.sets.join(' : ')+(series.forfeit?' · 기권 종료':'')+(series.history.length?' · '+series.history.map(s=>s.score.join(':')).join(' / '):''):null;}
const API={resultText,FORMATS,FORMATIONS,RULES,bestOf,formation,role,home,preferred};root.ShuttleCompetition=API;if(typeof module!=='undefined')module.exports=API;
})(typeof globalThis!=='undefined'?globalThis:this);
