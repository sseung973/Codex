/* Server-authoritative friend matches. The solo simulation remains owned by physics.js. */
(()=>{'use strict';
// Predictive input cue only; the server still validates the physical contact and timing.
const Competition=ShuttleCompetition;
const {VENUES,normalizeVenue}=ShuttlePhysics;
function write(id,value){if($(id).textContent!==value)$(id).textContent=value;}
const NET={initialCueLead:.15,maxCueLead:.6};
const copy=x=>JSON.parse(JSON.stringify(x)),$=id=>document.getElementById(id),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function transform(p,dir){if(!p)return null;const q={...p};for(const k of ['x','z','vx','vz','startX','startZ'])if(Number.isFinite(q[k]))q[k]*=dir;if(q.direction)q.direction*=dir;for(const k of ['point','incoming','outgoing'])if(q[k])q[k]=transform(q[k],dir);return q;}
class Client{
 constructor({match,getAthlete,setView,emit,focusCourt,clearInput,updateServeOptions,isOnCourt,onRoomChange}){Object.assign(this,{match,getAthlete,setView,emit,focusCourt,clearInput,updateServeOptions,isOnCourt,onRoomChange});this.room=null;this.seat=0;this.active=false;this.running=false;this.ws=null;this.retry=0;this.latest=null;this.previous=null;this.seq=0;this.rendered=null;this.rtt=null;this.saved=null;try{const saved=JSON.parse(sessionStorage.getItem('shuttle-rush-room-v1'));if(saved&&/^[A-Z2-9]{6}$/.test(saved.code)&&typeof saved.token==='string')this.saved=saved;}catch{}this.original={};for(const key of ['update','strike','selectShot','selectServe','cancelSwing','pause'])this.original[key]=match[key].bind(match);this.originalStart=match.start.bind(match);match.update=dt=>this.active?this.update(dt):this.original.update(dt);match.strike=q=>{if(!this.active)return this.original.strike(q);if(!['serve','rally'].includes(match.state))return false;if(this.ws?.readyState!==1){this.emit('inputRejected',{reason:'connection'});return false;}const inputId=++this.seq;match.pending={...q,ttl:2.6,inputId,acknowledged:false};this.send({type:'strike',input:q,inputId});return true;};match.selectShot=shot=>{if(!this.active)return this.original.selectShot(shot);match.selectedShot=shot;this.send({type:'shot',shot});};match.selectServe=serve=>{if(!this.active)return this.original.selectServe(serve);if(match.state!=='serve'||match.server!==0)return false;match.selectedServe=serve;this.send({type:'serve',serve});return true;};match.cancelSwing=()=>{if(!this.active)return this.original.cancelSwing();match.pending=null;this.send({type:'cancel'});};match.pause=()=>{if(!this.active)return this.original.pause();const resuming=match.state==='paused';if(resuming)this.requestResume();else this.send({type:'pause'});if(!resuming&&['serve','rally','point','setbreak','countdown'].includes(match.state)){match.state='paused';this.emit('pause');}};
 const updateLineup=()=>{
  const doubles=document.querySelector('[name=room-type]:checked').value==='doubles';
  $('room-lineup').hidden=$('room-lineup').disabled=!doubles;
 };
 for(const input of document.querySelectorAll('[name=room-type]'))input.addEventListener('change',updateLineup);
 updateLineup();
 $('room-create').onclick=()=>{
  this.codeError('');
  this.connect({
   type:'create',
   doubles:!$('room-lineup').disabled,
   lineup:document.querySelector('[name=room-lineup]:checked').value,
   bestOf:Number(document.querySelector('[name=room-format]:checked').value),
   venue:document.querySelector('[name=room-venue]:checked').value,
   ...this.profile()
  });
 };
 $('room-join-form').onsubmit=e=>{
  e.preventDefault();
  const code=$('room-code-input').value.toUpperCase().replace(/\s/g,'');
  if(!/^[A-Z2-9]{6}$/.test(code)){
   this.codeError('영문과 숫자로 된 방 코드 6자리를 입력해 주세요.');
   return;
  }
  this.codeError('');
  this.connect({type:'join',code,...this.profile()});
 };
 $('room-code-input').oninput=()=>this.codeError('');
 $('room-return').onclick=()=>this.returnToCourt();
 $('room-ready').onclick=()=>this.send({type:'ready'});$('room-start').onclick=()=>this.send({type:this.room?.phase==='over'?'reset':'start'});$('room-leave').onclick=()=>{this.leave();this.setView('friends');};for(const b of document.querySelectorAll('[data-room-team]'))b.onclick=()=>this.send({type:'team',team:Number(b.dataset.roomTeam)});for(const b of document.querySelectorAll('[data-formation]'))b.onclick=()=>this.chooseFormation({typeName:b.dataset.formation});$('room-swap-role').onclick=()=>{const f=this.room.formations[this.team()];this.chooseFormation({lead:this.team()*2+(f.lead===this.team()*2?1:0)});};$('room-copy').onclick=async()=>{try{const url=new URL(location.href);url.search='';url.searchParams.set('room',this.room.code);await navigator.clipboard.writeText(url.href);this.status('초대 링크를 복사했어요. 친구에게 보내주세요.');}catch{this.status('방 코드 '+this.room.code+' 를 친구에게 알려주세요.');}};$('room-retry').onclick=()=>this.reconnect();const code=new URLSearchParams(location.search).get('room');if(code&&/^[A-Z2-9]{6}$/i.test(code)){$('room-code-input').value=code.toUpperCase();this.invited=true;}this.timer=setInterval(()=>{if(this.ws?.readyState===1)this.send({type:'ping',at:performance.now()});},5000);}
 profile(){return {name:$('room-name').value.trim().slice(0,12)||ShuttlePhysics.ATHLETES[this.getAthlete()].name,athlete:this.getAthlete()};}
 status(text){$('room-status').textContent=text;}
 codeError(message){
  const input=$('room-code-input'),error=$('room-code-error');
  error.textContent=message;
  error.hidden=!message;
  if(message){
   this.status('');
   input.setAttribute('aria-invalid','true');
   input.focus({preventScroll:true});
   error.scrollIntoView({block:'nearest'});
  }else input.removeAttribute('aria-invalid');
 }
 syncCourt(){
  if(!this.active||!this.latest||this.room?.phase!=='playing'||this.ws?.readyState!==1)return;
  const present=this.isOnCourt();
  if(present===this.sentCourt)return;
  this.sentCourt=present;
  this.send({type:'court',present});
 }
 requestResume(){
  this.syncCourt();
  this.send({type:'resume'});
 }
 returnToCourt(resume=false){
  this.setView('game');
  this.focusCourt();
  if(resume)this.requestResume();
 }
 connect(request){if(this.ws&&this.ws.readyState<2)return;this.intent=request;this.status('서버에 연결 중이에요. 첫 접속에는 잠시 걸릴 수 있어요.');this.busy(true);let socket;try{socket=new WebSocket((location.protocol==='https:'?'wss:':'ws:')+'//'+location.host+'/ws');}catch{this.busy(false);return this.status('서버에 연결하지 못했어요. 다시 시도해 주세요.');}this.ws=socket;socket.onopen=()=>{this.retry=0;this.send(request);};socket.onmessage=e=>{if(socket!==this.ws)return;try{this.receive(JSON.parse(e.data));}catch{this.status('경기 정보를 받지 못했어요. 다시 연결해 주세요.');}};socket.onerror=()=>{};socket.onclose=()=>{if(socket!==this.ws)return;this.busy(false);if(this.room){this.match.state='paused';this.clearInput();this.status('연결이 끊겼어요. 다시 연결 중이에요…');this.setView('friends');$('room-retry').hidden=false;if(this.retry<5)setTimeout(()=>this.reconnect(),Math.min(1000*2**this.retry++,8000));}else this.status('서버에 연결하지 못했어요. 다시 시도해 주세요.');};}
 busy(value){for(const id of ['room-create','room-join'])$(id).disabled=value;}
 send(data){if(this.ws?.readyState===1)this.ws.send(JSON.stringify(data));}
 reconnect(){const info=this.room?{code:this.room.code,token:this.token}:this.saved;if(!info)return;this.connect({type:'join',...info,onCourt:false,...this.profile()});}
 receive(q){if(q.type==='formation'){this.formationBusy=false;this.room.formations[this.team()]=q.formation;if(this.latest)this.latest.formations[this.team()]=q.formation;this.drawFormation();this.status('우리 팀 포메이션과 역할을 적용했어요.');return;}if(q.type==='input'){const pending=this.match.pending;if(!pending||pending.inputId!==q.inputId)return;if(q.accepted)pending.acknowledged=true;else{this.match.pending=null;this.emit('inputRejected',{reason:q.reason,shot:q.shot});}return;}if(q.type==='error'){this.formationBusy=false;this.drawFormation();if(!this.room&&this.intent?.type==='join'&&!this.intent.token)this.codeError(q.message);else this.status(q.message);this.busy(false);if(!this.room){this.ws?.close();this.ws=null;}return;}if(q.type==='pong'){this.rtt=Math.round(performance.now()-q.at);this.hud();return;}if(q.type==='welcome'){this.formationBusy=false;this.sentCourt=null;this.seat=q.seat;this.token=q.token;this.room=q.room;this.send({type:'ping',at:performance.now()});this.saved={code:q.room.code,token:q.token};try{sessionStorage.setItem('shuttle-rush-room-v1',JSON.stringify(this.saved));}catch{}this.busy(false);$('room-retry').hidden=true;this.drawRoom();return;}if(q.type==='seat'){this.seat=q.seat;return;}if(q.type==='room'){this.room=q.room;this.drawRoom();return;}if(q.type==='left')return;
 if(q.type==='start'){
  this.active=true;document.body.classList.add('is-online');this.running=true;
  this.latest=this.previous=null;this.sentCourt=null;
  this.originalStart({mode:'match',difficulty:'normal',athlete:this.getAthlete()});
  this.accept(q.snapshot);this.returnToCourt();this.hud();return;
 }
 if(q.type==='state'){
  const restoring=!this.active,wasOver=this.latest?.state==='over';
  if(restoring){
   this.active=true;document.body.classList.add('is-online');this.running=true;
   this.originalStart({mode:'match',difficulty:'normal',athlete:this.getAthlete()});
  }
  this.accept(q.snapshot);
  if(restoring){
   this.returnToCourt();
   if(q.snapshot.state==='paused')this.emit('pause');
  }
  const events=q.events||[];
  for(const event of events)this.event(event);
  if(q.snapshot.state==='over'&&!wasOver&&!events.some(e=>e.type==='point'&&e.data.over)){
   this.emit('matchEnd',{winner:this.match.series.winner});
  }
  this.syncCourt();
  this.hud();
 }}
 accept(s){
  const previous=this.latest,serve=s.players[this.seat].serve;
  const controlsChanged=!previous||s.state!==previous.state||s.server!==previous.server||serve!==this.match.selectedServe;
  this.previous=previous;this.latest=copy(s);this.received=performance.now();this.apply(s);
  this.match.selectedServe=serve;
  if(controlsChanged)this.updateServeOptions();
 }
 team(){return Math.floor(this.seat/(this.room?.doubles?2:1));}
 remapSide(team){return team===this.team()?0:1;}
 player(p){const dir=this.team()===0?1:-1;return {...transform(p,dir),impact:transform(p.impact,dir),dive:transform(p.dive,dir)};}
 apply(s){if(!s.players[this.seat])return;const m=this.match,own=this.team(),dir=own===0?1:-1;this.primaryOpponent=s.lastHit>=0&&s.players[s.lastHit].team!==own?s.lastHit:s.players.find(p=>p.team!==own).id;const self=this.player(s.players[this.seat]),opponent=this.player(s.players[this.primaryOpponent]);m.players=[self,opponent];m.athleteId=s.players[this.seat].athlete;m.conditions=[self.condition,opponent.condition];m.stats=copy(self.stats);m.combo=self.combo;m.bestCombo=self.bestCombo;m.netCords=s.netCords;m.score=own===0?[...s.score]:[s.score[1],s.score[0]];m.series={bestOf:s.bestOf||1,sets:own===0?[...(s.sets||[0,0])]:[s.sets?.[1]||0,s.sets?.[0]||0],number:s.setNumber||1,history:(s.setHistory||[]).map(h=>({...h,winner:this.remapSide(h.winner),score:own===0?[...h.score]:[h.score[1],h.score[0]]})),winner:s.matchWinner===null||s.matchWinner===undefined?null:this.remapSide(s.matchWinner),forfeit:!!s.forfeit};m.venue=normalizeVenue(s.venue);m.wind=s.wind?s.wind*dir:0;m.state=s.state;m.ball=transform(s.ball,dir);m.lastHit=s.lastHit<0?-1:this.remapSide(s.players[s.lastHit].team);m.server=s.server===this.seat?0:1;m.contact=this.contactFor(this.seat);m.landing=transform(s.landing,dir);m.rally=s.rally;m.best=s.best;m.time=s.time;m.pointCount=s.pointCount;m.resumeRemaining=s.resumeRemaining;m.lastNetCord=s.lastNetCord?{...s.lastNetCord,point:transform(s.lastNetCord.point,dir)}:null;m.service=s.service?{...s.service}:null;for(const c of ['service','activeServe']){if(!s[c]){m[c]=null;continue;}m[c]={...s[c]};if(dir<0){m[c].minX=-s[c].maxX;m[c].maxX=-s[c].minX;m[c].minZ=-s[c].maxZ;m[c].maxZ=-s[c].minZ;m[c].serverX=-s[c].serverX;m[c].receiverX=-s[c].receiverX;}}
 if(s.lastShot){const shot={...s.lastShot,side:this.remapSide(s.lastShot.side),origin:transform(s.lastShot.origin,dir),target:transform(s.lastShot.target,dir),velocity:transform(s.lastShot.velocity,dir)};if(m.shotHistory.at(-1)?.time!==shot.time)m.shotHistory.push(shot);if(m.shotHistory.length>20)m.shotHistory.shift();}m.onlinePartners=s.players.filter(p=>p.id!==this.seat&&p.id!==this.primaryOpponent).map(p=>({player:this.player(p),side:this.remapSide(p.team),identity:ShuttlePhysics.ATHLETES[p.athlete],name:p.name}));m.pending=s.state!=='rally'?null:m.pending;}
 update(){if(!this.latest)return;this.apply(this.latest);const old=this.previous,s=this.latest;if(!old||old.rally!==s.rally||s.state!=='rally')return;const t=clamp((performance.now()-this.received)/33.34,0,1),dir=this.team()===0?1:-1;for(const k of ['x','y','z'])this.match.ball[k]=(old.ball[k]+(s.ball[k]-old.ball[k])*t)*(k==='y'?1:dir);for(const [index,id]of [[0,this.seat],[1,this.primaryOpponent]])for(const k of ['x','z'])this.match.players[index][k]=(old.players[id][k]+(s.players[id][k]-old.players[id][k])*t)*dir;}
 event(e){const dir=this.team()===0?1:-1,data=copy(e.data||{});if(e.type==='hit'){data.side=this.remapSide(data.side);data.teammate=data.side===0&&data.player!==this.seat;data.bot=!!this.latest.players[data.player]?.bot;data.point=transform(data.point,dir);data.target=transform(data.target,dir);this.match.pending=null;this.emit('hit',data);}else if(e.type==='point'){data.winner=this.remapSide(data.winner);if(data.sets&&dir<0)data.sets.reverse();if(data.completedSet){data.completedSet.winner=this.remapSide(data.completedSet.winner);if(dir<0)data.completedSet.score.reverse();}this.emit('point',data);$('point-banner').firstChild.textContent=data.winner===0?'우리 팀 포인트!':'상대 팀 포인트';}else if(e.type==='setstart'){this.emit('setstart',data);}else if(e.type==='serve'){this.emit('serve',this.match.server);}else if(e.type==='countdown')this.emit('countdown',data.seconds);else if(e.type==='netcord'){data.point=transform(data.point,dir);this.emit('netcord',data);}else if(e.type==='dive'){if(data.player===this.seat)this.emit('dive',{side:0});}else if(e.type==='miss'){if(data.player===this.seat)this.emit('miss');}else this.emit(e.type,data);}
 contactFor(id){const c=transform(this.latest?.contacts[id],this.team()===0?1:-1);if(c){const lead=id===this.seat?Math.min(NET.maxCueLead,Math.max(0,this.rtt===null?NET.initialCueLead:this.rtt/1000)):0;c.t-=Math.min(.25,(performance.now()-this.received)/1000)+lead;}return c;}
 identity(side){return ShuttlePhysics.ATHLETES[this.latest?.players[side===0?this.seat:this.primaryOpponent]?.athlete||this.getAthlete()];}
 hud(){if(!this.active||!this.latest)return;const s=this.latest,team=this.team(),own=s.players.filter(p=>p.team===team),opponents=s.players.filter(p=>p.team!==team);$('condition').hidden=true;$('online-condition').hidden=false;$('online-condition').textContent='체력 나 '+Math.round(s.players[this.seat].condition)+'%'+(this.room.doubles?' · 짝 '+Math.round(own.find(p=>p.id!==this.seat).condition)+'%':'')+' · 상대 '+opponents.map(p=>Math.round(p.condition)).join('/')+'%';$('player-name').textContent=own.map(p=>p.name).join(' · ');$('player-role').textContent=this.room.doubles?Competition.FORMATIONS[s.formations[team].type].roles[Competition.role(s.formations[team],this.seat)]+' · 우리 팀':'나';$('opponent-name').textContent=opponents.map(p=>p.name).join(' · ');$('difficulty-label').textContent=opponents.every(p=>p.bot)?'AI 팀':this.room.doubles?'상대 팀':'친구';$('mode-label').textContent=(this.room.doubles?'FRIENDS / 2 vs 2':'FRIENDS / 1 vs 1')+(this.rtt===null?'':' · '+this.rtt+'ms');$('score-you').textContent=this.match.score[0];$('score-ai').textContent=this.match.score[1];if(s.state==='serve'){
  const server=s.players[s.server];
  $('status').textContent=s.server===this.seat?'내 서브 · 스와이프 / Space':server.bot?server.name+' 서브 준비':server.team===team?'파트너의 서브 차례예요':'상대의 서브를 기다리는 중';
 }$('online-series').hidden=false;write('online-series',s.bestOf===3?s.setNumber+'세트 · 세트 '+this.match.series.sets.join(' : ')+' · 3판 2선승':Competition.RULES.points+'점 · 한 세트');
 $('online-set-break').hidden=s.state!=='setbreak'||!$('line-call').hidden;if(s.state==='setbreak'){const h=this.match.series.history.at(-1);write('online-set-result',h.number+'세트 '+(h.winner===0?'우리 팀 승리':'상대 팀 승리')+' · '+h.score.join(' : '));write('online-set-timer',Math.ceil(s.setBreakRemaining)+'초');$('point-banner').hidden=true;}
 if(s.state==='paused'){
  const disconnected=this.room.players.some(p=>!p?.connected);
  const prompt=disconnected?'연결이 끊긴 선수가 돌아와야 재개할 수 있어요.':
   s.resumeRequested?'모두 코트로 돌아오면 자동으로 재개해요.':
   s.waitingForCourt?'설정 중인 선수가 있어요. 재개를 누르면 복귀를 기다려요.':'준비가 되면 다시 코트로.';
  write('pause-copy',prompt);
 }this.drawFormation();}
 createRosterSeat(room,player,id){
  const seat=document.createElement('li'),team=Math.floor(id/(room.doubles?2:1));
  seat.dataset.team=team;
  if(player?.bot)seat.dataset.bot='true';

  const athlete=player&&ShuttlePhysics.ATHLETES[ShuttlePhysics.normalizeAthlete(player.athlete)];
  const portrait=document.createElement(athlete?'img':'span');
  portrait.className='room-avatar';
  if(athlete){
   portrait.src=$('lobby-portrait-'+athlete.id).src;
   portrait.alt='';portrait.width=40;portrait.height=40;portrait.loading='lazy';portrait.decoding='async';
  }else portrait.setAttribute('aria-hidden','true');

  const identity=document.createElement('div');
  const name=document.createElement('strong'),role=document.createElement('span');
  name.textContent=player?player.name+(id===this.seat?' (나)':''):'친구 대기';
  const details=[team===0?'A팀':'B팀'];
  if(room.doubles)details.push(Competition.FORMATIONS[room.formations[team].type].roles[Competition.role(room.formations[team],id)]);
  if(athlete)details.push(athlete.name);
  role.textContent=details.join(' · ');
  identity.append(name,role);

  const status=document.createElement('span');
  status.className='room-player-state';
  const state=!player?'empty':player.bot?'bot':!player.connected?'offline':player.ready?'ready':'waiting';
  status.dataset.state=state;
  status.textContent={empty:'빈 자리',bot:'자동 플레이',offline:'재접속 대기',ready:'준비 완료',waiting:'준비 중'}[state];
  seat.append(portrait,identity,status);
  return seat;
 }
 drawRoom(){const r=this.room;if(r?.phase==='waiting'&&this.active){this.endMatch();this.setView('friends');}if(r?.phase==='waiting'&&this.nextProfile){this.send({type:'profile',...this.nextProfile});this.nextProfile=null;}this.busy(false);$('room-entry').hidden=!!r;$('room-waiting').hidden=!r;if(!r)return;$('room-number').textContent=r.code;const lineup=r.lineup||'four',usesAI=lineup!=='four';
 $('room-kind').textContent=(usesAI?Competition.DOUBLES_LINEUPS[lineup].label:r.doubles?'2 vs 2 복식':'1 vs 1 단식')+' · '+Competition.FORMATS[r.bestOf||1].label+' · '+VENUES[normalizeVenue(r.venue)].label;$('room-roster').replaceChildren(...r.players.map((player,id)=>this.createRosterSeat(r,player,id)));
 $('room-return').hidden=!this.active||r.phase==='waiting';$('room-teams').hidden=!r.doubles||usesAI||r.phase!=='waiting';$('room-ready').disabled=r.phase!=='waiting';$('room-ready').textContent=r.players[this.seat]?.ready?'준비 취소':'준비 완료';$('room-ready').setAttribute('aria-pressed',String(!!r.players[this.seat]?.ready));$('room-start').hidden=r.host!==this.seat;$('room-start').textContent=r.phase==='over'?'다음 경기 준비':'경기 시작';$('room-start').disabled=r.phase==='playing'||r.phase==='waiting'&&r.players.some(p=>!p?.connected||!p.ready);this.drawFormation();this.onRoomChange();this.status(r.phase==='playing'?'경기 중 · 연결이 끊기면 모두 일시정지돼요.':r.phase==='over'?'경기 종료 · 방장이 다음 경기를 준비할 수 있어요.':r.players.some(p=>!p)?(usesAI?'친구 한 명에게 방 코드나 초대 링크를 보내세요.':'방 코드나 초대 링크를 친구에게 알려주세요.'):'친구끼리 준비 완료를 누르면 방장이 시작할 수 있어요.');}
 chooseFormation(value){if(this.formationBusy||this.ws?.readyState!==1)return;this.formationBusy=true;this.drawFormation();this.status('우리 팀 포메이션을 적용하는 중이에요…');this.send({type:'formation',...value});}
 drawFormation(){const r=this.room,show=!!r?.doubles;$('room-formation').hidden=!show;if(!show)return;const team=this.team(),f=(this.latest?.formations&&r.phase!=='waiting'?this.latest.formations:r.formations)[team],spec=Competition.FORMATIONS[f.type],editable=!this.formationBusy&&this.ws?.readyState===1&&(r.phase==='waiting'||r.phase==='playing'&&['serve','point','setbreak','paused'].includes(this.latest?.state));$('room-formation').setAttribute('aria-busy',String(!!this.formationBusy));for(const button of document.querySelectorAll('[data-formation]')){button.disabled=!editable;button.setAttribute('aria-pressed',String(button.dataset.formation===f.type));}$('room-swap-role').disabled=!editable;write('room-roles',spec.roles.map((label,index)=>label+' '+(r.players[f.lead===team*2?team*2+index:team*2+1-index]?.name||'친구 대기')).join(' · '));write('room-formation-note',r.phase==='waiting'?'바꾸면 우리 팀은 준비 완료를 다시 눌러주세요.':editable?'포메이션과 역할을 바꾼 뒤 경기로 돌아가세요.':'서브 준비·세트 휴식·일시정지 때 바꿀 수 있어요.');}
 adjustInput(input){if(!this.active||performance.now()-(this.lastAdjust||0)<33)return;this.lastAdjust=performance.now();this.send({type:'adjust',input:{...input,shot:this.match.selectedShot}});}
 profileChanged(){if(!this.room)return;if(this.room.phase==='waiting')this.send({type:'profile',...this.profile()});else this.nextProfile=this.profile();}
 showRoom(){this.setView('friends');this.drawRoom();}
 endMatch(){
  this.clearInput();this.active=false;this.running=false;this.latest=this.previous=null;
  this.match.onlinePartners=[];this.match.series=null;this.match.state='menu';this.match.pending=null;
  document.body.classList.remove('is-online');
  for(const id of ['online-condition','online-series','online-set-break'])$(id).hidden=true;
 }
 leave(){this.saved=null;try{sessionStorage.removeItem('shuttle-rush-room-v1');}catch{}this.send({type:'leave'});const socket=this.ws;this.ws=null;socket?.close();this.room=null;this.endMatch();this.nextProfile=null;this.busy(false);this.codeError('');$('room-entry').hidden=false;$('room-waiting').hidden=true;$('room-retry').hidden=true;this.status('방을 만들거나 친구의 코드로 참가하세요.');}
 get snapshot(){return {connected:this.ws?.readyState===1,active:this.active,seat:this.seat,room:this.room?copy(this.room):null,series:this.match.series?copy(this.match.series):null,setBreakRemaining:this.latest?.setBreakRemaining,formations:this.latest?copy(this.latest.formations):null,serverSeat:this.latest?.server,serverTick:this.latest?.tick,rtt:this.rtt,players:this.latest?copy(this.latest.players):[]};}
}
window.ShuttleOnline={Client};})();
