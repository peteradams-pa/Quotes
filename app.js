'use strict';
// ═══════════════════════════════════════════════════════
// QUOTES PWA v3.0
// ═══════════════════════════════════════════════════════

// ── STATE ──────────────────────────────────────────────
let DB = {
  companies:[], customers:[], inventory:[], quotes:[], salespeople:[], templates:[],
  settings:{
    quotePrefix:'QMS-', invoicePrefix:'INV-', quoteValidDays:30, followUpDays:7,
    taxRate:0.16, taxLabel:'VAT', currencySymbol:'KSh',
    minMargin:.20, warnMargin:.25, activeCompanyId:null,
    darkMode:false, accentName:'Google Blue', dlIncludeVersion:true,
    productCategories:['Software','Hardware','Services','Other'],
  }
};
let curPage='dashboard', curQID=null, qeStep=0, qeD={}, qFilt='all', invF='all', setType='';
let editCoId=null, editCustId=null, editInvId=null, editSpId=null;

const ACCENTS=[
  {name:'Google Blue', lc:'#1A73E8', dc:'#8AB4F8'},
  {name:'Teal',        lc:'#00897B', dc:'#4DB6AC'},
  {name:'Indigo',      lc:'#3949AB', dc:'#9FA8DA'},
  {name:'Green',       lc:'#2E7D32', dc:'#81C995'},
  {name:'Purple',      lc:'#7B1FA2', dc:'#CE93D8'},
  {name:'Deep Orange', lc:'#E65100', dc:'#FFAB76'},
  {name:'Pink',        lc:'#C2185B', dc:'#F48FB1'},
  {name:'Cyan',        lc:'#0097A7', dc:'#80DEEA'},
];

// ── XSS PROTECTION ─────────────────────────────────────
function esc(s){
  if(s===null||s===undefined) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── INDEXEDDB STORAGE ──────────────────────────────────
const IDB_NAME='QuotesPWA3', IDB_STORE='data';
const IDB_KEYS=['inventory','quotes','customers','companies','salespeople','settings','templates'];
let _idb=null;
function openIDB(){
  return new Promise((resolve,reject)=>{
    if(_idb){resolve(_idb);return;}
    const req=indexedDB.open(IDB_NAME,3);
    req.onupgradeneeded=e=>{const db=e.target.result;if(!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);};
    req.onsuccess=e=>{_idb=e.target.result;resolve(_idb);};
    req.onerror=e=>reject(e.target.error);
  });
}
let _saveTimer=null;
function save(){clearTimeout(_saveTimer);_saveTimer=setTimeout(_doSave,200);}
function _doSave(){
  openIDB().then(db=>{
    const tx=db.transaction(IDB_STORE,'readwrite');
    const st=tx.objectStore(IDB_STORE);
    IDB_KEYS.forEach(k=>{if(DB[k]!==undefined) st.put(JSON.stringify(DB[k]),'col_'+k);});
    st.put(JSON.stringify(DB.settings||{}),'col_settings');
  }).catch(()=>snack('⚠ Storage unavailable — data may not persist'));
  try{localStorage.setItem('qpwa3',JSON.stringify(DB));}catch(e){}
}
function load(){
  return new Promise(resolve=>{
    openIDB().then(db=>{
      const tx=db.transaction(IDB_STORE,'readonly');
      const probe=tx.objectStore(IDB_STORE).get('col_inventory');
      probe.onsuccess=()=>{
        if(probe.result!==undefined){
          Promise.all(IDB_KEYS.map(k=>new Promise(res=>{
            const r=tx.objectStore(IDB_STORE).get('col_'+k);
            r.onsuccess=()=>res([k,r.result]); r.onerror=()=>res([k,null]);
          }))).then(pairs=>{pairs.forEach(([k,v])=>{if(v){try{DB[k]=JSON.parse(v);}catch(e){}}});ensureDefaults();resolve();});
        } else {loadLS(resolve);}
      };
      probe.onerror=()=>loadLS(resolve);
    }).catch(()=>loadLS(resolve));
  });
}
function ensureDefaults(){
  ['quotes','inventory','customers','companies','salespeople','templates'].forEach(k=>{if(!DB[k]) DB[k]=[];});
  if(!DB.settings) DB.settings={};
  const d={quotePrefix:'QMS-',invoicePrefix:'INV-',quoteValidDays:30,followUpDays:7,taxRate:0.16,taxLabel:'VAT',currencySymbol:'KSh',minMargin:.20,warnMargin:.25,activeCompanyId:null,darkMode:false,accentName:'Google Blue',dlIncludeVersion:true,productCategories:['Software','Hardware','Services','Other']};
  Object.keys(d).forEach(k=>{if(DB.settings[k]===undefined) DB.settings[k]=d[k];});
}
function loadLS(resolve){
  try{const r=localStorage.getItem('qpwa3');if(r){DB=JSON.parse(r);_doSave();}else seed();}catch(e){seed();}
  ensureDefaults();resolve();
}

// ── SAFE UNIQUE IDS ─────────────────────────────────────
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
function nextId(pfx,col,field='id'){
  const p=pfx+'-';
  const nums=col.filter(x=>x[field]&&x[field].startsWith(p)).map(x=>parseInt(x[field].replace(p,''))||0);
  return p+String((nums.length?Math.max(...nums):0)+1).padStart(3,'0');
}

// ── SEED DATA ──────────────────────────────────────────
function seed(){
  DB.companies=[{id:'CO-001',name:'Acme Corporation',tagline:'Enterprise Solutions',address:'123 Business Ave\nNairobi, Kenya 00100',phone:'+254 700 000 000',email:'sales@acme.co.ke',website:'www.acme.co.ke',taxPin:'P051234567A',paymentMethods:[{type:'Bank',bankName:'Equity Bank Kenya',accName:'Acme Corporation Ltd',accNum:'0123456789',branch:'Westlands Branch',swift:'EQBLKENA'},{type:'M-Pesa',paybillBusiness:'123456',paybillAccount:'Invoice No.',tillNumber:'',mpesaName:'Acme Corporation'}],paymentTerms:'Net 30',terms:'1. Payment is due within 30 days of invoice date.\n2. Late payments accrue 1.5% interest per month.\n3. All prices are in KSh and subject to change without notice.\n4. Goods remain property of Acme Corporation until full payment is received.',logoText:'A',logoColor:'#1A73E8',logoImg:null}];
  DB.settings.activeCompanyId='CO-001';
  DB.salespeople=[{id:'SP-001',name:'Sarah Kamau',title:'Senior Sales Executive',email:'sarah@acme.co.ke',phone:'+254 711 000 001',companyId:'CO-001'},{id:'SP-002',name:'Mike Odhiambo',title:'Account Manager',email:'mike@acme.co.ke',phone:'+254 711 000 002',companyId:'CO-001'}];
  DB.customers=[{id:'CUS-001',companyId:'CO-001',company:'Nexus Technologies',contact:'Alex Chen',email:'alex@nexus.co.ke',phone:'+254 722 010 101',address:'Westlands, Nairobi',taxPin:'P051111111A',industry:'Technology',tier:'Gold',ltv:0},{id:'CUS-002',companyId:'CO-001',company:'Pinnacle Group',contact:'Maria Santos',email:'m.santos@pinnacle.co.ke',phone:'+254 722 010 102',address:'Upper Hill, Nairobi',taxPin:'P052222222A',industry:'Finance',tier:'Platinum',ltv:0},{id:'CUS-003',companyId:'CO-001',company:'Horizon Health',contact:'James Wright',email:'j.wright@horizon.co.ke',phone:'+254 722 010 103',address:'Karen, Nairobi',taxPin:'',industry:'Healthcare',tier:'Silver',ltv:0},{id:'CUS-004',companyId:'CO-001',company:'Summit Retail',contact:'Sarah Kim',email:'s.kim@summit.co.ke',phone:'+254 722 010 104',address:'CBD, Nairobi',taxPin:'',industry:'Retail',tier:'Bronze',ltv:0}];
  DB.inventory=[{id:'ITM-001',companyId:'CO-001',name:'Enterprise Software License',category:'Software',unitCost:60000,markup:.50,description:'Full enterprise license with unlimited users.'},{id:'ITM-002',companyId:'CO-001',name:'Implementation Services (hr)',category:'Services',unitCost:7500,markup:.40,description:'Professional implementation and setup.'},{id:'ITM-003',companyId:'CO-001',name:'Annual Support Package',category:'Services',unitCost:40000,markup:.60,description:'12-month support and maintenance plan.'},{id:'ITM-004',companyId:'CO-001',name:'Hardware Server Unit',category:'Hardware',unitCost:175000,markup:.30,description:'High-performance rack server unit.'},{id:'ITM-005',companyId:'CO-001',name:'Network Switch 48-port',category:'Hardware',unitCost:32500,markup:.35,description:'Managed gigabit 48-port switch.'},{id:'ITM-006',companyId:'CO-001',name:'Training (per day)',category:'Services',unitCost:25000,markup:.50,description:'On-site or remote training sessions.'},{id:'ITM-007',companyId:'CO-001',name:'Cloud Storage (TB/month)',category:'Software',unitCost:1250,markup:.80,description:'Secure cloud storage per TB per month.'},{id:'ITM-008',companyId:'CO-001',name:'Security Suite License',category:'Software',unitCost:22500,markup:.55,description:'Comprehensive cybersecurity suite.'}];
  DB.templates=[];
  const d=n=>{const x=new Date();x.setDate(x.getDate()+n);return x.toISOString().slice(0,10);};
  DB.quotes=[{id:'QMS-2026-001',companyId:'CO-001',customerId:'CUS-002',date:d(-80),validUntil:d(-50),status:'Won',version:'v1',revision:'Initial proposal',salespersonId:'SP-001',notes:'Client approved on first presentation.',taxable:true,discount:0.05,history:[],items:[{itemId:'ITM-001',desc:'Enterprise Software License',qty:3,unitPrice:90000,discount:0},{itemId:'ITM-002',desc:'Implementation Services (hr)',qty:40,unitPrice:10500,discount:0},{itemId:'ITM-003',desc:'Annual Support Package',qty:1,unitPrice:64000,discount:0.05}]},{id:'QMS-2026-002',companyId:'CO-001',customerId:'CUS-003',date:d(-50),validUntil:d(-20),status:'Draft',version:'v1',revision:'Service expansion',salespersonId:'SP-001',notes:'Needs internal sign-off.',taxable:false,discount:0,history:[],items:[{itemId:'ITM-003',desc:'Annual Support Package',qty:3,unitPrice:64000,discount:0},{itemId:'ITM-006',desc:'Training (per day)',qty:8,unitPrice:37500,discount:0}]},{id:'QMS-2026-003',companyId:'CO-001',customerId:'CUS-001',date:d(-15),validUntil:d(15),status:'Sent',version:'v2',revision:'Revised scope',salespersonId:'SP-002',notes:'Board approval pending.',taxable:true,discount:0,history:[],items:[{itemId:'ITM-004',desc:'Hardware Server Unit',qty:2,unitPrice:227500,discount:0},{itemId:'ITM-005',desc:'Network Switch 48-port',qty:4,unitPrice:43875,discount:0.10},{itemId:'ITM-007',desc:'Cloud Storage (TB/month)',qty:12,unitPrice:2250,discount:0}]},{id:'QMS-2026-004',companyId:'CO-001',customerId:'CUS-004',date:d(-5),validUntil:d(25),status:'Sent',version:'v1',revision:'',salespersonId:'SP-001',notes:'Follow-up due soon.',taxable:true,discount:0,history:[],items:[{itemId:'ITM-008',desc:'Security Suite License',qty:5,unitPrice:34875,discount:0}]}];
  recalcAllLTV();save();
}

// ── HELPERS ────────────────────────────────────────────
const sym=()=>DB.settings.currencySymbol||'KSh';
function fmt(n){return sym()+' '+Number(n||0).toLocaleString('en-KE',{minimumFractionDigits:2,maximumFractionDigits:2});}
function fmtDate(d){if(!d)return'—';try{return new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});}catch{return d;}}
function fmtCompact(n){if(n>=1000000)return(n/1000000).toFixed(1)+'M';if(n>=1000)return Math.round(n/1000)+'K';return Math.round(n)+'';}
function v(id){return(document.getElementById(id)||{}).value||'';}
function activeCo(){return DB.companies.find(c=>c.id===DB.settings.activeCompanyId)||DB.companies[0]||null;}
function getCo(id){return DB.companies.find(c=>c.id===id)||null;}
function getCust(id){return DB.customers.find(c=>c.id===id)||null;}
function getProd(id){return DB.inventory.find(i=>i.id===id)||null;}
function getSP(id){return DB.salespeople.find(s=>s.id===id)||null;}
function getCategories(){return DB.settings.productCategories||['Software','Hardware','Services','Other'];}
function acoCusts(){const co=activeCo();return DB.customers.filter(c=>!c.companyId||c.companyId===(co&&co.id));}
function acoInv(){const co=activeCo();return DB.inventory.filter(i=>!i.companyId||i.companyId===(co&&co.id));}
function acoQuotes(){const co=activeCo();return DB.quotes.filter(q=>!q.companyId||q.companyId===(co&&co.id));}
function acoSP(){const co=activeCo();return DB.salespeople.filter(s=>!s.companyId||s.companyId===(co&&co.id));}
function calcTotals(q){
  let sub=0,cost=0;
  (q.items||[]).forEach(li=>{const p=getProd(li.itemId);const lt=li.unitPrice*(li.qty||1)*(1-(li.discount||0));const lc=(p?p.unitCost:li.unitPrice*0.7)*(li.qty||1);sub+=lt;cost+=lc;});
  const discAmt=sub*(q.discount||0),net=sub-discAmt,taxAmt=q.taxable?net*(DB.settings.taxRate||0.16):0,total=net+taxAmt,margin=net>0?(net-cost)/net:0;
  return{sub,discAmt,net,taxAmt,total,cost,margin};
}
function nextQID(){const yr=new Date().getFullYear();const pfx=(DB.settings.quotePrefix||'QMS-')+yr+'-';const nums=DB.quotes.filter(q=>q.id.startsWith(pfx)).map(q=>parseInt(q.id.replace(pfx,''))||0);return pfx+String((nums.length?Math.max(...nums):0)+1).padStart(3,'0');}
function isOverdue(q){return q.status==='Sent'&&new Date(q.validUntil)<new Date();}
function isFollowUpDue(q){if(q.status!=='Sent')return false;const due=new Date(q.date);due.setDate(due.getDate()+(DB.settings.followUpDays||7));return new Date()>=due&&!isOverdue(q);}
function chipCls(s){return'chip cs-'+(s||'Draft');}
function avColor(n){const c=['#4285F4','#EA4335','#FBBC04','#34A853','#FF6D00','#7B1FA2','#00897B','#C62828'];let h=0;for(const ch of(n||''))h=ch.charCodeAt(0)+((h<<5)-h);return c[Math.abs(h)%c.length];}
function avLetter(n){return(n||'?')[0].toUpperCase();}
function autoExpireQuotes(){let ch=false;DB.quotes.forEach(q=>{if(q.status==='Sent'&&new Date(q.validUntil)<new Date()){q.status='Expired';ch=true;}});if(ch)save();}
function recalcAllLTV(){DB.customers.forEach(c=>{const w=DB.quotes.filter(q=>q.customerId===c.id&&q.status==='Won');c.ltv=w.reduce((s,q)=>s+calcTotals(q).total,0);});}
function updateLTV(customerId){const c=getCust(customerId);if(!c)return;c.ltv=DB.quotes.filter(q=>q.customerId===customerId&&q.status==='Won').reduce((s,q)=>s+calcTotals(q).total,0);}

// ── NAVIGATION ──────────────────────────────────────────
function go(page){
  curPage=page;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));
  document.getElementById('page-'+page).classList.add('on');
  document.querySelectorAll('.nv').forEach(b=>b.classList.toggle('on',b.dataset.p===page));
  const titles={dashboard:'Quotes',quotes:'Quotes',inventory:'Products',customers:'Clients',settings:'Settings'};
  document.getElementById('tbar-title').textContent=titles[page]||'Quotes';
  const fab=document.getElementById('fab'),lbl=document.getElementById('fab-lbl');
  const fm={dashboard:'New Quote',quotes:'New Quote',inventory:'Add Product',customers:'Add Client'};
  if(fm[page]){lbl.textContent=fm[page];fab.classList.remove('gone');}else fab.classList.add('gone');
  document.getElementById('btn-srch').style.display=page==='quotes'?'flex':'none';
  renderPage(page);updateNavBadges();
}
function renderPage(p){
  if(p==='dashboard')renderDash();
  else if(p==='quotes')renderQuotes();
  else if(p==='inventory')renderInv();
  else if(p==='customers')renderCusts();
  else if(p==='settings')renderSettings();
}
function fabClick(){
  if(curPage==='dashboard'||curPage==='quotes')openQE(null);
  else if(curPage==='inventory')openInvEd(null);
  else if(curPage==='customers')openCustEd(null);
}
function updateNavBadges(){
  const n=acoQuotes().filter(q=>isOverdue(q)||isFollowUpDue(q)).length;
  const b=document.getElementById('nav-badge-quotes');
  if(!b)return;
  if(n>0){b.textContent=n;b.style.display='flex';}else b.style.display='none';
}

// ── DASHBOARD ──────────────────────────────────────────
function renderDash(){
  const co=activeCo();
  document.getElementById('d-coname').textContent=co?co.name:'Set up a company profile →';
  const qs=acoQuotes();
  const won=qs.filter(q=>q.status==='Won');
  const wonV=won.reduce((s,q)=>s+calcTotals(q).total,0);
  document.getElementById('d-met').innerHTML=`
    <div class="mc bl"><div class="mv">${qs.filter(q=>q.status==='Sent').length}</div><div class="mlb">Sent / Pending</div></div>
    <div class="mc gr"><div class="mv">${won.length}</div><div class="mlb">Won</div></div>
    <div class="mc"><div class="mv" style="font-size:16px;color:var(--P)">${fmtCompact(wonV)}</div><div class="mlb">Revenue Won</div></div>
    <div class="mc re"><div class="mv">${qs.filter(isOverdue).length}</div><div class="mlb">Overdue</div></div>`;

  // Alerts
  const alerts=[];
  if(!co&&DB.companies.length===0) alerts.push(`<div class="alert-card info" onclick="openCoEd(null)"><div style="display:flex;align-items:center;gap:10px"><span class="material-icons-round" style="color:var(--P)">business</span><div style="flex:1"><div style="font-size:13px;font-weight:700">Set up your company profile</div><div style="font-size:12px;color:var(--t2)">Tap to add your company for branded quotes</div></div><span class="material-icons-round" style="color:var(--t3)">chevron_right</span></div></div>`);
  qs.filter(isOverdue).forEach(q=>{const cu=getCust(q.customerId);alerts.push(`<div class="alert-card danger" onclick="openQD('${q.id}')"><div style="display:flex;align-items:center;gap:10px"><span class="material-icons-round" style="color:var(--E);font-size:20px">warning</span><div style="flex:1"><div style="font-size:13px;font-weight:700">${esc(cu?.company||'Unknown')} — ${esc(q.id)}</div><div style="font-size:12px;color:var(--t2)">Expired ${fmtDate(q.validUntil)} · ${fmt(calcTotals(q).total)}</div></div><span class="material-icons-round" style="color:var(--t3)">chevron_right</span></div></div>`);});
  qs.filter(isFollowUpDue).forEach(q=>{const cu=getCust(q.customerId);alerts.push(`<div class="alert-card" onclick="openQD('${q.id}')"><div style="display:flex;align-items:center;gap:10px"><span class="material-icons-round" style="color:var(--W);font-size:20px">schedule</span><div style="flex:1"><div style="font-size:13px;font-weight:700">${esc(cu?.company||'Unknown')} — ${esc(q.id)}</div><div style="font-size:12px;color:var(--t2)">Follow-up due · ${fmt(calcTotals(q).total)}</div></div><span class="material-icons-round" style="color:var(--t3)">chevron_right</span></div></div>`);});
  document.getElementById('d-alerts').innerHTML=alerts.join('');

  // Revenue chart
  renderRevenueChart();

  // Pipeline
  const stats=['Draft','Sent','Won','Lost','Expired'],cols={Draft:'#4285F4',Sent:'#F9AB00',Won:'#34A853',Lost:'#EA4335',Expired:'#9AA0A6'};
  const grp={};stats.forEach(s=>{grp[s]={n:0,v:0};});
  qs.forEach(q=>{const g=grp[q.status]||grp.Draft;g.n++;g.v+=calcTotals(q).total;});
  const grand=Object.values(grp).reduce((s,g)=>s+g.v,0);
  document.getElementById('d-pipe').innerHTML=stats.map(s=>`<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;margin-bottom:3px"><div style="font-size:13px;font-weight:600;display:flex;align-items:center"><span class="cdot" style="background:${cols[s]}"></span>${s}<span style="margin-left:6px;background:${cols[s]};color:#fff;border-radius:999px;padding:1px 7px;font-size:11px;font-weight:700">${grp[s].n}</span></div><div style="font-size:13px;font-weight:700">${fmt(grp[s].v)}</div></div><div class="pbar"><div class="pfill" style="width:${grand?Math.round(grp[s].v/grand*100):0}%;background:${cols[s]}"></div></div></div>`).join('');

  const rec=[...qs].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
  document.getElementById('d-rec').innerHTML=rec.length?rec.map(qItemHTML).join(''):`<div class="empty"><span class="material-icons-round">receipt_long</span><div class="empty-t">No quotes yet</div><div class="empty-s">Tap + New Quote to get started</div></div>`;
}

function renderRevenueChart(){
  const el=document.getElementById('d-chart');if(!el)return;
  const qs=acoQuotes().filter(q=>q.status==='Won');
  const now=new Date();
  const months=[];
  for(let i=5;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);months.push({label:d.toLocaleDateString('en-GB',{month:'short'}),year:d.getFullYear(),month:d.getMonth(),total:0});}
  qs.forEach(q=>{const d=new Date(q.date);const m=months.find(x=>x.year===d.getFullYear()&&x.month===d.getMonth());if(m)m.total+=calcTotals(q).total;});
  const maxV=Math.max(...months.map(m=>m.total),1);
  const cur=now.getMonth(),curY=now.getFullYear();
  el.innerHTML=months.map(m=>{const pct=Math.max(Math.round(m.total/maxV*100),m.total>0?4:0);const isCur=m.month===cur&&m.year===curY;return`<div class="chart-bar-wrap"><div style="font-size:8px;color:var(--t3);margin-bottom:2px">${m.total>0?fmtCompact(m.total):''}</div><div class="chart-bar${isCur?' active':''}" style="height:${pct}%"></div><div class="chart-bar-lbl">${m.label}</div></div>`;}).join('');
}

// ── QUOTES LIST ─────────────────────────────────────────
function renderQuotes(){
  const srch=(document.getElementById('q-srch-in')||{}).value?.toLowerCase()||'';
  const df=v('q-date-from'),dt=v('q-date-to');
  let list=acoQuotes().sort((a,b)=>b.date.localeCompare(a.date));
  if(qFilt!=='all')list=list.filter(q=>q.status===qFilt);
  if(srch)list=list.filter(q=>q.id.toLowerCase().includes(srch)||(getCust(q.customerId)||{}).company?.toLowerCase().includes(srch)||(getSP(q.salespersonId)||{}).name?.toLowerCase().includes(srch));
  if(df)list=list.filter(q=>q.date>=df);
  if(dt)list=list.filter(q=>q.date<=dt);
  const el=document.getElementById('q-list');
  el.innerHTML=list.length?list.map(qItemHTML).join(''):`<div class="empty"><span class="material-icons-round">search_off</span><div class="empty-t">No quotes found</div><div class="empty-s">Try a different filter or create a new quote</div></div>`;
}
function qItemHTML(q){
  const cu=getCust(q.customerId),sp=getSP(q.salespersonId),tots=calcTotals(q);
  const od=isOverdue(q),fu=isFollowUpDue(q);
  return`<div class="qi" onclick="openQD('${q.id}')"><div class="qi-top"><span class="qi-id">${esc(q.isInvoice?q.invoiceId:q.id)}${q.isInvoice?'<span class="chip cs-Won" style="font-size:10px;margin-left:4px">INV</span>':''}</span><span class="qi-amt">${fmt(tots.total)}</span></div><div class="qi-co">${esc(cu?.company||'Unknown Customer')}</div><div style="font-size:12px;color:var(--t2)">${esc(cu?.contact||'')}${sp?' · '+esc(sp.name):''}</div><div class="qi-meta"><div style="display:flex;align-items:center;gap:6px">${od?'<span style="width:7px;height:7px;border-radius:50%;background:var(--E);display:inline-block"></span>':''}${fu&&!od?'<span class="fu-badge"><span class="material-icons-round" style="font-size:10px">schedule</span> Follow-up</span>':''}<span class="qi-date">${fmtDate(q.date)} · until ${fmtDate(q.validUntil)}</span></div><span class="${chipCls(q.status)}">${q.status}</span></div></div>`;
}
function setQF(s){qFilt=s;document.querySelectorAll('#q-fbar .fc').forEach(c=>c.classList.toggle('on',c.textContent.trim()===s||(s==='all'&&c.textContent.trim()==='All')));renderQuotes();}
function clearDateFilter(){const df=document.getElementById('q-date-from'),dt=document.getElementById('q-date-to');if(df)df.value='';if(dt)dt.value='';renderQuotes();}
function toggleSearch(){const w=document.getElementById('q-srch-wrap');const show=!w.style.display||w.style.display==='none';w.style.display=show?'block':'none';if(show)setTimeout(()=>document.getElementById('q-srch-in')?.focus(),60);}
function closeSearch(){document.getElementById('q-srch-wrap').style.display='none';const e=document.getElementById('q-srch-in');if(e)e.value='';renderQuotes();}

// ── QUOTE DETAIL ────────────────────────────────────────
function openQD(qid){
  curQID=qid;
  const q=DB.quotes.find(x=>x.id===qid);if(!q)return;
  const cu=getCust(q.customerId),sp=getSP(q.salespersonId),co=getCo(q.companyId),tots=calcTotals(q);
  const mc=tots.margin<DB.settings.minMargin?'var(--E)':tots.margin<DB.settings.warnMargin?'#E65100':'var(--S)';
  document.getElementById('qd-id').textContent=q.isInvoice?q.invoiceId:q.id;
  const revCount=(q.history||[]).length;
  document.getElementById('qd-body').innerHTML=`
    <div class="db2" style="margin-top:10px">
      <div class="dh2"><span class="dht">${q.isInvoice?'Invoice':'Quote'} Details</span><span class="${chipCls(q.status)}">${q.status}</span></div>
      <div class="dr"><span class="dk">Customer</span><span class="dv fw7">${esc(cu?.company||'—')}</span></div>
      <div class="dr"><span class="dk">Contact</span><span class="dv">${esc(cu?.contact||'—')}</span></div>
      <div class="dr"><span class="dk">Sales Rep</span><span class="dv">${esc(sp?.name||'—')}</span></div>
      <div class="dr"><span class="dk">Date</span><span class="dv">${fmtDate(q.isInvoice?q.invoiceDate:q.date)}</span></div>
      <div class="dr"><span class="dk">Valid Until</span><span class="dv">${fmtDate(q.validUntil)}</span></div>
      <div class="dr"><span class="dk">Version</span><span class="dv">${esc(q.version||'v1')}${q.revision?' — '+esc(q.revision):''}</span></div>
    </div>
    <div class="db2">
      <div class="dh2"><span class="dht">Line Items</span></div>
      ${(q.items||[]).map(li=>{const lt=li.unitPrice*(li.qty||1)*(1-(li.discount||0));return`<div class="dr"><span class="dk" style="flex:1">${esc(li.desc||li.itemId)}</span><span class="dv" style="white-space:nowrap">${li.qty}× ${fmt(li.unitPrice)}${li.discount?' −'+Math.round(li.discount*100)+'%':''} = <b>${fmt(lt)}</b></span></div>`;}).join('')}
    </div>
    <div class="tots">
      <div class="tr2"><span class="tk">Subtotal</span><span class="tv">${fmt(tots.sub)}</span></div>
      ${tots.discAmt>0?`<div class="tr2"><span class="tk">Discount</span><span class="tv" style="color:var(--S)">−${fmt(tots.discAmt)}</span></div>`:''}
      <div class="tr2"><span class="tk">Net Amount</span><span class="tv">${fmt(tots.net)}</span></div>
      <div class="tr2"><span class="tk">${q.taxable?DB.settings.taxLabel:'Tax Exempt'}</span><span class="tv">${q.taxable?fmt(tots.taxAmt):'—'}</span></div>
      <div class="tr2 grand"><span class="tk">Grand Total</span><span class="tv">${fmt(tots.total)}</span></div>
    </div>
    <div class="db2">
      <div class="dh2"><span class="dht">Profitability</span></div>
      <div class="dr"><span class="dk">Cost</span><span class="dv">${fmt(tots.cost)}</span></div>
      <div class="dr"><span class="dk">Gross Profit</span><span class="dv" style="color:${mc}">${fmt(tots.net-tots.cost)}</span></div>
      <div class="dr"><span class="dk">Margin</span><span class="dv" style="color:${mc}">${Math.round(tots.margin*100)}%${tots.margin<DB.settings.minMargin?' ⚠':''}</span></div>
    </div>
    ${q.notes?`<div class="db2"><div class="dh2"><span class="dht">Notes</span></div><div style="padding:12px 16px;font-size:14px;color:var(--t2);line-height:1.6">${esc(q.notes)}</div></div>`:''}
    ${revCount>0?`<div style="margin:8px 16px"><button class="btn bo btn-w" onclick="openRevHistory('${q.id}')"><span class="material-icons-round">history</span> Revision History (${revCount})</button></div>`:''}
    <div style="padding:14px 16px 8px;display:flex;gap:10px">
      <button class="btn bo" style="flex:1" onclick="closeDlg('dlg-qd');setTimeout(()=>openQE('${q.id}'),120)"><span class="material-icons-round">edit</span> Edit</button>
      <button class="btn bd2" style="flex:1" onclick="confirmAct('Delete this quote permanently?',()=>delItem('quote','${q.id}'))"><span class="material-icons-round">delete</span> Del</button>
    </div>
    <div style="padding:0 16px 8px"><button class="btn bp" style="width:100%" onclick="openPreview('${q.id}')"><span class="material-icons-round">picture_as_pdf</span> Preview / Export PDF</button></div>
    <div style="padding:0 16px 20px"><button class="btn btn-ton" style="width:100%" onclick="openShareDialog('${q.id}')"><span class="material-icons-round">share</span> Share</button></div>
    <div style="height:24px"></div>`;
  openDlg('dlg-qd');
}

function openQAct(){
  const q=DB.quotes.find(x=>x.id===curQID);if(!q)return;
  const others=['Draft','Sent','Won','Lost','Expired'].filter(s=>s!==q.status);
  const invHtml=q.isInvoice
    ?`<div class="si" onclick="revertToQuote('${q.id}');closeDlg('dlg-qact')"><div class="si-ic"><span class="material-icons-round">undo</span></div><div class="si-tx"><div class="si-m">Revert to Quote</div></div></div>`
    :`<div class="si" onclick="convertToInvoice('${q.id}');closeDlg('dlg-qact')"><div class="si-ic grn"><span class="material-icons-round">receipt</span></div><div class="si-tx"><div class="si-m">Convert to Invoice</div></div></div>`;
  document.getElementById('qact-body').innerHTML=`
    <div class="si" onclick="closeDlg('dlg-qact');closeDlg('dlg-qd');setTimeout(()=>openQE('${q.id}'),120)"><div class="si-ic"><span class="material-icons-round">edit</span></div><div class="si-tx"><div class="si-m">Edit Quote</div></div></div>
    <div class="si" onclick="dupQ('${q.id}')"><div class="si-ic"><span class="material-icons-round">content_copy</span></div><div class="si-tx"><div class="si-m">Duplicate</div></div></div>
    <div class="si" onclick="saveAsTemplate('${q.id}');closeDlg('dlg-qact')"><div class="si-ic"><span class="material-icons-round">bookmark_add</span></div><div class="si-tx"><div class="si-m">Save as Template</div></div></div>
    ${invHtml}
    ${others.map(s=>`<div class="si" onclick="setQStat('${q.id}','${s}')"><div class="si-ic"><span class="material-icons-round">label</span></div><div class="si-tx"><div class="si-m">Mark as ${s}</div></div></div>`).join('')}
    <div class="si" onclick="openRevHistory('${q.id}');closeDlg('dlg-qact')"><div class="si-ic"><span class="material-icons-round">history</span></div><div class="si-tx"><div class="si-m">Revision History</div><div class="si-s">${(q.history||[]).length} snapshots</div></div></div>
    <div class="si" onclick="openPreview('${q.id}');closeDlg('dlg-qact')"><div class="si-ic"><span class="material-icons-round">preview</span></div><div class="si-tx"><div class="si-m">Preview PDF</div></div></div>
    <div class="si" onclick="openShareDialog('${q.id}');closeDlg('dlg-qact')"><div class="si-ic"><span class="material-icons-round">share</span></div><div class="si-tx"><div class="si-m">Share</div></div></div>
    <div class="si" onclick="confirmAct('Delete this quote permanently?',()=>delItem('quote','${q.id}'))"><div class="si-ic red"><span class="material-icons-round">delete</span></div><div class="si-tx"><div class="si-m txt-e">Delete</div></div></div>`;
  openDlg('dlg-qact');
}

function convertToInvoice(qid){const q=DB.quotes.find(x=>x.id===qid);if(!q||q.isInvoice)return;const yr=new Date().getFullYear();const pfx=(DB.settings.invoicePrefix||'INV-')+yr+'-';const nums=DB.quotes.filter(x=>x.invoiceId&&x.invoiceId.startsWith(pfx)).map(x=>parseInt(x.invoiceId.replace(pfx,''))||0);q.isInvoice=true;q.invoiceId=pfx+String((nums.length?Math.max(...nums):0)+1).padStart(3,'0');q.invoiceDate=new Date().toISOString().slice(0,10);save();closeDlg('dlg-qact');closeDlg('dlg-qd');snack('Converted to Invoice '+q.invoiceId);renderPage(curPage);}
function revertToQuote(qid){const q=DB.quotes.find(x=>x.id===qid);if(!q)return;confirmAct('Revert invoice back to quote?',()=>{q.isInvoice=false;q.invoiceId=null;q.invoiceDate=null;save();closeDlg('dlg-qd');renderPage(curPage);snack('Reverted to quote');});}
function setQStat(qid,s){const q=DB.quotes.find(x=>x.id===qid);if(!q)return;const old=q.status;q.status=s;if(s==='Won')updateLTV(q.customerId);if(old==='Won'&&s!=='Won')updateLTV(q.customerId);save();closeDlg('dlg-qact');openQD(qid);if(curPage==='dashboard')renderDash();snack('Marked as '+s);updateNavBadges();}
function dupQ(qid){const q=DB.quotes.find(x=>x.id===qid);if(!q)return;const nq=JSON.parse(JSON.stringify(q));nq.id=nextQID();nq.date=new Date().toISOString().slice(0,10);const vd=new Date();vd.setDate(vd.getDate()+(DB.settings.quoteValidDays||30));nq.validUntil=vd.toISOString().slice(0,10);nq.status='Draft';nq.version='v1';nq.revision='Copy of '+q.id;nq.isInvoice=false;nq.invoiceId=null;nq.history=[];DB.quotes.unshift(nq);save();closeDlg('dlg-qact');closeDlg('dlg-qd');renderPage(curPage);snack('Duplicated as '+nq.id);setTimeout(()=>openQD(nq.id),320);}

// ── REVISION HISTORY ────────────────────────────────────
function snapshotQuote(q){
  if(!q.history)q.history=[];
  q.history.push({ts:new Date().toISOString(),version:q.version,revision:q.revision,status:q.status,discount:q.discount,taxable:q.taxable,items:JSON.parse(JSON.stringify(q.items||[])),notes:q.notes,total:calcTotals(q).total});
  if(q.history.length>20)q.history.splice(0,q.history.length-20);
}
function openRevHistory(qid){
  const q=DB.quotes.find(x=>x.id===qid);if(!q)return;
  const hist=(q.history||[]).slice().reverse();
  document.getElementById('rev-body').innerHTML=hist.length===0?`<div class="empty"><span class="material-icons-round">history</span><div class="empty-t">No history yet</div><div class="empty-s">Snapshots are saved each time you edit</div></div>`
    :hist.map((h,i)=>`<div class="rev-item${i===0?' current':''}" onclick="previewSnap(${JSON.stringify({ts:h.ts,version:h.version,revision:h.revision,status:h.status,total:h.total}).replace(/"/g,'&quot;')},'${qid}')"><div style="display:flex;gap:12px"><div class="rev-dot"></div><div style="flex:1"><div style="font-size:14px;font-weight:700">${esc(h.version||'v1')}${h.revision?' — '+esc(h.revision):''}</div><div style="font-size:12px;color:var(--t2)">${fmtDate(h.ts.slice(0,10))} · ${fmt(h.total)} · <span class="${chipCls(h.status)}">${h.status}</span></div></div>${i===0?'<span style="font-size:11px;background:var(--PC);color:var(--P);border-radius:999px;padding:2px 8px;font-weight:700">Latest</span>':''}</div></div>`).join('');
  openDlg('dlg-rev');
}
function previewSnap(snap,qid){snack(`${snap.version||'v1'}: ${fmt(snap.total)} · ${snap.status}`,'Restore',()=>restoreSnap(snap,qid));}
function restoreSnap(snap,qid){
  const q=DB.quotes.find(x=>x.id===qid);if(!q)return;
  confirmAct(`Restore snapshot "${snap.version||'v1'}"? Current state will be overwritten.`,()=>{
    const fullSnap=(q.history||[]).find(h=>h.ts===snap.ts);
    if(fullSnap){snapshotQuote(q);q.version=fullSnap.version;q.revision=fullSnap.revision;q.status=fullSnap.status;q.discount=fullSnap.discount;q.taxable=fullSnap.taxable;q.items=JSON.parse(JSON.stringify(fullSnap.items));q.notes=fullSnap.notes;save();closeDlg('dlg-rev');openQD(qid);snack('Snapshot restored');}
  });
}

// ── TEMPLATES ───────────────────────────────────────────
function saveAsTemplate(qid){
  const q=DB.quotes.find(x=>x.id===qid);if(!q)return;
  const name=prompt('Template name:',q.revision||q.id);if(!name)return;
  if(!DB.templates)DB.templates=[];
  DB.templates.push({id:'TPL-'+uid().slice(0,6).toUpperCase(),name,createdAt:new Date().toISOString().slice(0,10),companyId:q.companyId,items:JSON.parse(JSON.stringify(q.items)),discount:q.discount,taxable:q.taxable,notes:q.notes,version:'v1'});
  save();snack(`Template "${name}" saved`);
}
function openTemplates(){
  const tpls=DB.templates||[];
  document.getElementById('tpl-body').innerHTML=tpls.length===0?`<div class="empty"><span class="material-icons-round">bookmark</span><div class="empty-t">No templates yet</div><div class="empty-s">Open any quote → ⋮ Actions → Save as Template</div></div>`
    :tpls.map(t=>`<div class="tpl-card"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px"><div style="font-size:15px;font-weight:700">${esc(t.name)}</div><div style="display:flex;gap:6px"><button class="btn bp btn-sm" onclick="useTemplate('${t.id}');closeDlg('dlg-tpl')">Use</button><button class="btn bd2 btn-sm" onclick="confirmAct('Delete template?',()=>deleteTpl('${t.id}'))">Del</button></div></div><div style="font-size:12px;color:var(--t2)">${(t.items||[]).length} items · ${fmtDate(t.createdAt)}</div><div style="font-size:12px;color:var(--t2);margin-top:2px">${(t.items||[]).slice(0,3).map(i=>esc(i.desc||i.itemId)).join(', ')}${(t.items||[]).length>3?' +'+((t.items||[]).length-3)+' more':''}</div></div>`).join('');
  openDlg('dlg-tpl');
}
function deleteTpl(id){DB.templates=(DB.templates||[]).filter(t=>t.id!==id);save();openTemplates();snack('Template deleted');}
function useTemplate(tplId){
  const t=DB.templates.find(x=>x.id===tplId);if(!t)return;
  const co=activeCo();
  qeStep=0;
  const vd=new Date();vd.setDate(vd.getDate()+(DB.settings.quoteValidDays||30));
  qeD={id:nextQID(),companyId:t.companyId||co?.id||'',customerId:'',date:new Date().toISOString().slice(0,10),validUntil:vd.toISOString().slice(0,10),status:'Draft',version:'v1',revision:'From template: '+t.name,salespersonId:acoSP()[0]?.id||'',notes:t.notes||'',taxable:t.taxable!==undefined?t.taxable:true,discount:t.discount||0,items:JSON.parse(JSON.stringify(t.items||[])),history:[]};
  document.getElementById('qe-ttl').textContent='New Quote (Template)';
  renderQEStep();openDlg('dlg-qe');
}

// ── QUOTE EDITOR ────────────────────────────────────────
function openQE(qid){
  qeStep=0;const co=activeCo();
  if(qid){qeD=JSON.parse(JSON.stringify(DB.quotes.find(x=>x.id===qid)||{}));if(!qeD.history)qeD.history=[];snapshotQuote(qeD);}
  else{const vd=new Date();vd.setDate(vd.getDate()+(DB.settings.quoteValidDays||30));qeD={id:nextQID(),companyId:co?.id||'',customerId:'',date:new Date().toISOString().slice(0,10),validUntil:vd.toISOString().slice(0,10),status:'Draft',version:'v1',revision:'',salespersonId:acoSP()[0]?.id||'',notes:'',taxable:true,discount:0,items:[],history:[]};}
  document.getElementById('qe-ttl').textContent=qid?'Edit Quote':'New Quote';
  renderQEStep();openDlg('dlg-qe');
}
function renderQEStep(){
  for(let i=0;i<4;i++){const d=document.getElementById('sd'+i);d.className='sd'+(i<qeStep?' d':i===qeStep?' a':'');if(i<3)document.getElementById('sl'+i).className='sl'+(i<qeStep?' d':'');}
  document.getElementById('qe-bk').style.display=qeStep>0?'':'none';
  document.getElementById('qe-nx').textContent=qeStep===3?'✓ Save Quote':'Next →';
  const body=document.getElementById('qe-body');
  if(qeStep===0)renderQE0(body);if(qeStep===1)renderQE1(body);if(qeStep===2)renderQE2(body);if(qeStep===3)renderQE3(body);
}
function renderQE0(body){
  const sps=acoSP(),cos=DB.companies;
  body.innerHTML=`<div class="fg"><label class="fl">Quote ID</label><input class="fi" id="qe-id" value="${esc(qeD.id)}" readonly></div>
  <div class="fr"><div class="fg"><label class="fl">Date *</label><input class="fi" type="date" id="qe-date" value="${qeD.date}"></div><div class="fg"><label class="fl">Valid Until *</label><input class="fi" type="date" id="qe-valid" value="${qeD.validUntil}"></div></div>
  <div class="fr"><div class="fg"><label class="fl">Status</label>${buildCustomSelect({id:'qe-status',label:'Status',options:['Draft','Sent','Won','Lost','Expired'].map(s=>({value:s,label:s})),value:qeD.status})}</div><div class="fg"><label class="fl">Version</label><input class="fi" id="qe-ver" value="${esc(qeD.version||'v1')}"></div></div>
  <div class="fg"><label class="fl">Salesperson</label>${buildCustomSelect({id:'qe-sp',label:'Salesperson',placeholder:'— None —',options:[{value:'',label:'— None —'},...sps.map(s=>({value:s.id,label:s.name,sub:s.title||''}))],value:qeD.salespersonId||'',searchable:sps.length>4})}</div>
  <div class="fg"><label class="fl">Company Profile</label>${buildCustomSelect({id:'qe-co',label:'Company Profile',options:cos.map(c=>({value:c.id,label:c.name})),value:qeD.companyId})}</div>
  <div class="fr"><div class="fg"><label class="fl">Overall Discount %</label><input class="fi" type="number" id="qe-disc" value="${Math.round((qeD.discount||0)*100)}" min="0" max="100"></div><div class="fg"><label class="fl" style="display:flex;justify-content:space-between">Taxable <button class="tog ${qeD.taxable?'on':''}" id="qe-tax" onclick="this.classList.toggle('on')"></button></label><div style="height:40px"></div></div></div>
  <div class="fg"><label class="fl">Revision Note</label><input class="fi" id="qe-rev" value="${esc(qeD.revision||'')}" placeholder="e.g. Initial proposal / Revised scope"></div>`;
}
function renderQE1(body){
  const custs=acoCusts();
  body.innerHTML=`<div class="fg"><label class="fl">Select Customer *</label>${buildCustomSelect({id:'qe-cust',label:'Customer',placeholder:'— Select —',options:[{value:'',label:'— Select a customer —'},...custs.map(c=>({value:c.id,label:c.company,sub:c.contact+' · '+(c.phone||'')}))],value:qeD.customerId||'',searchable:true})}</div>
  <div id="qe-cust-prev"></div>
  <div style="text-align:center;padding:10px 0;color:var(--t3);font-size:13px">— or —</div>
  <button class="btn bo btn-w" onclick="openCustEd(null,true)"><span class="material-icons-round">person_add</span> Create New Customer</button>`;
  previewCust();
}
function previewCust(){
  const id=v('qe-cust'),el=document.getElementById('qe-cust-prev');if(!el)return;
  const c=getCust(id);if(!c){el.innerHTML='';return;}
  el.innerHTML=`<div class="db2" style="margin:8px 0"><div class="dr"><span class="dk">Company</span><span class="dv">${esc(c.company)}</span></div><div class="dr"><span class="dk">Contact</span><span class="dv">${esc(c.contact)}</span></div><div class="dr"><span class="dk">Email</span><span class="dv">${esc(c.email||'—')}</span></div><div class="dr"><span class="dk">Tier</span><span class="dv"><span class="tier-${c.tier||'Bronze'}">${c.tier||'Bronze'}</span></span></div></div>`;
}
function renderQE2(body){
  if(!qeD.items)qeD.items=[];
  body.innerHTML=`<div id="qe-items"></div><button class="btn btn-ton btn-w" style="margin-top:8px" onclick="addLI()"><span class="material-icons-round">add</span> Add Line Item</button>`;
  renderQEItems();
}
function renderQEItems(){
  const el=document.getElementById('qe-items');if(!el)return;
  if(!qeD.items.length){el.innerHTML=`<div class="empty" style="padding:24px"><span class="material-icons-round">playlist_add</span><div class="empty-t">No items yet</div><div class="empty-s">Search from ${acoInv().length} products or type a custom item</div></div>`;return;}
  el.innerHTML=qeD.items.map((li,i)=>{
    const lt=li.unitPrice*(li.qty||1)*(1-(li.discount||0));const prod=getProd(li.itemId);
    return`<div class="lir" id="lir-${i}"><div class="lir-top"><div style="flex:1;position:relative"><input class="fi ac-input" id="ac-input-${i}" style="width:100%;font-size:13px" placeholder="Search products…" value="${esc(li.desc||li.itemId||'')}" autocomplete="off" oninput="acSearch(${i},this.value)" onfocus="acSearch(${i},this.value)" onkeydown="acKeydown(event,${i})">${prod?'<span class="material-icons-round" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:15px;color:var(--S);pointer-events:none">check_circle</span>':''}<div class="ac-dropdown" id="ac-drop-${i}" style="display:none"></div></div><button class="ib" style="background:var(--E);color:#fff;width:30px;height:30px;border-radius:8px;flex-shrink:0" onclick="removeLI(${i})"><span class="material-icons-round" style="font-size:16px">close</span></button></div>
    ${prod?`<div style="font-size:11px;color:var(--t2);margin:-2px 0 6px;padding-left:2px"><span style="background:var(--PC);color:var(--P);border-radius:4px;padding:1px 6px;font-size:10px;font-weight:600">${esc(prod.category)}</span> ${esc(prod.id)}</div>`:''}
    <div class="fr3"><div><div class="fl" style="margin-bottom:3px">Qty</div><input class="fi" type="number" id="li-qty-${i}" value="${li.qty||1}" min="1" onchange="liFC(${i},'qty',parseFloat(this.value)||1)"></div><div><div class="fl" style="margin-bottom:3px">Unit Price</div><input class="fi" type="number" id="li-price-${i}" value="${li.unitPrice||0}" step="0.01" onchange="liFC(${i},'unitPrice',parseFloat(this.value)||0)"></div><div><div class="fl" style="margin-bottom:3px">Disc %</div><input class="fi" type="number" id="li-disc-${i}" value="${Math.round((li.discount||0)*100)}" min="0" max="100" onchange="liFC(${i},'discount',(parseFloat(this.value)||0)/100)"></div></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:5px"><span style="font-size:12px;color:var(--t2)">${prod?esc(prod.name):(li.itemId?'':li.desc?'Custom item':'')}</span><span id="li-tot-${i}" style="font-weight:800;font-size:14px;color:var(--P)">${fmt(lt)}</span></div></div>`;
  }).join('');
}
function acSearch(i,query){
  const drop=document.getElementById('ac-drop-'+i);if(!drop)return;
  const q=query.trim().toLowerCase();if(!q){drop.style.display='none';return;}
  const prods=acoInv();
  const results=prods.map(p=>{const nm=p.name.toLowerCase(),id=p.id.toLowerCase(),ds=(p.description||'').toLowerCase();let sc=0;if(nm.startsWith(q))sc=3;else if(nm.includes(q))sc=2;else if(id.includes(q))sc=1;else if(ds.includes(q))sc=0.5;return{p,sc};}).filter(x=>x.sc>0).sort((a,b)=>b.sc-a.sc).slice(0,8);
  if(!results.length){drop.innerHTML=`<div class="ac-item ac-custom" onclick="acSelectCustom(${i},this.dataset.q)" data-q="${esc(query)}"><span class="material-icons-round" style="font-size:18px;color:var(--P)">add_circle</span><div><div style="font-size:13px;font-weight:600">Use "${esc(query)}" as custom item</div><div style="font-size:11px;color:var(--t2)">Enter price manually</div></div></div>`;drop.style.display='block';return;}
  drop.innerHTML=results.map(({p})=>{const price=p.unitCost*(1+p.markup);const nm=p.name;const idx=nm.toLowerCase().indexOf(q);const hl=idx>=0?esc(nm.slice(0,idx))+'<b>'+esc(nm.slice(idx,idx+q.length))+'</b>'+esc(nm.slice(idx+q.length)):esc(nm);return`<div class="ac-item" onclick="acSelect(${i},'${p.id}')"><div style="flex:1"><div style="font-size:13px;font-weight:600">${hl}</div><div style="font-size:11px;color:var(--t2)">${esc(p.id)} · ${esc(p.category)}</div></div><div style="font-size:13px;font-weight:700;color:var(--P);white-space:nowrap">${fmt(price)}</div></div>`;}).join('');
  drop.style.display='block';
}
function acSelect(i,prodId){const p=getProd(prodId);if(!p)return;const price=p.unitCost*(1+p.markup);qeD.items[i].itemId=p.id;qeD.items[i].desc=p.name;qeD.items[i].unitPrice=price;document.getElementById('ac-drop-'+i).style.display='none';setTimeout(()=>renderQEItems(),50);}
function acSelectCustom(i,desc){qeD.items[i].itemId='';qeD.items[i].desc=desc;document.getElementById('ac-drop-'+i).style.display='none';renderQEItems();setTimeout(()=>{const pr=document.getElementById('li-price-'+i);if(pr)pr.select();},60);}
function acKeydown(event,i){const drop=document.getElementById('ac-drop-'+i);if(!drop||drop.style.display==='none')return;const items=drop.querySelectorAll('.ac-item');if(!items.length)return;let active=drop.querySelector('.ac-active'),idx=Array.from(items).indexOf(active);if(event.key==='ArrowDown'){event.preventDefault();idx=Math.min(idx+1,items.length-1);}else if(event.key==='ArrowUp'){event.preventDefault();idx=Math.max(idx-1,0);}else if(event.key==='Enter'&&active){event.preventDefault();active.click();return;}else if(event.key==='Escape'){drop.style.display='none';return;}else return;items.forEach(el=>el.classList.remove('ac-active'));if(idx>=0){items[idx].classList.add('ac-active');items[idx].scrollIntoView({block:'nearest'});}}
document.addEventListener('click',e=>{if(!e.target.closest('.lir'))document.querySelectorAll('.ac-dropdown').forEach(d=>d.style.display='none');});
function addLI(){qeD.items.push({itemId:'',desc:'',qty:1,unitPrice:0,discount:0});renderQEItems();}
function removeLI(i){qeD.items.splice(i,1);renderQEItems();}
function liFC(i,f,val){if(!qeD.items[i])return;qeD.items[i][f]=val;const lt=qeD.items[i].unitPrice*(qeD.items[i].qty||1)*(1-(qeD.items[i].discount||0));const totEl=document.getElementById('li-tot-'+i);if(totEl)totEl.textContent=fmt(lt);}
function renderQE3(body){
  collectQE(qeStep);const q=qeD,tots=calcTotals(q),cu=getCust(q.customerId);
  const mc=tots.margin<DB.settings.minMargin?'var(--E)':tots.margin<DB.settings.warnMargin?'#E65100':'var(--S)';
  body.innerHTML=`<div style="background:var(--su2);border-radius:12px;padding:16px;margin-bottom:14px"><div style="font-size:12px;color:var(--t2)">Grand Total</div><div style="font-size:28px;font-weight:800;color:var(--P);line-height:1">${fmt(tots.total)}</div><div style="font-size:13px;color:${mc};margin-top:5px">Margin: ${Math.round(tots.margin*100)}%${tots.margin<DB.settings.minMargin?' ⚠ Below minimum':''}</div></div>
  <div class="db2" style="margin:0 0 12px"><div class="dr"><span class="dk">Quote ID</span><span class="dv">${esc(q.id)}</span></div><div class="dr"><span class="dk">Customer</span><span class="dv">${esc(cu?.company||'—')}</span></div><div class="dr"><span class="dk">Status</span><span class="dv"><span class="${chipCls(q.status)}">${q.status}</span></span></div><div class="dr"><span class="dk">Valid Until</span><span class="dv">${fmtDate(q.validUntil)}</span></div><div class="dr"><span class="dk">Items</span><span class="dv">${(q.items||[]).length} line item(s)</span></div></div>
  <div class="tots"><div class="tr2"><span class="tk">Subtotal</span><span class="tv">${fmt(tots.sub)}</span></div>${tots.discAmt>0?`<div class="tr2"><span class="tk">Discount</span><span class="tv" style="color:var(--S)">−${fmt(tots.discAmt)}</span></div>`:''}<div class="tr2"><span class="tk">Net</span><span class="tv">${fmt(tots.net)}</span></div><div class="tr2"><span class="tk">${q.taxable?DB.settings.taxLabel:'Tax Exempt'}</span><span class="tv">${q.taxable?fmt(tots.taxAmt):'—'}</span></div><div class="tr2 grand"><span class="tk">Grand Total</span><span class="tv">${fmt(tots.total)}</span></div></div>
  <div class="fg" style="margin-top:14px"><label class="fl">Notes</label><textarea class="fi" id="qe-notes">${esc(q.notes||'')}</textarea></div>`;
}
function collectQE(step){
  if(step===0){qeD.date=v('qe-date')||qeD.date;qeD.validUntil=v('qe-valid')||qeD.validUntil;qeD.status=v('qe-status')||qeD.status;qeD.salespersonId=v('qe-sp');qeD.companyId=v('qe-co')||qeD.companyId;qeD.version=v('qe-ver')||qeD.version;qeD.discount=(parseFloat(v('qe-disc'))||0)/100;qeD.taxable=!!document.getElementById('qe-tax')?.classList.contains('on');qeD.revision=v('qe-rev');}
  if(step===1){qeD.customerId=v('qe-cust')||qeD.customerId;}
  if(step===3){qeD.notes=v('qe-notes');}
}
function qeNext(){collectQE(qeStep);if(qeStep===3){qeSave();return;}if(qeStep===1&&!qeD.customerId){snack('Please select a customer first');return;}qeStep++;renderQEStep();}
function qeBack(){collectQE(qeStep);if(qeStep>0){qeStep--;renderQEStep();}}
function qeSave(){
  collectQE(qeStep);
  if(!qeD.customerId){snack('Please select a customer');qeStep=1;renderQEStep();return;}
  if(!qeD.items||!qeD.items.length){snack('Add at least one item');qeStep=2;renderQEStep();return;}
  const idx=DB.quotes.findIndex(q=>q.id===qeD.id);
  if(idx>=0)DB.quotes[idx]=qeD;else DB.quotes.unshift(qeD);
  if(qeD.status==='Won')updateLTV(qeD.customerId);
  save();closeDlg('dlg-qe');renderPage(curPage);snack(qeD.id+' saved ✓');updateNavBadges();
  setTimeout(()=>openQD(qeD.id),360);
}

// ── ANALYTICS ───────────────────────────────────────────
function openAnalytics(){
  const qs=acoQuotes(),sps=acoSP(),custs=acoCusts();
  const won=qs.filter(q=>q.status==='Won'),sent=qs.filter(q=>q.status==='Sent'),lost=qs.filter(q=>q.status==='Lost');
  const total=qs.length,winRate=total>0?Math.round(won.length/total*100):0;
  const avgDeal=won.length>0?won.reduce((s,q)=>s+calcTotals(q).total,0)/won.length:0;
  const pipeline=sent.reduce((s,q)=>s+calcTotals(q).total,0);
  const avgMargin=won.length>0?won.reduce((s,q)=>s+calcTotals(q).margin,0)/won.length:0;
  const custRev=custs.map(c=>{const cw=won.filter(q=>q.customerId===c.id);return{name:c.company,rev:cw.reduce((s,q)=>s+calcTotals(q).total,0),n:cw.length};}).filter(x=>x.rev>0).sort((a,b)=>b.rev-a.rev).slice(0,5);
  const spPerf=sps.map(sp=>{const sq=qs.filter(q=>q.salespersonId===sp.id);const sw=sq.filter(q=>q.status==='Won');return{name:sp.name,total:sq.length,won:sw.length,rev:sw.reduce((s,q)=>s+calcTotals(q).total,0),rate:sq.length>0?Math.round(sw.length/sq.length*100):0};}).sort((a,b)=>b.rev-a.rev);
  document.getElementById('analytics-body').innerHTML=`
  <div class="met" style="grid-template-columns:1fr 1fr"><div class="mc bl"><div class="mv">${winRate}%</div><div class="mlb">Win Rate</div></div><div class="mc gr"><div class="mv" style="font-size:16px">${fmtCompact(avgDeal)}</div><div class="mlb">Avg Deal</div></div><div class="mc or"><div class="mv" style="font-size:16px">${fmtCompact(pipeline)}</div><div class="mlb">Pipeline</div></div><div class="mc"><div class="mv">${Math.round(avgMargin*100)}%</div><div class="mlb">Avg Margin</div></div></div>
  <div class="st">Quote Funnel</div>
  <div style="margin:0 16px;background:var(--su);border-radius:12px;padding:14px 16px;box-shadow:var(--sh)">
    ${[['Draft',qs.filter(q=>q.status==='Draft').length,'#4285F4'],['Sent',sent.length,'#F9AB00'],['Won',won.length,'#34A853'],['Lost',lost.length,'#EA4335'],['Expired',qs.filter(q=>q.status==='Expired').length,'#9AA0A6']].map(([s,n,c])=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--ol2)"><div style="display:flex;align-items:center;gap:8px"><span class="cdot" style="background:${c}"></span><span style="font-size:14px;font-weight:600">${s}</span></div><div style="display:flex;align-items:center;gap:10px"><div style="width:80px;height:6px;background:var(--ol2);border-radius:3px"><div style="height:100%;border-radius:3px;background:${c};width:${total?Math.round(n/total*100):0}%"></div></div><span style="font-size:13px;font-weight:700;min-width:20px;text-align:right">${n}</span></div></div>`).join('')}
  </div>
  ${spPerf.length?`<div class="st">Salesperson Performance</div><div style="margin:0 16px;background:var(--su);border-radius:12px;box-shadow:var(--sh);overflow:hidden">${spPerf.map(sp=>`<div style="padding:12px 16px;border-bottom:1px solid var(--ol2)"><div style="display:flex;justify-content:space-between"><div style="font-size:14px;font-weight:700">${esc(sp.name)}</div><div style="font-size:13px;font-weight:700;color:var(--P)">${fmtCompact(sp.rev)}</div></div><div style="font-size:12px;color:var(--t2);margin-top:3px">${sp.total} quotes · ${sp.won} won · ${sp.rate}% win rate</div></div>`).join('')}</div>`:''}
  ${custRev.length?`<div class="st">Top Customers by Revenue</div><div style="margin:0 16px;background:var(--su);border-radius:12px;box-shadow:var(--sh);overflow:hidden">${custRev.map((c,i)=>`<div style="padding:12px 16px;border-bottom:1px solid var(--ol2);display:flex;gap:12px;align-items:center"><div style="font-size:16px;font-weight:900;color:var(--t3);width:20px">${i+1}</div><div style="flex:1"><div style="font-size:14px;font-weight:700">${esc(c.name)}</div><div style="font-size:12px;color:var(--t2)">${c.n} deal${c.n!==1?'s':''} won</div></div><div style="font-size:14px;font-weight:700;color:var(--P)">${fmt(c.rev)}</div></div>`).join('')}</div>`:''}
  <div class="sp"></div>`;
  openDlg('dlg-analytics');
}

// ── PDF / PREVIEW ────────────────────────────────────────
function numberToWords(n){
  const ones=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  if(n===0)return'Zero';
  function conv(n){if(n<20)return ones[n];if(n<100)return tens[Math.floor(n/10)]+(n%10?' '+ones[n%10]:'');return ones[Math.floor(n/100)]+' Hundred'+(n%100?' '+conv(n%100):'');}
  const m=Math.floor(n/1000000),th=Math.floor((n%1000000)/1000),rem=n%1000;
  let r='';if(m)r+=conv(m)+' Million ';if(th)r+=conv(th)+' Thousand ';if(rem)r+=conv(rem);return r.trim();
}
function amountInWords(total){
  const s=DB.settings.currencySymbol||'KSh';const int=Math.floor(total),cents=Math.round((total-int)*100);
  let w=s+' '+numberToWords(int)+' Only';if(cents>0)w+=' and '+numberToWords(cents)+' Cents';return w;
}

function openPreview(qid){curQID=qid;buildPreview(qid);openDlg('dlg-prev');}

function buildPreview(qid){
  const q=DB.quotes.find(x=>x.id===qid);if(!q)return;
  const co=getCo(q.companyId)||activeCo(),cu=getCust(q.customerId),sp=getSP(q.salespersonId),tots=calcTotals(q);
  const acc=ACCENTS.find(a=>a.name===DB.settings.accentName)||ACCENTS[0];
  const ac=acc.lc;
  const sym2=DB.settings.currencySymbol||'KSh';
  const fmtN=n=>Number(n||0).toLocaleString('en-KE',{minimumFractionDigits:2,maximumFractionDigits:2});
  const logoHTML=co?.logoImg?`<div class="qv-logo-img"><img src="${co.logoImg}" alt="logo"></div>`:`<div class="qv-logo-img" style="background:${co?.logoColor||ac}">${esc(co?.logoText||'A')}</div>`;
  const rows=(q.items||[]).map((li,i)=>{const lt=li.unitPrice*(li.qty||1)*(1-(li.discount||0));return`<tr><td>${i+1}.</td><td><div class="qv-tbl-desc">${esc(li.desc||li.itemId)}</div></td><td>${li.qty||1}</td><td>${fmtN(li.unitPrice)}</td><td>${li.discount?'−'+Math.round(li.discount*100)+'%':'—'}</td><td>${fmtN(lt)}</td></tr>`;}).join('');
  const pmHTML=(co?.paymentMethods||[]).map(pm=>{if(pm.type==='Bank')return`<div class="qv-pay-block"><div class="qv-pay-type" style="color:${ac}">BANK TRANSFER</div>${pm.bankName?`<div class="qv-pay-row">Bank: <b>${esc(pm.bankName)}</b></div>`:''} ${pm.branch?`<div class="qv-pay-row">Branch: <b>${esc(pm.branch)}</b></div>`:''} ${pm.accName?`<div class="qv-pay-row">Account: <b>${esc(pm.accName)}</b></div>`:''} ${pm.accNum?`<div class="qv-pay-row">A/C No: <b>${esc(pm.accNum)}</b></div>`:''} ${pm.swift?`<div class="qv-pay-row">SWIFT: <b>${esc(pm.swift)}</b></div>`:''}</div>`;if(pm.type==='M-Pesa')return`<div class="qv-pay-block"><div class="qv-pay-type" style="color:#4CAF50">M-PESA</div>${pm.paybillBusiness?`<div class="qv-pay-row">Paybill: <b>${esc(pm.paybillBusiness)}</b></div>`:''} ${pm.paybillAccount?`<div class="qv-pay-row">Account: <b>${esc(pm.paybillAccount)}</b></div>`:''} ${pm.tillNumber?`<div class="qv-pay-row">Till No: <b>${esc(pm.tillNumber)}</b></div>`:''} ${pm.mpesaName?`<div class="qv-pay-row">Name: <b>${esc(pm.mpesaName)}</b></div>`:''}</div>`;return`<div class="qv-pay-block"><div class="qv-pay-type">${esc(pm.type)}</div><div class="qv-pay-row">${esc(pm.details||'')}</div></div>`;}).join('');
  const termsHTML=(co?.terms||'').split('\n').filter(t=>t.trim()).map((t,i)=>`<div style="display:flex;gap:8px;margin-bottom:4px"><span style="font-size:8pt;color:${ac};font-weight:700;flex-shrink:0;min-width:16px;line-height:1.7">${i+1}.</span><span style="font-size:8pt;color:#555;line-height:1.7">${esc(t.replace(/^\d+\.\s*/,''))}</span></div>`).join('');
  const watermark={Won:'ACCEPTED',Lost:'DECLINED',Draft:'DRAFT'}[q.status]||'';
  const docEl=document.getElementById('prev-doc');
  docEl.innerHTML=`
    ${watermark?`<div class="qv-wm">${watermark}</div>`:''}
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">
      <div><div class="qv-title" style="color:${ac}">${q.isInvoice?'Invoice':'Quotation'}</div>
        <div class="qv-meta">${q.isInvoice?'Invoice':'Quotation'} # <b>${esc(q.isInvoice?q.invoiceId:q.id)}</b><br>Date <b>${fmtDate(q.isInvoice?q.invoiceDate:q.date)}</b><br>Valid Until <b>${fmtDate(q.validUntil)}</b></div></div>
      <div class="qv-logo-box">${logoHTML}<div><div class="qv-co-name">${esc(co?.name||'Your Company')}</div><div class="qv-co-tag">${esc(co?.tagline||'')}</div></div></div>
    </div>
    <div class="qv-boxes">
      <div class="qv-box"><div class="qv-box-lbl">Quotation by</div><div class="qv-box-row"><span class="qv-box-key">Name</span><span class="qv-box-val"><b>${esc(co?.name||'')}</b></span></div><div class="qv-box-row"><span class="qv-box-key">Address</span><span class="qv-box-val">${esc((co?.address||'').replace(/\n/g,', '))}</span></div><div class="qv-box-row"><span class="qv-box-key">Phone</span><span class="qv-box-val">${esc(co?.phone||'—')}</span></div><div class="qv-box-row"><span class="qv-box-key">Email</span><span class="qv-box-val">${esc(co?.email||'—')}</span></div>${co?.taxPin?`<div class="qv-box-row"><span class="qv-box-key">KRA PIN</span><span class="qv-box-val">${esc(co.taxPin)}</span></div>`:''}</div>
      <div class="qv-box"><div class="qv-box-lbl">Quotation to</div><div class="qv-box-row"><span class="qv-box-key">Name</span><span class="qv-box-val"><b>${esc(cu?.company||'—')}</b></span></div><div class="qv-box-row"><span class="qv-box-key">Contact</span><span class="qv-box-val">${esc(cu?.contact||'—')}</span></div><div class="qv-box-row"><span class="qv-box-key">Address</span><span class="qv-box-val">${esc((cu?.address||'—').replace(/\n/g,', '))}</span></div><div class="qv-box-row"><span class="qv-box-key">Phone</span><span class="qv-box-val">${esc(cu?.phone||'—')}</span></div><div class="qv-box-row"><span class="qv-box-key">Email</span><span class="qv-box-val">${esc(cu?.email||'—')}</span></div>${cu?.taxPin?`<div class="qv-box-row"><span class="qv-box-key">KRA PIN</span><span class="qv-box-val">${esc(cu.taxPin)}</span></div>`:''}</div>
    </div>
    <div class="qv-meta-row"><span>Sales Rep: <b>${esc(sp?.name||'—')}</b>${sp?.phone?' | '+esc(sp.phone):''}${sp?.email?' | '+esc(sp.email):''}</span><span>Payment Terms: <b>${esc(co?.paymentTerms||'Net 30')}</b></span></div>
    <table class="qv-tbl"><thead><tr><th style="width:22px">#</th><th>Description</th><th style="width:44px;text-align:center">Qty</th><th style="width:100px;text-align:right">Rate (${esc(sym2)})</th><th style="width:46px;text-align:right">Disc</th><th style="width:105px;text-align:right">Amount (${esc(sym2)})</th></tr></thead><tbody>${rows}</tbody></table>
    <div id="qv-block-1" class="qv-breakable">
      <div class="qv-bottom">
        <div>${termsHTML?`<div class="qv-terms-title" style="color:${ac}">Terms and Conditions</div>${termsHTML}`:''}</div>
        <div class="qv-tot-wrap">
          <div class="qv-tr"><span class="qv-tk">Sub Total</span><span class="qv-tv">${fmt(tots.sub)}</span></div>
          ${tots.discAmt>0?`<div class="qv-tr disc"><span class="qv-tk">Discount${q.discount?'('+Math.round(q.discount*100)+'%)':''}</span><span>−${fmt(tots.discAmt)}</span></div>`:''}
          <div class="qv-tr"><span class="qv-tk">Net Amount</span><span class="qv-tv">${fmt(tots.net)}</span></div>
          <div class="qv-tr"><span class="qv-tk">${q.taxable?DB.settings.taxLabel+' ('+Math.round((DB.settings.taxRate||.16)*100)+'%)':'Tax Exempt'}</span><span class="qv-tv">${q.taxable?fmt(tots.taxAmt):'—'}</span></div>
          <div class="qv-tr grand-row"><span class="qv-tk">Total</span><span class="qv-tv" style="font-size:13pt;font-weight:900">${fmt(tots.total)}</span></div>
          <div class="qv-words-lbl">Invoice Total (in words)</div><div class="qv-words">${amountInWords(tots.total)}</div>
        </div>
      </div>
    </div>
    <div id="qv-block-2" class="qv-breakable">
      ${q.notes?`<div style="margin-top:10px"><div class="qv-notes-title" style="color:${ac}">Additional Notes</div><div class="qv-notes-text">${esc(q.notes).replace(/\n/g,'<br>')}</div></div>`:''}
      <div class="qv-contact-line" style="margin-top:8px">For enquiries, email <a href="mailto:${esc(co?.email||'')}" style="color:${ac}">${esc(co?.email||'')}</a>${co?.phone?' or call <b>'+esc(co.phone)+'</b>':''}</div>
      ${(co?.paymentMethods||[]).length?`<div class="qv-pay-footer"><div class="qv-pay-title">Payment Details</div><div class="qv-pay-grid">${pmHTML}</div></div>`:''}
      <div class="qv-sig-area"><div class="qv-sig-block">
        ${sp?.signatureImg?`<div style="height:60px;display:flex;align-items:flex-end;justify-content:center;margin-bottom:4px"><img src="${sp.signatureImg}" style="max-height:56px;max-width:180px;object-fit:contain" alt="sig"></div><div style="border-bottom:1.5px solid #BBB;margin-bottom:5px"></div>`:`<div class="qv-sig-line"></div>`}
        <div class="qv-sig-lbl">Authorized Signature</div><div class="qv-sig-name">${esc(sp?.name||co?.name||'')}</div>
      </div></div>
    </div>`;
  const b1El=docEl.querySelector('#qv-block-1'),b2El=docEl.querySelector('#qv-block-2');
  window._previewAccent=ac;
  const clone=docEl.cloneNode(true);
  const cb1=clone.querySelector('#qv-block-1'),cb2=clone.querySelector('#qv-block-2');
  if(cb1)cb1.remove();if(cb2)cb2.remove();
  window._previewAbove=clone.innerHTML;
  window._previewBlock1=b1El?b1El.outerHTML:'';
  window._previewBlock2=b2El?b2El.outerHTML:'';
  window._previewHTML=docEl.innerHTML;
  setTimeout(()=>renderPreviewPage(),60);
}

const A4_W=760,A4_H=1074,M=40;
let _renderLock=false;

function iframeCSS(ac){
  return`<style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}html,body{font-family:'Inter',ui-sans-serif,-apple-system,sans-serif;font-size:10pt;color:#111;background:#fff;-webkit-font-smoothing:antialiased}
  .qv-title{font-size:22pt;font-weight:900;color:${ac};margin-bottom:6px;line-height:1}.qv-meta{font-size:9pt;color:#555;line-height:1.9}.qv-meta b{color:#111}
  .qv-logo-box{display:flex;align-items:center;gap:10px}.qv-logo-img{width:48px;height:48px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px;font-weight:900;overflow:hidden;flex-shrink:0}.qv-logo-img img{width:100%;height:100%;object-fit:cover}
  .qv-co-name{font-size:14pt;font-weight:900;color:#111;letter-spacing:-.3px;line-height:1.1}.qv-co-tag{font-size:8pt;color:#777;margin-top:2px}
  .qv-boxes{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:18px 0}.qv-box{border:1px solid #E0E0E0;border-radius:6px;padding:12px 14px;background:#FAFAFA}
  .qv-box-lbl{font-size:8pt;color:#999;font-weight:600;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px}.qv-box-row{display:flex;gap:10px;margin-bottom:3px}.qv-box-key{font-size:8.5pt;color:#888;min-width:60px;flex-shrink:0}.qv-box-val{font-size:8.5pt;color:#111;font-weight:500;line-height:1.5}
  .qv-meta-row{display:flex;justify-content:space-between;font-size:8.5pt;color:#666;padding:6px 0;border-top:1px solid #EEE;border-bottom:1px solid #EEE;margin-bottom:16px}.qv-meta-row b{color:#111}
  .qv-tbl{width:100%;border-collapse:collapse}.qv-tbl thead tr{background:${ac}}.qv-tbl th{color:#fff;padding:6px 10px;font-size:8.5pt;font-weight:700;text-align:left;white-space:nowrap}.qv-tbl th:nth-child(n+3){text-align:right}.qv-tbl th:nth-child(3){text-align:center}
  .qv-tbl td{padding:6px 10px;font-size:9pt;border-bottom:1px solid #F0F0F0;vertical-align:middle}.qv-tbl tr:nth-child(even) td{background:#FAFAFA}.qv-tbl td:nth-child(1){color:#888;font-size:8pt;width:28px}.qv-tbl td:nth-child(3){text-align:center}.qv-tbl td:nth-child(n+4){text-align:right}.qv-tbl td:last-child{font-weight:700}.qv-tbl-desc{font-weight:600;color:#111}
  .qv-bottom{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:16px}.qv-terms-title,.qv-notes-title{font-size:10pt;font-weight:700;color:${ac};margin-bottom:8px}.qv-notes-text{font-size:8pt;color:#666;line-height:1.7}.qv-contact-line{font-size:8pt;color:#555;margin-top:10px;line-height:1.7}.qv-contact-line a{color:${ac};font-weight:600}
  .qv-tr{display:flex;justify-content:space-between;padding:5px 0;font-size:9.5pt;border-bottom:1px solid #F0F0F0}.qv-tr:last-child{border-bottom:none}.qv-tr.disc span:last-child{color:#E53935;font-weight:600}
  .qv-tr.grand-row{border-top:1.5px solid #E0E0E0;border-bottom:none;margin-top:6px;padding-top:8px}.qv-tr.grand-row .qv-tk{font-size:12pt;font-weight:700;color:#111}.qv-tr.grand-row .qv-tv{font-size:13pt;font-weight:900;color:#111}
  .qv-tk{color:#555;font-size:9pt}.qv-tv{font-weight:600;color:#111}.qv-words-lbl{font-size:8pt;color:#999;margin-top:8px;margin-bottom:2px}.qv-words{font-size:8.5pt;color:#333;font-weight:500;font-style:italic;line-height:1.5}
  .qv-sig-area{margin-top:24px;display:flex;justify-content:flex-end}.qv-sig-block{text-align:center;min-width:180px}.qv-sig-line{border-bottom:1.5px solid #BBB;margin-bottom:5px;height:36px}.qv-sig-lbl{font-size:8pt;color:#777}.qv-sig-name{font-size:8.5pt;font-weight:600;color:#333;margin-top:2px}
  .qv-wm{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:60pt;font-weight:900;opacity:.05;pointer-events:none;color:${ac};white-space:nowrap;text-transform:uppercase;letter-spacing:6px}
  .qv-pay-footer{border-top:1px solid #E8E8E8;margin-top:20px;padding-top:14px}.qv-pay-title{font-size:9pt;font-weight:700;color:#444;margin-bottom:8px}.qv-pay-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .qv-pay-type{font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:${ac};margin-bottom:4px}.qv-pay-row{font-size:8pt;color:#555;line-height:1.8}.qv-pay-row b{color:#222}</style>`;
}
function makePgDoc(content,ac){return`<!DOCTYPE html><html><head><meta charset="utf-8">${iframeCSS(ac)}<style>html,body{overflow:hidden}</style></head><body style="margin:0;padding:${M}px;width:${A4_W}px;box-sizing:border-box;background:#fff;position:relative">${content}</body></html>`;}
function measureH(content,ac){
  return new Promise(resolve=>{
    const ifr=document.createElement('iframe');
    ifr.style.cssText=`position:fixed;top:0;left:0;width:${A4_W-M*2}px;height:5000px;border:none;opacity:0;pointer-events:none;z-index:-1`;
    document.body.appendChild(ifr);const d=ifr.contentDocument;d.open();
    d.write(`<!DOCTYPE html><html><head><meta charset="utf-8">${iframeCSS(ac)}</head><body style="margin:0;padding:0;width:${A4_W-M*2}px;box-sizing:border-box">${content}</body></html>`);d.close();
    let tries=0,last=0;const t=setInterval(()=>{const h=d.body.scrollHeight;if((h===last&&h>0)||++tries>30){clearInterval(t);document.body.removeChild(ifr);resolve(h);}last=h;},80);
  });
}
function writeIframe(ifr,content,ac){const d=ifr.contentDocument;d.open();d.write(makePgDoc(content,ac));d.close();}

async function renderPreviewPage(){
  if(_renderLock)return;_renderLock=true;
  const above=window._previewAbove||'',block1=window._previewBlock1||'',block2=window._previewBlock2||'',ac=window._previewAccent||'#1A73E8';
  const outer=document.getElementById('prev-outer');
  if(!above||!outer){_renderLock=false;return;}
  outer.querySelectorAll('.prev-iframe-wrap').forEach(el=>el.remove());
  const avail=Math.max(outer.clientWidth-4,100),ss=Math.min(avail/A4_W,1);
  const vW=Math.round(A4_W*ss),vH=Math.round(A4_H*ss);
  const loader=document.createElement('div');
  loader.className='prev-iframe-wrap';loader.style.cssText=`width:${vW}px;height:${vH}px;background:#f5f5f5;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:13px;flex-shrink:0`;
  loader.innerHTML='<div style="text-align:center"><div style="width:24px;height:24px;border:3px solid #ddd;border-top-color:#aaa;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 8px"></div>Loading…</div>';
  outer.appendChild(loader);
  try{
    const aboveH=await measureH(above,ac);const b1H=block1?await measureH(block1,ac):0;const b2H=block2?await measureH(block2,ac):0;
    const USABLE=A4_H-M*2,allH=aboveH+b1H+b2H,p1H=aboveH+b1H;
    let pages;if(allH<=USABLE)pages=[above+block1+block2];else if(p1H<=USABLE)pages=[above+block1,block2];else pages=[above,block1+block2];
    loader.remove();
    pages.forEach(content=>{
      const wrap=document.createElement('div');wrap.className='prev-iframe-wrap';wrap.style.cssText=`width:${vW}px;height:${vH}px;overflow:hidden;flex-shrink:0`;
      const ifr=document.createElement('iframe');ifr.scrolling='no';ifr.style.cssText=`width:${A4_W}px;height:${A4_H}px;border:none;display:block;transform:scale(${ss});transform-origin:top left`;
      wrap.appendChild(ifr);outer.appendChild(wrap);writeIframe(ifr,content,ac);
    });
    window._previewPagesArr=pages;window._previewAccentUsed=ac;
  }catch(e){console.error('Preview:',e);loader.textContent='Preview failed';}
  finally{_renderLock=false;}
}
window.addEventListener('resize',()=>{if(window._previewHTML)renderPreviewPage();});

function buildFileName(q){const cu=getCust(q.customerId);const nm=(cu?.company||'Client').replace(/[^\w\s-]/g,'').replace(/\s+/g,'-');const ver=DB.settings.dlIncludeVersion!==false&&q.version?'_v'+q.version:'';return`${nm}_${q.isInvoice?q.invoiceId:q.id}${ver}.pdf`;}

async function doPDF(){
  if(!window.jspdf||!window.html2canvas){snack('PDF library loading, try again');return;}
  const q=DB.quotes.find(x=>x.id===curQID);if(!q)return;
  const btn=document.querySelector('#dlg-prev .btn.bp');
  if(btn){btn.disabled=true;btn.textContent='Generating…';}
  snack('Building PDF…');
  try{
    const blob=await generatePDFBlob();if(!blob)throw new Error('no blob');
    const fname=buildFileName(q);const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=fname;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),10000);snack('Saved: '+fname);
  }catch(e){console.error(e);snack('PDF failed — try again');}
  finally{if(btn){btn.disabled=false;btn.innerHTML='<span class="material-icons-round">download</span> Save PDF';}}
}

async function generatePDFBlob(){
  if(!window.jspdf||!window.html2canvas)return null;
  const pages=window._previewPagesArr;if(!pages||!pages.length)return null;
  const ac=window._previewAccentUsed||'#1A73E8';
  try{await document.fonts.ready;}catch(e){}
  const{jsPDF}=window.jspdf;const pdf=new jsPDF({orientation:'p',unit:'mm',format:'a4'});
  for(let p=0;p<pages.length;p++){
    if(p>0)pdf.addPage();
    snack(`Page ${p+1} of ${pages.length}…`);
    const ifr=document.createElement('iframe');
    ifr.style.cssText=`position:fixed;top:0;left:0;width:${A4_W}px;height:${A4_H}px;border:none;opacity:0;pointer-events:none;z-index:-1`;
    document.body.appendChild(ifr);writeIframe(ifr,pages[p],ac);
    await new Promise(r=>setTimeout(r,500));
    try{const canvas=await html2canvas(ifr.contentDocument.body,{scale:2.5,useCORS:true,allowTaint:true,backgroundColor:'#ffffff',logging:false,width:A4_W,height:A4_H});pdf.addImage(canvas.toDataURL('image/png'),'PNG',0,0,210,297,'','FAST');}
    finally{document.body.removeChild(ifr);}
  }
  return pdf.output('blob');
}

// ── SHARE ────────────────────────────────────────────────
function openShareDialog(qid){
  curQID=qid;const q=DB.quotes.find(x=>x.id===qid);if(!q)return;
  const cu=getCust(q.customerId),tots=calcTotals(q),co=activeCo();
  document.getElementById('share-quote-label').textContent=`${q.isInvoice?q.invoiceId:q.id} — ${cu?.company||'Unknown'} — ${fmt(tots.total)}`;
  document.getElementById('share-body').innerHTML=`
    <div class="si" onclick="copyQuoteText('${qid}');closeDlg('dlg-share')"><div class="si-ic"><span class="material-icons-round">content_copy</span></div><div class="si-tx"><div class="si-m">Copy Summary Text</div><div class="si-s">Plain text for messages</div></div></div>
    ${cu?.email?`<div class="si" onclick="mailQuote('${qid}')"><div class="si-ic"><span class="material-icons-round">email</span></div><div class="si-tx"><div class="si-m">Draft Email</div><div class="si-s">${esc(cu.email)}</div></div></div>`:''}
    ${navigator.share?`<div class="si" onclick="nativeShare('${qid}')"><div class="si-ic"><span class="material-icons-round">ios_share</span></div><div class="si-tx"><div class="si-m">Share via…</div><div class="si-s">WhatsApp, Telegram, etc.</div></div></div>`:''}`;
  document.getElementById('share-progress').style.display='none';
  openDlg('dlg-share');
}
function copyQuoteText(qid){const q=DB.quotes.find(x=>x.id===qid);if(!q)return;const cu=getCust(q.customerId),tots=calcTotals(q),co=activeCo();const text=`*Quotation ${q.isInvoice?q.invoiceId:q.id}*\nFrom: ${co?.name||''}\nTo: ${cu?.company||''} (${cu?.contact||''})\nAmount: ${fmt(tots.total)}\nValid until: ${fmtDate(q.validUntil)}\nContact: ${co?.email||''} ${co?.phone||''}`;navigator.clipboard?.writeText(text).then(()=>snack('Copied to clipboard')).catch(()=>snack('Copy failed'));}
function mailQuote(qid){const q=DB.quotes.find(x=>x.id===qid);if(!q)return;const cu=getCust(q.customerId),tots=calcTotals(q),co=activeCo();const s=encodeURIComponent(`Quotation ${q.isInvoice?q.invoiceId:q.id} — ${cu?.company||''}`);const b=encodeURIComponent(`Dear ${cu?.contact||'Sir/Madam'},\n\nPlease find our quotation ${q.isInvoice?q.invoiceId:q.id} amounting to ${fmt(tots.total)} valid until ${fmtDate(q.validUntil)}.\n\nRegards,\n${co?.name||''}`);window.location.href=`mailto:${cu?.email||''}?subject=${s}&body=${b}`;}
async function nativeShare(qid){const q=DB.quotes.find(x=>x.id===qid);if(!q||!navigator.share)return;const cu=getCust(q.customerId),tots=calcTotals(q);try{await navigator.share({title:`Quotation ${q.isInvoice?q.invoiceId:q.id}`,text:`Quote for ${cu?.company||''}: ${fmt(tots.total)} valid until ${fmtDate(q.validUntil)}`});}catch(e){}}
async function doGeneratePDFAndShare(){
  const q=DB.quotes.find(x=>x.id===curQID);if(!q)return;
  const prog=document.getElementById('share-progress');prog.style.display='block';document.getElementById('share-progress-msg').textContent='Generating PDF…';
  try{const blob=await generatePDFBlob();if(!blob)throw new Error('no blob');
    const fname=buildFileName(q);
    if(navigator.share&&navigator.canShare&&navigator.canShare({files:[new File([blob],fname,{type:'application/pdf'})]})){await navigator.share({files:[new File([blob],fname,{type:'application/pdf'})],title:fname});}
    else{const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=fname;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);snack('PDF saved: '+fname);}
    closeDlg('dlg-share');
  }catch(e){console.error(e);snack('PDF generation failed');}
  finally{prog.style.display='none';}
}

// ── INVENTORY ────────────────────────────────────────────
function renderInvFilterBar(){
  const fbar=document.getElementById('inv-fbar');if(!fbar)return;
  const cats=getCategories();
  fbar.innerHTML=[`<button class="fc${invF==='all'?' on':''}" data-cat="all">All</button>`,...cats.map(c=>`<button class="fc${invF===c?' on':''}" data-cat="${esc(c)}">${esc(c)}</button>`)].join('');
  fbar.querySelectorAll('button[data-cat]').forEach(btn=>btn.addEventListener('click',()=>{invF=btn.dataset.cat;renderInv();}));
}
function renderInv(){
  renderInvFilterBar();
  const srch=(document.getElementById('inv-srch')||{}).value?.toLowerCase()||'';
  let list=acoInv();
  if(invF!=='all')list=list.filter(i=>i.category===invF);
  if(srch)list=list.filter(i=>i.name.toLowerCase().includes(srch)||(i.id||'').toLowerCase().includes(srch)||(i.description||'').toLowerCase().includes(srch));
  const el=document.getElementById('inv-list');
  el.innerHTML=list.length?list.map(p=>`<div class="ii" onclick="openInvEd('${p.id}')"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px"><div style="flex:1"><div style="font-size:11px;font-weight:600;color:var(--t2)">${esc(p.id)}</div><div style="font-size:15px;font-weight:700;margin-top:1px">${esc(p.name)}</div>${p.description?`<div style="font-size:12px;color:var(--t2);margin-top:2px">${esc(p.description)}</div>`:''}</div><span style="background:var(--PC);color:var(--P);border-radius:999px;font-size:11px;padding:3px 8px;font-weight:600;flex-shrink:0">${esc(p.category||'Other')}</span></div><div style="display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:16px;font-weight:800;color:var(--P)">${fmt(p.unitCost*(1+p.markup))}</div><div style="font-size:11px;color:var(--t2)">Cost: ${fmt(p.unitCost)} · ${Math.round(p.markup*100)}% markup</div></div><button class="ib" style="color:var(--E)" onclick="event.stopPropagation();confirmAct('Delete this product?',()=>delItem('inv','${p.id}'))"><span class="material-icons-round">delete</span></button></div></div>`).join('')
    :`<div class="empty"><span class="material-icons-round">inventory_2</span><div class="empty-t">No products found</div><div class="empty-s">Add products to search them in quotes</div></div>`;
}
function openInvEd(id){
  editInvId=id;const p=id?getProd(id):null;
  document.getElementById('inv-ttl').textContent=id?'Edit Product':'New Product';
  const nid=nextId('ITM',DB.inventory);
  document.getElementById('inv-body').innerHTML=`
    <div class="fg"><label class="fl">Item ID</label><input class="fi" id="ii-id" value="${esc(p?.id||nid)}" ${id?'readonly':''}></div>
    <div class="fg"><label class="fl">Name *</label><input class="fi" id="ii-nm" value="${esc(p?.name||'')}" placeholder="Product or service name"></div>
    <div class="fg"><label class="fl">Description</label><textarea class="fi" id="ii-desc">${esc(p?.description||'')}</textarea></div>
    <div class="fg"><label class="fl">Category</label>${buildCustomSelect({id:'ii-cat',label:'Category',options:getCategories().map(c=>({value:c,label:c})),value:p?.category||getCategories()[0]})}</div>
    <div class="fr"><div class="fg"><label class="fl">Unit Cost *</label><input class="fi" type="number" id="ii-cost" value="${p?.unitCost||0}" step="0.01" min="0"></div><div class="fg"><label class="fl">Markup %</label><input class="fi" type="number" id="ii-mkup" value="${Math.round((p?.markup||.30)*100)}" min="0"></div></div>
    <div style="background:var(--su2);border-radius:8px;padding:10px 12px;font-size:13px;color:var(--t2)">Sale price = Cost × (1 + Markup%)</div>
    ${id?`<div style="margin-top:12px"><button class="btn bd2 btn-w" onclick="confirmAct('Delete this product?',()=>delItem('inv','${id}'))"><span class="material-icons-round">delete</span> Delete Product</button></div>`:''}`;
  openDlg('dlg-inv');
}
function saveInv(){
  const id=v('ii-id'),nm=v('ii-nm');if(!id||!nm){snack('ID and name required');return;}
  if(!editInvId&&DB.inventory.find(i=>i.id===id)){snack('Product ID already exists');return;}
  const item={id,name:nm,description:v('ii-desc'),category:v('ii-cat')||getCategories()[0],unitCost:parseFloat(v('ii-cost'))||0,markup:(parseFloat(v('ii-mkup'))||30)/100,companyId:(activeCo()||{}).id};
  const idx=DB.inventory.findIndex(i=>i.id===id);if(idx>=0)DB.inventory[idx]=item;else DB.inventory.push(item);
  save();closeDlg('dlg-inv');renderInv();snack('Product saved');
}

// ── CUSTOMERS ────────────────────────────────────────────
function renderCusts(){
  const srch=(document.getElementById('cust-srch')||{}).value?.toLowerCase()||'';
  let list=acoCusts().sort((a,b)=>(b.ltv||0)-(a.ltv||0));
  if(srch)list=list.filter(c=>c.company.toLowerCase().includes(srch)||(c.contact||'').toLowerCase().includes(srch)||(c.email||'').toLowerCase().includes(srch));
  const el=document.getElementById('cust-list');
  el.innerHTML=list.length?list.map(c=>`<div class="qi" style="display:flex;gap:12px;align-items:center" onclick="openCustEd('${c.id}')"><div class="av" style="width:42px;height:42px;font-size:16px;background:${avColor(c.company)}">${avLetter(c.company)}</div><div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><div style="font-size:15px;font-weight:700">${esc(c.company)}</div><span class="tier-${c.tier||'Bronze'}">${c.tier||'Bronze'}</span></div><div style="font-size:13px;color:var(--t2)">${esc(c.contact||'—')}${c.industry?' · '+esc(c.industry):''}</div><div style="font-size:12px;color:var(--t2)">${esc(c.email||'')}</div></div><div style="text-align:right;flex-shrink:0"><div style="font-size:13px;font-weight:700;color:var(--P)">${fmt(c.ltv||0)}</div><div style="font-size:10px;color:var(--t2)">Lifetime</div></div></div>`).join('')
    :`<div class="empty"><span class="material-icons-round">people</span><div class="empty-t">No customers yet</div></div>`;
}
function openCustEd(id,fromQE=false){
  editCustId=id;const c=id?getCust(id):null;
  document.getElementById('cust-ttl').textContent=id?'Edit Customer':'New Customer';
  const nid=nextId('CUS',DB.customers);
  document.getElementById('cust-body').innerHTML=`
    <div class="fg"><label class="fl">Customer ID</label><input class="fi" id="ci-id" value="${esc(c?.id||nid)}" ${id?'readonly':''}></div>
    <div class="fg"><label class="fl">Company Name *</label><input class="fi" id="ci-co" value="${esc(c?.company||'')}" placeholder="Company name"></div>
    <div class="fg"><label class="fl">Contact Person</label><input class="fi" id="ci-cnt" value="${esc(c?.contact||'')}" placeholder="Full name"></div>
    <div class="fr"><div class="fg"><label class="fl">Email</label><input class="fi" type="email" id="ci-em" value="${esc(c?.email||'')}" placeholder="email@example.com"></div><div class="fg"><label class="fl">Phone</label><input class="fi" type="tel" id="ci-ph" value="${esc(c?.phone||'')}" placeholder="+254 7xx xxx xxx"></div></div>
    <div class="fg"><label class="fl">Address</label><textarea class="fi" id="ci-addr">${esc(c?.address||'')}</textarea></div>
    <div class="fr"><div class="fg"><label class="fl">Industry</label><input class="fi" id="ci-ind" value="${esc(c?.industry||'')}" placeholder="e.g. Technology"></div><div class="fg"><label class="fl">Tier</label>${buildCustomSelect({id:'ci-tier',label:'Tier',options:['Platinum','Gold','Silver','Bronze'].map(t=>({value:t,label:t})),value:c?.tier||'Bronze'})}</div></div>
    <div class="fg"><label class="fl">KRA PIN</label><input class="fi" id="ci-pin" value="${esc(c?.taxPin||'')}" placeholder="P051234567A"></div>
    ${id?`<div style="margin-top:4px"><button class="btn bd2 btn-w" onclick="confirmAct('Delete this customer?',()=>delItem('cust','${id}'))"><span class="material-icons-round">delete</span> Delete Customer</button></div>`:''}`;
  openDlg('dlg-cust');
}
function saveCust(){
  const id=v('ci-id'),co=v('ci-co');if(!id||!co){snack('ID and company name required');return;}
  if(!editCustId&&DB.customers.find(c=>c.id===id)){snack('Customer ID already exists');return;}
  const cust={id,company:co,contact:v('ci-cnt'),email:v('ci-em'),phone:v('ci-ph'),address:v('ci-addr'),industry:v('ci-ind'),tier:v('ci-tier')||'Bronze',taxPin:v('ci-pin'),companyId:(activeCo()||{}).id,ltv:getCust(id)?.ltv||0};
  const idx=DB.customers.findIndex(c=>c.id===id);if(idx>=0)DB.customers[idx]=cust;else DB.customers.push(cust);
  save();closeDlg('dlg-cust');renderCusts();snack('Customer saved');
}

// ── COMPANY EDITOR ───────────────────────────────────────
function openCoEd(id){editCoId=id;document.getElementById('co-ttl').textContent=id?'Edit Company':'New Company Profile';buildCoForm(id?getCo(id):null);openDlg('dlg-co');}
function buildCoForm(co){
  const pms=co?.paymentMethods||[];
  document.getElementById('co-body').innerHTML=`
    <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px">
      <div id="logo-prev" onclick="document.getElementById('logo-file').click()" style="width:64px;height:64px;border-radius:10px;background:${co?.logoColor||'#1A73E8'};display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px;font-weight:900;cursor:pointer;overflow:hidden;flex-shrink:0">${co?.logoImg?`<img src="${co.logoImg}" style="width:100%;height:100%;object-fit:cover">`:(co?.logoText||'A')}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn bo btn-sm" onclick="document.getElementById('logo-file').click()"><span class="material-icons-round">upload</span> Upload Logo</button>
        <input type="file" id="logo-file" accept="image/*" style="display:none" onchange="previewLogo(this)">
        <input type="color" id="logo-col" value="${co?.logoColor||'#1A73E8'}" style="display:none" onchange="updLogoColor(this.value)">
        <button class="btn bo btn-sm" onclick="document.getElementById('logo-col').click()"><span class="material-icons-round">palette</span> Color</button>
      </div>
    </div>
    <input type="hidden" id="co-img" value="${co?.logoImg||''}">
    <div class="fr"><div class="fg"><label class="fl">Logo Initials</label><input class="fi" id="co-lt" value="${esc(co?.logoText||'A')}" maxlength="3" oninput="updLogoText(this.value)"></div><div class="fg"><label class="fl">Logo Color</label><div id="co-col-show" onclick="document.getElementById('logo-col').click()" style="height:40px;border-radius:8px;background:${co?.logoColor||'#1A73E8'};cursor:pointer;border:1.5px solid var(--ol)"></div></div></div>
    <div style="height:1px;background:var(--ol2);margin:4px 0 14px"></div>
    <div class="fg"><label class="fl">Company Name *</label><input class="fi" id="co-nm" value="${esc(co?.name||'')}" placeholder="Acme Corporation Ltd."></div>
    <div class="fg"><label class="fl">Tagline</label><input class="fi" id="co-tag" value="${esc(co?.tagline||'')}" placeholder="Enterprise Solutions"></div>
    <div class="fg"><label class="fl">Address</label><textarea class="fi" id="co-addr">${esc(co?.address||'')}</textarea></div>
    <div class="fr"><div class="fg"><label class="fl">Phone</label><input class="fi" type="tel" id="co-ph" value="${esc(co?.phone||'')}" placeholder="+254 700 000 000"></div><div class="fg"><label class="fl">Email</label><input class="fi" type="email" id="co-em" value="${esc(co?.email||'')}" placeholder="info@company.com"></div></div>
    <div class="fr"><div class="fg"><label class="fl">Website</label><input class="fi" id="co-web" value="${esc(co?.website||'')}" placeholder="www.company.com"></div><div class="fg"><label class="fl">KRA PIN</label><input class="fi" id="co-pin" value="${esc(co?.taxPin||'')}" placeholder="P051234567A"></div></div>
    <div style="height:1px;background:var(--ol2);margin:4px 0 14px"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><div class="fw7">Payment Methods</div><button class="btn btn-ton btn-sm" onclick="addPayMethod()"><span class="material-icons-round">add</span> Add</button></div>
    <div id="pm-list">${pms.map((pm,i)=>pmCardHTML(pm,i)).join('')}</div>
    <div style="height:1px;background:var(--ol2);margin:4px 0 14px"></div>
    <div class="fg"><label class="fl">Payment Terms</label>${buildCustomSelect({id:'co-pterms',label:'Payment Terms',options:['Net 7','Net 14','Net 30','Net 60','Due on Receipt','50% Upfront','COD'].map(t=>({value:t,label:t})),value:co?.paymentTerms||'Net 30'})}</div>
    <div class="fg"><label class="fl">Terms &amp; Conditions</label><textarea class="fi" id="co-tc" rows="6" placeholder="Enter standard terms…">${esc(co?.terms||'')}</textarea></div>
    ${editCoId?`<div style="margin-top:4px"><button class="btn bd2 btn-w" onclick="confirmAct('Delete company profile?',()=>{delItem('co','${editCoId}');closeDlg('dlg-co')})"><span class="material-icons-round">delete</span> Delete Profile</button></div>`:''}
    <div style="height:20px"></div>`;
  setTimeout(wirePMSelects,50);
}
function pmCardHTML(pm,i){return`<div class="pmcard" id="pm-${i}"><div class="pmhead"><span class="pm-badge" id="pm-badge-${i}">${esc(pm.type)}</span><div style="flex:1">${buildCustomSelect({id:'pm-type-'+i,label:'Type',options:['Bank','M-Pesa','Cash','Cheque','Other'].map(t=>({value:t,label:t})),value:pm.type})}</div><button class="ib" style="width:30px;height:30px;color:var(--E)" onclick="removePM(${i})"><span class="material-icons-round" style="font-size:18px">delete</span></button></div><div id="pm-fields-${i}">${pmFieldsHTML(pm,i)}</div></div>`;}
function pmFieldsHTML(pm,i){
  if(pm.type==='Bank')return`<div class="fr"><div class="fg"><label class="fl">Bank Name</label><input class="fi" id="pm-bank-${i}" value="${esc(pm.bankName||'')}" placeholder="Equity Bank Kenya"></div><div class="fg"><label class="fl">Branch</label><input class="fi" id="pm-branch-${i}" value="${esc(pm.branch||'')}" placeholder="Westlands"></div></div><div class="fr"><div class="fg"><label class="fl">Account Name</label><input class="fi" id="pm-accnm-${i}" value="${esc(pm.accName||'')}" placeholder="Company Ltd."></div><div class="fg"><label class="fl">Account No.</label><input class="fi" id="pm-accn-${i}" value="${esc(pm.accNum||'')}" placeholder="0123456789"></div></div><div class="fg"><label class="fl">SWIFT</label><input class="fi" id="pm-swift-${i}" value="${esc(pm.swift||'')}" placeholder="EQBLKENA"></div>`;
  if(pm.type==='M-Pesa')return`<div class="fr"><div class="fg"><label class="fl">Paybill No.</label><input class="fi" id="pm-pb-${i}" value="${esc(pm.paybillBusiness||'')}" placeholder="123456"></div><div class="fg"><label class="fl">Account Field</label><input class="fi" id="pm-pba-${i}" value="${esc(pm.paybillAccount||'')}" placeholder="Invoice No."></div></div><div class="fr"><div class="fg"><label class="fl">Till No. (optional)</label><input class="fi" id="pm-till-${i}" value="${esc(pm.tillNumber||'')}"></div><div class="fg"><label class="fl">M-Pesa Name</label><input class="fi" id="pm-mpnm-${i}" value="${esc(pm.mpesaName||'')}" placeholder="Company Name"></div></div>`;
  return`<div class="fg"><label class="fl">Details</label><textarea class="fi" id="pm-det-${i}">${esc(pm.details||'')}</textarea></div>`;
}
function pmTypeChange(i,type){document.getElementById('pm-badge-'+i).textContent=type;document.getElementById('pm-fields-'+i).innerHTML=pmFieldsHTML({type},i);}
function wirePMSelects(){document.querySelectorAll('[id^="pm-type-"]').forEach(sel=>{sel.addEventListener('change',function(){pmTypeChange(this.id.replace('pm-type-',''),this.value);});});}
function addPayMethod(){const list=document.getElementById('pm-list');const idx=list.querySelectorAll('.pmcard').length;const div=document.createElement('div');div.innerHTML=pmCardHTML({type:'Bank'},idx);list.appendChild(div.firstElementChild);setTimeout(wirePMSelects,50);}
function removePM(i){document.getElementById('pm-'+i)?.remove();}
function collectPMs(){return Array.from(document.querySelectorAll('#pm-list .pmcard')).map((_,i)=>{const type=document.getElementById('pm-type-'+i)?.value||'Bank';const pm={type};if(type==='Bank'){pm.bankName=document.getElementById('pm-bank-'+i)?.value||'';pm.branch=document.getElementById('pm-branch-'+i)?.value||'';pm.accName=document.getElementById('pm-accnm-'+i)?.value||'';pm.accNum=document.getElementById('pm-accn-'+i)?.value||'';pm.swift=document.getElementById('pm-swift-'+i)?.value||'';}else if(type==='M-Pesa'){pm.paybillBusiness=document.getElementById('pm-pb-'+i)?.value||'';pm.paybillAccount=document.getElementById('pm-pba-'+i)?.value||'';pm.tillNumber=document.getElementById('pm-till-'+i)?.value||'';pm.mpesaName=document.getElementById('pm-mpnm-'+i)?.value||'';}else{pm.details=document.getElementById('pm-det-'+i)?.value||'';}return pm;});}
function previewLogo(input){const file=input.files[0];if(!file)return;const r=new FileReader();r.onload=e=>{document.getElementById('co-img').value=e.target.result;document.getElementById('logo-prev').innerHTML=`<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover">`;};r.readAsDataURL(file);}
function updLogoColor(val){document.getElementById('logo-prev').style.background=val;document.getElementById('co-col-show').style.background=val;}
function updLogoText(t){if(!document.getElementById('co-img')?.value)document.getElementById('logo-prev').textContent=t;}
function saveCo(){
  const name=v('co-nm');if(!name){snack('Company name required');return;}
  const id=editCoId||'CO-'+uid().slice(0,6).toUpperCase();
  const co={id,name,tagline:v('co-tag'),address:v('co-addr'),phone:v('co-ph'),email:v('co-em'),website:v('co-web'),taxPin:v('co-pin'),paymentMethods:collectPMs(),paymentTerms:v('co-pterms'),terms:v('co-tc'),logoText:v('co-lt')||'A',logoColor:document.getElementById('logo-col')?.value||'#1A73E8',logoImg:document.getElementById('co-img')?.value||null};
  const idx=DB.companies.findIndex(c=>c.id===id);if(idx>=0)DB.companies[idx]=co;else{DB.companies.push(co);if(!DB.settings.activeCompanyId)DB.settings.activeCompanyId=id;}
  save();closeDlg('dlg-co');renderSettings();snack('Company profile saved');
}

// ── SETTINGS ─────────────────────────────────────────────
function renderSettings(){
  const cos=DB.companies;
  document.getElementById('co-list-el').innerHTML=cos.length?cos.map(co=>`<div class="si" onclick="openCoEd('${co.id}')"><div style="width:38px;height:38px;border-radius:50%;background:${co.logoColor||'#1A73E8'};display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:900;flex-shrink:0;overflow:hidden">${co.logoImg?`<img src="${co.logoImg}" style="width:100%;height:100%;object-fit:cover">`:esc(co.logoText||'A')}</div><div class="si-tx"><div class="si-m">${esc(co.name)}</div><div class="si-s">${co.id===DB.settings.activeCompanyId?'● Active':esc(co.tagline||co.id)}</div></div>${co.id===DB.settings.activeCompanyId?'<span class="material-icons-round" style="color:var(--S)">check_circle</span>':`<button class="btn bt btn-sm" onclick="event.stopPropagation();setActiveCo('${co.id}')">Activate</button>`}<span class="material-icons-round" style="color:var(--t3)">chevron_right</span></div>`).join(''):`<div class="empty" style="padding:24px"><span class="material-icons-round">business</span><div class="empty-t">No company profiles</div></div>`;
  document.getElementById('acc-sub').textContent=DB.settings.accentName;
  document.getElementById('sp-sub').textContent=acoSP().length+' members';
  document.getElementById('cat-sub').textContent=getCategories().join(', ');
  const tog=document.getElementById('dark-tog');if(tog)tog.classList.toggle('on',DB.settings.darkMode);
}
function setActiveCo(id){DB.settings.activeCompanyId=id;save();renderSettings();renderDash();snack('Active company updated');}
function openSetSheet(type){
  setType=type;const s=DB.settings;let title='',html='';
  if(type==='quote'){title='Quote Defaults';html=`<div class="fg"><label class="fl">Quote ID Prefix</label><input class="fi" id="ss-pfx" value="${esc(s.quotePrefix||'QMS-')}"></div><div class="fg"><label class="fl">Invoice ID Prefix</label><input class="fi" id="ss-invpfx" value="${esc(s.invoicePrefix||'INV-')}"></div><div class="fr"><div class="fg"><label class="fl">Valid Days</label><input class="fi" type="number" id="ss-vd" value="${s.quoteValidDays||30}"></div><div class="fg"><label class="fl">Follow-up Days</label><input class="fi" type="number" id="ss-fu" value="${s.followUpDays||7}"></div></div><div class="fr"><div class="fg"><label class="fl">Tax Rate %</label><input class="fi" type="number" id="ss-tax" value="${Math.round((s.taxRate||.16)*100)}" step=".1"></div><div class="fg"><label class="fl">Tax Label</label><input class="fi" id="ss-taxlbl" value="${esc(s.taxLabel||'VAT')}"></div></div><div class="fg"><label class="fl">Currency Symbol</label><input class="fi" id="ss-curr" value="${esc(s.currencySymbol||'KSh')}"></div>`;}
  else if(type==='margin'){title='Margin Thresholds';html=`<div class="fg"><label class="fl">Minimum Margin % (Red ⚠)</label><input class="fi" type="number" id="ss-mm" value="${Math.round((s.minMargin||.20)*100)}"></div><div class="fg"><label class="fl">Warning Margin % (Orange)</label><input class="fi" type="number" id="ss-wm" value="${Math.round((s.warnMargin||.25)*100)}"></div>`;}
  else if(type==='categories'){title='Product Categories';const cats=getCategories();html=`<div id="cat-list-ed">${cats.map((c,i)=>`<div style="display:flex;gap:8px;margin-bottom:8px;align-items:center"><input class="fi" style="flex:1" value="${esc(c)}" id="cat-item-${i}" placeholder="Category name"><button class="ib" style="color:var(--E);flex-shrink:0" onclick="this.closest('div').remove()"><span class="material-icons-round">delete</span></button></div>`).join('')}</div><button class="btn btn-ton btn-w" onclick="addCatItem()"><span class="material-icons-round">add</span> Add Category</button>`;}
  else if(type==='download'){title='Download Settings';html=`<div class="fg"><label class="fl" style="display:flex;justify-content:space-between;align-items:center">Include version in filename<button class="tog ${s.dlIncludeVersion!==false?'on':''}" id="ss-dlv" onclick="this.classList.toggle('on')"></button></label><div style="font-size:12px;color:var(--t2);margin-top:4px">e.g. ClientName_QMS-2026-001_v1.pdf</div></div>`;}
  document.getElementById('set-ttl').textContent=title;document.getElementById('set-body').innerHTML=html;openDlg('dlg-set');
}
function saveSetSheet(){
  const s=DB.settings;
  if(setType==='quote'){s.quotePrefix=v('ss-pfx')||'QMS-';s.invoicePrefix=v('ss-invpfx')||'INV-';s.quoteValidDays=parseInt(v('ss-vd'))||30;s.followUpDays=parseInt(v('ss-fu'))||7;s.taxRate=(parseFloat(v('ss-tax'))||16)/100;s.taxLabel=v('ss-taxlbl')||'VAT';s.currencySymbol=v('ss-curr')||'KSh';}
  else if(setType==='margin'){s.minMargin=(parseFloat(v('ss-mm'))||20)/100;s.warnMargin=(parseFloat(v('ss-wm'))||25)/100;}
  else if(setType==='categories'){const inputs=document.querySelectorAll('[id^="cat-item-"]');const cats=Array.from(inputs).map(el=>el.value.trim()).filter(Boolean);if(!cats.length){snack('Need at least one category');return;}s.productCategories=cats;}
  else if(setType==='download'){s.dlIncludeVersion=!!document.getElementById('ss-dlv')?.classList.contains('on');}
  save();closeDlg('dlg-set');renderSettings();snack('Settings saved');
}
function addCatItem(){const list=document.getElementById('cat-list-ed');if(!list)return;const idx=list.querySelectorAll('div').length;const row=document.createElement('div');row.style.cssText='display:flex;gap:8px;margin-bottom:8px;align-items:center';row.innerHTML=`<input class="fi" style="flex:1" value="" id="cat-item-${idx}" placeholder="Category name"><button class="ib" style="color:var(--E);flex-shrink:0" onclick="this.closest('div').remove()"><span class="material-icons-round">delete</span></button>`;list.appendChild(row);}

// ── SALES TEAM ───────────────────────────────────────────
function openSalesTeam(){renderSPList();openDlg('dlg-sp');}
function renderSPList(){
  const list=acoSP();document.getElementById('sp-sub').textContent=list.length+' members';
  document.getElementById('sp-list').innerHTML=list.length?list.map(sp=>`<div class="spc" onclick="openSpEd('${sp.id}')"><div class="av" style="width:42px;height:42px;font-size:16px;background:${avColor(sp.name)}">${avLetter(sp.name)}</div><div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:700">${esc(sp.name)}</div><div style="font-size:12px;color:var(--t2)">${esc(sp.title||'—')}</div><div style="font-size:12px;color:var(--t2)">${esc(sp.email||'')}${sp.phone?' · '+esc(sp.phone):''}</div></div><span class="material-icons-round" style="color:var(--t2)">chevron_right</span></div>`).join(''):`<div class="empty"><span class="material-icons-round">badge</span><div class="empty-t">No salespeople yet</div></div>`;
}
function openSpEd(id){
  editSpId=id;const sp=id?getSP(id):null;
  document.getElementById('spe-ttl').textContent=id?'Edit Salesperson':'New Salesperson';
  const nid=nextId('SP',DB.salespeople);
  document.getElementById('spe-body').innerHTML=`
    <div class="fg"><label class="fl">ID</label><input class="fi" id="sp-id" value="${esc(sp?.id||nid)}" ${id?'readonly':''}></div>
    <div class="fg"><label class="fl">Full Name *</label><input class="fi" id="sp-nm" value="${esc(sp?.name||'')}" placeholder="Full name"></div>
    <div class="fg"><label class="fl">Job Title</label><input class="fi" id="sp-ttl2" value="${esc(sp?.title||'')}" placeholder="e.g. Senior Sales Executive"></div>
    <div class="fr"><div class="fg"><label class="fl">Email</label><input class="fi" type="email" id="sp-em" value="${esc(sp?.email||'')}" placeholder="email@company.com"></div><div class="fg"><label class="fl">Phone</label><input class="fi" type="tel" id="sp-ph" value="${esc(sp?.phone||'')}" placeholder="+254 7xx xxx xxx"></div></div>
    <div class="fg"><label class="fl">Company</label>${buildCustomSelect({id:'sp-coid',label:'Company',options:DB.companies.map(co=>({value:co.id,label:co.name})),value:sp?.companyId||DB.settings.activeCompanyId||''})}</div>
    <div style="height:1px;background:var(--ol2);margin:4px 0 14px"></div>
    <div class="fg"><label class="fl">Digital Signature</label>
      <div style="background:var(--su2);border-radius:8px;padding:12px;border:1.5px dashed var(--ol)">
        <div id="sp-sig-preview" style="min-height:60px;display:flex;align-items:center;justify-content:center;margin-bottom:10px">${sp?.signatureImg?`<img src="${sp.signatureImg}" style="max-height:70px;max-width:240px;object-fit:contain">`:''}</div>
        <div style="display:flex;gap:8px;justify-content:center">
          <button class="btn bo btn-sm" onclick="document.getElementById('sp-sig-file').click()"><span class="material-icons-round">upload</span> Upload Signature</button>
          ${sp?.signatureImg?`<button class="btn bt btn-sm" style="color:var(--E)" onclick="clearSpSig()"><span class="material-icons-round">delete</span> Remove</button>`:''}
        </div>
        <input type="file" id="sp-sig-file" accept="image/*" style="display:none" onchange="previewSpSig(this)">
        <input type="hidden" id="sp-sig-img" value="${sp?.signatureImg||''}">
      </div>
    </div>
    ${id?`<div style="margin-top:4px"><button class="btn bd2 btn-w" onclick="confirmAct('Remove this salesperson?',()=>delItem('sp','${id}'))"><span class="material-icons-round">delete</span> Remove</button></div>`:''}`;
  openDlg('dlg-spe');
}
function saveSp(){const id=v('sp-id'),name=v('sp-nm');if(!id||!name){snack('ID and name required');return;}if(!editSpId&&DB.salespeople.find(s=>s.id===id)){snack('ID already exists');return;}const sp={id,name,title:v('sp-ttl2'),email:v('sp-em'),phone:v('sp-ph'),companyId:v('sp-coid'),signatureImg:document.getElementById('sp-sig-img')?.value||''};const idx=DB.salespeople.findIndex(s=>s.id===id);if(idx>=0)DB.salespeople[idx]=sp;else DB.salespeople.push(sp);save();closeDlg('dlg-spe');renderSPList();renderSettings();snack('Salesperson saved');}
function previewSpSig(input){const file=input.files[0];if(!file)return;const r=new FileReader();r.onload=e=>{document.getElementById('sp-sig-img').value=e.target.result;document.getElementById('sp-sig-preview').innerHTML=`<img src="${e.target.result}" style="max-height:70px;max-width:240px;object-fit:contain">`;};r.readAsDataURL(file);}
function clearSpSig(){document.getElementById('sp-sig-img').value='';document.getElementById('sp-sig-preview').innerHTML='';}

// ── THEME & ACCENT ───────────────────────────────────────
function applyTheme(){
  const dark=DB.settings.darkMode;
  document.documentElement.dataset.theme=dark?'dark':'light';
  const acc=ACCENTS.find(a=>a.name===DB.settings.accentName)||ACCENTS[0];
  const color=dark?acc.dc:acc.lc;
  document.documentElement.style.setProperty('--P',color);
  document.documentElement.style.setProperty('--PC',dark?'rgba(138,180,248,0.15)':color+'1A');
  document.getElementById('theme-meta').content=dark?'#1E1E1E':color;
  const tog=document.getElementById('dark-tog');if(tog)tog.classList.toggle('on',dark);
}
function toggleTheme(){DB.settings.darkMode=!DB.settings.darkMode;save();applyTheme();}
function openAccentPicker(){
  document.getElementById('acc-body').innerHTML=ACCENTS.map(a=>`<div class="si" onclick="setAccent('${a.name}')"><div style="width:32px;height:32px;border-radius:50%;background:${a.lc};flex-shrink:0;box-shadow:0 2px 6px rgba(0,0,0,.2);border:${a.name===DB.settings.accentName?'3px solid var(--t1)':'3px solid transparent'}"></div><div class="si-tx"><div class="si-m">${a.name}</div></div>${a.name===DB.settings.accentName?'<span class="material-icons-round" style="color:var(--P)">check_circle</span>':''}</div>`).join('');
  openDlg('dlg-acc');
}
function setAccent(name){DB.settings.accentName=name;save();applyTheme();document.getElementById('acc-sub').textContent=name;closeDlg('dlg-acc');snack('Accent updated');}

// ── DELETE & CONFIRM ─────────────────────────────────────
function delItem(type,id){
  if(type==='quote'){const q=DB.quotes.find(x=>x.id===id);DB.quotes=DB.quotes.filter(x=>x.id!==id);if(q)updateLTV(q.customerId);closeDlg('dlg-qact');closeDlg('dlg-qd');}
  else if(type==='inv'){DB.inventory=DB.inventory.filter(x=>x.id!==id);closeDlg('dlg-inv');renderInv();}
  else if(type==='cust'){DB.customers=DB.customers.filter(x=>x.id!==id);closeDlg('dlg-cust');renderCusts();}
  else if(type==='co'){DB.companies=DB.companies.filter(x=>x.id!==id);if(DB.settings.activeCompanyId===id)DB.settings.activeCompanyId=DB.companies[0]?.id||null;}
  else if(type==='sp'){DB.salespeople=DB.salespeople.filter(x=>x.id!==id);closeDlg('dlg-spe');renderSPList();}
  save();renderPage(curPage);snack('Deleted');updateNavBadges();
}
function confirmAct(msg,fn){document.getElementById('cfm-ttl').textContent='Confirm';document.getElementById('cfm-msg').textContent=msg;document.getElementById('cfm-ok').onclick=()=>{fn();closeDlg('dlg-cfm');};openDlg('dlg-cfm');}
function clearAllData(){openIDB().then(db=>{const tx=db.transaction(IDB_STORE,'readwrite');tx.objectStore(IDB_STORE).clear();tx.oncomplete=()=>{localStorage.clear();location.reload();};}).catch(()=>{localStorage.clear();location.reload();});}

// ── DATA IMPORT / EXPORT ─────────────────────────────────
function exportData(){const blob=new Blob([JSON.stringify(DB,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`quotes_backup_${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);snack('Backup exported');}
function importData(){const inp=document.createElement('input');inp.type='file';inp.accept='.json';inp.onchange=e=>{const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=ev=>{try{const d=JSON.parse(ev.target.result);if(!d.companies||!d.quotes)throw new Error('Invalid format');confirmAct('Replace ALL current data with this backup?',()=>{DB=d;ensureDefaults();recalcAllLTV();_doSave();location.reload();});}catch(err){snack('Invalid backup file');}};r.readAsText(file);};inp.click();}

// ── CUSTOM SELECT COMPONENT ──────────────────────────────
let _csCallback=null, _csOpts=[], _csId=null;
function buildCustomSelect({id,label,options,value,placeholder,searchable}){
  const sel=options.find(o=>o.value==value);const disp=sel?sel.label:(placeholder||label);
  return`<div class="cs-wrap" id="cswrap-${id}">
    <input type="hidden" id="${id}" value="${esc(value||'')}">
    <div class="cs-display" tabindex="0" id="csdisp-${id}" onclick="csOpen('${id}')" onkeydown="if(event.key==='Enter'||event.key===' ')csOpen('${id}')">
      <span class="cs-display-text${sel?'':' placeholder'}" id="csdt-${id}">${esc(disp)}</span>
      <span class="material-icons-round cs-arrow" id="csarr-${id}">expand_more</span>
    </div>
  </div>`;
}
function csOpen(id){
  const opts=_csOptsMap[id];if(!opts)return;
  _csId=id;_csOpts=opts.options;
  document.getElementById('cs-title').textContent=opts.label||'Select';
  const searchWrap=document.getElementById('cs-search-wrap');
  if(opts.searchable&&opts.options.length>5){searchWrap.style.display='block';document.getElementById('cs-search').value='';}else searchWrap.style.display='none';
  const curVal=document.getElementById(id)?.value||'';
  renderCSOpts(_csOpts,curVal);
  document.getElementById('cs-sheet').classList.add('open');
  document.getElementById('csarr-'+id)?.classList.add('open');
  document.getElementById('csdisp-'+id)?.classList.add('open');
  if(opts.searchable)setTimeout(()=>document.getElementById('cs-search')?.focus(),200);
}
function renderCSOpts(opts,curVal){
  document.getElementById('cs-list').innerHTML=opts.map(o=>`<div class="cs-opt${o.value==curVal?' selected':''}" onclick="csSelect('${_csId}','${esc(String(o.value))}','${esc(o.label)}')"><div class="cs-opt-check">${o.value==curVal?'✓':''}</div><div class="cs-opt-label"><div>${esc(o.label)}</div>${o.sub?`<div class="cs-opt-sub">${esc(o.sub)}</div>`:''}</div></div>`).join('');
}
function csFilter(q){if(!q){renderCSOpts(_csOpts,document.getElementById(_csId)?.value||'');return;}const lq=q.toLowerCase();renderCSOpts(_csOpts.filter(o=>o.label.toLowerCase().includes(lq)||(o.sub||'').toLowerCase().includes(lq)),document.getElementById(_csId)?.value||'');}
function csSelect(id,value,label){
  const hidEl=document.getElementById(id);if(hidEl)hidEl.value=value;
  const dtEl=document.getElementById('csdt-'+id);if(dtEl){dtEl.textContent=label;dtEl.classList.remove('placeholder');}
  hidEl?.dispatchEvent(new Event('change',{bubbles:true}));
  csClose();
  // Trigger relevant reactive updates
  if(id==='qe-cust')setTimeout(previewCust,50);
}
function csClose(){
  document.getElementById('cs-sheet').classList.remove('open');
  if(_csId){document.getElementById('csarr-'+_csId)?.classList.remove('open');document.getElementById('csdisp-'+_csId)?.classList.remove('open');}
  _csId=null;
}
const _csOptsMap={};
// Patch buildCustomSelect to register options
const _origBCS=buildCustomSelect;
// We register opts lazily on open via a MutationObserver — simpler: just re-expose via data attr
// Actually: store options at render time by overriding after component mounts
function registerCS(id,opts){_csOptsMap[id]=opts;}

// Override buildCustomSelect to also register
function buildCustomSelect({id,label,options,value,placeholder,searchable}){
  _csOptsMap[id]={label,options,searchable};
  const sel=options.find(o=>String(o.value)===String(value));
  const disp=sel?sel.label:(placeholder||'— Select —');
  return`<div class="cs-wrap" id="cswrap-${id}">
    <input type="hidden" id="${id}" value="${esc(value!==undefined&&value!==null?value:'')}">
    <div class="cs-display" tabindex="0" id="csdisp-${id}" onclick="csOpen('${id}')" onkeydown="if(event.key==='Enter'||event.key===' ')csOpen('${id}')">
      <span class="cs-display-text${sel?'':' placeholder'}" id="csdt-${id}">${esc(disp)}</span>
      <span class="material-icons-round cs-arrow" id="csarr-${id}">expand_more</span>
    </div>
  </div>`;
}

// ── DIALOG HELPERS ───────────────────────────────────────
function openDlg(id){document.getElementById(id).classList.add('open');document.body.style.overflow='hidden';}
function closeDlg(id){document.getElementById(id).classList.remove('open');if(!document.querySelector('.bd.open'))document.body.style.overflow='';}

// ── MORE MENU ────────────────────────────────────────────
function openMore(){
  document.getElementById('more-body').innerHTML=`
    <div class="si" onclick="openAnalytics();closeDlg('dlg-more')"><div class="si-ic"><span class="material-icons-round">analytics</span></div><div class="si-tx"><div class="si-m">Sales Analytics</div></div></div>
    <div class="si" onclick="openTemplates();closeDlg('dlg-more')"><div class="si-ic"><span class="material-icons-round">bookmark</span></div><div class="si-tx"><div class="si-m">Quote Templates</div></div></div>
    <div class="si" onclick="toggleTheme();closeDlg('dlg-more')"><div class="si-ic"><span class="material-icons-round">dark_mode</span></div><div class="si-tx"><div class="si-m">Toggle Dark Mode</div></div></div>
    <div class="si" onclick="exportData();closeDlg('dlg-more')"><div class="si-ic"><span class="material-icons-round">download</span></div><div class="si-tx"><div class="si-m">Export Backup</div></div></div>
    <div class="si" onclick="go('settings');closeDlg('dlg-more')"><div class="si-ic"><span class="material-icons-round">settings</span></div><div class="si-tx"><div class="si-m">Settings</div></div></div>`;
  openDlg('dlg-more');
}

// ── SNACKBAR ─────────────────────────────────────────────
let _snackTimer=null;
function snack(msg,actionLabel,actionFn){
  const el=document.getElementById('snack');
  document.getElementById('snack-msg').textContent=msg;
  const act=document.getElementById('snack-act');
  if(actionLabel&&actionFn){act.textContent=actionLabel;act.onclick=()=>{actionFn();el.classList.remove('show');};act.style.display='block';}
  else act.style.display='none';
  el.classList.add('show');clearTimeout(_snackTimer);
  _snackTimer=setTimeout(()=>el.classList.remove('show'),actionLabel?5000:3000);
}

// ── SERVICE WORKER ───────────────────────────────────────
function registerSW(){
  if(!('serviceWorker' in navigator))return;
  navigator.serviceWorker.register('sw.js').then(reg=>{
    reg.addEventListener('updatefound',()=>{
      const nw=reg.installing;
      nw.addEventListener('statechange',()=>{
        if(nw.state==='installed'&&navigator.serviceWorker.controller){
          document.getElementById('update-banner').classList.add('show');
        }
      });
    });
  }).catch(e=>console.warn('SW reg failed:',e));
}

// ── KEYBOARD SHORTCUTS ────────────────────────────────────
document.addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.isContentEditable)return;
  if(document.querySelector('.bd.open'))return;
  if(e.key==='n'||e.key==='N'){e.preventDefault();openQE(null);}
  else if(e.key==='1')go('dashboard');
  else if(e.key==='2')go('quotes');
  else if(e.key==='3')go('inventory');
  else if(e.key==='4')go('customers');
  else if(e.key==='5')go('settings');
  else if(e.key==='Escape'){const open=document.querySelector('.bd.open');if(open)open.classList.remove('open');}
});

// ── INIT ─────────────────────────────────────────────────
async function init(){
  await load();
  autoExpireQuotes();
  applyTheme();
  go('dashboard');
  renderSettings();
  registerSW();
}

document.addEventListener('DOMContentLoaded',init);
