
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
if(q.type!=="short")return Number(a)===q.correct;
const normalize=v=>String(v).replace(/[\s,\[\]·]/g,"").normalize("NFC");
return (q.accept||[]).some(x=>normalize(x)===normalize(a));
}
function practice(){
if(!S.practice){
root.innerHTML=header("TRAINING ZONE","문제 풀이","문제를 풀고 바로 해설을 확인할 수 있어. 틀린 문제는 자동으로 오답 노트에 쌓여.")+
'<div class="mode-card"><h2 style="margin-top:0">문제 설정</h2><div class="mode-row"><label>영역</label><select id="pUnit" class="select"><option value="all">전체 영역</option>'+U.map((u,i)=>'<option value="'+i+'">'+u.name+'</option>').join("")+'</select><label>유형</label><select id="pType" class="select"><option value="all">혼합</option><option value="short">단답형만</option><option value="mc">객관식만</option></select><label>문제 수</label><select id="pCount" class="select"><option value="10">10문제</option><option value="20">20문제</option><option value="30">30문제</option><option value="50">50문제</option><option value="all">전체</option></select><button data-act="start-practice" class="btn primary">시작하기 →</button></div><p class="tiny muted">객관식과 단답형 연습이 함께 제공돼. 단답형은 다른 표준 표기를 입력한 경우 해설도 확인해 줘.</p></div><div class="units">'+cards()+'</div>';
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
clearInterval(timer); const q=qid(session.ids[session.idx]),ans=session.answers[q.id],checked=Boolean(session.checked&&session.checked[q.id]),ex=mode==="exam";
const title=ex?'<div class="exam-head"><div><div class="tiny muted">45분 실전 모의고사</div><div id="timer" class="timer">45:00</div></div><span class="tiny muted">총 20점 · 25문제</span><button data-act="finish-exam" class="btn danger">시험 제출</button></div>':header("TRAINING","문제 풀이",session.fromWrong?"오답 다시 풀기":"정답 확인 후 해설을 읽고 넘어가 봐.");
let opts="";
if(q.type==="mc")opts='<div class="choice-grid">'+q.choices.map((c,i)=>'<button data-pick="'+i+'" '+(checked?"disabled":"")+' class="choice '+(ans!==undefined&&Number(ans)===i?"selected ":"")+(checked&&i===q.correct?"correct ":"")+(checked&&Number(ans)===i&&i!==q.correct?"wrong ":"")+'"><span class="no">'+(i+1)+'</span><span>'+esc(c)+'</span></button>').join("")+'</div>';
else opts='<input id="short" class="answer" placeholder="답을 입력해 줘" value="'+esc(ans||"")+'" '+(checked?"disabled":"")+'>';
const explanation=(!ex&&checked)?'<div class="explain '+(isCorrect(q,ans)?"good":"bad")+'"><strong>'+(isCorrect(q,ans)?"✓ 정답!":"✗ 오답")+'</strong><p>정답: '+(q.type==="mc"?esc(q.choices[q.correct]):esc(q.accept[0]))+'</p><p>'+esc(q.why)+'</p></div>':"";
const actions='<div class="question-actions"><button data-act="previous" class="btn line" '+(session.idx===0?"disabled":"")+'>← 이전</button><button data-act="'+(ex?"next":checked?"next":"check")+'" class="btn primary" '+(!ex&&!checked&&ans===undefined?"disabled":"")+'>'+(ex?"다음 문제":checked?(session.idx===session.ids.length-1?"결과 보기":"다음 문제"):"정답 확인")+' →</button></div>';
const pager=ex?'<div class="exam-pager">'+session.ids.map((id,i)=>'<button data-jump="'+i+'" class="'+(i===session.idx?"now ":"")+(session.answers[id]!==undefined?"answered":"")+'">'+(i+1)+'</button>').join("")+'</div>':"";
root.innerHTML=title+'<div class="quiz-top" style="max-width:800px;margin:0 auto 12px"><span class="badge">'+uname(q.unit)+' · 교재 '+q.pages+'쪽</span><strong class="tiny muted">'+(session.idx+1)+' / '+session.ids.length+'</strong></div><div class="question-card"><div class="question-meta">'+(q.type==="mc"?"객관식":"단답형")+'</div><h2>'+esc(q.q)+'</h2>'+opts+explanation+actions+'</div>'+pager;
if(ex){updateTimer();timer=setInterval(updateTimer,1000)}
}
function updateTimer(){const ex=S.exam;if(!ex||ex.finished)return;const seconds=Math.max(0,Math.ceil((ex.deadline-Date.now())/1000)),e=$("#timer");
if(e){e.textContent=String(Math.floor(seconds/60)).padStart(2,"0")+":"+String(seconds%60).padStart(2,"0");e.classList.toggle("danger",seconds<300)}
if(seconds===0)finishExam(true)}
function choose(n){const s=S.page==="exam"?S.exam:S.practice;const q=qid(s.ids[s.idx]);if(s.checked&&s.checked[q.id])return;s.answers[q.id]=n;if(S.page==="exam")save();question(s,S.page)}
function check(){const s=S.practice;if(!s)return;const q=qid(s.ids[s.idx]);if(q.type==="short"){const value=$("#short").value.trim();if(!value){notify("답을 입력해 줘.");return}s.answers[q.id]=value}
if(s.answers[q.id]===undefined)return;s.checked[q.id]=true;if(!isCorrect(q,s.answers[q.id]))S.wrong.add(q.id);save();question(s,"practice")}
function next(){const s=S.page==="exam"?S.exam:S.practice;if(!s)return;if(S.page==="practice"&&!s.checked[s.ids[s.idx]])return;
if(s.idx===s.ids.length-1){if(S.page==="practice")finishPractice();else notify("마지막 문제야. 제출 버튼을 눌러 줘.");return}
s.idx++;if(S.page==="exam")save();question(s,S.page)}
function finishPractice(){const s=S.practice;s.finished=true;const c=s.ids.filter(id=>isCorrect(qid(id),s.answers[id])).length;S.history.unshift({mode:"practice",correct:c,total:s.ids.length,when:Date.now()});save();practice()}
function exam(){
if(S.exam){if(S.exam.finished){results(S.exam,"exam");return}if(S.exam.deadline<=Date.now()){finishExam(true);return}question(S.exam,"exam");return}
root.innerHTML=header("REAL EXAM","45분 모의고사","5개 영역에서 각각 객관식 3문제와 단답형 2문제를 출제해. 총 25문제 실전 연습이야.")+
'<div class="panel" style="max-width:740px;margin:auto"><div class="eyebrow">BEFORE YOU START</div><h2 style="font-size:29px">45:00 <span class="muted" style="font-size:15px">/ 25문제</span></h2><p>객관식 15문제와 단답형 10문제가 섞인 자체 모의고사야. 실제 수행평가의 문항 수와 세부 배점은 공개되지 않았으므로 완전히 동일하지는 않아.</p><div class="notice">5개 영역 × 5문제 · 총 20점 · 자동 저장 · 시간 종료 자동 제출 · 새로고침해도 타이머 유지</div><button data-act="start-exam" class="btn primary" style="width:100%">모의고사 시작 →</button></div>';
}
function startExam(){let list=[];for(let i=0;i<5;i++){list=list.concat(shuffle(Q.filter(q=>q.unit===i&&q.type==="mc")).slice(0,3).map(x=>x.id));list=list.concat(shuffle(Q.filter(q=>q.unit===i&&q.type==="short")).slice(0,2).map(x=>x.id))}S.exam={ids:shuffle(list),idx:0,answers:{},deadline:Date.now()+2700000,finished:false};save();nav("exam")}
function finishExam(auto){const s=S.exam;if(!s||s.finished)return;s.finished=true;s.auto=auto;const correct=s.ids.filter(id=>isCorrect(qid(id),s.answers[id])).length;s.ids.forEach(id=>{if(!isCorrect(qid(id),s.answers[id]))S.wrong.add(id)});S.history.unshift({mode:"exam",correct,total:s.ids.length,when:Date.now()});save();nav("exam")}
function results(s,mode){
const correct=s.ids.filter(id=>isCorrect(qid(id),s.answers[id])).length,total=s.ids.length;
const score=mode==="exam"?(correct*20/total).toFixed(1):Math.round(correct/total*100);
root.innerHTML=header("RESULT","결과 및 해설",s.auto?"45분이 지나 자동 제출했어.":"각 문제의 해설을 확인하고 부족한 부분을 복습해.")+
'<div class="panel" style="max-width:830px;margin:auto"><span class="eyebrow">'+(mode==="exam"?"EXAM SCORE":"PRACTICE SCORE")+'</span><div class="resultBig">'+score+'<span> '+(mode==="exam"?"/ 20점":"% 정답률")+'</span></div><p class="muted">정답 '+correct+'개 · 오답/미응답 '+(total-correct)+'개 · 총 '+total+'문제</p><div class="progress-track"><span style="width:'+(correct/total*100)+'%"></span></div><button data-act="reset-'+mode+'" class="btn primary">다시 도전하기</button> <button data-act="wrong" class="btn light">오답 노트</button></div>'+
'<div class="section-row"><h2>문제별 해설</h2></div>'+s.ids.map((id,i)=>{const q=qid(id),a=s.answers[id],ok=isCorrect(q,a);return '<div class="review"><span class="badge '+(ok?"":"wrong")+'">'+(ok?"정답":"오답")+'</span> <span class="tiny muted">'+(i+1)+'번 · '+uname(q.unit)+' · '+q.pages+'쪽</span><h3>'+esc(q.q)+'</h3><p class="tiny">내 답: '+(a===undefined?"미응답":q.type==="mc"?esc(q.choices[a]):esc(a))+'</p><p class="tiny"><b>정답:</b> '+(q.type==="mc"?esc(q.choices[q.correct]):esc(q.accept[0]))+'</p><div class="muted tiny">'+esc(q.why)+'</div></div>'}).join("");
}
function wrong(){const items=[...S.wrong].map(qid).filter(Boolean);
root.innerHTML=header("REVIEW","오답 노트","틀렸던 문제만 모았어. 다시 풀거나 충분히 이해했다면 제거할 수 있어.")+
'<div class="section-row"><h2>오답 '+items.length+'개</h2>'+(items.length?'<button data-act="retry" class="btn primary">오답 다시 풀기 →</button>':"")+'</div>'+
(items.length?items.map(q=>'<div class="review"><span class="badge wrong">'+uname(q.unit)+' · '+q.pages+'쪽</span><h3>'+esc(q.q)+'</h3><p class="tiny"><b>정답:</b> '+(q.type==="mc"?esc(q.choices[q.correct]):esc(q.accept[0]))+'</p><p class="tiny muted">'+esc(q.why)+'</p><button data-remove="'+q.id+'" class="checkbtn">✓ 이해했어 · 오답 제거</button></div>').join(""):'<div class="emptystate"><h3>아직 오답이 없어!</h3><p>틀린 문제는 여기 자동 저장돼.</p><button data-act="practice" class="btn primary">문제 풀이 시작 →</button></div>');
}
document.addEventListener("click",ev=>{const n=ev.target.closest("[data-nav]");if(n){ev.preventDefault();nav(n.dataset.nav);return}if(ev.target.closest("#menuBtn"))$(".sidebar").classList.toggle("open")});
root.addEventListener("input",e=>{if(e.target.id==="lessonSearch"){S.search=e.target.value;const len=S.search.length;learn();const inp=$("#lessonSearch");inp.focus();inp.setSelectionRange(len,len)}
if(e.target.id==="short"){const s=S.page==="exam"?S.exam:S.practice,q=qid(s.ids[s.idx]);if(S.page==="exam"){s.answers[q.id]=e.target.value;save()}else{const btn=root.querySelector('[data-act="check"]');if(btn)btn.disabled=!e.target.value.trim()}}});
root.addEventListener("keydown",e=>{if(e.target.id==="short"&&e.key==="Enter"){e.preventDefault();if(S.page==="practice")check();else next()}});
root.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;
if(b.dataset.filter!==undefined){S.filter=b.dataset.filter;learn();return}
if(b.dataset.unit!==undefined){S.filter=b.dataset.unit;S.search="";nav("learn");return}
if(b.dataset.done!==undefined){const id=Number(b.dataset.done),open=b.closest("details")?.open;S.done.has(id)?S.done.delete(id):S.done.add(id);save();learn();const d=$("#lesson-"+id);if(d&&open)d.open=true;return}
if(b.dataset.pick!==undefined){choose(Number(b.dataset.pick));return}
if(b.dataset.jump!==undefined){S.exam.idx=Number(b.dataset.jump);save();question(S.exam,"exam");return}
if(b.dataset.remove!==undefined){S.wrong.delete(Number(b.dataset.remove));save();wrong();return}
const a=b.dataset.act;
if(["learn","practice","exam","wrong","home"].includes(a)){if(a==="learn"){S.filter="all";S.search=""}nav(a)}
else if(a==="reset-search"){S.search="";learn()}
else if(a==="start-practice")startPractice(false)
else if(a==="retry")startPractice(true)
else if(a==="check")check()
else if(a==="previous"){const s=S.page==="exam"?S.exam:S.practice;if(s&&s.idx>0){s.idx--;if(S.page==="exam")save();question(s,S.page)}}
else if(a==="next")next()
else if(a==="reset-practice"){S.practice=null;practice()}
else if(a==="start-exam")startExam()
else if(a==="finish-exam"){const s=S.exam,empty=s.ids.filter(id=>s.answers[id]===undefined).length;if(empty&&!window.confirm("미응답 "+empty+"개가 있어. 그래도 제출할까?"))return;finishExam(false)}
else if(a==="reset-exam"){S.exam=null;save();exam()}
});
if(S.exam&&!S.exam.finished&&S.exam.deadline<=Date.now())finishExam(true);else render();
})();
