
(function(){
"use strict";
const U=window.UNITS||[], L=window.LESSONS||[], Q=window.QUESTIONS||[], root=document.getElementById("root"), KEY="grammar-lab-2026-v1";
function read(){try{return JSON.parse(localStorage.getItem(KEY))||{}}catch(e){return {}}}
const old=read();
const S={page:"home",filter:"all",search:"",done:new Set(old.done||[]),wrong:new Set(old.wrong||[]),history:old.history||[],practice:null,exam:old.exam||null};
let timer=null;
const $=s=>document.querySelector(s), qid=id=>Q.find(q=>q.id===id), uname=n=>U[n]?U[n].name:"전체";
function esc(s){return String(s===undefined?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function save(){try{localStorage.setItem(KEY,JSON.stringify({done:[...S.done],wrong:[...S.wrong],history:S.history.slice(0,80),exam:S.exam}))}catch(e){notify("기록 저장에 실패했어.")}}
function notify(t){const e=$("#toast");e.textContent=t;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),2400)}
const shuffle=a=>[...a].sort(()=>Math.random()-.5);
function header(tag,title,desc){return '<div class="eyebrow">'+esc(tag)+'</div><h1 class="heading">'+esc(title)+'</h1><p class="sub">'+esc(desc)+'</p>'}
function cards(){return U.map((u,i)=>'<button data-unit="'+i+'" class="unit-card"><span class="uicon">'+u.icon+'</span><h3>'+u.name+'</h3><p>'+u.pages+' · '+L.filter(x=>x.unit===i).length+'개 개념</p><div class="arrow">학습하기 ↗</div></button>').join("")}
function nav(p){S.page=p;$(".sidebar").classList.remove("open");document.querySelectorAll("[data-nav]").forEach(e=>e.classList.toggle("active",e.dataset.nav===p));$("#pageName").textContent=({home:"대시보드",learn:"개념 공부",practice:"문제 풀이",exam:"45분 모의고사",wrong:"오답 노트"})[p];render();window.scrollTo(0,0)}
function render(){clearInterval(timer);if(S.page==="home")home();if(S.page==="learn")learn();if(S.page==="practice")practice();if(S.page==="exam")exam();if(S.page==="wrong")wrong()}
function home(){
const pct=Math.round(S.done.size/Math.max(1,L.length)*100);
root.innerHTML='<div class="hero"><section class="hero-main"><div class="eyebrow">YOUR GRAMMAR JOURNEY</div><h1>문법을 외우는 데서 끝내지 말고,<br>원리를 직접 설명해 보자.</h1><p>학교 자료에 맞춘 5개 영역 · '+L.length+'개 개념 · '+Q.length+'개 문제. 이해하고, 연습하고, 실전처럼 풀어 봐.</p><button class="btn white" data-act="learn">개념 공부 시작하기 →</button></section><section class="hero-side"><div class="mini-title">개념 학습 진행률</div><div class="progressBig">'+pct+'<small>%</small></div><div class="progress-track"><span style="width:'+pct+'%"></span></div><div class="tiny muted">'+S.done.size+' / '+L.length+'개 학습 완료</div><div class="hr"></div><div class="tiny muted">범위: 1~29쪽, 31~35쪽 (5개 평가 영역)</div></section></div>'+
'<div class="stats"><div class="stat"><div class="label">완료 개념</div><strong>'+S.done.size+'</strong></div><div class="stat"><div class="label">연습 기록</div><strong>'+S.history.length+'</strong></div><div class="stat"><div class="label">복습할 오답</div><strong>'+S.wrong.size+'</strong></div></div>'+
'<div class="section-row"><h2>5개 평가 영역</h2><span class="tiny muted">학교 수행 안내 기준</span></div><div class="units">'+cards()+'</div>'+
'<div class="section-row"><h2>학습 가이드</h2></div><div class="panel"><p><strong>개념 이해 → 영역별 문제 → 오답 복습 → 45분 모의고사</strong></p><p class="tiny muted">모의고사는 5개 영역 5문제씩 총 25문제를 자체 구성하고, 총 20점으로 환산해. 실제 시험의 세부 배점과는 달라.</p><div class="notice warn"><strong>정확도 안내:</strong> 올려준 학교 자료의 인쇄 부분을 중심으로 정리했어. 불명확한 손글씨는 정답으로 단정하지 않았고, 일부 예외는 표준국어대사전과 표준 발음법을 함께 확인해야 해.</div></div>';
}
function learn(){
const text=S.search.trim().toLowerCase(),list=L.filter(x=>(S.filter==="all"||x.unit===Number(S.filter))&&(!text||[x.title,...x.points,...x.examples,x.pitfall].join(" ").toLowerCase().includes(text)));
root.innerHTML=header("THEORY LIBRARY","개념 공부","학교 문법 학습 자료를 세부 주제로 정리했어. 제목을 눌러 내용을 열어 봐.")+
'<div class="controlbar"><div class="search-wrap"><input id="lessonSearch" class="search" placeholder="개념 검색: 구개음화, 서술절, 형태소..." value="'+esc(S.search)+'"></div><button data-act="reset-search" class="btn line">초기화</button></div>'+
'<div class="pills"><button data-filter="all" class="pill '+(S.filter==="all"?"selected":"")+'">전체 ('+L.length+')</button>'+U.map((u,i)=>'<button data-filter="'+i+'" class="pill '+(S.filter===String(i)?"selected":"")+'">'+u.name+'</button>').join("")+'</div>'+
'<div class="notice"><strong>자료 근거:</strong> 각 개념에 학교 학습 자료 쪽수를 표시했어. 손글씨가 불명확한 부분은 임의 정답으로 확정하지 않았어.</div>'+
'<div class="section-row"><h2>개념 '+list.length+'개</h2><span class="tiny muted">클릭해서 자세히 보기</span></div><div class="lesson-grid">'+(list.length?list.map(x=>
'<details class="lesson" id="lesson-'+x.id+'"><summary><div><small>'+uname(x.unit)+' · '+esc(x.pages)+'쪽</small><strong>'+esc(x.title)+'</strong></div><span class="carat">⌄</span></summary><div class="lesson-content"><ul>'+
x.points.map(p=>'<li>'+esc(p)+'</li>').join("")+'</ul>'+x.examples.map(p=>'<div class="example"><b>예시</b><br>'+esc(p)+'</div>').join("")+
'<div class="trap"><b>주의:</b> '+esc(x.pitfall)+'</div><div class="lesson-foot"><span class="sourceline">학교 자료 '+esc(x.pages)+'쪽 · <a target="_blank" rel="noopener" href="https://stdict.korean.go.kr/">표준국어대사전 ↗</a></span><button data-done="'+x.id+'" class="checkbtn '+(S.done.has(x.id)?"done":"")+'">'+(S.done.has(x.id)?"✓ 학습 완료":"□ 학습 완료 표시")+'</button></div></div></details>').join(""):'<div class="emptystate">검색 결과가 없어.</div>')+'</div>';
}
function isCorrect(q,a){
if(a===undefined||a===null||a==="")return false;
if(q.type==="match"||q.type==="order")return Array.isArray(a)&&a.length===q.correct.length&&q.correct.every((v,i)=>Number(a[i])===v);
if(q.type==="blank"||q.type==="short"){
const normalize=v=>String(v).replace(/[\s,\[\]·,，]/g,"").normalize("NFC");
return(q.accept||[]).some(x=>normalize(x)===normalize(a));
}
return Number(a)===q.correct;
}
function hasAnswer(q,a){
if(a===undefined||a===null)return false;
if(q.type==="blank"||q.type==="short")return String(a).trim().length>0;
if(q.type==="match")return Array.isArray(a)&&a.length===q.pairs.length&&a.every(x=>Number.isInteger(x));
if(q.type==="order")return Array.isArray(a)&&a.length===q.choices.length&&new Set(a).size===a.length;
return a!==""&&Number.isInteger(Number(a));
}
function answerString(q,a){
if(!hasAnswer(q,a))return "미응답";
if(q.type==="match")return q.pairs.map((t,i)=>t+" → "+q.choices[a[i]]).join(" / ");
if(q.type==="order")return a.map(i=>q.choices[i]).join(" → ");
if(q.type==="mc"||q.type==="ox")return q.choices[Number(a)];
return String(a);
}
function correctString(q){
if(q.type==="match")return q.pairs.map((t,i)=>t+" → "+q.choices[q.correct[i]]).join(" / ");
if(q.type==="order")return q.correct.map(i=>q.choices[i]).join(" → ");
if(q.type==="mc"||q.type==="ox")return q.choices[q.correct];
return(q.accept||[])[0]||"";
}
function practice(){
if(!S.practice){
root.innerHTML=header("TRAINING ZONE","문제 풀이","문제를 풀고 바로 해설을 확인할 수 있어. 틀린 문제는 자동으로 오답 노트에 쌓여.")+
'<div class="mode-card"><h2 style="margin-top:0">문제 설정</h2><div class="mode-row"><label>영역</label><select id="pUnit" class="select"><option value="all">전체 영역</option>'+U.map((u,i)=>'<option value="'+i+'">'+u.name+'</option>').join("")+'</select><label>유형</label><select id="pType" class="select"><option value="all">전체 유형 섞기</option><option value="mc">객관식</option><option value="short">단답형</option><option value="blank">빈칸 채우기</option><option value="ox">OX 퀴즈</option><option value="match">개념 연결하기</option><option value="order">순서 배열하기</option></select><label>문제 수</label><select id="pCount" class="select"><option value="10">10문제</option><option value="20">20문제</option><option value="30">30문제</option><option value="50">50문제</option><option value="all">전체</option></select><button data-act="start-practice" class="btn primary">시작하기 →</button></div><p class="tiny muted">객관식과 단답형 연습이 함께 제공돼. 단답형은 다른 표준 표기를 입력한 경우 해설도 확인해 줘.</p></div><div class="units">'+cards()+'</div>';
return;
}
if(S.practice.finished){results(S.practice,"practice");return}
question(S.practice,"practice");
}
function startPractice(onlyWrong){
const selectedType=$("#pType")?.value||"all"; const pool=onlyWrong?Q.filter(q=>S.wrong.has(q.id)):Q.filter(q=>($("#pUnit").value==="all"||q.unit===Number($("#pUnit").value))&&(selectedType==="all"||q.type===selectedType));
if(!pool.length){notify("복습할 문제가 없어.");return}
const count=onlyWrong||$("#pCount").value==="all"?pool.length:Number($("#pCount").value);
S.practice={ids:shuffle(pool).slice(0,count).map(x=>x.id),idx:0,answers:{},checked:{},finished:false,fromWrong:Boolean(onlyWrong)};
nav("practice");
}
function question(session,mode){
clearInterval(timer);
const q=qid(session.ids[session.idx]),ans=session.answers[q.id],checked=Boolean(session.checked&&session.checked[q.id]),ex=mode==="exam";
const title=ex?'<div class="exam-head"><div><div class="tiny muted">45분 실전 모의고사</div><div id="timer" class="timer">45:00</div></div><span class="tiny muted">총 20점 · 25문제</span><button data-act="finish-exam" class="btn danger">시험 제출</button></div>':header("TRAINING","문제 풀이",session.fromWrong?"오답 다시 풀기":"정답 확인 후 해설을 읽고 넘어가 봐.");
const labels={mc:"객관식",short:"단답형",blank:"빈칸 채우기",ox:"OX 퀴즈",match:"개념 연결하기",order:"순서 배열하기"};
let opts="";
if(q.type==="mc"||q.type==="ox"){
opts='<div class="choice-grid '+(q.type==="ox"?"ox-grid":"")+'">'+q.choices.map((c,i)=>'<button data-pick="'+i+'" '+(checked?"disabled":"")+' class="choice '+(ans!==undefined&&Number(ans)===i?"selected ":"")+(checked&&i===q.correct?"correct ":"")+(checked&&Number(ans)===i&&i!==q.correct?"wrong ":"")+'"><span class="no">'+(q.type==="ox"?c:i+1)+'</span><span>'+esc(c)+'</span></button>').join("")+'</div>';
}else if(q.type==="short"||q.type==="blank"){
opts='<input id="textAnswer" class="answer" autocomplete="off" placeholder="'+(q.type==="blank"?"빈칸에 들어갈 말만 입력해 줘":"답을 입력해 줘")+'" value="'+esc(ans||"")+'" '+(checked?"disabled":"")+'>';
}else if(q.type==="match"){
const picked=Array.isArray(ans)?ans:[];
opts='<div class="match-grid"><p class="muted tiny">왼쪽 개념과 알맞은 설명을 각각 연결해 줘.</p>'+q.pairs.map((t,i)=>'<div class="match-row"><label for="pair'+i+'">'+esc(t)+'</label><select class="select match-select" data-match="'+i+'" id="pair'+i+'" '+(checked?"disabled":"")+'><option value="">정답을 선택해 줘</option>'+q.choices.map((d,j)=>'<option value="'+j+'" '+(picked[i]===j?"selected":"")+'>'+esc(d)+'</option>').join("")+'</select></div>').join("")+'</div>';
}else if(q.type==="order"){
const picked=Array.isArray(ans)?ans:[];
opts='<div class="order-wrap"><p class="tiny muted">아래 조각을 순서대로 눌러 배열해 줘.</p><div class="order-selected">'+(picked.length?picked.map((idx,i)=>'<span class="order-chip">'+(i+1)+'. '+esc(q.choices[idx])+'</span>').join(""):'<span class="tiny muted">아직 선택한 항목이 없어.</span>')+'</div><div class="order-choices">'+q.choices.map((t,i)=>'<button data-order="'+i+'" class="choice" '+(picked.includes(i)||checked?"disabled":"")+'><span class="no">'+(i+1)+'</span>'+esc(t)+'</button>').join("")+'</div><button data-act="undo-order" class="checkbtn" '+(!picked.length||checked?"disabled":"")+'>↶ 마지막 선택 취소</button></div>';
}
const explanation=(!ex&&checked)?'<div class="explain '+(isCorrect(q,ans)?"good":"bad")+'"><strong>'+(isCorrect(q,ans)?"✓ 정답!":"✗ 오답")+'</strong><p><b>정답:</b> '+esc(correctString(q))+'</p><p>'+esc(q.why)+'</p></div>':"";
const actions='<div class="question-actions"><button data-act="previous" class="btn line" '+(session.idx===0?"disabled":"")+'>← 이전</button><button data-act="'+(ex?"next":checked?"next":"check")+'" class="btn primary" '+(!ex&&!checked&&!hasAnswer(q,ans)?"disabled":"")+'>'+(ex?(session.idx===session.ids.length-1?"답안 검토":"다음 문제"):checked?(session.idx===session.ids.length-1?"결과 보기":"다음 문제"):"정답 확인")+' →</button></div>';
const pager=ex?'<div class="exam-pager">'+session.ids.map((id,i)=>'<button data-jump="'+i+'" class="'+(i===session.idx?"now ":"")+(hasAnswer(qid(id),session.answers[id])?"answered":"")+'">'+(i+1)+'</button>').join("")+'</div>':"";
root.innerHTML=title+'<div class="quiz-top" style="max-width:800px;margin:0 auto 12px"><span class="badge">'+uname(q.unit)+' · 교재 '+q.pages+'쪽</span><strong class="tiny muted">'+(session.idx+1)+' / '+session.ids.length+'</strong></div><div class="question-card"><div class="question-meta">'+labels[q.type]+'</div><h2>'+esc(q.q)+'</h2>'+opts+explanation+actions+'</div>'+pager;
if(ex){updateTimer();timer=setInterval(updateTimer,1000)}
}
function updateTimer(){const ex=S.exam;if(!ex||ex.finished)return;const seconds=Math.max(0,Math.ceil((ex.deadline-Date.now())/1000)),e=$("#timer");
if(e){e.textContent=String(Math.floor(seconds/60)).padStart(2,"0")+":"+String(seconds%60).padStart(2,"0");e.classList.toggle("danger",seconds<300)}
if(seconds===0)finishExam(true)}
function choose(n){
const session=S.page==="exam"?S.exam:S.practice;if(!session)return;
const q=qid(session.ids[session.idx]);
if(session.checked&&session.checked[q.id])return;
session.answers[q.id]=n;
if(S.page==="exam")save();
question(session,S.page);
}
function check(){
const session=S.practice;if(!session)return;
const q=qid(session.ids[session.idx]);
if(q.type==="short"||q.type==="blank"){
const value=$("#textAnswer")?.value.trim();
if(!value){notify("답을 입력해 줘.");return}
session.answers[q.id]=value;
}
if(!hasAnswer(q,session.answers[q.id])){notify("답을 모두 완성해 줘.");return}
session.checked[q.id]=true;
if(!isCorrect(q,session.answers[q.id]))S.wrong.add(q.id);
save();question(session,"practice");
}
function next(){
const session=S.page==="exam"?S.exam:S.practice;if(!session)return;
if(S.page==="practice"&&!session.checked[session.ids[session.idx]])return;
if(session.idx===session.ids.length-1){
if(S.page==="practice")finishPractice();
else notify("마지막 문제야. 상단의 시험 제출 버튼을 눌러 줘.");
return;
}
session.idx++;if(S.page==="exam")save();question(session,S.page);
}
function finishPractice(){const s=S.practice;s.finished=true;const c=s.ids.filter(id=>isCorrect(qid(id),s.answers[id])).length;S.history.unshift({mode:"practice",correct:c,total:s.ids.length,when:Date.now()});save();practice()}
function exam(){
if(S.exam){if(S.exam.finished){results(S.exam,"exam");return}if(S.exam.deadline<=Date.now()){finishExam(true);return}question(S.exam,"exam");return}
root.innerHTML=header("REAL EXAM","45분 모의고사","5개 영역에서 각각 5문제씩, 총 25문제로 다양한 문법 유형을 연습해.")+
'<div class="panel" style="max-width:740px;margin:auto"><div class="eyebrow">BEFORE YOU START</div><h2 style="font-size:29px">45:00 <span class="muted" style="font-size:15px">/ 25문제</span></h2><p>객관식·단답형·빈칸·OX·연결·순서 배열 유형이 섞인 자체 모의고사야. 실제 수행평가와 문항 수·배점이 동일한 것은 아니야.</p><div class="notice">5개 영역 × 5문제 · 총 20점 · 답안 저장 · 시간 종료 자동 제출 · 새로고침해도 타이머 유지</div><button data-act="start-exam" class="btn primary" style="width:100%">모의고사 시작 →</button></div>';
}
function startExam(){
let list=[];
for(let unit=0;unit<5;unit++){
for(const type of ["mc","short","blank","ox",unit%2===0?"match":"order"]){
const candidates=Q.filter(q=>q.unit===unit&&q.type===type);
if(!candidates.length){notify("해당 유형의 문제가 부족해.");return}
list.push(shuffle(candidates)[0].id);
}
}
S.exam={ids:shuffle(list),idx:0,answers:{},deadline:Date.now()+2700000,finished:false};save();nav("exam");
}
function finishExam(auto){const s=S.exam;if(!s||s.finished)return;s.finished=true;s.auto=auto;const correct=s.ids.filter(id=>isCorrect(qid(id),s.answers[id])).length;s.ids.forEach(id=>{if(!isCorrect(qid(id),s.answers[id]))S.wrong.add(id)});S.history.unshift({mode:"exam",correct,total:s.ids.length,when:Date.now()});save();nav("exam")}
function results(session,mode){
const correct=session.ids.filter(id=>isCorrect(qid(id),session.answers[id])).length,total=session.ids.length;
const score=mode==="exam"?(correct*20/total).toFixed(1):Math.round(correct/total*100);
root.innerHTML=header("RESULT","결과 및 해설",session.auto?"45분이 지나 자동 제출했어.":"각 문제의 해설을 확인하고 부족한 부분을 복습해.")+
'<div class="panel" style="max-width:830px;margin:auto"><span class="eyebrow">'+(mode==="exam"?"EXAM SCORE":"PRACTICE SCORE")+'</span><div class="resultBig">'+score+'<span> '+(mode==="exam"?"/ 20점":"% 정답률")+'</span></div><p class="muted">정답 '+correct+'개 · 오답/미응답 '+(total-correct)+'개 · 총 '+total+'문제</p><div class="progress-track"><span style="width:'+(correct/total*100)+'%"></span></div><button data-act="reset-'+mode+'" class="btn primary">다시 도전하기</button> <button data-act="wrong" class="btn light">오답 노트</button></div>'+
'<div class="section-row"><h2>문제별 해설</h2></div>'+session.ids.map((id,i)=>{const q=qid(id),a=session.answers[id],ok=isCorrect(q,a);return '<div class="review"><span class="badge '+(ok?"":"wrong")+'">'+(ok?"정답":"오답")+'</span> <span class="tiny muted">'+(i+1)+'번 · '+uname(q.unit)+' · '+q.pages+'쪽</span><h3>'+esc(q.q)+'</h3><p class="tiny"><b>내 답:</b> '+esc(answerString(q,a))+'</p><p class="tiny"><b>정답:</b> '+esc(correctString(q))+'</p><div class="muted tiny">'+esc(q.why)+'</div></div>'}).join("");
}
function wrong(){
const items=[...S.wrong].map(qid).filter(Boolean);
root.innerHTML=header("REVIEW","오답 노트","틀렸던 문제만 모았어. 다시 풀거나 충분히 이해했다면 제거할 수 있어.")+
'<div class="section-row"><h2>오답 '+items.length+'개</h2>'+(items.length?'<button data-act="retry" class="btn primary">오답 다시 풀기 →</button>':"")+'</div>'+
(items.length?items.map(q=>'<div class="review"><span class="badge wrong">'+uname(q.unit)+' · '+q.pages+'쪽</span><h3>'+esc(q.q)+'</h3><p class="tiny"><b>정답:</b> '+esc(correctString(q))+'</p><p class="tiny muted">'+esc(q.why)+'</p><button data-remove="'+q.id+'" class="checkbtn">✓ 이해했어 · 오답 제거</button></div>').join(""):'<div class="emptystate"><h3>아직 오답이 없어!</h3><p>틀린 문제는 여기 자동 저장돼.</p><button data-act="practice" class="btn primary">문제 풀이 시작 →</button></div>');
}
document.addEventListener("click",ev=>{const n=ev.target.closest("[data-nav]");if(n){ev.preventDefault();nav(n.dataset.nav);return}if(ev.target.closest("#menuBtn"))$(".sidebar").classList.toggle("open")});
root.addEventListener("input",e=>{
if(e.target.id==="lessonSearch"){
S.search=e.target.value;const len=S.search.length;learn();const inp=$("#lessonSearch");inp.focus();inp.setSelectionRange(len,len);
}
if(e.target.id==="textAnswer"){
const session=S.page==="exam"?S.exam:S.practice;if(!session)return;
const q=qid(session.ids[session.idx]);
session.answers[q.id]=e.target.value;if(S.page==="exam")save();
const b=root.querySelector('[data-act="check"]');if(b)b.disabled=!hasAnswer(q,session.answers[q.id]);
}
});
root.addEventListener("change",e=>{
if(e.target.dataset.match===undefined)return;
const session=S.page==="exam"?S.exam:S.practice;if(!session)return;
const q=qid(session.ids[session.idx]);
const row=Number(e.target.dataset.match);
const answers=Array.isArray(session.answers[q.id])?[...session.answers[q.id]]:Array(q.pairs.length).fill(null);
answers[row]=e.target.value===""?null:Number(e.target.value);
session.answers[q.id]=answers;if(S.page==="exam")save();
const b=root.querySelector('[data-act="check"]');if(b)b.disabled=!hasAnswer(q,answers);
});
root.addEventListener("keydown",e=>{
if(e.target.id==="textAnswer"&&e.key==="Enter"){e.preventDefault();if(S.page==="practice")check();else next()}
});
root.addEventListener("click",e=>{
const b=e.target.closest("button");if(!b)return;
if(b.dataset.filter!==undefined){S.filter=b.dataset.filter;learn();return}
if(b.dataset.unit!==undefined){S.filter=b.dataset.unit;S.search="";nav("learn");return}
if(b.dataset.done!==undefined){const id=Number(b.dataset.done),open=b.closest("details")?.open;S.done.has(id)?S.done.delete(id):S.done.add(id);save();learn();const d=$("#lesson-"+id);if(d&&open)d.open=true;return}
if(b.dataset.pick!==undefined){choose(Number(b.dataset.pick));return}
if(b.dataset.order!==undefined){
const session=S.page==="exam"?S.exam:S.practice;if(!session)return;
const q=qid(session.ids[session.idx]),val=Number(b.dataset.order);
const answers=Array.isArray(session.answers[q.id])?[...session.answers[q.id]]:[];
if(answers.includes(val))return;answers.push(val);session.answers[q.id]=answers;
if(S.page==="exam")save();question(session,S.page);return;
}
if(b.dataset.jump!==undefined){S.exam.idx=Number(b.dataset.jump);save();question(S.exam,"exam");return}
if(b.dataset.remove!==undefined){S.wrong.delete(Number(b.dataset.remove));save();wrong();return}
const a=b.dataset.act;
if(["learn","practice","exam","wrong","home"].includes(a)){if(a==="learn"){S.filter="all";S.search=""}nav(a)}
else if(a==="reset-search"){S.search="";learn()}
else if(a==="start-practice")startPractice(false)
else if(a==="retry")startPractice(true)
else if(a==="check")check()
else if(a==="undo-order"){
const session=S.page==="exam"?S.exam:S.practice;if(!session)return;
const q=qid(session.ids[session.idx]),answers=Array.isArray(session.answers[q.id])?[...session.answers[q.id]]:[];
answers.pop();session.answers[q.id]=answers;if(S.page==="exam")save();question(session,S.page);
}
else if(a==="previous"){const session=S.page==="exam"?S.exam:S.practice;if(session&&session.idx>0){session.idx--;if(S.page==="exam")save();question(session,S.page)}}
else if(a==="next")next()
else if(a==="reset-practice"){S.practice=null;practice()}
else if(a==="start-exam")startExam()
else if(a==="finish-exam"){
const session=S.exam,empty=session.ids.filter(id=>!hasAnswer(qid(id),session.answers[id])).length;
if(empty&&!window.confirm("미응답 "+empty+"개가 있어. 그래도 제출할까?"))return;
finishExam(false);
}
else if(a==="reset-exam"){S.exam=null;save();exam()}
});

if(S.exam&&!S.exam.finished&&S.exam.deadline<=Date.now())finishExam(true);else render();
})();
