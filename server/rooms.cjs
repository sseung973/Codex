'use strict';
const {randomBytes,randomInt}=require('node:crypto');
const {OnlineMatch}=require('./match.cjs');
const {CFG,normalizeAthlete}=require('../dist/physics.js');
const Competition=require('../dist/competition.js');
const CODE='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const RUNNING_STATES=['serve','rally','point','setbreak','countdown'];
class Rooms{
 constructor({now=Date.now,send=(peer,data)=>peer.ws?.readyState===1&&peer.ws.send(JSON.stringify(data)),maxRooms=128}={}){this.rooms=new Map();this.now=now;this.send=send;this.maxRooms=maxRooms;}
 public(room){return {code:room.code,doubles:room.doubles,lineup:room.lineup,bestOf:room.bestOf,formations:room.formations,phase:room.phase,host:room.host,players:room.members.map((m,id)=>m?{id,name:m.name,athlete:m.athlete,team:Math.floor(id/(room.doubles?2:1)),ready:m.ready,connected:!!(m.peer||m.bot),bot:!!m.bot}:null)};}
 broadcast(room,data){for(const m of room.members)if(m?.peer)this.send(m.peer,data);}
 lobby(room){room.updated=this.now();this.broadcast(room,{type:'room',room:this.public(room)});}
 snapshot(room){return {...room.match.snapshot(),waitingForCourt:room.members.some(m=>m?.away),resumeRequested:!!room.resumeRequested};}
 attach(peer,room,id,{away=false}={}){if(peer.room)throw Error('먼저 현재 방에서 나가주세요.');const m=room.members[id];if(m.peer&&m.peer!==peer){m.peer.room=null;m.peer.ws?.close(4001,'reconnected');}m.peer=peer;m.disconnected=0;m.away=away;peer.room=room;peer.seat=id;if(away)this.setCourt(room,id,false);this.send(peer,{type:'welcome',seat:id,token:m.token,room:this.public(room)});this.lobby(room);if(room.match)this.send(peer,{type:'state',snapshot:this.snapshot(room),events:[]});}
 member(info){return {name:typeof info.name==='string'?info.name.trim().slice(0,12)||'선수':'선수',athlete:normalizeAthlete(info.athlete),token:randomBytes(24).toString('base64url'),ready:false,peer:null,disconnected:0};}
 create(peer,info){
  if(peer.createdAt&&this.now()-peer.createdAt<2000)throw Error('잠시 후 방을 다시 만들어 주세요.');
  peer.createdAt=this.now();
  if(peer.room)throw Error('이미 방에 입장해 있어요.');
  if(this.rooms.size>=this.maxRooms)throw Error('서버가 가득 찼어요. 잠시 후 다시 시도해 주세요.');
  const doubles=info.doubles===true;
  const lineup=doubles&&typeof info.lineup==='string'&&Object.hasOwn(Competition.DOUBLES_LINEUPS,info.lineup)?info.lineup:'four';
  let code;
  do{code=Array.from({length:6},()=>CODE[randomInt(CODE.length)]).join('');}while(this.rooms.has(code));
  const members=Array(doubles?4:2).fill(null);
  members[0]=this.member(info);
  Competition.DOUBLES_LINEUPS[lineup].aiSeats.forEach((id,index)=>{
   members[id]={bot:true,name:'AI '+(index+1),athlete:'haru',ready:true};
  });
  const room={code,doubles,lineup,bestOf:Competition.bestOf(info.bestOf,1),formations:[0,1].map(team=>Competition.formation(null,team)),phase:'waiting',host:0,members,updated:this.now(),match:null,events:[],accumulator:0};
  this.rooms.set(code,room);
  this.attach(peer,room,0);
  return room;
 }
 join(peer,info){
  if(peer.room)throw Error('먼저 현재 방에서 나가주세요.');
  const code=String(info.code||'').toUpperCase(),room=this.rooms.get(code);
  if(!room)throw Error('방을 찾을 수 없어요. 코드를 다시 확인해 주세요.');
  if(info.token){
   const id=room.members.findIndex(m=>m?.token===info.token);
   if(id>=0){
    this.attach(peer,room,id,{away:room.phase==='playing'&&info.onCourt===false});
    return;
   }
  }
  if(room.phase!=='waiting')throw Error('이미 경기가 시작된 방이에요.');
  const id=room.members.findIndex(m=>!m);
  if(id<0)throw Error('방이 가득 찼어요.');
  room.members[id]=this.member(info);
  this.attach(peer,room,id);
 }
 ready(peer){const r=this.require(peer);if(r.phase!=='waiting')throw Error('다음 경기 준비를 기다려 주세요.');r.members[peer.seat].ready=!r.members[peer.seat].ready;this.lobby(r);}
 require(peer){if(!peer.room||peer.room.members[peer.seat]?.peer!==peer)throw Error('먼저 방에 입장해 주세요.');return peer.room;}
 profile(peer,q){const r=this.require(peer);if(r.phase!=='waiting')return;const m=r.members[peer.seat],update=this.member(q);m.name=update.name;m.athlete=update.athlete;m.ready=false;this.lobby(r);}
 team(peer,q){const r=this.require(peer);if(!r.doubles||r.lineup!=='four'||r.phase!=='waiting'||![0,1].includes(q.team))return;const index=r.members.findIndex((m,id)=>!m&&Math.floor(id/2)===q.team);if(index<0)throw Error('그 팀은 이미 두 명이에요.');const old=peer.seat,m=r.members[old];r.members[index]=m;r.members[old]=null;if(r.host===old)r.host=index;peer.seat=index;m.ready=false;this.send(peer,{type:'seat',seat:index});this.lobby(r);}
 start(peer){const r=this.require(peer);if(r.host!==peer.seat)throw Error('방장만 경기를 시작할 수 있어요.');if(r.phase!=='waiting'||r.members.some(m=>!(m?.peer||m?.bot)||!m.ready))throw Error('모든 선수가 입장하고 준비해야 해요.');r.phase='playing';r.events=[];r.resumeRequested=false;for(const m of r.members)m.away=false;r.match=new OnlineMatch(r.members,{doubles:r.doubles,bestOf:r.bestOf,formations:r.formations,onEvent:(type,data)=>{r.events.push({type,data});if(type==='point'&&data.over){r.phase='over';this.lobby(r);}}});this.broadcast(r,{type:'start',snapshot:this.snapshot(r)});r.events=[];this.lobby(r);}
 reset(peer){const r=this.require(peer);if(r.host!==peer.seat||r.phase!=='over')return;r.match=null;r.phase='waiting';r.resumeRequested=false;for(const m of r.members)if(m&&!m.bot)m.ready=false;this.lobby(r);}
 formation(peer,q){const r=this.require(peer);if(!r.doubles||r.phase==='over')throw Error('복식 경기에서 포메이션을 고를 수 있어요.');const team=Math.floor(peer.seat/2);if(q.typeName!==undefined&&!Object.hasOwn(Competition.FORMATIONS,q.typeName))throw Error('포메이션을 다시 골라주세요.');if(q.lead!==undefined&&![team*2,team*2+1].includes(q.lead))throw Error('우리 팀 안에서 역할을 골라주세요.');const next={...r.formations[team],...(q.typeName?{type:q.typeName}:{}),...(q.lead!==undefined?{lead:q.lead}:{})};if(next.type===r.formations[team].type&&next.lead===r.formations[team].lead){this.send(peer,{type:'formation',formation:next});return;}if(r.match&&!r.match.setFormation(team,next))throw Error('서브 준비·세트 휴식·일시정지 때 변경할 수 있어요.');r.formations[team]=Competition.formation(next,team);if(r.phase==='waiting')for(const m of r.members.slice(team*2,team*2+2))if(m&&!m.bot)m.ready=false;this.lobby(r);this.send(peer,{type:'formation',formation:r.formations[team]});}
 forfeit(r,id){if(!r.match||r.phase!=='playing')return;const winner=1-r.match.team(id);r.match.score[winner]=15;r.match.state='over';r.match.matchWinner=winner;r.match.forfeit=true;r.match.setBreakRemaining=0;r.match.pending.fill(null);r.phase='over';r.events.push({type:'point',data:{winner,reason:'forfeit',over:true,rally:r.match.rally}});}
 disconnect(peer,leave=false){const r=peer.room;if(!r)return;const m=r.members[peer.seat];if(!m||m.peer!==peer){peer.room=null;return;}m.peer=null;m.disconnected=this.now();m.ready=false;peer.room=null;r.resumeRequested=false;if(r.match&&RUNNING_STATES.includes(r.match.state))r.match.pause();if(leave){this.forfeit(r,peer.seat);r.members[peer.seat]=null;}if(r.host===peer.seat){const next=r.members.findIndex(m=>m?.peer);if(next>=0)r.host=next;}this.lobby(r);}
 setCourt(room,seat,present){
  if(room.phase!=='playing'||typeof present!=='boolean')return;
  room.members[seat].away=!present;
  if(!present&&RUNNING_STATES.includes(room.match.state)){
   room.resumeRequested=false;
   room.match.pause();
   return;
  }
  if(present)this.resumeIfReady(room);
 }
 resumeIfReady(room){
  if(!room.resumeRequested||room.match.state!=='paused'||room.members.some(m=>!(m?.peer||m?.bot)||m.away))return;
  room.resumeRequested=false;
  room.match.pause();
 }
 message(peer,q){if(!q||typeof q.type!=='string')throw Error('올바르지 않은 요청이에요.');if(q.type==='create')return this.create(peer,q);if(q.type==='join')return this.join(peer,q);if(q.type==='leave'){this.disconnect(peer,true);this.send(peer,{type:'left'});return;}if(q.type==='ping'){this.send(peer,{type:'pong',at:q.at});return;}const r=this.require(peer),m=r.match;switch(q.type){case 'ready':this.ready(peer);break;case 'profile':this.profile(peer,q);break;case 'team':this.team(peer,q);break;case 'formation':this.formation(peer,q);break;case 'start':this.start(peer);break;case 'reset':this.reset(peer);break;case 'shot':if(m)m.select(peer.seat,q.shot);break;case 'serve':if(m)m.selectServe(peer.seat,q.serve);break;case 'strike':{const accepted=m?m.strike(peer.seat,q.input):false;if(Number.isSafeInteger(q.inputId)&&q.inputId>0)this.send(peer,{type:'input',inputId:q.inputId,accepted,...(!accepted?m?.inputFeedback||{reason:'inactive'}:{})});break;}case 'adjust':if(m)m.adjust(peer.seat,q.input);break;case 'cancel':if(m)m.cancel(peer.seat);break;case 'court':this.setCourt(r,peer.seat,q.present);break;case 'pause':if(m&&RUNNING_STATES.includes(m.state)){r.resumeRequested=false;m.pause();}break;case 'resume':if(m?.state==='paused'){if(r.members.some(m=>!(m?.peer||m?.bot)))throw Error('연결이 끊긴 선수가 돌아와야 재개할 수 있어요.');r.resumeRequested=true;this.resumeIfReady(r);}break;default:throw Error('지원하지 않는 요청이에요.');}}
 advance(dt){for(const [code,r]of this.rooms){for(let i=0;i<r.members.length;i++)if(r.members[i]&&!r.members[i].bot&&!r.members[i].peer&&this.now()-r.members[i].disconnected>90000){this.forfeit(r,i);r.members[i]=null;this.lobby(r);}if(!r.members.some(m=>m?.peer)&&this.now()-r.updated>90000){this.rooms.delete(code);continue;}if(!r.match)continue;r.accumulator+=Math.min(dt,.1);while(r.accumulator>=CFG.step){r.match.step();r.accumulator-=CFG.step;}this.broadcast(r,{type:'state',snapshot:this.snapshot(r),events:r.events.splice(0)});}}
}
module.exports={Rooms};
