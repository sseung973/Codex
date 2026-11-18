(()=>{
'use strict';
const $=id=>document.getElementById(id),canvas=$('court'),{Rally,CFG,VENUES,normalizeVenue,SHOTS,SERVES,AI_STYLES,ATHLETES,normalizeAthlete,strokeSide,COMPARE_ORDER,predict,integrate,collideNet,Tournament,ROUND_NAMES}=ShuttlePhysics;
let ctx=canvas.getContext('2d');
const artStyle=getComputedStyle(document.documentElement),artToken=name=>artStyle.getPropertyValue('--'+name).trim();
const ART={roof:artToken('bg'),wall:artToken('surface'),court:artToken('court'),wood:artToken('wood'),player:artToken('player'),opponent:artToken('opponent'),paint:artToken('text'),muted:artToken('muted'),out:artToken('out'),kits:Object.fromEntries(Object.keys(ATHLETES).map(id=>[id,artToken('kit-'+id)]))};
function tone(hex,amount){const value=parseInt(hex.slice(1),16),target=amount>0?255:0,t=Math.abs(amount);return '#'+[value>>16&255,value>>8&255,value&255].map(n=>Math.round(n+(target-n)*t).toString(16).padStart(2,'0')).join('');}
const {drawVenue,drawOutdoorVenue,drawWindFlags,drawTape,gradient,surfaceGrain}=ShuttleCourtArt;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const director=new ShuttleCamera.CameraDirector(CFG,{reduced});let pendingFinish=null;
let W=720,H=1060,cameraScale=1,wideView=false,chosen='drive',debug=false,audio=false,ac=null,last=0,gesture=null,feedbackTimer=0,particles=[],trail=[],best=0,staticLayer=null,helpWasRunning=false;
const wallArt=$('arena-wall-art');
wallArt.addEventListener('load',()=>{staticLayer=null;});
try{best=Number(localStorage.getItem('shuttle-rush-best'))||0;}catch{}$('best').textContent=best;
const shotNames=Object.fromEntries(Object.entries(SHOTS).map(([key,value])=>[key,value.label]));
let controls=ShuttleInput.preferences(),controlsStorage=true,savedControls=null;try{savedControls=localStorage.getItem('shuttle-rush-controls-v1');}catch{controlsStorage=false;}try{controls=ShuttleInput.preferences(JSON.parse(savedControls));}catch{}
let online=null,renderedVenue=null,renderedWind=0;
function selectedVenue(){return normalizeVenue(document.querySelector('[name=venue]:checked').value);}
let selectedAthlete='jun',athleteStorage=true,lobbyTab='play';
try{selectedAthlete=normalizeAthlete(localStorage.getItem('shuttle-rush-athlete-v1'));}catch{athleteStorage=false;}
function selectLobbyTab(tab,focus=false){
 lobbyTab=['play','athlete','friends'].includes(tab)?tab:'play';
 for(const name of ['play','athlete','friends']){const selected=name===lobbyTab,button=$('lobby-'+name+'-tab');button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;$('lobby-'+name+'-panel').hidden=!selected;}
 $('start').hidden=lobbyTab==='friends';syncLobbyArtwork();updateLobbyReady();if(focus)$('lobby-'+lobbyTab+'-tab').focus({preventScroll:true});
}
function syncLobby(){const title=!$('title-screen').hidden,visible=!$('menu').hidden;document.body.classList.toggle('is-title',title);document.body.classList.toggle('is-lobby',visible);document.querySelector('.game-layout').inert=title;document.querySelector('.app-header').inert=title;$('menu').classList.toggle('is-resumable',visible&&canContinueMatch());for(const child of $('stage').children)if(child.id!=='menu')child.inert=visible||title;online?.syncCourt();}
$('title-enter').addEventListener('click',()=>{$('title-screen').hidden=true;$('menu').hidden=false;syncLobby();updateLobbyReady();if(online?.invited||online?.saved){online.invited=false;selectLobbyTab('friends');if(online.saved)online.reconnect();}$('lobby-'+lobbyTab+'-tab').focus({preventScroll:true});});
$('title-return').addEventListener('click',()=>{clearGesture();$('menu').hidden=true;$('title-screen').hidden=false;syncLobby();$('title-enter').focus({preventScroll:true});});
function updateLobbyReady(){
 if(lobbyTab==='friends'){$('lobby-ready').textContent='친구 대전 · 1 vs 1 / 2 vs 2';$('setup-hint').textContent='방 코드로 함께 입장하고 준비 완료를 눌러주세요.';return;}
 const modeInput=document.querySelector('[name=mode]:checked');
 const mode=modeInput.value,level=document.querySelector('[name=difficulty]:checked').value,names={match:'AI 단식',tournament:'토너먼트',practice:'타격 연습',compare:'타구 비교'},levels={easy:'쉬움',normal:'보통',hard:'어려움'};
 const isCompare=mode==='compare';
 $('lobby-ready').textContent=ATHLETES[selectedAthlete].name+' · '+names[mode]+(isCompare?'':' · '+levels[level]);
 $('lobby-venue-label').textContent=VENUES[isCompare?'indoor':selectedVenue()].label;
 $('lobby-match-mode').textContent=names[mode];
 $('lobby-match-format').textContent=modeInput.labels[0].querySelector('small').textContent;
 $('lobby-match-level').textContent=levels[level];
 $('lobby-match-level').hidden=isCompare;
 const hints={tournament:'8강부터 결승까지, 3연승에 도전하세요.',compare:'같은 공으로 네 타구의 궤적을 비교해요.',practice:'점수 없이 편하게 랠리를 이어가세요.'};
 const levelHints={easy:'높은 공으로 랠리부터 시작해요.',normal:'코스와 타이밍으로 빈틈을 노려요.',hard:'빠른 타구와 스매시에 대비하세요.'};
 $('setup-hint').textContent=!isCompare&&selectedVenue()==='outdoor'?'깃발이 가리키는 쪽으로 셔틀이 밀려요.':hints[mode]||'11점 경기 · '+levelHints[level];
 $('start').firstChild.textContent=($('menu-resume').hidden?{match:'경기 시작',tournament:'대회 시작',practice:'연습 시작',compare:'비교 시작'}[mode]:'새 경기 시작')+' ';
}
for(const button of document.querySelectorAll('[data-lobby-tab]'))button.addEventListener('click',()=>selectLobbyTab(button.dataset.lobbyTab,button.getAttribute('role')!=='tab'));
for(const button of document.querySelectorAll('.lobby-tabs [role=tab]'))button.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();const tabs=['play','athlete','friends'],index=tabs.indexOf(lobbyTab);selectLobbyTab(e.key==='Home'?'play':e.key==='End'?'friends':tabs[(index+(e.key==='ArrowLeft'?2:1))%3],true);}});
function syncLobbyArtwork(){
 const showPortrait=lobbyTab==='athlete',showCourt=lobbyTab==='play';
 $('lobby-showcase').dataset.art=lobbyTab;
 const friends=lobbyTab==='friends';
 const roomVenue=online?.room?.venue||document.querySelector('[name=room-venue]:checked').value;
 const outdoor=friends?roomVenue==='outdoor':showCourt&&selectedVenue()==='outdoor'&&!document.querySelector('[name=mode][value=compare]').checked;
 $('lobby-court-art').hidden=!showCourt||outdoor;
 $('lobby-outdoor-art').hidden=!outdoor;
 $('lobby-friends-art').hidden=!friends||outdoor;
 $('lobby-court-caption').hidden=!showCourt;
 $('lobby-athlete-caption').hidden=!showPortrait;
 for(const athlete of Object.values(ATHLETES))$('lobby-portrait-'+athlete.id).hidden=!showPortrait||athlete.id!==selectedAthlete;
}
for(const radio of document.querySelectorAll('[name=room-venue]'))radio.addEventListener('change',syncLobbyArtwork);
function renderAthleteChoice(){
 const a=ATHLETES[selectedAthlete];
 $('lobby-hero-name').textContent=a.name;
 $('lobby-current-athlete').textContent=a.name;
 const thumb=$('lobby-athlete-thumb'),portrait=$('lobby-portrait-'+a.id);
 if(thumb.src!==portrait.src)thumb.src=portrait.src;
 $('lobby-hero-role').textContent=a.role;
 $('lobby-athlete-caption').style.setProperty('--preview-kit',ART.kits[a.id]);
 $('athlete-note').textContent=a.name+' · '+a.hint;
 $('athlete-stats').innerHTML=Object.entries(a.stats).map(([key,value])=>'<div><dt>'+({attack:'공격',footwork:'이동',control:'제어'}[key])+'</dt><dd><span class="stat-track" aria-hidden="true"><i style="width:'+value*10+'%"></i></span><b>'+value+'</b></dd></div>').join('');
 $('athlete-persistence').textContent=athleteStorage?'새 경기부터 적용 · 대회 중에는 선수 유지':'저장을 사용할 수 없어 이번 실행에서만 선수를 기억해요.';
 syncLobbyArtwork();updateLobbyReady();
}
for(const a of Object.values(ATHLETES)){
 const label=document.createElement('label');
 const portrait=$('lobby-portrait-'+a.id);
 label.dataset.athlete=a.id;
 label.innerHTML='<input type="radio" name="athlete" value="'+a.id+'"'+(selectedAthlete===a.id?' checked':'')+'><span><img class="athlete-option-art" src="'+portrait.getAttribute('src')+'" width="512" height="768" loading="lazy" decoding="async" alt=""><b>'+a.name+'</b><small>'+a.role+'</small></span>';
 $('athlete-options').append(label);
 label.querySelector('input').addEventListener('change',()=>{
  selectedAthlete=a.id;
  try{localStorage.setItem('shuttle-rush-athlete-v1',a.id);}catch{athleteStorage=false;}
  renderAthleteChoice();online?.profileChanged();
 });
}
renderAthleteChoice();
let layoutEditor=null,layoutSession=null;let lastSound=null;const tournament=new Tournament();let crowdFx=0,crowdLevel=0;
let lastInput=null,shotPreview=0,lastShotColor=SHOTS.drive.color,poses=[],lastImpactFx=null;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),mix=(a,b,t)=>a+(b-a)*t;
function say(text){$('status').textContent=text;$('announcement').textContent=text;}
function beep(kind,preview=false,intensity=0){if(!audio&&!preview)return false;try{ac??=new(window.AudioContext||window.webkitAudioContext)();if(ac.state==='suspended')ac.resume().catch(()=>{});ShuttleFeel.sound(ac,kind,ac.destination,ac.currentTime,intensity);lastSound={kind,preview};return true;}catch{return false;}}
function flash(title,sub='',color=ART.player){$('feedback').innerHTML=title+(sub?'<small>'+sub+'</small>':'');$('feedback').style.color=color;$('feedback').classList.add('show');$('status-stack').classList.add('has-feedback');feedbackTimer=.8;}
function hideFeedback(){$('feedback').classList.remove('show');$('status-stack').classList.remove('has-feedback');feedbackTimer=0;}
function burst(pos,color){if(reduced)return;const p=project(pos);for(let i=0;i<5;i++)particles.push({x:p.x,y:p.y,vx:(Math.random()-.5)*130,vy:(Math.random()-.5)*130,life:.22,color});}
function renderMatchSummary(){
 const stats=match.summary;$('summary-rally').textContent=stats.bestRally+'회';$('summary-net').textContent=stats.netFaults+'회';$('summary-out').textContent=stats.outFaults+'회';
 $('summary-shots').innerHTML=Object.entries(stats.shots).map(([type,row])=>'<tr data-summary-shot="'+type+'"><th scope="row" style="color:'+SHOTS[type].color+'">'+shotNames[type]+'</th><td>'+row.successes+' / '+row.attempts+'</td><td>'+ (row.rate===null?'—':row.rate+'%')+'</td></tr>').join('');
 $('summary-extra').textContent='최고 정타 '+stats.bestCombo+'연속 · 경기 네트 넘김 '+stats.netCords+'회';renderTournament();$('match-summary').scrollTop=0;$('match-summary').hidden=false;$('pause-overlay').querySelector('.compact-card').classList.add('is-finished');
}
function resetMatchSummary(){$('tournament-bracket').hidden=true;$('match-summary').hidden=true;$('pause-overlay').querySelector('.compact-card').classList.remove('is-finished');}
function renderTournament(){
 const el=$('tournament-bracket');el.hidden=match.mode!=='tournament';if(el.hidden)return;
 const snap=tournament.snapshot;el.innerHTML=ROUND_NAMES.map((label,index)=>'<div class="bracket-round"><h3>'+label+'</h3><ul>'+Array.from({length:2**(2-index)},(_,i)=>{const g=snap.bracket[index]?.[i];return '<li'+(g&&(g.a===0||g.b===0)?' class="player-fixture"':'')+'><span>'+(g?snap.names[g.a]+' · '+snap.names[g.b]:'승자 · 승자')+'</span><b>'+(g?.score?g.score.join(' : '):'—')+'</b></li>';}).join('')+'</ul></div>').join('');
}
function showMatchEnd(data){
 const friendMatch=online?.active,won=data.winner===0,series=friendMatch?match.series:null;
 renderMatchSummary();
 $('point-banner').hidden=true;$('resume-countdown').hidden=true;$('pause').disabled=true;
 $('pause-eyebrow').textContent='MATCH FINISHED';
 $('pause-title').textContent=friendMatch?(won?'우리 팀 승리!':'상대 팀 승리'):(won?'멋진 승리!':'한 번 더 도전!');
 $('pause-copy').textContent=ShuttleCompetition.resultText(series)||match.score.join(' : ')+' · '+(series?.forfeit?'기권 종료':'이번 경기 최고 '+match.best+'회 랠리');
 $('resume').innerHTML=friendMatch?'대기방으로 <span>↗</span>':'다시 경기 <span>↗</span>';
 if(match.mode==='tournament'){
  const status=tournament.status;$('pause-eyebrow').textContent='SHUTTLE CUP / '+ROUND_NAMES[tournament.round];$('pause-title').textContent=status==='champion'?'대회 우승!':status==='between'?ROUND_NAMES[tournament.round]+' 통과!':'다음 대회에서 다시!';
  $('pause-copy').textContent=match.score.join(' : ')+' · '+(status==='between'?'다음 경기 시작 시 체력 100% 회복':status==='champion'?'3연승으로 트로피를 차지했어요':ROUND_NAMES[tournament.round]+'에서 도전을 마쳤어요');$('resume').innerHTML=(status==='between'?ROUND_NAMES[tournament.round+1]+' 시작':'대회 다시 도전')+' <span>↗</span>';
 }
 $('pause-overlay').hidden=false;if($('menu').hidden&&$('title-screen').hidden)$('resume').focus({preventScroll:true});say('경기 종료. '+$('pause-title').textContent+' '+$('pause-copy').textContent);
}
const match=new Rally((event,data)=>{
 if(event==='matchEnd')showMatchEnd(data);
 if(event==='start'){$('player-name').textContent=match.athlete.name;$('player-role').textContent=match.athlete.role;document.body.style.setProperty('--active-kit',ART.kits[match.athleteId]);crowdFx=0;crowdLevel=0;$('resume-countdown').hidden=true;resetMatchSummary();director.reset();pendingFinish=null;$('line-call').hidden=true;hideFeedback();document.body.classList.add('is-playing');$('menu').hidden=true;syncLobby();$('pause-overlay').hidden=true;$('point-banner').hidden=true;$('pause').disabled=false;$('opponent-name').textContent=match.mode==='tournament'?tournament.current.opponent:'클럽 AI';$('condition').hidden=!match.scored;$('mode-label').textContent=match.mode==='tournament'?'SHUTTLE CUP / '+tournament.current.label:match.mode==='compare'?'SHOT LAB / COURT 01':match.mode==='practice'?'PRACTICE / COURT 01':'SINGLES / COURT 01';$('difficulty-label').textContent=AI_STYLES[match.aiStyle].label+' · '+match.difficulty.toUpperCase();$('score-you').textContent=$('score-ai').textContent='0';$('rally').textContent='0';$('speed').textContent='— km/h';trail=[];particles=[];clearGesture();lastInput=null;$('last-shot').textContent='타구를 고르면 아래에서 특징을 볼 수 있어요';lastImpactFx=null;if(match.mode==='compare')setShot('clear');updateComparison();}
 if(event==='serve'){director.reset();$('line-call').hidden=true;updateComparison();trail=[];$('point-banner').hidden=true;$('gesture-guide').style.opacity='1';say(data===0?serveInstruction():match.mode==='practice'?'연습 공급 · 돌아오는 셔틀콕을 준비하세요':(online?.active?'상대 서브 · ':'AI 서브 · ')+(match.service?.right?'오른쪽':'왼쪽')+' → 대각선');}
 if(event==='hit'){if(data.side===1&&gesture?.fired){gesture.reset(gesture.last,performance.now());gesture.accepted=false;}const hitName=data.variant==='block'?'블록 수비':shotNames[data.type],hitHint=data.variant==='block'?'힘을 빼고 네트 앞에 짧게':SHOTS[data.type].hint;director.hit(data,match.mode);lastImpactFx={point:{...data.point},time:data.time,side:data.side};if(data.side===0)lastShotColor=SHOTS[data.type].color;beep(data.variant==='block'?'block':data.type,false,data.combo);if(data.side===0&&!data.teammate&&data.combo>=2){crowdFx=.7;crowdLevel=data.combo;if(audio&&ac)try{ShuttleFeel.cheer(ac,data.combo);}catch{}}burst(data.point,data.side===0?ART.player:ART.opponent);$('rally').textContent=match.rally;$('speed').textContent=Math.round(data.speed)+' km/h';trail=[];if(match.best>best){best=match.best;$('best').textContent=best;try{localStorage.setItem('shuttle-rush-best',best);}catch{}}if(data.teammate){
 const partner=data.bot?'AI 파트너':'파트너';
 const stroke=data.judgement==='serve'?SERVES[data.serve||'long'].label:hitName;
 $('last-shot').textContent=partner+' · '+stroke+' · '+Math.round(data.speed)+' km/h';
 say(partner+' '+stroke+' · 상대 리턴을 준비하세요');
 }else if(data.side===0){const titles={perfect:'PERFECT',good:'GOOD',early:'EARLY',late:'LATE',serve:'SERVE'};flash(data.judgement==='serve'?SERVES[data.serve||'long'].label:hitName,data.judgement==='serve'?(data.serve==='short'?'네트 앞에 짧게 · 선택한 타구는 리턴부터':'뒤쪽으로 높게 · 선택한 타구는 리턴부터'):hitHint+' · '+(titles[data.judgement]||'GOOD')+(data.combo>=2?' · '+data.combo+' COMBO':''),SHOTS[data.type].color);$('last-shot').textContent=(data.diving?'다이빙 수비: ':'방금 친 공: ')+(data.judgement==='serve'?SERVES[data.serve||'long'].label:hitName)+' · '+Math.round(data.speed)+' km/h';say(data.judgement==='serve'?SERVES[data.serve||'long'].label+' · 상대 리턴을 준비하세요':data.judgement==='early'?'조금 빨랐어요 · 다음엔 링이 모일 때 타격':data.judgement==='late'?'조금 늦었어요 · 링이 모일 때 스윙하세요':'좋아요! '+hitName+' · '+match.rally+'회 랠리'+(data.combo>=2?' · 정타 '+data.combo+'연속':''));}else say('내 쪽으로 오는 중 · 링이 모일 때 스윙!');$('gesture-guide').style.opacity='.5';}
 if(event==='dive'&&data.side===0){flash('다이빙 수비','낮은 공 · 스와이프로 받아치세요');say('다이빙 수비 · 클리어 또는 드라이브로 받아치세요');}
 if(event==='recovering')say('다이빙 후 일어나는 중이에요');
 if(event==='netcord'){beep('net');burst(data.point,ART.player);flash('NET CORD','네트를 스치며 짧게 넘어갔어요',ART.player);say('네트를 스치고 넘어갔어요 · 짧은 공을 준비하세요');trail=[];}
 if(event==='miss'){flash('TOO EARLY','셔틀콕이 조금 더 가까이 왔을 때',ART.player);say('너무 일렀어요 · 셔틀콕이 가까워지면 다시 스윙하세요');}
 if(event==='unavailable'){const shot=typeof data==='string'?data:data?.shot||chosen;flash(shotNames[shot]+' 높이가 아니에요','낮은 공은 드라이브 / 클리어로 받아주세요',ART.out);say(shotNames[shot]+'를 칠 높이가 아니에요 · 드라이브나 클리어를 골라주세요');}
 if(event==='inputRejected'){if(gesture){gesture.reset(gesture.last,performance.now());gesture.accepted=false;}if(data.reason==='height'){flash(shotNames[data.shot]+' 높이가 아니에요','드라이브 / 클리어를 골라 다시 스윙하세요',ART.out);say('낮은 공이에요 · 드라이브나 클리어로 바꿔 다시 스윙하세요');}else if(data.reason==='recovering'){say('다이빙에서 일어나는 중이에요 · 다음 공을 준비하세요');}else if(data.reason==='not-turn'||data.reason==='not-server'){say(data.reason==='not-server'?'다른 선수의 서브 차례예요':'상대 타격 후 다시 스윙하세요');}else if(data.reason==='connection'){say('연결 중이에요 · 연결이 돌아오면 다시 스윙하세요');}else say('랠리가 멈췄어요 · 다음 서브를 준비하세요');}
 if(event==='swing')say('스와이프 인식 · 타격 범위에 오면 스윙합니다');
 if(event==='point'){clearGesture();const reasons={forfeit:'선수가 나가 기권으로 끝났어요',service:'대각선 서비스 구역 밖에 떨어졌어요',net:'네트에 걸렸어요',out:'코트 밖에 떨어졌어요',ground:'셔틀콕이 코트에 닿았어요'};$('score-you').textContent=match.score[0];$('score-ai').textContent=match.score[1];$('point-banner').hidden=false;$('point-banner').style.color=data.winner===0?ART.player:ART.opponent;$('point-banner').innerHTML=(!match.scored?'다음 랠리 준비':data.winner===0?(online?.active?'우리 팀 포인트!':'나의 포인트!'):(online?.active?'상대 팀 포인트':'AI의 포인트'))+'<small>'+reasons[data.reason]+' · '+data.rally+'회 랠리</small>';say((data.winner===0?(online?.active?'우리 팀 득점. ':'나의 득점. '):(online?.active?'상대 팀 득점. ':'AI 득점. '))+reasons[data.reason]);beep('point');const halfWidth=online?.active&&online.room.doubles?ShuttleCompetition.RULES.doublesHalfWidth:CFG.halfWidth;const call=director.point({reason:data.reason,lastHit:match.lastHit,landing:{...match.ball}},halfWidth);if(call){$('point-banner').hidden=true;hideFeedback();showLineCall(call);}if(data.over){if(match.mode==='tournament')tournament.finish({winner:data.winner,score:match.score,stats:match.summary,condition:match.condition});$('pause').disabled=true;if(call)pendingFinish=data;else showMatchEnd(data);}}
 if(event==='setstart'){clearGesture();director.reset();pendingFinish=null;$('line-call').hidden=true;$('point-banner').hidden=true;$('pause').disabled=false;trail=[];particles=[];hideFeedback();say(data.number+'세트 시작 · 서브를 준비하세요');}
 if(event==='comparison'){setShot(data.next);updateComparison();if(data.complete){$('point-banner').hidden=true;$('pause').disabled=true;say('네 타구 비교 완료 · 타구 버튼을 눌러 궤적을 비교해보세요');}else say('다음은 '+shotNames[data.next]+' · 같은 공을 받아보세요');}
 if(event==='pause'){$('resume-countdown').hidden=true;resetMatchSummary();clearGesture();$('pause-eyebrow').textContent='TIME OUT';$('pause-title').textContent='잠깐, 숨 고르기';$('pause-copy').textContent='준비가 되면 다시 코트로.';$('resume').innerHTML='계속 플레이 <span>↗</span>';$('pause-overlay').hidden=false;$('pause').textContent='▶';$('pause').setAttribute('aria-label','경기 재개');say('일시정지 · 계속 플레이를 눌러주세요');}
 if(event==='countdown'){clearGesture();$('pause-overlay').hidden=true;$('resume-countdown').hidden=false;$('countdown-value').textContent=data;$('pause').textContent='Ⅱ';$('pause').setAttribute('aria-label','카운트다운 중단');say(data+'초 후 경기 재개');}
 if(event==='resume'){$('resume-countdown').hidden=true;document.body.classList.add('is-playing');$('pause-overlay').hidden=true;$('pause').textContent='Ⅱ';$('pause').setAttribute('aria-label','일시정지');say(match.state==='serve'&&match.server===0?serveInstruction():'경기 재개 · 돌아오는 셔틀콕을 준비하세요');}
 if(['start','serve','hit','pause','countdown','resume','point'].includes(event))updateServeOptions();
});
function serveInstruction(){return '내 서브 · '+(match.service?(match.service.right?'오른쪽':'왼쪽')+' → 대각선 · ':'')+SERVES[match.selectedServe].label+' · 스와이프 / Space';}
function updateServeOptions(){$('serve-options').hidden=match.state!=='serve'||match.server!==0||!$('menu').hidden;for(const b of document.querySelectorAll('[data-serve]'))b.setAttribute('aria-pressed',String(b.dataset.serve===match.selectedServe));}
for(const b of document.querySelectorAll('[data-serve]'))b.addEventListener('click',()=>{if(match.selectServe(b.dataset.serve)){updateServeOptions();say(serveInstruction());canvas.focus({preventScroll:true});}});
function updateComparisonChart(){const chart=$('comparison-chart');const empty=match.comparisons.length===0;chart.toggleAttribute('hidden',empty);if(empty)return;const map=p=>[12+(p.z+6.7)/13.4*236,116-Math.max(0,p.y)/8*100];chart.innerHTML='<path d="M12 116H248M130 116V96" fill="none" stroke="#91a7ae" stroke-width="1"/><text x="6" y="12" fill="#b3c1c4" font-size="9">높이</text><text x="132" y="93" fill="#b3c1c4" font-size="9">네트</text><text x="17" y="133" fill="#b3c1c4" font-size="9">나</text><text x="206" y="133" fill="#b3c1c4" font-size="9">상대 뒤</text>'+match.comparisons.map(r=>'<path data-curve="'+r.type+'" d="'+r.points.map((p,i)=>(i?'L':'M')+map(p).map(v=>v.toFixed(1)).join(' ')).join(' ')+'" fill="none" stroke="'+SHOTS[r.type].color+'" stroke-width="'+(r.type===chosen?'2.5':'1.7')+'" opacity="'+(r.type===chosen?'1':'.6')+'"/>' ).join('');}
function updateComparison(){const panel=$('comparison-panel');panel.hidden=match.mode!=='compare';if(panel.hidden)return;const complete=match.state==='review';$('comparison-title').textContent=complete?'네 타구 비교 완료':(match.comparisons.length+1)+'/4 · '+shotNames[match.selectedShot]+' 받기';$('comparison-note').textContent=complete?'타구를 골라 궤적과 착지점을 비교하세요.':'같은 공 · 중앙 코스 · 세기 고정';$('comparison-restart').hidden=!complete;$('comparison-results').innerHTML=match.comparisons.map(r=>'<button class="comparison-result" data-result="'+r.type+'" aria-pressed="'+(r.type===chosen)+'" style="--result-color:'+SHOTS[r.type].color+'"><b>'+shotNames[r.type]+'</b><span>최고 '+r.peak.toFixed(1)+'m · '+r.flight.toFixed(1)+'초</span><small>'+Math.round(r.speed)+'km/h · '+(r.landing.z<2?'네트 앞':'코트 뒤쪽')+'</small></button>').join('');for(const b of document.querySelectorAll('[data-result]'))b.addEventListener('click',()=>setShot(b.dataset.result));updateComparisonChart();}
$('comparison-restart').addEventListener('click',()=>{document.querySelector('[name=mode][value=compare]').checked=true;start();});
function launchMatch(mode,difficulty,venue=selectedVenue()){const aiStyle=mode==='tournament'?tournament.current.aiStyle:document.querySelector('[name=ai-style]:checked').value;match.selectShot(chosen);match.start({mode,difficulty,aiStyle,venue,athlete:mode==='tournament'?tournament.athleteId||selectedAthlete:selectedAthlete});$('pause').textContent='Ⅱ';$('pause').setAttribute('aria-label','일시정지');canvas.focus({preventScroll:true});}
function start(){if(online?.room)online.leave();const mode=document.querySelector('[name=mode]:checked').value,difficulty=document.querySelector('[name=difficulty]:checked').value;if(mode==='tournament'){tournament.start(difficulty);tournament.athleteId=selectedAthlete;launchMatch(mode,tournament.current.difficulty);}else{tournament.status='idle';launchMatch(mode,difficulty);}}
function continueOrRestart(){if(online?.active){online.showRoom();return;}if(match.mode==='tournament'&&tournament.advance())launchMatch('tournament',tournament.current.difficulty,match.venue);else start();}
function canContinueMatch(){return online?.active?match.state!=='over':match.state==='paused';}
function openMenu(){
 document.body.classList.remove('is-playing');
 if(!online?.active&&['serve','rally','point','setbreak','countdown'].includes(match.state))match.pause();
 $('pause-overlay').hidden=true;$('menu').hidden=false;syncLobby();selectLobbyTab('play');updateServeOptions();
 const canContinue=canContinueMatch();
 $('menu-resume').hidden=!canContinue;updateLobbyReady();
 (canContinue?$('menu-resume'):$('start')).focus({preventScroll:true});
}
$('start').addEventListener('click',start);$('pause').addEventListener('click',()=>match.pause());$('resume').addEventListener('click',()=>{if(match.state==='over')continueOrRestart();else{match.pause();canvas.focus({preventScroll:true});}});$('settings').addEventListener('click',openMenu);
async function toggleFullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{say('전체 화면을 켜지 못했어요 · 현재 화면에서 계속 플레이할 수 있어요');}}
$('fullscreen').hidden=!document.fullscreenEnabled||typeof document.documentElement.requestFullscreen!=='function';$('fullscreen').addEventListener('click',toggleFullscreen);document.addEventListener('fullscreenchange',()=>{const active=!!document.fullscreenElement;$('fullscreen').setAttribute('aria-pressed',String(active));$('fullscreen').setAttribute('aria-label',active?'전체 화면 종료':'전체 화면');$('fullscreen').title=active?'전체 화면 종료 (F)':'전체 화면 (F)';});$('new-game').addEventListener('click',openMenu);$('menu-resume').addEventListener('click',()=>{
 if(online?.active){online.returnToCourt(true);return;}
 $('menu').hidden=true;syncLobby();match.pause();canvas.focus({preventScroll:true});
});
$('sound').addEventListener('click',e=>{audio=!audio;$('sound').setAttribute('aria-pressed',audio);$('sound').setAttribute('aria-label',audio?'소리 끄기':'소리 켜기');$('sound').title=audio?'소리 끄기':'소리 켜기';$('sound-slash').hidden=audio;if(audio)beep('hit');if(e.detail>0&&$('menu').hidden)canvas.focus({preventScroll:true});});
function setShot(shot){chosen=shot;if(match.mode==='compare')updateComparisonChart();for(const b of document.querySelectorAll('[data-result]'))b.setAttribute('aria-pressed',b.dataset.result===shot);match.selectShot(shot);shotPreview=2.5;$('shot-detail').textContent=SHOTS[shot].label+' · '+SHOTS[shot].hint;$('shot-detail').style.color=SHOTS[shot].color;for(const b of document.querySelectorAll('[data-shot]')){b.setAttribute('aria-pressed',b.dataset.shot===shot);b.style.setProperty('--shot-color',SHOTS[b.dataset.shot].color);}}
const shotKeys=Object.create(null);let bindingShot=null;
function renderKeys(){
 for(const key of Object.keys(shotKeys))delete shotKeys[key];
 const help=[];
 for(const b of document.querySelectorAll('[data-shot]')){const type=b.dataset.shot,code=controls.keys[type],key=code.slice(3),number=b.dataset.number;for(const k of [code,'Digit'+number,'Numpad'+number,key.toLowerCase(),number])shotKeys[k]=type;b.dataset.key=key;b.querySelector('kbd').textContent=key;b.setAttribute('aria-keyshortcuts',key+' '+number);b.title=SHOTS[type].label+' ('+key+' / '+number+')';help.push(key+'('+number+') '+SHOTS[type].label);}
 $('keyboard-note').textContent=Object.values(controls.keys).map(code=>code.slice(3)).join('/')+' 또는 1–4 타구 선택 · Space 타격 · Shift+Space 블록 · P 정지 · F 전체 화면';$('shot-hotkeys-help').textContent=help.join(' · ');
 for(const b of document.querySelectorAll('[data-bind]')){const type=b.dataset.bind,recording=bindingShot===type;b.dataset.recording=String(recording);b.textContent=recording?'키 입력…':controls.keys[type].slice(3);b.setAttribute('aria-label',SHOTS[type].label+' 단축키 변경, 현재 '+controls.keys[type].slice(3));}
}
function finishBinding(){bindingShot=null;renderKeys();}
function handleBindingKey(e){
 if(!bindingShot)return false;
 if(e.ctrlKey||e.altKey||e.metaKey){finishBinding();$('key-binding-note').textContent='키 변경을 취소했어요.';return false;}
 if(e.key==='Tab'){finishBinding();$('key-binding-note').textContent='키 변경을 취소했어요.';return false;}
 e.preventDefault();e.stopPropagation();if(e.repeat)return true;
 if(e.key==='Escape'){finishBinding();$('key-binding-note').textContent='키 변경을 취소했어요.';return true;}
 const error=e.ctrlKey||e.altKey||e.metaKey||e.isComposing?'unsupported':ShuttleInput.bindingError(controls.keys,bindingShot,e.code);
 if(error){$('key-binding-note').textContent=error==='duplicate'?'다른 타구에서 사용 중인 키예요. 다른 키를 눌러주세요.':error==='reserved'?'D/P/F는 게임 기능 키예요. 다른 영문 키를 눌러주세요.':'영문 A–Z 중 하나를 눌러주세요. Escape로 취소할 수 있어요.';return true;}
 const type=bindingShot;controls=ShuttleInput.preferences({...controls,keys:{...controls.keys,[type]:e.code}});bindingShot=null;renderControls(true);$('key-binding-note').textContent=SHOTS[type].label+' 키를 '+e.code.slice(3)+'로 바꿨어요.';return true;
}
for(const b of document.querySelectorAll('[data-shot]'))b.addEventListener('click',e=>{setShot(b.dataset.shot);if(e.detail>0)canvas.focus({preventScroll:true});});
for(const b of document.querySelectorAll('[data-bind]')){b.addEventListener('click',()=>{bindingShot=b.dataset.bind;renderKeys();$('key-binding-note').textContent=SHOTS[bindingShot].label+'에 사용할 키를 누르세요. Escape로 취소합니다.';});b.addEventListener('blur',()=>{if(bindingShot===b.dataset.bind){finishBinding();$('key-binding-note').textContent='키 변경을 취소했어요.';}});}
function toggleDebug(){debug=!debug;$('debug-panel').hidden=!debug;$('debug-toggle').setAttribute('aria-pressed',debug);$('debug-toggle').textContent=debug?'궤적 분석 닫기':'궤적 분석 보기';}
$('debug-toggle').addEventListener('click',toggleDebug);function setupHint(){const mode=document.querySelector('[name=mode]:checked').value,style=document.querySelector('[name=ai-style]:checked').value,hideOpponent=mode==='compare'||mode==='tournament';$('ai-style-options').hidden=hideOpponent;$('lobby-opponent').hidden=hideOpponent;$('lobby-venue').hidden=$('lobby-venue').disabled=mode==='compare';$('lobby-difficulty').hidden=mode==='compare';$('lobby-style-summary').textContent=AI_STYLES[style].label;syncLobbyArtwork();updateLobbyReady();}
for(const radio of document.querySelectorAll('[name=ai-style]')){radio.nextElementSibling.textContent=AI_STYLES[radio.value].label;radio.nextElementSibling.title=AI_STYLES[radio.value].hint;}
for(const radio of document.querySelectorAll('[name=mode],[name=difficulty],[name=ai-style],[name=venue]'))radio.addEventListener('change',setupHint);setupHint();
function openHelp(){helpWasRunning=['serve','rally','point','setbreak','countdown'].includes(match.state);if(helpWasRunning&&!online?.active)match.pause();$('help-dialog').showModal();online?.syncCourt();}$('help').addEventListener('click',openHelp);$('court-help').addEventListener('click',openHelp);document.querySelector('[data-lobby-help]').addEventListener('click',openHelp);function resumeAfterHelp(){const resume=helpWasRunning;helpWasRunning=false;resumeAfterDialog(resume);}function closeHelp(){$('help-dialog').close();resumeAfterHelp();}for(const id of ['help-close','help-done'])$(id).addEventListener('click',closeHelp);$('help-dialog').addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeHelp();}});$('help-dialog').addEventListener('cancel',e=>{e.preventDefault();closeHelp();});$('help-dialog').addEventListener('close',resumeAfterHelp);

function renderControls(persist=false){
 renderKeys();
 document.body.dataset.hand=controls.hand;document.body.dataset.buttonSize=controls.buttonSize;
 $('controls-sensitivity').value=controls.sensitivity;$('sensitivity-value').value=Math.round(controls.sensitivity*100)+'%';
 document.querySelector('[name=control-hand][value='+controls.hand+']').checked=true;document.querySelector('[name=control-size][value='+controls.buttonSize+']').checked=true;document.querySelector('[name=control-camera][value='+controls.camera+']').checked=true;director.setStrength(ShuttleCamera.STRENGTHS[controls.camera]);$('line-call').dataset.still=String(director.reduced);$('camera-note').textContent=reduced?'기기의 모션 감소 설정으로 고정 카메라를 사용합니다.':'약하게는 추적·줌을 줄이고, 고정은 정지된 라인 확대도를 보여줘요.';
 if(persist)try{localStorage.setItem('shuttle-rush-controls-v1',JSON.stringify(controls));controlsStorage=true;}catch{controlsStorage=false;}
 layoutEditor?.refresh();
 $('controls-persistence').textContent=controlsStorage?'변경한 설정은 바로 적용되고 이 기기에 저장돼요.':'이 브라우저에서는 저장할 수 없어 이번 실행에만 적용돼요.';
}
let controlsWasRunning=false;
function openControls(){controlsWasRunning=['serve','rally','point','setbreak','countdown'].includes(match.state);if(controlsWasRunning&&!online?.active)match.pause();$('controls-dialog').showModal();online?.syncCourt();$('controls-sensitivity').focus({preventScroll:true});}
function resumeAfterDialog(resume){
 online?.syncCourt();
 if(!resume)return;
 if(online?.active)online.requestResume();
 else if(match.state==='paused')match.pause();
}
function resumeAfterControls(){const resume=controlsWasRunning;controlsWasRunning=false;resumeAfterDialog(resume);}
function closeControls(){finishBinding();$('controls-dialog').close();resumeAfterControls(); }
$('controls-open').addEventListener('click',openControls);for(const b of document.querySelectorAll('[data-controls]'))b.addEventListener('click',openControls);
for(const id of ['controls-close','controls-done'])$(id).addEventListener('click',closeControls);
$('controls-dialog').addEventListener('keydown',e=>{if(handleBindingKey(e))return;if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeControls();}});$('controls-dialog').addEventListener('cancel',e=>{e.preventDefault();closeControls();});$('controls-dialog').addEventListener('close',resumeAfterControls);
$('controls-sensitivity').addEventListener('input',e=>{controls=ShuttleInput.preferences({...controls,sensitivity:Number(e.target.value)});renderControls(true);});
for(const input of document.querySelectorAll('[name=control-hand],[name=control-size],[name=control-camera]'))input.addEventListener('change',()=>{controls=ShuttleInput.preferences({...controls,hand:document.querySelector('[name=control-hand]:checked').value,buttonSize:document.querySelector('[name=control-size]:checked').value,camera:document.querySelector('[name=control-camera]:checked').value});renderControls(true);});
$('controls-reset').addEventListener('click',()=>{bindingShot=null;controls=ShuttleInput.preferences();renderControls(true);layoutEditor.resetAll();$('key-binding-note').textContent='타구 키를 Q/W/E/R로 돌렸어요.';$('controls-sound-note').textContent='조작·키·카메라·버튼 위치를 기본값으로 돌렸어요.';});
for(const b of document.querySelectorAll('[data-preview]'))b.addEventListener('click',()=>{$('controls-sound-note').textContent=beep(b.dataset.preview,true)?shotNames[b.dataset.preview]+' 타격음': '이 브라우저에서 소리를 재생하지 못했어요.';});
renderControls();
function updateLayoutNote(){const info=layoutEditor?.snapshot;$('layout-settings-note').textContent=info&&!info.stored?'위치는 이번 실행에만 적용돼요. 이 브라우저에서는 저장할 수 없습니다.':info?.custom?'직접 배치한 위치를 사용 중이에요. 가로·세로는 따로 저장되며 왼손 설정으로 뒤집히지 않아요.':'네 버튼을 각각 끌거나 선택 후 빈 곳을 탭해 옮길 수 있어요. PC와 터치 가로·세로 배치를 따로 저장해요.';}
layoutEditor=new ShuttleLayout.Editor({stage:$('stage'),selector:document.querySelector('.shot-selector'),bar:$('layout-toolbar'),names:shotNames,onChange:updateLayoutNote,onFinish:({saved,stored})=>{
 const session=layoutSession;layoutSession=null;if(!session)return;
 if(!session.playing)document.body.classList.remove('is-playing');$('menu').hidden=!session.menu;syncLobby();$('pause-overlay').hidden=!session.overlay;
 if(session.menu)$('start').focus({preventScroll:true});else if(session.resume&&match.state==='paused'){match.pause();canvas.focus({preventScroll:true});}else if(session.overlay)$('resume').focus({preventScroll:true});else canvas.focus({preventScroll:true});
 if(!session.resume)say(saved?(stored?'버튼 위치를 저장했어요.':'버튼 위치는 이번 실행에만 적용돼요.'):'버튼 위치 변경을 취소했어요.');updateLayoutNote();
}});updateLayoutNote();
$('layout-edit').addEventListener('click',()=>{
 finishBinding();clearGesture();layoutSession={menu:!$('menu').hidden,overlay:!$('pause-overlay').hidden,resume:controlsWasRunning,playing:document.body.classList.contains('is-playing')};controlsWasRunning=false;$('controls-dialog').close();
 if(['serve','rally','point','setbreak','countdown'].includes(match.state))match.pause();$('menu').hidden=true;syncLobby();$('pause-overlay').hidden=true;document.body.classList.add('is-playing');layoutEditor.begin();
});

function coordinates(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*W,y:(e.clientY-r.top)/r.height*H};}
function commitSwipe(input){lastInput={...input,shot:chosen};const accepted=match.strike({...input,shot:chosen});if(gesture)gesture.accepted=gesture.accepted||accepted;return accepted;}
canvas.addEventListener('pointerdown',e=>{if(layoutEditor.editing||gesture||e.isPrimary===false||(e.pointerType==='mouse'&&e.button!==0)||!['serve','rally'].includes(match.state)||!$('menu').hidden)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);gesture=new ShuttleInput.Swipe({x:e.clientX,y:e.clientY},performance.now(),controls);gesture.id=e.pointerId;});
canvas.addEventListener('pointermove',e=>{if(!gesture||gesture.id!==e.pointerId)return;e.preventDefault();const input=gesture.move({x:e.clientX,y:e.clientY},performance.now());if(input.commit)commitSwipe(input);else if(gesture.fired&&match.pending?.kind==='swipe'&&match.mode!=='compare'){match.pending.aim=input.aim;match.pending.power=input.power;online?.adjustInput(input);}});
canvas.addEventListener('pointerup',e=>{if(!gesture||gesture.id!==e.pointerId)return;e.preventDefault();const input=gesture.end({x:e.clientX,y:e.clientY},performance.now());if(input)commitSwipe(input);else if(!gesture.fired)say('위로 밀면 스윙해요 · 손을 떼지 않아도 됩니다');gesture=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);});
function clearGesture(){const id=gesture?.id;gesture=null;if(id!==undefined&&canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);}function cancelPointer(e){if(!gesture||e.pointerId!==gesture.id)return;if(gesture.accepted)match.cancelSwing();clearGesture();}canvas.addEventListener('pointercancel',cancelPointer);canvas.addEventListener('lostpointercapture',cancelPointer);
window.addEventListener('keydown',e=>{
 if(!$('title-screen').hidden||layoutEditor.editing)return;
 const target=e.target instanceof Element?e.target:document.activeElement;
 if($('help-dialog').open||$('controls-dialog').open||e.isComposing||e.ctrlKey||e.altKey||e.metaKey||target.isContentEditable||target.closest('input,select,textarea,[role=textbox]'))return;
 const k=e.key.toLowerCase();
 if((k===' '||k==='enter')&&target.closest('button,a,[role=button]'))return;
 const shot=shotKeys[e.code]||shotKeys[k];
 if(shot){e.preventDefault();if(!e.repeat){setShot(shot);if($('menu').hidden&&['serve','rally'].includes(match.state))canvas.focus({preventScroll:true});}return;}
 if(k==='f'){e.preventDefault();if(!e.repeat)toggleFullscreen();return;}
 if(k==='d'){toggleDebug();return;}
 if(k==='p'||k==='escape'){e.preventDefault();if(!e.repeat&&$('menu').hidden)match.pause();return;}
 if(k===' '&&$('menu').hidden&&match.state!=='over'){e.preventDefault();if(!e.repeat)match.state==='paused'?match.pause():match.strike({shot:chosen,kind:'keyboard',power:.55,aim:0,block:e.shiftKey&&chosen==='drive'});}
});
function suspend(){clearGesture();if(['serve','rally','point','setbreak','countdown'].includes(match.state))match.pause();}window.addEventListener('blur',suspend);document.addEventListener('visibilitychange',()=>{if(online?.active){clearGesture();online.syncCourt();}else if(document.hidden)suspend();});
function project(p){const z=p.z??0,s=1000/(z+15)*cameraScale,far=1/21.7,near=1/8.3,t=(1/(z+15)-far)/(near-far),height=p.y||0,elevation=height>4?4+(height-4)*.55:height;return {x:W/2+p.x*s,y:H*(wideView?.43:.34)+H*(wideView?.40:.44)*t-elevation*s*(wideView?.78:.85),s};}
function viewPoint(p){return ShuttleCamera.transformPoint(p,director.view,W,H);}
function screenPoint(p){const base=viewPoint(project(p));if(director.call&&!director.reduced){const close=ShuttleCamera.lineViewPoint(p,director.call,W,H),a=director.detailWeight;return {...base,x:mix(base.x,close.x,a),y:mix(base.y,close.y,a),s:mix(base.s,close.s,a)};}return base;}
function showLineCall(call){
 const el=$('line-call');el.hidden=false;el.dataset.still=String(director.reduced);
 const x=call.landing.x,z=call.landing.z,map=p=>({x:100+(p.x-x)*160,y:50-(p.z-z)*160});
 const a=map({x:-call.halfWidth,z:CFG.halfLength}),b=map({x:call.halfWidth,z:-CFG.halfLength}),ia=map({x:-call.halfWidth+.04,z:CFG.halfLength-.04}),ib=map({x:call.halfWidth-.04,z:-CFG.halfLength+.04});
 $('line-call-detail').innerHTML='<rect x="'+a.x+'" y="'+a.y+'" width="'+(b.x-a.x)+'" height="'+(b.y-a.y)+'" fill="var(--text)"/><rect x="'+ia.x+'" y="'+ia.y+'" width="'+(ib.x-ia.x)+'" height="'+(ib.y-ia.y)+'" fill="var(--court)"/><circle cx="100" cy="50" r="'+(CFG.lineTolerance*160-.75)+'" fill="#e9d7b0" stroke="#fff7e0" stroke-width="1.5"/><circle cx="100" cy="50" r="10" fill="none" stroke="var(--out)" stroke-width="1.5"/>';
 const scorer=online?.active?(call.lastHit===0?'상대 팀 득점. ':'우리 팀 득점. '):(call.lastHit===0?'AI 득점. ':'나의 득점. ');
 say((match.mode==='match'?scorer:'')+'라인 바로 바깥에 착지 · 아웃 클로즈업');
}
function drawLineCall(){
 if(!director.call)return;const a=project(director.call.edge),b=project(director.call.landing),radius=Math.max(2,CFG.lineTolerance*b.s);
 ctx.save();ctx.setLineDash([2,3]);line(a,b,ART.out,1);ctx.setLineDash([]);ellipse(b.x,b.y,radius+3,radius+3,null,ART.out,1.2);line({x:a.x-3,y:a.y},{x:a.x+3,y:a.y},'#fff7e0',1.5);ctx.restore();
}
function drawLineView(){
 if(!director.call||director.reduced)return;const call=director.call,lp=p=>ShuttleCamera.lineViewPoint(p,call,W,H),point=lp(call.landing),edge=lp(call.edge),scale=point.s;
 ctx.save();ctx.globalAlpha=director.detailWeight;ctx.fillStyle=gradient(ctx,0,0,W,H,[[0,tone(ART.wood,-.15)],[.55,ART.wood],[1,tone(ART.wood,-.25)]]);ctx.fillRect(0,0,W,H);
 const polygon=(points,fill)=>path(points.map(lp),fill);
 polygon([{x:-3.24,z:-6.96},{x:3.24,z:-6.96},{x:3.24,z:6.96},{x:-3.24,z:6.96}],gradient(ctx,0,0,W,H,[[0,tone(ART.court,-.12)],[1,tone(ART.court,.06)]]));
 surfaceGrain(ctx,W,H,.12);
 const cx=Math.round(call.landing.x*4)/4,cz=Math.round(call.landing.z*4)/4;
 for(let i=-8;i<=8;i++){const x=cx+i*.25,z=cz+i*.25;line(lp({x,z:cz-2}),lp({x,z:cz+2}),ART.paint+'07',1);line(lp({x:cx-2,z}),lp({x:cx+2,z}),ART.paint+'07',1);}
 for(const sign of [-1,1]){
  const outer=sign*call.halfWidth,inner=outer-sign*.04;
  polygon([{x:outer,z:-CFG.halfLength},{x:inner,z:-CFG.halfLength},{x:inner,z:CFG.halfLength},{x:outer,z:CFG.halfLength}],ART.paint);
  const end=sign*CFG.halfLength,start=end-sign*.04;
  polygon([{x:-call.halfWidth,z:end},{x:call.halfWidth,z:end},{x:call.halfWidth,z:start},{x:-call.halfWidth,z:start}],ART.paint);
 }
 const next=lp({x:call.landing.x+match.ball.vx*.02,z:call.landing.z+match.ball.vz*.02}),direction=Math.hypot(match.ball.vx,match.ball.vz)>.01?Math.atan2(next.y-point.y,next.x-point.x):-.65;
 ctx.save();ctx.translate(point.x,point.y);ctx.rotate(direction);ctx.scale(scale,scale);ellipse(-.045,.01,.085,.027,'#17252c70');
 path([{x:0,y:-.018},{x:-.12,y:-.05},{x:-.145,y:-.025},{x:-.145,y:.025},{x:-.12,y:.05},{x:0,y:.018}],'#fff8ed','#7e8e89',.0025);
 for(let i=-2;i<=2;i++)line({x:-.135,y:i*.019},{x:-.012,y:i*.006},'#aaa1b8',.002);ellipse(0,0,CFG.lineTolerance-.0015,CFG.lineTolerance-.0015,'#e9d7b0','#fff7e0',.003);ctx.restore();
 ctx.setLineDash([3,4]);line(edge,point,ART.out,1.3);ctx.setLineDash([]);ellipse(point.x,point.y,CFG.lineTolerance*scale+5,CFG.lineTolerance*scale+5,null,ART.out,1.8);
 ctx.restore();
}
function applyView(){const v=director.view;ctx.translate(W/2+v.x*W,H/2+v.y*H);ctx.rotate(v.roll);ctx.scale(v.zoom,v.zoom);ctx.translate(-W/2,-H/2);}
function path(points,fill,stroke,width=1){ctx.beginPath();points.forEach((p,i)=>ctx[i?'lineTo':'moveTo'](p.x,p.y));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
function line(a,b,color,width=1){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
function ellipse(x,y,rx,ry,fill,stroke,width=1){ctx.beginPath();ctx.ellipse(x,y,Math.abs(rx),Math.abs(ry),0,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
function rect(x,y,w,h,r,color,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=color;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.5;ctx.stroke();}}
function worldLine(a,b,color,width=1){line(project(a),project(b),color,width);}
function courtBackground(){
 const floor=Math.min(H*.31+42,project({x:3.34,z:7.07}).y-7);
 const draw=match.venue==='outdoor'?drawOutdoorVenue:drawVenue;
 draw(ctx,{width:W,height:H,floor,project,palette:ART,tone,compact:!wideView,wallArt});
 const stripe=(a,b)=>worldLine(a,b,ART.paint,1.3);
 for(const x of [-3.05,-CFG.halfWidth,CFG.halfWidth,3.05])stripe({x,z:-6.7},{x,z:6.7});
 for(const z of [-6.7,-5.94,-1.98,1.98,5.94,6.7])stripe({x:-3.05,z},{x:3.05,z});
 stripe({x:0,z:-6.7},{x:0,z:-1.98});stripe({x:0,z:1.98},{x:0,z:6.7});
}
function drawNet(){
 const corners=[{x:-3.05,z:0},{x:3.05,z:0},{x:3.05,y:CFG.netHeight,z:0},{x:-3.05,y:CFG.netHeight,z:0}];
 drawTape(ctx,corners.map(project),ART,tone);
}
function drawServiceCourt(){
 const court=match.service;if(!court||match.state!=='serve'||!$('menu').hidden)return;
 const corners=[{x:court.minX,z:court.minZ},{x:court.maxX,z:court.minZ},{x:court.maxX,z:court.maxZ},{x:court.minX,z:court.maxZ}].map(project),color=match.server===0?ART.player:ART.opponent;
 path(corners,color+'1c');ctx.save();ctx.setLineDash([7,6]);path(corners,null,color+'a6',1.5);ctx.restore();
 const center=project({x:(court.minX+court.maxX)/2,z:(court.minZ+court.maxZ)/2}),from=project(match.ball);ctx.save();ctx.setLineDash([4,7]);line(from,center,color+'80',1.2);ctx.restore();
}
function racketAt(pose,target){
 const {spot,scale,shoulder,handSign,elbow}=pose,s=scale*.85;
 const arm=ShuttleFeel.racketArm(shoulder,{x:(target.x-spot.x)/s,y:(target.y-spot.y)/s},handSign,elbow);
 return {arm,point:{x:spot.x+arm.head.x*s,y:spot.y+arm.head.y*s}};
}
function racketPose(p,side,contact=match.contact){
 const impact=p.impact,age=impact?match.time-impact.time:99,impactKind=impact?.variant==='block'?'block':impact?.type,active=impact&&age<ShuttleFeel.SWINGS[impactKind].duration,receiving=(match.state==='rally'||['paused','countdown'].includes(match.state)&&match.previous==='rally')&&match.lastHit===1-side&&contact;
 const type=active?impact.type:side===0?chosen:match.difficulty==='hard'&&contact?.y>=2.65?'smash':'clear',pendingBlock=side===0&&type==='drive'&&match.pending&&(match.pending.block||match.pending.power<=CFG.block.maxPower),kind=active?impactKind:pendingBlock?'block':type,profile=ShuttleFeel.SWINGS[kind];
 const stroke=active?impact.stroke||'forehand':receiving?strokeSide(side,p,{...contact,vx:match.ball.vx}):'forehand',motion=ShuttleFeel.STROKES[stroke],handSign=side===0?1:-1,dir=(stroke==='backhand'?-1:1)*handSign;
 let jump=0;if(active)jump=ShuttleFeel.jumpHeight(kind,impact.point.y)*(1-clamp((age-.09)/(profile.duration-.09),0,1));else if(receiving&&contact.t<profile.windup)jump=ShuttleFeel.jumpHeight(kind,contact.y)*clamp((profile.windup-contact.t)/.45,0,1);
 if(!reduced)jump+=.055*Math.sin(Math.PI*clamp(1-p.split/CFG.splitDuration,0,1));if(profile.maxJump)jump=Math.min(jump,profile.maxJump);if(p.dive)jump=0;
 const dive=ShuttleFeel.divePose(p.dive,match.time,CFG.dive,reduced),spot=project({x:p.x,y:jump,z:p.z}),scale=spot.s/100,s=scale*.85,wind=receiving?Math.sin(Math.PI*clamp((profile.windup-contact.t)/profile.windup,0,1)):0,back=active?clamp((age-profile.duration*.62)/(profile.duration*.38),0,1):0,ease=back*back*(3-2*back),effort=active?(.45+.55*Math.sin(Math.PI*clamp(age/profile.duration,0,1)))*(1-ease):wind,turn=reduced?0:motion.turn*handSign*effort*(1-(dive.weight||0)*.7);
 const shoulder=ShuttleFeel.bodyPoint({x:handSign*21-turn*39,y:-127},dive),ready={x:spot.x+shoulder.x*s+dir*25*scale,y:spot.y+shoulder.y*s-(45-23*(dive.weight||0))*scale};let point={...ready},tilt=0;
 if(receiving&&contact.t<.85){const target=project(contact),t=clamp((.85-contact.t)/.6,0,1);point={x:mix(ready.x,target.x,t)+dir*profile.backX*motion.backX*scale*wind,y:mix(ready.y,target.y,t)+profile.backY*motion.backY*scale*wind};tilt=-profile.tilt*motion.tilt*wind;}
 if(active){const hit=project(impact.point),end=ShuttleFeel.follow(kind,age,stroke);point={x:mix(hit.x+dir*end.x*scale,ready.x,ease),y:mix(hit.y+end.y*scale,ready.y,ease)};tilt=end.tilt*(1-ease);}
 const pose={spot,scale,dir,age,impact,jump,type,kind,profile,tilt,stroke,handSign,dive,shoulder,elbow:motion.elbow,turn};
 return Object.assign(pose,racketAt(pose,point));
}
function athlete(p,side,variant=null){
 const identity=variant?.identity||(online?.active?online.identity(side):match.athlete),pose=variant?.pose||poses[side],{spot,scale}=pose,isBack=side===0,s=scale*.85,shirt=online?.active?ART.kits[identity.id]:isBack?ART.kits[identity.id]:ART.opponent,skin=isBack?'#b68b6d':'#c6a18a',hair='#263134',racketSide=pose.handSign;
 const speed=Math.hypot(p.vx,p.vz),step=reduced||p.dive?0:Math.sin(p.steps)*Math.min(9,speed*1.35),ready=reduced?0:Math.sin(Math.PI*clamp(1-p.split/CFG.splitDuration,0,1))*4;
 if(!reduced&&pose.impact&&pose.age>.055&&pose.age<pose.profile.duration*.62){
  const hit=project(pose.impact.point);
  let previous=racketAt(pose,hit).point;
  for(let i=1;i<=5;i++){
   const follow=ShuttleFeel.follow(pose.kind,pose.age*i/5,pose.stroke);
   const target={x:hit.x+pose.dir*follow.x*scale,y:hit.y+follow.y*scale};
   const next=racketAt(pose,target).point;
   line(previous,next,SHOTS[pose.type].color+'35',1.6*scale);
   previous=next;
  }
 }
 const ground=project({x:p.x,z:p.z});
 const shadow=ctx.createRadialGradient(ground.x+4*s,ground.y+2*s,2*s,ground.x+4*s,ground.y+2*s,25*s);
 shadow.addColorStop(0,ART.roof+'86');shadow.addColorStop(1,ART.roof+'00');
 ctx.save();ctx.translate(ground.x,ground.y);ctx.scale(1,.34);ctx.translate(-ground.x,-ground.y);
 ellipse(ground.x+4*s,ground.y+2*s,28*s,22*s,shadow);ctx.restore();
 if(online?.active&&online.room?.doubles&&p.id===online.seat){
  ellipse(ground.x,ground.y+1.5*s,24*s,5.4*s,ART.roof+'35',ART.player+'d8',Math.max(.95,1.5*s));
 }
 ctx.save();ctx.translate(spot.x,spot.y);ctx.scale(s,s);ctx.lineCap='round';ctx.lineJoin='round';
 const leg=(side,bend)=>{
  const active=!!pose.dive.hip,leading=side===pose.dive.lead,pelvis=pose.dive.hip||{x:0,y:-88},hip={x:pelvis.x+side*10,y:pelvis.y+9},knee=active?(leading?pose.dive.leadKnee:pose.dive.trailKnee):{x:side*(13+ready)+bend*.35,y:-43+Math.abs(bend)*.22},ankle=active?(leading?pose.dive.leadFoot:pose.dive.trailFoot):{x:side*(16+ready)+bend,y:-10};
  line(hip,knee,tone(skin,side<0?-.12:0),10);
  line(knee,ankle,tone(skin,side<0?-.08:.02),7.5);
  line({x:knee.x-1.6,y:knee.y+1},{x:ankle.x-1.6,y:ankle.y-14},tone(skin,.19)+'a8',1.6);
  line({x:ankle.x,y:ankle.y-12},ankle,ART.paint,7);
  line({x:ankle.x-2.6,y:ankle.y-10},{x:ankle.x+2.6,y:ankle.y-10},tone(shirt,-.31),1.4);
  path([{x:ankle.x-5,y:ankle.y-1},{x:ankle.x+4,y:ankle.y-1},{x:ankle.x+9,y:ankle.y+5},{x:ankle.x+8,y:ankle.y+9},{x:ankle.x-7,y:ankle.y+9},{x:ankle.x-7,y:ankle.y+4}],ART.paint,tone(ART.paint,-.38),.7);line({x:ankle.x-6,y:ankle.y+9},{x:ankle.x+8,y:ankle.y+9},tone(ART.roof,.18),1.5);
 };
 leg(-1,step);leg(1,-step);
 ctx.save();const pelvis=pose.dive.hip||{x:0,y:-88};ctx.translate(pelvis.x,pelvis.y);ctx.rotate(pose.dive.angle);ctx.translate(0,88);ctx.transform(1,0,pose.turn,1,pose.turn*88,0);
 // Fitted shorts, long legs, a narrow neck and small head establish adult proportions.
 const shorts=gradient(ctx,-18,-90,22,-75,[[0,tone(ART.roof,.14)],[.6,ART.roof],[1,tone(ART.roof,-.18)]]);
 path([{x:-19,y:-88},{x:18,y:-88},{x:20,y:-66},{x:3,y:-65},{x:0,y:-76},{x:-3,y:-65},{x:-20,y:-66}],shorts,ART.roof+'88',.8);
 line({x:-16,y:-86},{x:16,y:-86},tone(ART.roof,.22),1.2);
 line({x:16,y:-82},{x:18,y:-67},tone(shirt,-.24),2.2);
 const freeShoulder={x:-racketSide*20,y:-128},freeElbow={x:-racketSide*31,y:pose.jump>.1?-145:-105},freeHand={x:pose.stroke==='backhand'?racketSide*5:-racketSide*25,y:pose.stroke==='backhand'?-115:pose.jump>.1?-165:-91};
 if(!pose.dive.hip)line(freeShoulder,freeElbow,tone(skin,-.09),8);if(!pose.dive.hip){line(freeElbow,freeHand,skin,6.5);ellipse(freeHand.x,freeHand.y,3.4,4.2,skin);}
 rect(-5,-145,10,15,2,skin);
 const fabric=gradient(ctx,-25,-135,23,-93,[[0,tone(shirt,.16)],[.47,shirt],[1,tone(shirt,-.21)]]);
 path([{x:-13,y:-138},{x:13,y:-138},{x:24,y:-129},{x:21,y:-116},{x:16,y:-119},{x:16,y:-88},{x:-16,y:-88},{x:-16,y:-119},{x:-22,y:-116},{x:-25,y:-129}],fabric,ART.roof+'70',1.15);
 const trim=tone(shirt,-.38);
 path([{x:-13,y:-137},{x:-22,y:-128},{x:-18,y:-118},{x:-13,y:-91},{x:-8,y:-91},{x:-12,y:-120}],tone(shirt,-.18));
 line({x:-23,y:-121},{x:-17,y:-124},trim,2.4);
 line({x:23,y:-121},{x:17,y:-124},trim,2.4);
 line({x:-9,y:-137},{x:0,y:-132},trim,2.1);line({x:0,y:-132},{x:9,y:-137},trim,2.1);
 line({x:-14,y:-90},{x:14,y:-90},trim,1);
 line({x:10,y:-115},{x:12,y:-97},tone(shirt,.22)+'91',.9);
 line({x:-19,y:-129},{x:-10,y:-134},tone(shirt,.27)+'ad',.9);
 line({x:19,y:-129},{x:10,y:-134},tone(shirt,.21)+'ad',.9);
 line({x:-13,y:-106},{x:-9,y:-94},tone(shirt,-.31)+'70',1.1);
 ctx.textAlign='center';ctx.font='750 18px "Court Condensed",Arial';ctx.fillStyle=tone(ART.roof,-.05);ctx.fillText(isBack||online?.active?identity.number:'02',0,-105);
 ctx.save();ctx.translate(0,-159);ctx.rotate(pose.dive.headTilt||0);ctx.translate(0,159);ellipse(0,-159,14,17,skin);ellipse(isBack?12:-12,-158,3,4.5,tone(skin,-.06));
 if(isBack){if(identity.hair==='tied'){ellipse(-14,-151,5,12,hair);line({x:-11,y:-159},{x:-18,y:-143},hair,6);}path([{x:-14,y:-156},{x:-14,y:-166},{x:-8,y:-175},{x:7,y:-176},{x:14,y:-168},{x:14,y:-155},{x:8,y:-148},{x:-8,y:-149}],hair);line({x:-9,y:-166},{x:7,y:-169},tone(hair,.13),1);if(identity.hair==='sweep'){path([{x:-13,y:-165},{x:-4,y:-178},{x:12,y:-171},{x:13,y:-161},{x:2,y:-169}],tone(hair,.2));line({x:-13,y:-159},{x:12,y:-159},ART.paint,2.5);}}
 else{path([{x:-14,y:-159},{x:-13,y:-169},{x:-6,y:-176},{x:7,y:-174},{x:14,y:-166},{x:12,y:-156},{x:7,y:-164},{x:-6,y:-164}],hair);line({x:-7,y:-158},{x:-4,y:-158},hair,1.2);line({x:4,y:-158},{x:7,y:-158},hair,1.2);line({x:0,y:-156},{x:-1,y:-150},tone(skin,-.2),.8);line({x:-3,y:-147},{x:3,y:-147},tone(skin,-.22),.8);}
 ctx.restore();ctx.restore();
 if(pose.dive.hip){
  const dive=pose.dive,sh=ShuttleFeel.bodyPoint(freeShoulder,dive),rest=ShuttleFeel.bodyPoint(freeHand,dive);
  const target={x:mix(rest.x,dive.palm.x,dive.palmWeight),y:mix(rest.y,dive.palm.y,dive.palmWeight)};
  const {hand,elbow}=ShuttleFeel.supportArm(sh,target,racketSide);
  line(sh,elbow,tone(skin,-.09),8);line(elbow,hand,skin,6.5);ellipse(hand.x,hand.y,4.4,2.7,skin);
 }
 const {head,hand,elbow,axis}=pose.arm;
 const shoulder=pose.shoulder,ux=axis.x,uy=axis.y;
 line(shoulder,elbow,tone(skin,-.06),8);line(elbow,hand,skin,6.5);ellipse(hand.x,hand.y,3.7,4.2,skin);line(hand,{x:head.x-ux*21,y:head.y-uy*21},tone(ART.roof,.15),2);line(hand,{x:hand.x+ux*12,y:hand.y+uy*12},ART.roof,4);
 ctx.save();ctx.translate(head.x,head.y);ctx.rotate(Math.atan2(uy,ux)+Math.PI/2+pose.tilt);ellipse(0,0,14,22,ART.paint+'06',ART.roof,3);ellipse(0,0,14,22,null,tone(shirt,.28),1.4);
 for(let x=-10;x<=10;x+=4)line({x,y:-17},{x,y:17},ART.paint+'7a',.55);for(let y=-16;y<=16;y+=4)line({x:-11,y},{x:11,y},ART.paint+'7a',.55);ctx.restore();ctx.restore();
}
function drawTeam(side){
 const main={player:match.players[side],pose:poses[side]};
 if(!online?.active||!match.onlinePartners?.length){athlete(main.player,side);return;}
 const members=[main,...match.onlinePartners.filter(entry=>entry.side===side)];
 members.sort((a,b)=>b.player.z-a.player.z);
 for(const entry of members){
  athlete(entry.player,side,entry===main?null:{pose:racketPose(entry.player,side,online.contactFor(entry.player.id)),identity:entry.identity});
 }
 for(const entry of members){
  if(entry===main)continue;
  const pos=project(entry.player);
  ctx.save();
  ctx.font='bold 10px Arial';ctx.textAlign='center';
  const width=Math.min(100,Math.max(24,ctx.measureText(entry.name).width+14));
  rect(pos.x-width/2,pos.y+6,width,16,3,ART.roof+'ef');
  rect(pos.x-width/2+2,pos.y+9,2,10,1,side===0?ART.player:ART.opponent);
  ctx.fillStyle=ART.paint;ctx.fillText(entry.name,pos.x+1,pos.y+17,width-13);
  ctx.restore();
 }
}
function drawShuttle(){
 const b=match.ball,p=project(b),shadow=project({x:b.x,z:b.z});
 const pixel=W/canvas.getBoundingClientRect().width;
 const scale=Math.max(.62*pixel,p.s/(director.call&&!director.reduced?140:200));
 ctx.save();ctx.globalAlpha=.56/(1+b.y*.2);
 ellipse(shadow.x,shadow.y,(7+Math.min(7,b.y)*1.65)*scale,3.1*scale,ART.roof);
 ctx.restore();
 if(match.state==='rally'&&b.y>.5){
  ctx.save();ctx.setLineDash([2*pixel,5*pixel]);line(shadow,p,ART.paint+'57',.95*pixel);ctx.restore();
  if(p.y>H*.16&&p.y<H*.8){
   ctx.font='700 '+(11*pixel)+'px "Court Condensed",Arial';
   const height=b.y.toFixed(1)+'m',x=p.x+10*pixel,y=p.y-10*pixel;
   const width=ctx.measureText(height).width;
   rect(x-4*pixel,y-10*pixel,width+8*pixel,15*pixel,3*pixel,ART.roof+'ef');
   ctx.textAlign='left';ctx.fillStyle=ART.paint;ctx.fillText(height,x,y);
  }
 }
 if(!reduced)for(let i=1;i<trail.length;i++){
  const a=project(trail[i-1]),q=project(trail[i]),progress=i/trail.length;
  const color=match.lastHit===0?lastShotColor:ART.paint;
  line(a,q,color+Math.floor(progress*83).toString(16).padStart(2,'0'),Math.max(.65*pixel,progress*1.75*scale));
 }
 const next=project({x:b.x+b.vx*.02,y:b.y+b.vy*.02,z:b.z+b.vz*.02});
 ctx.save();ctx.translate(p.x,p.y);
 ctx.rotate(match.state==='rally'?Math.atan2(next.y-p.y,next.x-p.x):-.8);
 ctx.scale(scale,scale);
 const feather=gradient(ctx,-18,-8,-8,8,[[0,'#fff9e8'],[.5,ART.paint],[1,'#c3c7b7']]);
 path([{x:0,y:-3},{x:-16,y:-8},{x:-21,y:-6},{x:-21,y:6},{x:-16,y:8},{x:0,y:3}],feather,ART.roof,Math.max(.7,pixel/scale*.85));
 for(let i=-1;i<=1;i++)line({x:-19,y:i*4.8},{x:-2,y:i*1.9},tone(ART.muted,-.26),.75);
 ellipse(0,0,4.1,4.1,'#e4c392',ART.roof,.9);
 ellipse(1,-1.2,1.7,1.1,ART.paint);
 ctx.restore();
}
function drawLanding(){
 if(!match.landing||match.state!=='rally')return;
 const q=project(match.landing),color=match.lastHit===1?ART.player:lastShotColor;
 const radius=clamp(q.s*.22,8,18);
 ellipse(q.x,q.y,radius,radius*.32,ART.roof+'28',color+'d8',1.6);
 ellipse(q.x,q.y,2.2,1.1,color);
}
function drawTiming(){if(match.state!=='rally'||match.lastHit!==1||!match.contact)return;const pose=poses[0],t=match.contact.t;if(t<-.35||t>1.3)return;const factor=1+Math.max(0,t)*2,color=t<.17?ART.player:t<.34?ART.paint:ART.muted;ctx.save();ctx.globalAlpha=Math.min(.9,1.5-t);const ringX=14*.85*pose.scale*factor,ringY=22*.85*pose.scale*factor;ellipse(pose.point.x,pose.point.y,ringX,ringY,null,ART.roof+'b8',3.5);ellipse(pose.point.x,pose.point.y,ringX,ringY,null,color,1.7);ellipse(pose.point.x,pose.point.y,14*.85*pose.scale,22*.85*pose.scale,null,color+'60',1);ctx.restore();}
function drawComparisons(){if(match.mode!=='compare')return;const pixel=W/canvas.getBoundingClientRect().width;for(const result of match.comparisons){ctx.save();ctx.globalAlpha=match.state==='review'?(chosen===result.type?.95:.35):.4;let previous=null;for(const point of result.points){const p=project(point);if(previous)line(previous,p,SHOTS[result.type].color,(chosen===result.type?2.5:1.3)*pixel);previous=p;}const landing=project(result.landing);ellipse(landing.x,landing.y,10*pixel,3.5*pixel,SHOTS[result.type].color+'30',SHOTS[result.type].color,1.3*pixel);ctx.font='bold '+(10*pixel)+'px Arial';ctx.fillStyle=SHOTS[result.type].color;ctx.textAlign='left';ctx.fillText(shotNames[result.type],landing.x+12*pixel,landing.y-6*pixel);ctx.restore();}}
function drawGesture(){if(!gesture)return;const g=gesture,r=canvas.getBoundingClientRect(),toWorld=p=>({x:(p.x-r.left)/r.width*W,y:(p.y-r.top)/r.height*H}),start=toWorld(g.start),end=toWorld(g.last);ctx.save();ctx.setLineDash([4,6]);line(start,end,'#d3dfd299',2);ctx.setLineDash([]);ellipse(end.x,end.y,14+g.power*8,14+g.power*8,'#f1f1e81a',ART.paint,1.4);line(end,{x:end.x+(g.last.x-g.lowest.x)*1.2,y:end.y-65},ART.paint,2);ctx.font='bold 12px Arial';ctx.textAlign='center';ctx.fillStyle=ART.paint;ctx.fillText(g.fired?(match.pending&&(Math.abs(match.pending.aim)>.85||chosen==='clear'&&match.pending.power>.9)?'라인 공략':online?.active?(match.pending?(match.pending.acknowledged?'타격 대기':'스윙 전송 중'):'스윙 완료'):'스와이프 인식 ✓'):g.phase==='ready'?'준비 '+Math.round(g.power*100)+'%':'위로 밀기',end.x,end.y+36);ctx.restore();}
function drawShotZone(){if(match.state==='serve'&&match.service||shotPreview<=0&&!gesture)return;const depth=chosen==='drop'?CFG.drop.minDepth+CFG.drop.depthRange*.55:chosen==='clear'?5.7:4.7,color=SHOTS[chosen].color;const points=[{x:-2.05,z:depth-.35},{x:2.05,z:depth-.35},{x:2.05,z:depth+.35},{x:-2.05,z:depth+.35}].map(project);path(points,color+'24',color+'70',1);const p=project({x:0,z:depth});ctx.font='bold 11px Arial';ctx.fillStyle=color;ctx.textAlign='center';ctx.fillText(chosen==='drop'?'네트 바로 뒤':chosen==='clear'?'코트 맨 뒤':chosen==='smash'?'빠르게 내려찍기':'낮고 빠르게',p.x,p.y-12);}
function drawDebug(){if(!debug)return;const b={...match.ball};ctx.save();ctx.setLineDash([3,5]);let prev=project(b);for(let i=0;i<350;i++){const before={...b};integrate(b,CFG.step,match.wind);const net=collideNet(b,before,CFG.step,match.wind);if(net&&!net.over)break;if(i%5===0){const p=project(b);line(prev,p,'#c4d2c899',1);prev=p;}if(b.y<0)break;}ctx.setLineDash([]);if(match.contact){const p=project(match.contact);ellipse(p.x,p.y,6,6,null,ART.player,2);}ctx.restore();$('debug-panel').textContent='PHYSICS 120 Hz · QUADRATIC DRAG\nx '+match.ball.x.toFixed(2)+'  y '+match.ball.y.toFixed(2)+'  z '+match.ball.z.toFixed(2)+' m\nv '+Math.hypot(match.ball.vx,match.ball.vy,match.ball.vz).toFixed(2)+' m/s  k '+CFG.drag+'\ncontact '+(match.contact?match.contact.t.toFixed(2)+' s':'—')+'  state '+match.state+'\nAI read '+match.adaptation.samples+' · '+(match.adaptation.shot||'—')+' / '+match.adaptation.lateral+' / '+match.adaptation.depth+'\ncover x '+match.adaptation.cover.x.toFixed(2)+'  z '+match.adaptation.cover.z.toFixed(2)+' m';}
function resize(){const r=canvas.getBoundingClientRect();H=Math.round(r.height/r.width*W);wideView=r.width/r.height>1.05;cameraScale=wideView?Math.min(1,Math.max(.5,H/1060*1.55)):1;const dpr=Math.min(devicePixelRatio||1,2),renderScale=r.width/W*dpr;canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);ctx.setTransform(renderScale,0,0,renderScale,0,0);staticLayer=null;}
new ResizeObserver(resize).observe(canvas);resize();
function drawNetContact(){const hit=match.lastNetCord;if(!hit||match.time-hit.time>.45)return;const p=project(hit.point),age=(match.time-hit.time)/.45;ctx.save();ctx.globalAlpha=1-age;ellipse(p.x,p.y,9+(reduced?0:age*14),4+(reduced?0:age*6),null,ART.player,1.5);ctx.restore();}
function frame(t){
 const dt=Math.min((t-last)/1000||.016,.1);last=t;shotPreview=Math.max(0,shotPreview-dt);match.update(dt);if(!['paused','countdown'].includes(match.state))crowdFx=Math.max(0,crowdFx-dt);$('condition-value').textContent=Math.round(match.condition)+'%';$('ai-condition-value').textContent=Math.round(match.conditions[1])+'%';$('combo-indicator').hidden=match.combo<2||match.mode==='compare'||!$('menu').hidden||match.state==='over';$('combo-value').textContent='× '+match.combo;
 const hadCall=!!director.call,baseBall=project(match.ball),focus=director.call?project(director.call.landing):null;
 director.update(dt,{state:match.state,mode:match.mode,ball:match.ball,lastHit:match.lastHit,contactT:match.contact?.t,ballScreen:{x:baseBall.x/W,y:baseBall.y/H},focus:focus?{x:focus.x/W,y:focus.y/H}:null,frozen:['paused','countdown'].includes(match.state)||!$('menu').hidden||$('help-dialog').open||$('controls-dialog').open});
 if(hadCall&&!director.call){$('line-call').hidden=true;if(pendingFinish){showMatchEnd(pendingFinish);pendingFinish=null;}else if(match.state==='point')$('point-banner').hidden=false;}
 poses=match.players.map((p,side)=>racketPose(p,side,online?.active?online.contactFor(p.id):match.contact));if(feedbackTimer>0){feedbackTimer-=dt;if(feedbackTimer<=0)hideFeedback();}
 if(renderedVenue!==match.venue){
  renderedVenue=match.venue;
  $('stage').dataset.venue=renderedVenue;
  staticLayer=null;
 }
 const wind=match.wind;
 if(renderedWind!==wind){
  renderedWind=wind;
  const status=$('wind-status');
  status.hidden=!wind;
  status.textContent=wind?'셔틀이 '+(wind>0?'오른쪽':'왼쪽')+'으로 밀려요.':'';
 }
 if(!staticLayer){courtBackground();staticLayer=document.createElement('canvas');staticLayer.width=canvas.width;staticLayer.height=canvas.height;staticLayer.getContext('2d').drawImage(canvas,0,0);}
 ctx.fillStyle=ART.roof;ctx.fillRect(0,0,W,H);ctx.save();applyView();
 ctx.drawImage(staticLayer,0,0,W,H);
 if(match.state==='rally'){trail.push({x:match.ball.x,y:match.ball.y,z:match.ball.z});if(trail.length>18)trail.shift();}
 const detail=director.detailWeight;drawComparisons();if(!director.call){drawServiceCourt();drawShotZone();drawLanding();}ctx.save();ctx.globalAlpha=1-detail;if(wind)drawWindFlags(ctx,project,ART,wind,reduced?0:match.time);drawTeam(1);ctx.restore();if(match.ball.z>0)drawShuttle();ctx.save();ctx.globalAlpha=1-detail;drawNet();drawTeam(0);ctx.restore();if(match.ball.z<=0)drawShuttle();drawTiming();drawDebug();drawNetContact();drawLineCall();
 for(let i=particles.length-1;i>=0;i--){const p=particles[i];if(!['paused','countdown'].includes(match.state)){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;}if(p.life<=0){particles.splice(i,1);continue;}ctx.globalAlpha=p.life/.22;ellipse(p.x,p.y,2,2,p.color);}ctx.globalAlpha=1;ctx.restore();drawLineView();drawGesture();requestAnimationFrame(frame);
}
online=new ShuttleOnline.Client({match,updateServeOptions,onRoomChange:syncLobbyArtwork,
 isOnCourt:()=>$('menu').hidden&&$('title-screen').hidden&&!document.hidden&&!$('help-dialog').open&&!$('controls-dialog').open&&!layoutSession,
 getAthlete:()=>selectedAthlete,emit:(event,data)=>match.emit(event,data),focusCourt:()=>canvas.focus({preventScroll:true}),clearInput:clearGesture,setView:view=>{if(view==='game'){$('menu').hidden=true;$('title-screen').hidden=true;document.body.classList.add('is-playing');$('pause-overlay').hidden=!['paused','over'].includes(match.state);}else{document.body.classList.remove('is-playing');$('title-screen').hidden=true;$('menu').hidden=false;$('pause-overlay').hidden=true;selectLobbyTab('friends');$('menu-resume').hidden=true;}syncLobby();updateServeOptions();}});
setShot(chosen);
if(document.fonts)document.fonts.ready.then(()=>{staticLayer=null;});
selectLobbyTab('play');syncLobby();$('title-enter').focus({preventScroll:true});
requestAnimationFrame(frame);
function lobbyArtwork(){
 if($('menu').hidden)return null;
 const {width,height}=$('lobby-showcase').getBoundingClientRect();
 return {athlete:selectedAthlete,width:Math.round(width),height:Math.round(height)};
}
// Read-only diagnostics support repeatable QA without changing normal gameplay.
window.shuttleRush={get snapshot(){return {online:online?.snapshot,screen:!$('title-screen').hidden?'title':!$('menu').hidden?'lobby':'game',lobby:{tab:lobbyTab,preview:lobbyArtwork()},inputState:gesture?{pointerId:gesture.id,phase:gesture.phase,fired:gesture.fired,accepted:!!gesture.accepted}:null,athleteId:match.athleteId,athlete:JSON.parse(JSON.stringify(match.athlete)),athleteModifiers:{...match.athleteModifiers},nextAthlete:selectedAthlete,layout:layoutEditor.snapshot,art:{theme:'club-court',palette:{...ART}},combo:match.combo,condition:match.condition,conditions:[...match.conditions],crowd:{level:crowdLevel,remaining:crowdFx},netCord:match.lastNetCord?JSON.parse(JSON.stringify(match.lastNetCord)):null,tournament:tournament.snapshot,stats:match.summary,camera:director.snapshot,controls:{...controls,keys:{...controls.keys}},aiStyle:match.aiStyle||'balanced',adaptation:JSON.parse(JSON.stringify(match.adaptation)),service:match.service?{...match.service}:null,activeServe:match.activeServe?{...match.activeServe}:null,selectedServe:match.selectedServe,resumeRemaining:match.resumeRemaining,lastSound:lastSound?{...lastSound}:null,state:match.state,mode:match.mode,venue:match.venue,wind:match.wind,server:match.server,score:[...match.score],ball:{...match.ball},rally:match.rally,contact:match.contact?{...match.contact}:null,players:JSON.parse(JSON.stringify(match.players)),lastHit:match.lastHit,pointCount:match.pointCount,pending:match.pending?{...match.pending}:null,lastInput:lastInput?{...lastInput}:null,comparisons:JSON.parse(JSON.stringify(match.comparisons)),selectedShot:match.selectedShot,lastDecision:match.lastDecision?{...match.lastDecision}:null,visual:{rackets:poses.map(p=>({x:viewPoint(p.point).x,y:viewPoint(p.point).y,scale:p.scale*director.view.zoom,age:p.age,type:p.type,variant:p.kind==='block'?'block':null,stroke:p.stroke,handSign:p.handSign,turn:p.turn,dive:JSON.parse(JSON.stringify(p.dive)),shoulder:{...p.shoulder},shoulderScreen:viewPoint({x:p.spot.x+p.shoulder.x*p.scale*.85,y:p.spot.y+p.shoulder.y*p.scale*.85}),jump:p.jump,tilt:p.tilt,impact:p.impact?screenPoint(p.impact.point):null})),impact:lastImpactFx?{...lastImpactFx,screen:screenPoint(lastImpactFx.point)}:null,ball:screenPoint(match.ball),ground:screenPoint({x:match.ball.x,z:match.ball.z}),ring:match.contact&&match.lastHit===1&&poses[0]?{x:viewPoint(poses[0].point).x,y:viewPoint(poses[0].point).y}:null},lastShot:match.shotHistory.length?JSON.parse(JSON.stringify(match.shotHistory.at(-1))):null};}};
})();
