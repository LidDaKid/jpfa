const sb = supabase.createClient(window.JPFA_URL, window.JPFA_KEY);
const LOGO_IMG=(c='')=>`<img class="logo ${c}" src="logo.png" alt="">`;
const ICONS={
  call:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z"/></svg>',
  eye:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5C7 5 2.7 8.1 1 12.5 2.7 16.9 7 20 12 20s9.3-3.1 11-7.5C21.3 8.1 17 5 12 5zm0 12.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>',
  web:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2c.8 1.2 1.5 2.5 1.9 4h-3.8c.4-1.5 1.1-2.8 1.9-4zM4.3 14a8 8 0 0 1 0-4h3.4a16 16 0 0 0 0 4zm7.7 6c-.8-1.2-1.5-2.5-1.9-4h3.8c-.4 1.5-1.1 2.8-1.9 4zm2.3-6H9.7a14 14 0 0 1 0-4h4.6a14 14 0 0 1 0 4zm2 0a16 16 0 0 0 0-4h3.4a8 8 0 0 1 0 4z"/></svg>',
  dream:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.3 2a10 10 0 1 0 9.7 12.4A8 8 0 0 1 12.3 2z"/></svg>',
  other:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 18h2v-2h-2v2zm1-16a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-14a4 4 0 0 0-4 4h2a2 2 0 1 1 4 0c0 2-3 1.8-3 5h2c0-2.3 3-2.5 3-5a4 4 0 0 0-4-4z"/></svg>'
};
const TYPES={call:'Incoming call',eye:'In person',web:'Online',dream:'Dream',other:'Other'};
const KINDS={login:'Login',logout:'Logout',view:'Page view',apply:'Application',review:'Review',sighting:'Sighting',exam:'Exam',duty:'Duty',rank:'Rank',profile:'Profile',badge:'Badge'};
const PAGES={home:'Home',missing:'Missing',sightings:'Sightings',agents:'Agents',casefile:'Case File',exam:'Field Exam',badge:'My Badge'};

/* ---------- ranks ---------- */
const RANKS=[
  {n:'Recruit',xp:0},{n:'Field Agent',xp:50},{n:'Special Agent',xp:150},{n:'Senior Special Agent',xp:300},
  {n:'Supervisory Agent',xp:500},{n:'Deputy Director',xp:800},{n:'Director',xp:Infinity}
];
const CLR=['Public','Restricted','Confidential','Secret','Top Secret','Top Secret // Pork','Omega'];
function xpRank(xp){let r=0;for(let i=0;i<RANKS.length;i++)if(xp>=RANKS[i].xp)r=i;return r}
function rankOf(u){return Math.max(xpRank(u.aura||0),u.appointed||0)}
function insignia(i){
  const bar='<svg viewBox="0 0 12 12"><path d="M1 3h10v2.5H1zM1 7h10v2.5H1z" fill="#c9a227"/></svg>';
  const chev='<svg viewBox="0 0 12 12"><path d="M1 8l5-4 5 4v2.5L6 6.5 1 10.5z" fill="#c9a227"/></svg>';
  const star='<svg viewBox="0 0 12 12"><path d="M6 .5l1.6 3.5 3.9.4-2.9 2.6.8 3.8L6 8.9 2.6 10.8l.8-3.8L.5 4.4l3.9-.4z" fill="#c9a227"/></svg>';
  const map=[[chev,1],[chev,2],[chev,3],[bar,1],[star,1],[star,2],[star,3]];
  const [g,c]=map[i]||map[0];return `<span class="ins" title="${RANKS[i].n}">${g.repeat(c)}</span>`;
}

/* ---------- data ---------- */
const S={agents:{},sightings:[],apps:{},activity:[],attempts:[],notes:'',uid:null,ready:false};
const me=()=>{const u=S.uid&&S.agents[S.uid];return u&&u.status==='approved'?u:null};
const isDir=()=>{const u=me();return !!u&&rankOf(u)===6};
const agents=()=>Object.values(S.agents).filter(u=>u.status==='approved');
const pendingApps=()=>Object.values(S.agents).filter(u=>u.status==='pending');
async function rpc(fn,args){const {data,error}=await sb.rpc(fn,args||{});if(error){toast(error.message);throw error}return data}
async function refresh(){
  const [ag,si]=await Promise.all([sb.from('jpfa_agents').select('*'),sb.from('jpfa_sightings').select('*').order('t',{ascending:false}).limit(500)]);
  S.agents={};(ag.data||[]).forEach(a=>S.agents[a.id]=a);S.sightings=si.data||[];
  const u=me(),r=u?rankOf(u):-1;
  const jobs=[];
  if(r===6){
    jobs.push(sb.from('jpfa_applications').select('*').then(x=>{S.apps={};(x.data||[]).forEach(a=>S.apps[a.agent_id]=a)}));
    jobs.push(sb.from('jpfa_activity').select('*').order('t',{ascending:false}).limit(2000).then(x=>S.activity=x.data||[]));
  }
  if(u)jobs.push(sb.from('jpfa_exam_attempts').select('*').order('t',{ascending:false}).then(x=>S.attempts=x.data||[]));
  if(r>=5)jobs.push(sb.from('jpfa_config').select('value').eq('key','notes').maybeSingle().then(x=>S.notes=x.data?.value||''));
  await Promise.all(jobs);S.ready=true;
}
let lastView='';
function logView(route){const u=me();if(!u||!PAGES[route]||lastView===route)return;lastView=route;sb.rpc('jpfa_log_event',{p_kind:'view',p_text:'Opened '+PAGES[route]}).then(()=>{})}

function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
const ms=t=>typeof t==='number'?t:new Date(t).getTime();
function fmtDate(t){return t?new Date(t).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'—'}
function fmtDT(t){return t?new Date(t).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'—'}
function fmtFull(t){return t?new Date(t).toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',second:'2-digit'}):'—'}
function ago(t){if(!t)return 'never';const s=(Date.now()-ms(t))/1000;if(s<60)return 'just now';if(s<3600)return Math.floor(s/60)+'m ago';if(s<86400)return Math.floor(s/3600)+'h ago';return Math.floor(s/86400)+'d ago'}
function avatar(u){return u.photo?`<img src="${esc(u.photo)}" alt="">`:`<span class="ph">${esc((u.callsign||'?')[0].toUpperCase())}</span>`}
function who(id){const a=S.agents[id];if(!a)return 'Unknown';return isDir()?`<a href="#agent/${a.id}">${esc(a.callsign)}</a>`:esc(a.callsign)}
let tt;function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),2800)}
async function act(fn,args,msg){const u=me(),before=u?rankOf(u):-1;const res=await rpc(fn,args);await refresh();
  const u2=me();if(msg)toast(msg);if(u2&&rankOf(u2)>before&&before>=0)setTimeout(()=>toast('PROMOTED: '+RANKS[rankOf(u2)].n),1200);render();return res}

/* ---------- chrome ---------- */
const MISSING_SINCE=new Date('2023-09-15T03:00:00');
function daysMissing(){return Math.floor((Date.now()-MISSING_SINCE)/864e5)}
function threat(){const recent=S.sightings.filter(s=>Date.now()-ms(s.t)<7*864e5&&s.status!=='debunked').length;
  const conf=S.sightings.some(s=>s.status==='confirmed'&&Date.now()-ms(s.t)<3*864e5);
  return Math.min(5,2+Math.floor(recent/3)+(conf?1:0))}
const TL=['Low','Guarded','Elevated','High','Severe'];
function chrome(){
  const u=me(),route=location.hash.slice(1).split('/')[0]||'home';
  document.getElementById('stripClr').textContent=u?CLR[rankOf(u)]:'Public';
  document.getElementById('acct').innerHTML=u
    ?`<a class="chip" href="#badge">${avatar(u)}<span><span class="nm">${esc(u.callsign)}</span><span class="rk">${RANKS[rankOf(u)].n}</span></span></a><button class="btn ghost sm" style="color:#fff" onclick="logout()">Log out</button>`
    :`<a class="btn gold" href="#login">Agent Login</a>`;
  const links=[['home','Home'],['missing','Missing'],['sightings','Sightings'],['agents','Agents'],['casefile','Case File']];
  if(u)links.push(['exam','Field Exam'],['badge','My Badge']);
  if(isDir()){const n=pendingApps().length;links.push(['apps','Applications'+(n?`<span class="cnt">${n}</span>`:'')],['activity','Activity'])}
  if(!u)links.push(['enlist','Enlist']);
  document.getElementById('nav').innerHTML=links.map(([h,l])=>`<a href="#${h}" class="${route===h||(route==='agent'&&h==='agents')?'on':''}">${l}</a>`).join('');
}
setInterval(()=>{document.getElementById('clock').textContent=new Date().toLocaleString(undefined,{weekday:'short',hour:'2-digit',minute:'2-digit',second:'2-digit'})},1000);

/* ---------- views ---------- */
const V={};
function sightingRow(s,ctl){
  const u=me();const r=u?rankOf(u):-1;
  const canJudge=ctl&&r>=5&&s.status==='pending';
  return `<div class="sight"><div class="ic">${ICONS[s.kind]||ICONS.other}</div><div style="min-width:0;flex:1">
  <div class="t">${esc(s.place)}<span class="stamp ${s.status}">${s.status}</span></div>
  <div class="meta">${TYPES[s.kind]||'Other'} &middot; ${fmtDT(s.t)} &middot; Agent ${who(s.by)} &middot; Confidence ${s.conf}/5</div>
  ${s.descr?`<div class="d">${esc(s.descr)}</div>`:''}
  ${canJudge?`<div style="margin-top:8px;display:flex;gap:6px"><button class="btn sm green" onclick="judge(${s.id},'confirmed')">Confirm</button><button class="btn sm danger" onclick="judge(${s.id},'debunked')">Debunk</button></div>`:''}
  </div></div>`}

V.home=()=>{
  const u=me(),t=threat(),conf=S.sightings.filter(s=>s.status==='confirmed').length;
  const recent=S.sightings.slice(0,5);
  return `<section class="hero">
    <div style="position:relative;z-index:1"><div class="kick">Active Operation</div><h2>Operation:<br>Find <span>John Pork</span></h2>
    <div class="acts">${u?`<a class="btn gold" href="#sightings">Report a Sighting</a><a class="btn ghost" href="#badge">My Badge</a>`:`<a class="btn gold" href="#enlist">Enlist Now</a><a class="btn ghost" href="#missing">Missing Poster</a>`}</div></div>
    <div class="threat"><div class="lbl">National Pork Threat Level</div><div class="lv">${TL[t-1].toUpperCase()}</div>
    <div class="tbar">${[1,2,3,4,5].map(i=>`<i class="${i<=t?'on':''}"></i>`).join('')}</div><div class="tlabels">${TL.map(x=>`<span>${x}</span>`).join('')}</div></div>
  </section>
  <div class="grid g4 mt">
    <div class="stat"><div class="n">${daysMissing().toLocaleString()}</div><div class="l">Days missing</div></div>
    <div class="stat"><div class="n">${agents().length}</div><div class="l">Agents enlisted</div></div>
    <div class="stat"><div class="n">${S.sightings.length}</div><div class="l">Sightings filed</div></div>
    <div class="stat"><div class="n">${conf}</div><div class="l">Confirmed</div></div>
  </div>
  <div class="grid g2 mt">
    <div class="card"><div class="hd">Latest Field Reports<a href="#sightings" style="color:var(--gold2);font-size:11px">All</a></div><div class="bd">${recent.length?recent.map(s=>sightingRow(s)).join(''):'<div class="empty">No reports filed.</div>'}</div></div>
    <div class="card"><div class="hd">Missing<span class="tag">JP-001</span></div><div class="bd" style="text-align:center">
      <img src="img/calling.jpg" alt="John Pork" style="width:100%;max-width:240px;border:3px solid var(--navy);display:block;margin:0 auto">
      <div style="font-family:Merriweather;font-weight:900;font-size:20px;margin-top:10px;color:var(--navy)">JOHN RICHARD PORK</div>
      <div class="pill" style="display:inline-block;background:#fde7ea;color:var(--red);margin:6px 0 12px">Missing</div><br>
      <a class="btn sm" href="#missing">Full Profile</a></div></div>
  </div>`};

V.missing=()=>`<h2 class="pg">Missing Person</h2><div class="pgsub"><span>Subject File JP-001</span><span>Priority: Maximum</span></div>
  <div class="grid g2" style="grid-template-columns:1fr 1fr">
  <div><img class="poster" src="img/missing.png" alt="John Pork missing poster"></div>
  <div class="card"><div class="hd">Subject Profile</div><div class="bd"><table class="facts">
  <tr><td>Name</td><td>John Richard Pork</td></tr>
  <tr><td>Date of birth</td><td>01/02/1995</td></tr>
  <tr><td>Age</td><td>31</td></tr>
  <tr><td>Sex</td><td>Male</td></tr>
  <tr><td>Race</td><td>Pig</td></tr>
  <tr><td>Eyes</td><td>Grey/green</td></tr>
  <tr><td>Hair</td><td>N/A</td></tr>
  <tr><td>Height</td><td>6'6</td></tr>
  <tr><td>Weight</td><td>245 lb</td></tr>
  <tr><td>Last seen wearing</td><td>Red plaid button up, gray shirt, blue jeans</td></tr>
  <tr><td>Last contact</td><td>Incoming call, 3:00 AM</td></tr>
  <tr><td>Status</td><td><b style="color:var(--red)">MISSING</b></td></tr>
  <tr><td>Hotline</td><td class="mono">1-800 JOHN-PORK-FEDERAL-AGENCY</td></tr>
  </table>
  <div class="reward"><small>Reward</small><b>1,000,000 AURA</b></div>
  <div style="margin-top:16px">${me()?'<a class="btn gold" href="#sightings">Report a Sighting</a>':'<a class="btn gold" href="#enlist">Enlist to Report</a>'}</div>
  </div></div></div>
  <div class="card mt"><div class="hd">Evidence Photos</div><div class="bd"><div class="evid">
    <figure><img src="img/calling.jpg" alt=""><figcaption>EX-01 // Incoming call</figcaption></figure>
    <figure><img src="img/club.jpg" alt=""><figcaption>EX-02 // Nightclub</figcaption></figure>
    <figure><img src="img/wrapping.jpg" alt=""><figcaption>EX-03 // Gift wrap</figcaption></figure>
  </div></div></div>`;

let sFilter='all';
V.sightings=()=>{
  const u=me();let list=S.sightings;
  if(sFilter!=='all')list=list.filter(s=>s.status===sFilter);
  const now=new Date(Date.now()-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,16);
  return `<h2 class="pg">Sightings</h2><div class="pgsub"><span>Field Report Database</span><span>${S.sightings.length} on file</span></div>
  <div class="grid g2" style="grid-template-columns:1fr 1.3fr">
  <div class="card"><div class="hd">File a Report<span class="tag">+25 Aura</span></div><div class="bd">
  ${u?`<form class="f" onsubmit="fileSighting(event)">
    <label>Location<input name="where" required maxlength="80" placeholder="e.g. Walmart parking lot"></label>
    <div class="row2"><label>Type<select name="type">${Object.entries(TYPES).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label>
    <label>Date &amp; time<input type="datetime-local" name="t" value="${now}" required></label></div>
    <label>Confidence<select name="conf">${[5,4,3,2,1].map(n=>`<option>${n}</option>`).join('')}</select></label>
    <label>Details<textarea name="desc" maxlength="600"></textarea></label>
    <button class="btn gold">Submit Report</button></form>`
  :`<a class="btn gold" href="#login">Agent Login</a>`}
  </div></div>
  <div class="card"><div class="hd">Reports<span style="display:flex;gap:4px;flex-wrap:wrap">${['all','pending','confirmed','debunked'].map(f=>`<button class="btn sm ${sFilter===f?'gold':'ghost'}" style="${sFilter===f?'':'color:#fff'}" onclick="sFilter='${f}';render()">${f}</button>`).join('')}</span></div>
  <div class="bd">${list.length?list.map(s=>sightingRow(s,true)).join(''):'<div class="empty">No reports.</div>'}</div></div></div>`};

V.agents=()=>{
  const u=me(),dir=isDir();
  const list=agents().sort((a,b)=>rankOf(b)-rankOf(a)||(b.aura||0)-(a.aura||0));
  return `<h2 class="pg">Agent Roster</h2><div class="pgsub"><span>Personnel Directory</span><span>${list.length} active</span></div>
  <div class="card"><div class="scroll"><table class="ros"><thead><tr><th>Agent</th><th>Badge</th><th>Rank</th><th>Aura</th><th>Reports</th><th>Enlisted</th>${dir?'<th>Last active</th><th>Appoint</th>':''}</tr></thead><tbody>
  ${list.length?list.map(a=>{const ar=rankOf(a);const n=S.sightings.filter(s=>s.by===a.id).length;
    return `<tr class="${u&&a.id===u.id?'me':''}"><td><div class="who">${avatar(a)}<b>${who(a.id)}</b></div></td>
    <td class="mono">${a.badge}</td><td style="white-space:nowrap">${insignia(ar)} ${RANKS[ar].n}</td><td class="mono">${a.aura||0}</td><td>${n}</td><td>${fmtDate(a.joined)}</td>
    ${dir?`<td style="white-space:nowrap">${ago(a.last_seen)}</td><td>${a.id===u.id?'':`<select onchange="appoint('${a.id}',this.value)" style="padding:4px;border:1px solid var(--line);border-radius:3px">${RANKS.map((k,i)=>`<option value="${i}" ${(a.appointed||0)===i?'selected':''}>${i===0?'None':k.n}</option>`).join('')}</select>`}</td>`:''}</tr>`}).join('')
  :`<tr><td colspan="8" class="empty" style="padding:16px">No agents enlisted.</td></tr>`}
  </tbody></table></div></div>
  <div class="card mt"><div class="hd">Chain of Command</div><div class="bd"><div class="ranks">${RANKS.map((k,i)=>`<div>${insignia(i)} ${k.n}<span class="xp mono">${k.xp===Infinity?'Appointed':k.xp+' Aura'}</span></div>`).join('')}</div></div></div>`};

function R(lvl,text){const u=me();const ok=u&&rankOf(u)>=lvl;return ok?`<b>${esc(text)}</b>`:`<span class="red" title="Requires ${RANKS[lvl].n}">${esc(text)}</span>`}
V.casefile=()=>{
  const u=me(),r=u?rankOf(u):-1;
  return `<h2 class="pg">Case File</h2><div class="pgsub"><span>JP-001 // The Pork Matter</span><span>Your clearance: ${u?CLR[r]:'Public'}</span></div>
  <div class="dossier"><div class="topsecret">TOP SECRET</div>
  <h3>Summary</h3>
  <p>Subject JOHN RICHARD PORK was last heard from via incoming video call at 3:00 AM. Call was ${R(1,'declined by the recipient')}. Subject has not been seen since.</p>
  <p>Subject is believed to be ${R(2,'alive and hiding out in a farmhouse two towns over')}.</p>
  <h3>Hostile Groups</h3>
  <p>&bull; Groups spreading rumors that the subject is deceased</p>
  <p>&bull; ${R(2,'Agents who declined his call')}</p>
  <p>&bull; ${R(4,'The bacon industry')}</p>
  <h3>Known Associates</h3>
  <p>&bull; ${R(1,'Tim Cheese')} &mdash; ${R(3,'last seen near a cheese factory')}</p>
  <p>&bull; ${R(2,'Unknown caller with no caller ID')}</p>
  <h3>Evidence Log</h3>
  <p>EX-01: Incoming call screenshot, 3:00 AM.</p>
  <p>EX-02: ${R(2,'Nightclub photo, flat cap, location unknown')}</p>
  <p>EX-03: ${R(3,'Gift wrap featuring the subject\'s face, origin unknown')}</p>
  <p>EX-04: ${R(5,'Voicemail: "pick up bro"')}</p>
  <h3>Director's Notes</h3>
  ${r>=5?`<p>${esc(S.notes||'—')}</p>${r===6?'<button class="btn sm" onclick="editNotes()" style="font-family:Public Sans">Edit</button>':''}`:`<div class="lockbox">Restricted to Deputy Director and above.</div>`}
  </div>`};

const QUIZ=[
  ['What should an agent do when John Pork calls?',['Decline','Let it ring','Answer instantly','Block the number'],2],
  ['What is John Pork\'s full name?',['John Robert Pork','John Richard Pork','Jonathan Pork','John P. Hamm'],1],
  ['What was he last seen wearing?',['Black suit, red tie','Hoodie and sweats','Red plaid button up, gray shirt, blue jeans','Overalls'],2],
  ['How tall is John Pork?',['5\'2','6\'0','6\'6','7\'1'],2],
  ['What is the reward for finding him?',['1,000,000 Robux','1,000,000 Aura','A ham','Nothing'],1]
];
V.exam=()=>{
  const u=me();if(!u)return need();
  if(u.exam_score!=null)return `<h2 class="pg">Field Exam</h2><div class="pgsub"><span>Certification</span><span>Passed</span></div><div class="card"><div class="bd"><b>Certified.</b> Score: ${u.exam_score}/5</div></div>`;
  return `<h2 class="pg">Field Exam</h2><div class="pgsub"><span>Certification</span><span>+100 Aura on pass (4/5)</span></div>
  <div class="card"><div class="bd"><form onsubmit="gradeExam(event)">${QUIZ.map((q,i)=>`<div class="q"><div class="qt">${i+1}. ${esc(q[0])}</div>${q[1].map((o,j)=>`<label><input type="radio" name="q${i}" value="${j}" required> ${esc(o)}</label>`).join('')}</div>`).join('')}
  <button class="btn gold mt">Submit Exam</button><span class="err" id="exErr" style="margin-left:12px"></span></form></div></div>`};

function barcode(seed){let s=0;for(const c of seed)s=(s*31+c.charCodeAt(0))>>>0;let out='';for(let i=0;i<34;i++){s=(s*1103515245+12345)>>>0;out+=`<i style="width:${1+(s>>>16)%3}px"></i>`}return `<div class="barcode">${out}</div>`}
V.badge=()=>{
  const u=me();if(!u)return need();
  const r=rankOf(u),nx=RANKS[r+1];const xp=u.aura||0;
  const pct=nx&&nx.xp!==Infinity?Math.round((xp-RANKS[r].xp)/(nx.xp-RANKS[r].xp)*100):100;
  const checked=u.last_duty===new Date().toISOString().slice(0,10);
  return `<h2 class="pg">My Badge</h2><div class="pgsub"><span>Agent Credentials</span><span class="mono">${u.badge}</span></div>
  <div class="grid g2" style="grid-template-columns:auto 1fr;align-items:start">
  <div><div class="badgecard">${LOGO_IMG('wm')}
    <div class="bt">${LOGO_IMG()}<b>John Pork<br>Federal Agency</b><span>AGENT ID</span></div>
    <div class="bm"><div class="pic">${avatar(u)}</div><div class="inf">
      <div><div class="k">Call Sign</div><div class="v big">${esc(u.callsign)}</div></div>
      <div><div class="k">Rank</div><div class="v rk">${insignia(r)} ${RANKS[r].n}</div></div>
      <div><div class="k">Badge No.</div><div class="v mono">${u.badge}</div></div>
      <div><div class="k">Issued</div><div class="v">${fmtDate(u.joined)}</div></div>
    </div></div>
    <div class="bb">${barcode(u.badge)}<span class="clear">${CLR[r].toUpperCase()}</span></div>
  </div>
  <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
    <label class="btn sm">Change Photo<input type="file" accept="image/*" hidden onchange="setPhoto(this)"></label>
    <button class="btn sm ghost" onclick="rename()">Change Call Sign</button>
    <button class="btn sm ghost" onclick="dlBadge()">Download Badge</button>
  </div></div>
  <div class="grid">
    <div class="card"><div class="hd">Service Record</div><div class="bd">
      <div class="flexb"><b>${RANKS[r].n}</b><span class="mono">${xp} Aura</span></div>
      <div class="prog" style="margin:8px 0 6px"><i style="width:${Math.max(0,Math.min(100,pct))}%"></i></div>
      <div style="font-size:13px;color:var(--muted)">${nx?(nx.xp===Infinity?'Next: Director (appointed)':`Next: ${nx.n} at ${nx.xp} Aura`):'Highest rank'}</div>
      <div class="flexb mt"><span>Daily duty report <span class="pill">+10 Aura</span></span><button class="btn sm ${checked?'':'gold'}" ${checked?'disabled':''} onclick="duty()">${checked?'Reported':'Report for Duty'}</button></div>
    </div></div>
    <div class="card"><div class="hd">Ranks</div><div class="bd"><div class="ranks">${RANKS.map((k,i)=>`<div class="${i===r?'cur':i>r?'lock':''}">${insignia(i)} ${k.n}<span class="xp mono">${k.xp===Infinity?'Appointed':k.xp+' Aura'}</span></div>`).join('')}</div></div></div>
  </div></div>`};

/* ---------- auth / enlistment ---------- */
V.login=()=>{
  if(me()){location.hash='#badge';return ''}
  return `<div class="auth card"><div class="tabs"><button class="on">Log In</button><button onclick="location.hash='#enlist'">Enlist</button></div>
  <div class="bd"><div class="seal">${LOGO_IMG()}</div>
  <form class="f" onsubmit="doLogin(event)">
    <label>Call Sign<input name="u" required maxlength="20" autocomplete="username"></label>
    <label>Password<input name="p" type="password" required autocomplete="current-password"></label>
    <div class="err" id="aErr"></div>
    <button class="btn gold">Log In</button>
  </form></div></div>`};

const OATHS=[
  'I confirm that I am John Richard Pork’s side and I will defend him against all hostile groups.',
  'I will answer any incoming call from John Pork instantly, regardless of hour or situation.',
  'I have never created, shared, or supported rumors claiming John Pork is deceased or compromised.'
];
const FIELDS=[['full_name','Full Legal Name',60],['callsign','Operative Call Sign',20],['contact','Primary Contact Method',60],['sector','Current Operating Sector (City, State)',60]];
function paperHead(){return `<div class="phd">${LOGO_IMG()}<div class="ttl"><span class="o">Official</span><span class="s">JPFA form</span></div></div>`}

let submitted=null;
V.enlist=()=>{
  if(me()){location.hash='#badge';return ''}
  if(submitted)return `<div class="auth card"><div class="bd" style="text-align:center"><div class="seal">${LOGO_IMG()}</div>
    <span class="stamp pending" style="font-size:14px">Pending review</span>
    <p><b>${esc(submitted)}</b></p><a class="btn" href="#login">Agent Login</a></div></div>`;
  return `<form class="paper" onsubmit="doEnlist(event)" autocomplete="off">
  ${paperHead()}
  <div class="sec">${FIELDS.map(([k,l,m])=>`<div class="fl"><span>${l}:</span><input name="${k}" required maxlength="${m}"></div>`).join('')}</div>
  ${OATHS.map((o,i)=>`<div class="oath"><p>${o}</p><div class="cd">
    <label>CONFIRM<input type="radio" name="o${i}" value="confirm" required></label>
    <label>DENY<input type="radio" name="o${i}" value="deny"></label></div></div>`).join('')}
  <div class="sig"><div class="flexb"><span class="lb">APPLICANT SIGNATURE</span><button type="button" class="btn sm ghost" onclick="clearSig()">Clear</button></div><canvas id="sig"></canvas></div>
  <div class="acc f"><div class="row2"><label>Password<input name="p" type="password" required minlength="6" autocomplete="new-password"></label>
    <label>Confirm Password<input name="p2" type="password" required minlength="6" autocomplete="new-password"></label></div></div>
  <div class="foot"><button class="btn gold" id="enlistBtn">Submit Application</button><span class="err" id="aErr"></span></div>
  </form>`};

function paperView(a){
  const app=S.apps[a.id]||{};
  return `<div class="paper">${paperHead()}
  <div class="sec">${FIELDS.map(([k,l])=>`<div class="fl"><span>${l}:</span><div class="val">${esc(k==='callsign'?a.callsign:app[k])}</div></div>`).join('')}</div>
  ${OATHS.map((o,i)=>{const v=app['o'+i];return `<div class="oath"><p>${o}</p><div class="cd">
    <div style="display:grid;justify-items:center;gap:6px">CONFIRM<span class="dot ${v==='confirm'?'on':''}"></span></div>
    <div style="display:grid;justify-items:center;gap:6px">DENY<span class="dot ${v==='deny'?'on bad':''}"></span></div></div></div>`}).join('')}
  <div class="sig"><span class="lb">APPLICANT SIGNATURE</span>${app.sig?`<img class="sigimg" src="${esc(app.sig)}" alt="">`:'<div style="height:60px"></div>'}</div>
  <div class="foot"><span class="stamp ${a.status}">${a.status}</span><span style="color:var(--muted);font-size:13px">Submitted ${fmtFull(a.applied)}</span>
  ${a.status==='pending'?`<span style="margin-left:auto;display:flex;gap:8px"><button class="btn green" onclick="decide('${a.id}','approved')">Approve</button><button class="btn danger" onclick="decide('${a.id}','denied')">Deny</button></span>`:''}
  ${a.status==='denied'?`<span style="margin-left:auto;display:flex;gap:8px"><button class="btn sm green" onclick="decide('${a.id}','approved')">Approve anyway</button></span>`:''}
  </div></div>`}

let appFilter='pending';
V.apps=()=>{
  if(!isDir())return need();
  const all=Object.values(S.agents).sort((a,b)=>ms(b.applied)-ms(a.applied));
  const list=all.filter(a=>appFilter==='all'||a.status===appFilter);
  const cnt=s=>all.filter(a=>s==='all'||a.status===s).length;
  return `<h2 class="pg">Applications</h2><div class="pgsub"><span>Enlistment Review</span><span>${cnt('pending')} pending</span></div>
  <div class="card"><div class="hd">Applicants<span style="display:flex;gap:4px;flex-wrap:wrap">${['pending','approved','denied','all'].map(f=>`<button class="btn sm ${appFilter===f?'gold':'ghost'}" style="${appFilter===f?'':'color:#fff'}" onclick="appFilter='${f}';render()">${f} (${cnt(f)})</button>`).join('')}</span></div>
  <div class="bd">${list.length?list.map(a=>{const app=S.apps[a.id]||{};const denies=[0,1,2].filter(i=>app['o'+i]==='deny').length;
    return `<div class="approw">${avatar(a)}<div><div class="nm">${esc(a.callsign)} <span class="stamp ${a.status}">${a.status}</span></div>
    <div class="meta">${esc(app.full_name)} &middot; ${esc(app.sector)} &middot; ${fmtFull(a.applied)}</div>
    ${denies?`<div class="flag">Answered DENY on ${denies} oath${denies>1?'s':''}</div>`:''}</div>
    <div class="acts"><a class="btn sm ghost" href="#agent/${a.id}">Open File</a>${a.status==='pending'?`<button class="btn sm green" onclick="decide('${a.id}','approved')">Approve</button><button class="btn sm danger" onclick="decide('${a.id}','denied')">Deny</button>`:''}</div></div>`}).join('')
  :'<div class="empty">None.</div>'}</div></div>`};

function actRow(e,showWho){return `<tr><td class="mono" style="white-space:nowrap;font-size:12px">${fmtFull(e.t)}</td>${showWho?`<td><b>${who(e.agent_id)}</b></td>`:''}<td><span class="kind k-${e.kind}">${KINDS[e.kind]||e.kind}</span></td><td>${esc(e.text)}</td></tr>`}
let actAgent='',actKind='',actHideViews=false;
V.activity=()=>{
  if(!isDir())return need();
  let list=S.activity;
  if(actAgent)list=list.filter(e=>e.agent_id===actAgent);
  if(actKind)list=list.filter(e=>e.kind===actKind);
  if(actHideViews)list=list.filter(e=>e.kind!=='view');
  const people=Object.values(S.agents).sort((a,b)=>a.callsign.localeCompare(b.callsign));
  return `<h2 class="pg">Activity</h2><div class="pgsub"><span>Agency Surveillance Log</span><span>${list.length} entries</span></div>
  <div class="card"><div class="hd">Log<span style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
    <select onchange="actAgent=this.value;render()" class="hsel"><option value="">All agents</option>${people.map(a=>`<option value="${a.id}" ${actAgent===a.id?'selected':''}>${esc(a.callsign)}</option>`).join('')}</select>
    <select onchange="actKind=this.value;render()" class="hsel"><option value="">All actions</option>${Object.entries(KINDS).map(([k,v])=>`<option value="${k}" ${actKind===k?'selected':''}>${v}</option>`).join('')}</select>
    <label style="display:flex;gap:4px;align-items:center;font-size:11px"><input type="checkbox" ${actHideViews?'checked':''} onchange="actHideViews=this.checked;render()">Hide page views</label>
    <button class="btn sm ghost" style="color:#fff" onclick="reload()">Refresh</button></span></div>
  <div class="scroll"><table class="ros"><thead><tr><th>Time</th><th>Agent</th><th>Action</th><th>Details</th></tr></thead><tbody>
  ${list.length?list.slice(0,500).map(e=>actRow(e,true)).join(''):'<tr><td colspan="4" class="empty" style="padding:16px">Nothing yet.</td></tr>'}
  </tbody></table></div></div>`};

V.agent=(id)=>{
  if(!isDir())return need();
  const a=S.agents[id];if(!a)return '<div class="empty">Not found.</div>';
  const r=rankOf(a);
  const atts=S.attempts.filter(x=>x.agent_id===id);
  const sights=S.sightings.filter(s=>s.by===id);
  const acts=S.activity.filter(e=>e.agent_id===id);
  const logins=acts.filter(e=>e.kind==='login').length;
  return `<div style="margin-bottom:14px"><a href="#agents" class="btn sm ghost">Back</a></div>
  <div class="card"><div class="bd profhead">
    <div class="pp">${avatar(a)}</div>
    <div style="min-width:0;flex:1"><h2 class="pg" style="margin:0">${esc(a.callsign)} <span class="stamp ${a.status}">${a.status}</span></h2>
    <div style="color:var(--gold);font-weight:800">${insignia(r)} ${RANKS[r].n}</div>
    <div class="kv">
      <div><span>Badge</span><b class="mono">${a.badge}</b></div>
      <div><span>Aura</span><b class="mono">${a.aura||0}</b></div>
      <div><span>Applied</span><b>${fmtFull(a.applied)}</b></div>
      <div><span>Enlisted</span><b>${fmtFull(a.joined)}</b></div>
      <div><span>Last active</span><b>${a.last_seen?fmtFull(a.last_seen)+' ('+ago(a.last_seen)+')':'never'}</b></div>
      <div><span>Last duty report</span><b>${(d=>d?fmtFull(d.t):'never')(acts.find(e=>e.kind==='duty'))}</b></div>
      <div><span>Logins</span><b>${logins}</b></div>
      <div><span>Sightings</span><b>${sights.length}</b></div>
    </div></div></div></div>
  <div class="grid mt" style="grid-template-columns:1fr 1fr">
    <div>
      <div class="card"><div class="hd">Field Exam<span class="tag">${a.exam_score!=null?'Passed '+a.exam_score+'/5':atts.length?'Not passed':'Not taken'}</span></div><div class="bd">
      ${atts.length?atts.map((t,n)=>`<div class="attempt"><div class="flexb"><b>Attempt ${atts.length-n}</b><span><span class="stamp ${t.passed?'approved':'denied'}">${t.score}/5</span> <span class="mono" style="font-size:12px;color:var(--muted)">${fmtFull(t.t)}</span></span></div>
        ${QUIZ.map((q,i)=>{const pick=t.answers[i],ok=pick===q[2];return `<div class="qa"><div class="qq">${i+1}. ${esc(q[0])}</div>
        <div class="${ok?'ok':'no'}">${ok?'&#10003;':'&#10007;'} ${esc(q[1][pick]??'—')}</div>${ok?'':`<div class="right">Correct: ${esc(q[1][q[2]])}</div>`}</div>`}).join('')}</div>`).join('')
      :'<div class="empty">No attempts.</div>'}</div></div>
      <div class="card mt"><div class="hd">Sightings Filed</div><div class="bd">${sights.length?sights.map(s=>sightingRow(s,true)).join(''):'<div class="empty">None.</div>'}</div></div>
    </div>
    <div>${S.apps[id]?paperView(a):'<div class="card"><div class="bd empty">No application on file.</div></div>'}</div>
  </div>
  <div class="card mt"><div class="hd">Activity<span>${acts.length}</span></div><div class="scroll"><table class="ros"><thead><tr><th>Time</th><th>Action</th><th>Details</th></tr></thead><tbody>
  ${acts.length?acts.slice(0,300).map(e=>actRow(e,false)).join(''):'<tr><td colspan="3" class="empty" style="padding:16px">Nothing yet.</td></tr>'}</tbody></table></div></div>`};

function need(){return `<div class="auth card"><div class="bd" style="text-align:center"><div class="seal">${LOGO_IMG()}</div><b>Agents only.</b><div class="mt"><a class="btn gold" href="#login">Agent Login</a></div></div></div>`}

/* signature pad */
let sigDirty=false;
function initSig(){const c=document.getElementById('sig');if(!c)return;sigDirty=false;
  const r=c.getBoundingClientRect(),d=devicePixelRatio||1;c.width=r.width*d;c.height=r.height*d;
  const x=c.getContext('2d');x.scale(d,d);x.lineWidth=2.4;x.lineCap='round';x.lineJoin='round';x.strokeStyle='#1d3a8a';
  let down=false,lx,ly;
  const pos=e=>{const b=c.getBoundingClientRect();return [e.clientX-b.left,e.clientY-b.top]};
  c.onpointerdown=e=>{down=true;[lx,ly]=pos(e);c.setPointerCapture(e.pointerId)};
  c.onpointermove=e=>{if(!down)return;const [nx,ny]=pos(e);x.beginPath();x.moveTo(lx,ly);x.lineTo(nx,ny);x.stroke();lx=nx;ly=ny;sigDirty=true};
  c.onpointerup=c.onpointercancel=()=>down=false;}
function clearSig(){const c=document.getElementById('sig');c.getContext('2d').clearRect(0,0,c.width,c.height);sigDirty=false}
function sigData(){const c=document.getElementById('sig');const o=document.createElement('canvas');const sc=Math.min(1,600/c.width);
  o.width=c.width*sc;o.height=c.height*sc;o.getContext('2d').drawImage(c,0,0,o.width,o.height);return o.toDataURL('image/png')}

/* ---------- actions ---------- */
async function doEnlist(e){e.preventDefault();const f=e.target,err=document.getElementById('aErr'),btn=document.getElementById('enlistBtn');
  const cs=f.callsign.value.trim();err.textContent='';
  if(!/^[\w .-]{2,20}$/.test(cs))return err.textContent='Call sign: letters, numbers, spaces, . _ - only';
  if(!sigDirty)return err.textContent='Signature required';
  if(f.p.value!==f.p2.value)return err.textContent='Passwords do not match';
  btn.disabled=true;
  try{
    if((await sb.rpc('jpfa_callsign_taken',{cs})).data)throw new Error('Call sign taken');
    const email=`agent-${crypto.randomUUID().replace(/-/g,'').slice(0,16)}@jpfa-agents.com`;
    const {data,error}=await sb.auth.signUp({email,password:f.p.value});
    if(error)throw error;if(!data.session)throw new Error('Signup failed');
    const {data:st,error:e2}=await sb.rpc('jpfa_submit_application',{cs,p_name:f.full_name.value.trim(),p_contact:f.contact.value.trim(),p_sector:f.sector.value.trim(),p0:f.o0.value,p1:f.o1.value,p2:f.o2.value,p_sig:sigData()});
    if(e2)throw e2;
    if(st==='approved'){S.uid=data.session.user.id;await refresh();toast('Welcome, Director');location.hash='#badge';return render()}
    await sb.auth.signOut();S.uid=null;submitted=cs;render();scrollTo(0,0);
  }catch(x){err.textContent=x.message||'Error';btn.disabled=false}}
async function doLogin(e){e.preventDefault();const f=e.target,err=document.getElementById('aErr');err.textContent='';
  const email=(await sb.rpc('jpfa_login_email',{cs:f.u.value.trim()})).data;
  if(!email)return err.textContent='Access denied';
  const {data,error}=await sb.auth.signInWithPassword({email,password:f.p.value});
  if(error)return err.textContent='Access denied';
  S.uid=data.user.id;await refresh();const a=S.agents[S.uid];
  if(!a||a.status!=='approved'){await sb.rpc('jpfa_log_event',{p_kind:'login',p_text:'Tried to log in ('+(a?a.status:'no file')+')'});
    await sb.auth.signOut();S.uid=null;await refresh();return err.textContent=a&&a.status==='denied'?'Application denied':'Application pending review'}
  await sb.rpc('jpfa_log_event',{p_kind:'login',p_text:'Logged in'});
  toast('Access granted');location.hash='#home';lastView='';render()}
async function logout(){await sb.rpc('jpfa_log_event',{p_kind:'logout',p_text:'Logged out'});await sb.auth.signOut();S.uid=null;lastView='';await refresh();location.hash='#home';render()}
function fileSighting(e){e.preventDefault();const f=e.target;
  act('jpfa_file_sighting',{p_place:f.where.value.trim(),p_kind:f.type.value,p_t:new Date(f.t.value).toISOString(),p_conf:+f.conf.value,p_descr:f.desc.value.trim()},'Report filed  +25 Aura')}
function judge(id,st){act('jpfa_judge_sighting',{p_id:id,p_status:st},st==='confirmed'?'Sighting confirmed':'Sighting debunked')}
function decide(id,st){const a=S.agents[id];if(st==='denied'&&!confirm(`Deny ${a.callsign}?`))return;act('jpfa_decide',{p_agent:id,p_status:st},`${a.callsign} ${st}`)}
function appoint(id,v){act('jpfa_appoint',{p_agent:id,p_rank:+v},'Rank updated')}
async function gradeExam(e){e.preventDefault();const f=e.target;const answers=QUIZ.map((q,i)=>+f['q'+i].value);
  const s=await act('jpfa_submit_exam',{p_answers:answers});
  if(s<4){toast(`Failed: ${s}/5`)}else toast(`Passed ${s}/5  +100 Aura`)}
function duty(){act('jpfa_report_duty',{},'Reported for duty  +10 Aura')}
function rename(){const u=me(),n=(prompt('New call sign',u.callsign)||'').trim();if(!n||n===u.callsign)return;act('jpfa_set_callsign',{cs:n},'Call sign updated')}
function editNotes(){const n=prompt('Director\'s notes',S.notes||'');if(n===null)return;act('jpfa_set_notes',{p:n})}
async function reload(){await refresh();render();toast('Refreshed')}
function setPhoto(inp){const file=inp.files[0];if(!file)return;const img=new Image();const url=URL.createObjectURL(file);
  img.onload=()=>{const c=document.createElement('canvas'),W=240;c.width=W;c.height=W*1.25;const x=c.getContext('2d');
    const sc=Math.max(c.width/img.width,c.height/img.height);x.drawImage(img,(c.width-img.width*sc)/2,(c.height-img.height*sc)/2,img.width*sc,img.height*sc);
    URL.revokeObjectURL(url);act('jpfa_set_photo',{p:c.toDataURL('image/jpeg',.82)},'Photo updated')};img.src=url}
async function dlBadge(){
  const u=me(),r=rankOf(u),W=856,H=540,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  await document.fonts.ready;
  const g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,'#0b2545');g.addColorStop(.55,'#13315c');g.addColorStop(1,'#0b2545');
  x.fillStyle=g;x.beginPath();x.roundRect(0,0,W,H,26);x.fill();
  const load=src=>new Promise(res=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>res(null);i.src=src});
  const logo=await load('logo.png');
  if(logo){x.globalAlpha=.1;x.drawImage(logo,W-330,H-330,420,410);x.globalAlpha=1;x.drawImage(logo,30,20,84,82)}
  x.fillStyle='#fff';x.font='900 26px Merriweather';x.fillText('JOHN PORK',128,58);x.fillText('FEDERAL AGENCY',128,90);
  x.fillStyle='#e6c65a';x.font='800 18px "Public Sans"';x.textAlign='right';x.fillText('AGENT ID',W-36,62);x.textAlign='left';
  x.fillStyle='#c9a227';x.fillRect(34,112,W-68,4);
  x.fillStyle='#0a1d38';x.fillRect(34,140,220,275);x.strokeStyle='#c9a227';x.lineWidth=4;x.strokeRect(34,140,220,275);
  if(u.photo){const p=await load(u.photo);if(p)x.drawImage(p,36,142,216,271)}else{x.fillStyle='#e6c65a';x.font='900 90px Merriweather';x.textAlign='center';x.fillText(u.callsign[0].toUpperCase(),144,310);x.textAlign='left'}
  const rows=[['CALL SIGN',u.callsign,'900 34px Merriweather','#fff'],['RANK',RANKS[r].n,'800 26px "Public Sans"','#e6c65a'],['BADGE NO.',u.badge,'700 24px "IBM Plex Mono"','#fff'],['ISSUED',fmtDate(u.joined),'800 22px "Public Sans"','#fff']];
  let y=160;for(const [k,v,f,col] of rows){x.fillStyle='#9fb1cb';x.font='700 14px "Public Sans"';x.fillText(k,284,y+6);x.fillStyle=col;x.font=f;x.fillText(v,284,y+40);y+=68}
  let s=0;for(const ch of u.badge)s=(s*31+ch.charCodeAt(0))>>>0;let bx=34;x.fillStyle='#fff';for(let i=0;i<60;i++){s=(s*1103515245+12345)>>>0;const w=2+(s>>>16)%4;x.fillRect(bx,448,w,56);bx+=w+3}
  const cl=CLR[r].toUpperCase();x.font='800 20px "Public Sans"';const tw=x.measureText(cl).width;x.fillStyle='#c9a227';x.fillRect(W-36-tw-24,466,tw+24,34);x.fillStyle='#1b1503';x.fillText(cl,W-36-tw-12,490);
  const a=document.createElement('a');a.download=`JPFA-${u.callsign}.png`;a.href=c.toDataURL('image/png');a.click();
  sb.rpc('jpfa_log_event',{p_kind:'badge',p_text:'Downloaded badge'}).then(()=>{})}

/* ---------- router ---------- */
function render(){const [route,arg]=(location.hash.slice(1)||'home').split('/');chrome();
  if(!S.ready){document.getElementById('view').innerHTML='<div class="empty" style="text-align:center;padding:40px">Connecting to JPFA network…</div>';return}
  const html=(V[route]||V.home)(arg);if(html)document.getElementById('view').innerHTML=html;
  if(route==='enlist')initSig();
  logView(route)}
addEventListener('hashchange',async()=>{if(location.hash!=='#enlist')submitted=null;render();scrollTo(0,0);
  const h=location.hash,route=(h.slice(1)||'home').split('/')[0];if(!S.ready||['enlist','login'].includes(route))return;
  await refresh();if(location.hash===h&&!document.activeElement?.matches('input,textarea,select'))render()});
const LIVE=['home','apps','activity','agent','agents'];
setInterval(async()=>{if(document.hidden||!S.ready)return;const route=(location.hash.slice(1)||'home').split('/')[0];
  if(!LIVE.includes(route)||document.activeElement?.matches('input,textarea,select'))return;
  const y=scrollY;await refresh();render();scrollTo(0,y)},20000);
(async()=>{render();const {data}=await sb.auth.getSession();S.uid=data.session?.user.id||null;await refresh();render()})();
