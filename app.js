'use strict';
// ═══════════════════════════════════════════════════════
// QUOTES PWA v4.0 — Full feature build
// New: back navigation, swipe cards, live totals bar,
//      expiry countdown, payment tracking, activity log,
//      QR share, stock tracking, product analytics,
//      undo delete, offline indicator, win animation,
//      onboarding checklist, settings search,
//      multi-currency per quote, virtual list,
//      customer industry filter, pinch-to-zoom preview
// ═══════════════════════════════════════════════════════

// ── STATE ──────────────────────────────────────────────
let DB = {
  companies:[], customers:[], inventory:[], quotes:[],
  salespeople:[], templates:[],
  settings:{
    quotePrefix:'QMS-', invoicePrefix:'INV-',
    quoteValidDays:30, followUpDays:7,
    taxRate:0.16, taxLabel:'VAT', currencySymbol:'KSh',
    minMargin:.20, warnMargin:.25, activeCompanyId:null,
    darkMode:false, accentName:'Google Blue', dlIncludeVersion:true,
    productCategories:['Software','Hardware','Services','Other'],
    exchangeRates:{'KSh':1,'USD':0.0077,'EUR':0.0071,'GBP':0.0061},
    dashSections:{alerts:true,chart:true,pipeline:true,recent:true},
  }
};

// Navigation history stack
const _navStack = [];
let curPage = 'dashboard';
let curQID  = null;
let qeStep  = 0, qeD = {};
let qFilt   = 'all', invF = 'all', setType = '';
let editCoId=null, editCustId=null, editInvId=null, editSpId=null;
let _undoStack = []; // [{type,data,label}]

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
const IDB_NAME='QuotesPWA4', IDB_STORE='data';
const IDB_KEYS=['inventory','quotes','customers','companies','salespeople','settings','templates'];
let _idb=null;
function openIDB(){
  return new Promise((resolve,reject)=>{
    if(_idb){resolve(_idb);return;}
    const req=indexedDB.open(IDB_NAME,4);
    req.onupgradeneeded=e=>{const db=e.target.result;if(!db.objectStoreNames.contains(IDB_STORE))db.createObjectStore(IDB_STORE);};
    req.onsuccess=e=>{_idb=e.target.result;resolve(_idb);};
    req.onerror=e=>reject(e.target.error);
  });
}
let _saveTimer=null;
function save(){clearTimeout(_saveTimer);_saveTimer=setTimeout(_doSave,200);}
function _doSave(){
  openIDB().then(db=>{
    const tx=db.transaction(IDB_STORE,'readwrite'),st=tx.objectStore(IDB_STORE);
    IDB_KEYS.forEach(k=>{if(DB[k]!==undefined)st.put(JSON.stringify(DB[k]),'col_'+k);});
    st.put(JSON.stringify(DB.settings||{}),'col_settings');
  }).catch(()=>snack('⚠ Storage unavailable'));
  try{localStorage.setItem('qpwa4',JSON.stringify(DB));}catch(e){}
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
            r.onsuccess=()=>res([k,r.result]);r.onerror=()=>res([k,null]);
          }))).then(pairs=>{
            pairs.forEach(([k,v])=>{if(v){try{DB[k]=JSON.parse(v);}catch(e){}}});
            ensureDefaults();resolve();
          });
        } else loadLS(resolve);
      };
      probe.onerror=()=>loadLS(resolve);
    }).catch(()=>loadLS(resolve));
  });
}
function ensureDefaults(){
  ['quotes','inventory','customers','companies','salespeople','templates'].forEach(k=>{if(!DB[k])DB[k]=[];});
  if(!DB.settings)DB.settings={};
  const d={quotePrefix:'QMS-',invoicePrefix:'INV-',quoteValidDays:30,followUpDays:7,taxRate:0.16,taxLabel:'VAT',currencySymbol:'KSh',minMargin:.20,warnMargin:.25,activeCompanyId:null,darkMode:false,accentName:'Google Blue',dlIncludeVersion:true,productCategories:['Software','Hardware','Services','Other'],exchangeRates:{'KSh':1,'USD':0.0077,'EUR':0.0071,'GBP':0.0061},dashSections:{alerts:true,chart:true,pipeline:true,recent:true}};
  Object.keys(d).forEach(k=>{if(DB.settings[k]===undefined)DB.settings[k]=d[k];});
}
function loadLS(resolve){
  try{const r=localStorage.getItem('qpwa4')||localStorage.getItem('qpwa3');if(r){DB=JSON.parse(r);_doSave();}else seed();}catch(e){seed();}
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
  DB.companies=[{id:'CO-001',name:'Acme Corporation',tagline:'Enterprise Solutions',address:'123 Business Ave\nNairobi, Kenya 00100',phone:'+254 700 000 000',email:'sales@acme.co.ke',website:'www.acme.co.ke',taxPin:'P051234567A',paymentMethods:[{type:'Bank',bankName:'Equity Bank Kenya',accName:'Acme Corporation Ltd',accNum:'0123456789',branch:'Westlands Branch',swift:'EQBLKENA'},{type:'M-Pesa Paybill',paybillBusiness:'123456',paybillAccount:'Invoice No.',mpesaName:'Acme Corporation'}],paymentTerms:'Net 30',terms:'1. Payment is due within 30 days of invoice date.\n2. Late payments accrue 1.5% interest per month.\n3. All prices are in KSh and subject to change without notice.\n4. Goods remain property of Acme Corporation until full payment is received.',logoText:'A',logoColor:'#1A73E8',logoImg:null}];
  DB.settings.activeCompanyId='CO-001';
  DB.salespeople=[{id:'SP-001',name:'Sarah Kamau',title:'Senior Sales Executive',email:'sarah@acme.co.ke',phone:'+254 711 000 001',companyId:'CO-001'},{id:'SP-002',name:'Mike Odhiambo',title:'Account Manager',email:'mike@acme.co.ke',phone:'+254 711 000 002',companyId:'CO-001'}];
  DB.customers=[{id:'CUS-001',companyId:'CO-001',company:'Nexus Technologies',contact:'Alex Chen',email:'alex@nexus.co.ke',phone:'+254 722 010 101',address:'Westlands, Nairobi',taxPin:'P051111111A',industry:'Technology',tier:'Gold',ltv:0},{id:'CUS-002',companyId:'CO-001',company:'Pinnacle Group',contact:'Maria Santos',email:'m.santos@pinnacle.co.ke',phone:'+254 722 010 102',address:'Upper Hill, Nairobi',taxPin:'P052222222A',industry:'Finance',tier:'Platinum',ltv:0},{id:'CUS-003',companyId:'CO-001',company:'Horizon Health',contact:'James Wright',email:'j.wright@horizon.co.ke',phone:'+254 722 010 103',address:'Karen, Nairobi',taxPin:'',industry:'Healthcare',tier:'Silver',ltv:0},{id:'CUS-004',companyId:'CO-001',company:'Summit Retail',contact:'Sarah Kim',email:'s.kim@summit.co.ke',phone:'+254 722 010 104',address:'CBD, Nairobi',taxPin:'',industry:'Retail',tier:'Bronze',ltv:0}];
  DB.inventory=[{id:'ITM-001',companyId:'CO-001',name:'Enterprise Software License',category:'Software',unitCost:60000,markup:.50,description:'Full enterprise license.',stock:20,trackStock:true},{id:'ITM-002',companyId:'CO-001',name:'Implementation Services (hr)',category:'Services',unitCost:7500,markup:.40,description:'Professional implementation.',stock:null,trackStock:false},{id:'ITM-003',companyId:'CO-001',name:'Annual Support Package',category:'Services',unitCost:40000,markup:.60,description:'12-month support plan.',stock:null,trackStock:false},{id:'ITM-004',companyId:'CO-001',name:'Hardware Server Unit',category:'Hardware',unitCost:175000,markup:.30,description:'High-performance rack server.',stock:8,trackStock:true},{id:'ITM-005',companyId:'CO-001',name:'Network Switch 48-port',category:'Hardware',unitCost:32500,markup:.35,description:'Managed gigabit switch.',stock:15,trackStock:true},{id:'ITM-006',companyId:'CO-001',name:'Training (per day)',category:'Services',unitCost:25000,markup:.50,description:'On-site training.',stock:null,trackStock:false},{id:'ITM-007',companyId:'CO-001',name:'Cloud Storage (TB/month)',category:'Software',unitCost:1250,markup:.80,description:'Secure cloud storage.',stock:null,trackStock:false},{id:'ITM-008',companyId:'CO-001',name:'Security Suite License',category:'Software',unitCost:22500,markup:.55,description:'Cybersecurity suite.',stock:50,trackStock:true}];
  DB.templates=[];
  const d=n=>{const x=new Date();x.setDate(x.getDate()+n);return x.toISOString().slice(0,10);};
  DB.quotes=[
    {id:'QMS-2026-001',companyId:'CO-001',customerId:'CUS-002',date:d(-80),validUntil:d(-50),status:'Won',version:'v1',revision:'Initial proposal',salespersonId:'SP-001',notes:'Client approved on first presentation.',taxable:true,discount:0.05,currency:'KSh',history:[],activityLog:[{ts:new Date(Date.now()-80*86400000).toISOString(),action:'Created',user:'Sarah Kamau'},{ts:new Date(Date.now()-75*86400000).toISOString(),action:'Sent to client',user:'Sarah Kamau'},{ts:new Date(Date.now()-72*86400000).toISOString(),action:'Marked as Won',user:'Sarah Kamau'}],payment:{status:'Paid',amountPaid:null},items:[{itemId:'ITM-001',desc:'Enterprise Software License',qty:3,unitPrice:90000,discount:0},{itemId:'ITM-002',desc:'Implementation Services (hr)',qty:40,unitPrice:10500,discount:0},{itemId:'ITM-003',desc:'Annual Support Package',qty:1,unitPrice:64000,discount:0.05}]},
    {id:'QMS-2026-002',companyId:'CO-001',customerId:'CUS-003',date:d(-50),validUntil:d(-20),status:'Draft',version:'v1',revision:'Service expansion',salespersonId:'SP-001',notes:'Needs internal sign-off.',taxable:false,discount:0,currency:'KSh',history:[],activityLog:[{ts:new Date(Date.now()-50*86400000).toISOString(),action:'Created',user:'Sarah Kamau'}],payment:{status:'Unpaid',amountPaid:0},items:[{itemId:'ITM-003',desc:'Annual Support Package',qty:3,unitPrice:64000,discount:0},{itemId:'ITM-006',desc:'Training (per day)',qty:8,unitPrice:37500,discount:0}]},
    {id:'QMS-2026-003',companyId:'CO-001',customerId:'CUS-001',date:d(-15),validUntil:d(15),status:'Sent',version:'v2',revision:'Revised scope',salespersonId:'SP-002',notes:'Board approval pending.',taxable:true,discount:0,currency:'KSh',history:[],activityLog:[{ts:new Date(Date.now()-15*86400000).toISOString(),action:'Created',user:'Mike Odhiambo'},{ts:new Date(Date.now()-12*86400000).toISOString(),action:'Sent to client',user:'Mike Odhiambo'}],payment:{status:'Unpaid',amountPaid:0},items:[{itemId:'ITM-004',desc:'Hardware Server Unit',qty:2,unitPrice:227500,discount:0},{itemId:'ITM-005',desc:'Network Switch 48-port',qty:4,unitPrice:43875,discount:0.10},{itemId:'ITM-007',desc:'Cloud Storage (TB/month)',qty:12,unitPrice:2250,discount:0}]},
    {id:'QMS-2026-004',companyId:'CO-001',customerId:'CUS-004',date:d(-5),validUntil:d(25),status:'Sent',version:'v1',revision:'',salespersonId:'SP-001',notes:'Follow-up due.',taxable:true,discount:0,currency:'KSh',history:[],activityLog:[{ts:new Date(Date.now()-5*86400000).toISOString(),action:'Created',user:'Sarah Kamau'}],payment:{status:'Unpaid',amountPaid:0},items:[{itemId:'ITM-008',desc:'Security Suite License',qty:5,unitPrice:34875,discount:0}]}
  ];
  recalcAllLTV();save();
}

// ── HELPERS ────────────────────────────────────────────
const sym=()=>DB.settings.currencySymbol||'KSh';
function fmtC(n,currency){
  const c=currency||sym();
  return c+' '+Number(n||0).toLocaleString('en-KE',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function fmt(n){return fmtC(n);}
function fmtDate(d){if(!d)return'—';try{return new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});}catch{return d;}}
function fmtCompact(n){if(n>=1000000)return(n/1000000).toFixed(1)+'M';if(n>=1000)return Math.round(n/1000)+'K';return Math.round(n)+'';}
function daysUntil(dateStr){if(!dateStr)return null;const diff=new Date(dateStr)-new Date();return Math.ceil(diff/86400000);}
function expiryLabel(q){
  if(q.status!=='Sent')return null;
  const d=daysUntil(q.validUntil);
  if(d===null)return null;
  if(d<0)return{text:`Expired ${Math.abs(d)}d ago`,cls:'danger'};
  if(d===0)return{text:'Expires today',cls:'danger'};
  if(d<=3)return{text:`Expires in ${d}d`,cls:'warn'};
  if(d<=7)return{text:`${d} days left`,cls:'info'};
  return null;
}
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
function productMargin(p){const price=p.unitCost*(1+p.markup);return price>0?(price-p.unitCost)/price:0;}
function autoExpireQuotes(){let ch=false;DB.quotes.forEach(q=>{if(q.status==='Sent'&&new Date(q.validUntil)<new Date()){q.status='Expired';logActivity(q,'Auto-expired');ch=true;}});if(ch)save();}
function recalcAllLTV(){DB.customers.forEach(c=>{c.ltv=DB.quotes.filter(q=>q.customerId===c.id&&q.status==='Won').reduce((s,q)=>s+calcTotals(q).total,0);});}
function updateLTV(cid){const c=getCust(cid);if(!c)return;c.ltv=DB.quotes.filter(q=>q.customerId===cid&&q.status==='Won').reduce((s,q)=>s+calcTotals(q).total,0);}
function logActivity(q,action){if(!q.activityLog)q.activityLog=[];const sp=getSP(q.salespersonId);q.activityLog.push({ts:new Date().toISOString(),action,user:sp?.name||'System'});}

// ── VIRTUAL LIST ENGINE ─────────────────────────────────
// Renders only visible items for performance with 500+ items
function renderVirtualList(container, items, renderFn, itemHeight=90){
  if(!container)return;
  if(items.length<80){
    container.style.paddingTop='';container.style.paddingBottom='';
    container.innerHTML=items.map(renderFn).join('');
    attachSwipeHandlers(container);return;
  }
  const scrollParent=container.closest('#content')||container.parentElement;
  const visible=Math.ceil((scrollParent.clientHeight||600)/itemHeight)+4;
  let start=0;
  function render(){
    const end=Math.min(start+visible,items.length);
    container.style.paddingTop=(start*itemHeight)+'px';
    container.style.paddingBottom=((items.length-end)*itemHeight)+'px';
    container.innerHTML=items.slice(start,end).map(renderFn).join('');
    attachSwipeHandlers(container);
  }
  render();
  const onScroll=()=>{
    const newStart=Math.max(0,Math.floor(scrollParent.scrollTop/itemHeight)-2);
    if(newStart!==start){start=newStart;render();}
  };
  scrollParent.removeEventListener('scroll',scrollParent._vlistHandler||null);
  scrollParent._vlistHandler=onScroll;
  scrollParent.addEventListener('scroll',onScroll,{passive:true});
}

// ── SWIPE GESTURES ON CARDS ─────────────────────────────
function attachSwipeHandlers(container){
  container.querySelectorAll('.qi[data-qid]').forEach(card=>{
    let sx=0,sy=0,swiping=false;
    card.addEventListener('touchstart',e=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY;swiping=false;},{passive:true});
    card.addEventListener('touchmove',e=>{
      const dx=e.touches[0].clientX-sx,dy=e.touches[0].clientY-sy;
      if(!swiping&&Math.abs(dy)>Math.abs(dx))return;
      swiping=true;if(dx<-30){card.style.transform=`translateX(${Math.max(dx,-80)}px)`;card.classList.add('swiping');}
      else if(dx>10){card.style.transform='';card.classList.remove('swiping');}
    },{passive:true});
    card.addEventListener('touchend',e=>{
      const dx=e.changedTouches[0].clientX-sx;
      if(swiping&&dx<-60){showSwipeActions(card,card.dataset.qid);}
      else{card.style.transform='';card.classList.remove('swiping');}
    });
  });
}
function showSwipeActions(card,qid){
  const q=DB.quotes.find(x=>x.id===qid);if(!q)return;
  card.style.transform='translateX(-80px)';
  const existing=card.querySelector('.swipe-actions');if(existing)existing.remove();
  const div=document.createElement('div');
  div.className='swipe-actions';
  div.innerHTML=`<button onclick="dupQ('${qid}');resetSwipe(this)" title="Duplicate"><span class="material-icons-round">content_copy</span></button><button onclick="openQAct('${qid}');resetSwipe(this)" title="Actions"><span class="material-icons-round">more_vert</span></button><button class="del-btn" onclick="softDelQ('${qid}');resetSwipe(this)" title="Delete"><span class="material-icons-round">delete</span></button>`;
  card.style.position='relative';card.appendChild(div);
  setTimeout(()=>document.addEventListener('touchstart',()=>resetSwipe(div),{once:true}),100);
}
function resetSwipe(el){const card=el.closest?.('.qi')||el.parentElement?.closest('.qi');if(card){card.style.transform='';card.classList.remove('swiping');card.querySelector('.swipe-actions')?.remove();}}

// ── UNDO DELETE ─────────────────────────────────────────
function softDelQ(qid){
  const q=DB.quotes.find(x=>x.id===qid);if(!q)return;
  const backup=JSON.parse(JSON.stringify(q));
  DB.quotes=DB.quotes.filter(x=>x.id!==qid);
  updateLTV(q.customerId);save();renderPage(curPage);updateNavBadges();
  snack('Quote deleted','Undo',()=>{DB.quotes.unshift(backup);updateLTV(backup.customerId);save();renderPage(curPage);updateNavBadges();snack('Restored');});
}
function softDelItem(type,id){
  if(type==='quote'){softDelQ(id);closeDlg('dlg-qd');closeDlg('dlg-qact');return;}
  let backup,col;
  if(type==='inv'){col='inventory';backup=JSON.parse(JSON.stringify(DB.inventory.find(x=>x.id===id)));DB.inventory=DB.inventory.filter(x=>x.id!==id);closeDlg('dlg-inv');}
  else if(type==='cust'){col='customers';backup=JSON.parse(JSON.stringify(DB.customers.find(x=>x.id===id)));DB.customers=DB.customers.filter(x=>x.id!==id);closeDlg('dlg-cust');}
  else if(type==='sp'){col='salespeople';backup=JSON.parse(JSON.stringify(DB.salespeople.find(x=>x.id===id)));DB.salespeople=DB.salespeople.filter(x=>x.id!==id);closeDlg('dlg-spe');}
  else if(type==='co'){col='companies';backup=JSON.parse(JSON.stringify(DB.companies.find(x=>x.id===id)));DB.companies=DB.companies.filter(x=>x.id!==id);if(DB.settings.activeCompanyId===id)DB.settings.activeCompanyId=DB.companies[0]?.id||null;closeDlg('dlg-co');}
  if(col&&backup){save();renderPage(curPage);snack(`Deleted`,'Undo',()=>{DB[col].push(backup);save();renderPage(curPage);snack('Restored');});}
}

// ── HISTORY NAVIGATION ─────────────────────────────────
// Push a state so back button/swipe closes dialogs or navigates pages
function pushNav(id,data={}){
  history.pushState({navId:id,...data},'');
}
window.addEventListener('popstate',e=>{
  const st=e.state;
  // Close topmost open dialog first
  const open=[...document.querySelectorAll('.bd.open')];
  if(open.length){
    open[open.length-1].classList.remove('open');
    if(!document.querySelector('.bd.open'))document.body.style.overflow='';
    pushNav('base');// keep a state so next back works
    return;
  }
  // Also close custom select sheet
  if(document.getElementById('cs-sheet').classList.contains('open')){
    csClose();pushNav('base');return;
  }
  // Navigate pages back
  const pages=['dashboard','quotes','inventory','customers','settings'];
  if(curPage!=='dashboard'){
    go('dashboard');
  }
  // If already on dashboard, let browser handle (exit/go back normally)
});
function initNav(){
  // Replace initial history state
  history.replaceState({navId:'base'},'');
}


// ── NAVIGATION & PAGES ─────────────────────────────────
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
  pushNav(page);
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

// ── OFFLINE INDICATOR ──────────────────────────────────
function initOfflineIndicator(){
  const dot=document.getElementById('offline-dot');
  function upd(){
    if(dot)dot.style.display=navigator.onLine?'none':'flex';
  }
  window.addEventListener('online',()=>{upd();snack('Back online');});
  window.addEventListener('offline',()=>{upd();snack('You are offline — app still works');});
  upd();
}

// ── ONBOARDING CHECKLIST ───────────────────────────────
function getOnboardingState(){
  const co=activeCo(),custs=acoCusts(),inv=acoInv(),qs=acoQuotes();
  return{
    company:DB.companies.length>0,
    product:inv.length>0,
    customer:custs.length>0,
    quote:qs.length>0,
  };
}
function renderOnboarding(){
  const el=document.getElementById('d-onboarding');if(!el)return;
  const s=getOnboardingState();
  if(s.company&&s.product&&s.customer&&s.quote){el.style.display='none';return;}
  el.style.display='block';
  const steps=[
    {key:'company',label:'Add your company profile',icon:'business',action:"openCoEd(null)"},
    {key:'product',label:'Add your first product',icon:'inventory_2',action:"go('inventory');openInvEd(null)"},
    {key:'customer',label:'Add your first customer',icon:'people',action:"go('customers');openCustEd(null)"},
    {key:'quote',label:'Create your first quote',icon:'receipt_long',action:"openQE(null)"},
  ];
  el.innerHTML=`<div class="ob-card">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div style="font-size:14px;font-weight:700">Getting Started</div>
      <div style="font-size:11px;color:var(--t2)">${Object.values(s).filter(Boolean).length}/4 done</div>
    </div>
    ${steps.map(st=>`<div class="ob-step${s[st.key]?' done':''}" onclick="${s[st.key]?'':st.action}">
      <div class="ob-icon"><span class="material-icons-round" style="font-size:18px">${s[st.key]?'check_circle':st.icon}</span></div>
      <div style="flex:1;font-size:13px;font-weight:${s[st.key]?'400':'600'};color:${s[st.key]?'var(--t3)':'var(--t1)'};text-decoration:${s[st.key]?'line-through':'none'}">${st.label}</div>
      ${s[st.key]?'':'<span class="material-icons-round" style="color:var(--t3);font-size:18px">chevron_right</span>'}
    </div>`).join('')}
  </div>`;
}

// ── DASHBOARD ──────────────────────────────────────────
function renderDash(){
  const co=activeCo();
  document.getElementById('d-coname').textContent=co?co.name:'Set up your company →';
  const qs=acoQuotes();
  const won=qs.filter(q=>q.status==='Won');
  const wonV=won.reduce((s,q)=>s+calcTotals(q).total,0);
  const ds=DB.settings.dashSections||{alerts:true,chart:true,pipeline:true,recent:true};

  document.getElementById('d-met').innerHTML=`
    <div class="mc bl"><div class="mv">${qs.filter(q=>q.status==='Sent').length}</div><div class="mlb">Pending</div></div>
    <div class="mc gr"><div class="mv">${won.length}</div><div class="mlb">Won</div></div>
    <div class="mc"><div class="mv" style="font-size:16px;color:var(--P)">${fmtCompact(wonV)}</div><div class="mlb">Revenue</div></div>
    <div class="mc re"><div class="mv">${qs.filter(isOverdue).length}</div><div class="mlb">Overdue</div></div>`;

  renderOnboarding();

  // Collapsible alerts
  const alertsEl=document.getElementById('d-alerts');
  if(ds.alerts){
    const alerts=[];
    qs.filter(isOverdue).forEach(q=>{const cu=getCust(q.customerId);alerts.push(`<div class="alert-card danger" onclick="openQD('${q.id}')"><div style="display:flex;align-items:center;gap:10px"><span class="material-icons-round" style="color:var(--E);font-size:20px">warning</span><div style="flex:1"><div style="font-size:13px;font-weight:700">${esc(cu?.company||'?')} — ${esc(q.id)}</div><div style="font-size:12px;color:var(--t2)">Expired ${fmtDate(q.validUntil)} · ${fmt(calcTotals(q).total)}</div></div><span class="material-icons-round" style="color:var(--t3)">chevron_right</span></div></div>`);});
    qs.filter(isFollowUpDue).forEach(q=>{const cu=getCust(q.customerId);alerts.push(`<div class="alert-card" onclick="openQD('${q.id}')"><div style="display:flex;align-items:center;gap:10px"><span class="material-icons-round" style="color:var(--W);font-size:20px">schedule</span><div style="flex:1"><div style="font-size:13px;font-weight:700">${esc(cu?.company||'?')} — ${esc(q.id)}</div><div style="font-size:12px;color:var(--t2)">Follow-up due · ${fmt(calcTotals(q).total)}</div></div><span class="material-icons-round" style="color:var(--t3)">chevron_right</span></div></div>`);});
    alertsEl.innerHTML=alerts.join('');alertsEl.style.display=alerts.length?'flex':'none';
  } else alertsEl.style.display='none';

  // Revenue chart
  const chartSec=document.getElementById('d-chart-sec');
  if(ds.chart){chartSec.style.display='block';renderRevenueChart();}else chartSec.style.display='none';

  // Pipeline
  const pipeSec=document.getElementById('d-pipe-sec');
  if(ds.pipeline){
    pipeSec.style.display='block';
    const stats=['Draft','Sent','Won','Lost','Expired'],cols={Draft:'#4285F4',Sent:'#F9AB00',Won:'#34A853',Lost:'#EA4335',Expired:'#9AA0A6'};
    const grp={};stats.forEach(s=>{grp[s]={n:0,v:0};});qs.forEach(q=>{const g=grp[q.status]||grp.Draft;g.n++;g.v+=calcTotals(q).total;});
    const grand=Object.values(grp).reduce((s,g)=>s+g.v,0);
    document.getElementById('d-pipe').innerHTML=stats.map(s=>`<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;margin-bottom:3px"><div style="font-size:13px;font-weight:600;display:flex;align-items:center;gap:5px"><span class="cdot" style="background:${cols[s]}"></span>${s}<span style="background:${cols[s]};color:#fff;border-radius:999px;padding:1px 6px;font-size:11px;font-weight:700">${grp[s].n}</span></div><div style="font-size:13px;font-weight:700">${fmt(grp[s].v)}</div></div><div class="pbar"><div class="pfill" style="width:${grand?Math.round(grp[s].v/grand*100):0}%;background:${cols[s]}"></div></div></div>`).join('');
  } else pipeSec.style.display='none';

  // Recent quotes
  const recSec=document.getElementById('d-rec-sec');
  if(ds.recent){
    recSec.style.display='block';
    const rec=[...qs].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
    document.getElementById('d-rec').innerHTML=rec.length?rec.map(q=>qItemHTML(q)).join(''):`<div class="empty"><span class="material-icons-round">receipt_long</span><div class="empty-t">No quotes yet</div><div class="empty-s">Tap + New Quote to get started</div></div>`;
    attachSwipeHandlers(document.getElementById('d-rec'));
  } else recSec.style.display='none';
}

function toggleDashSection(key){
  if(!DB.settings.dashSections)DB.settings.dashSections={alerts:true,chart:true,pipeline:true,recent:true};
  DB.settings.dashSections[key]=!DB.settings.dashSections[key];
  save();renderDash();
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
let _custIndFilt='all';
function renderQuotes(){
  const srch=(document.getElementById('q-srch-in')||{}).value?.toLowerCase()||'';
  const df=v('q-date-from'),dt=v('q-date-to');
  let list=acoQuotes().sort((a,b)=>b.date.localeCompare(a.date));
  if(qFilt!=='all')list=list.filter(q=>q.status===qFilt);
  if(srch)list=list.filter(q=>q.id.toLowerCase().includes(srch)||(getCust(q.customerId)||{}).company?.toLowerCase().includes(srch)||(getSP(q.salespersonId)||{}).name?.toLowerCase().includes(srch));
  if(df)list=list.filter(q=>q.date>=df);
  if(dt)list=list.filter(q=>q.date<=dt);
  const el=document.getElementById('q-list');
  if(!list.length){el.innerHTML=`<div class="empty"><span class="material-icons-round">search_off</span><div class="empty-t">No ${qFilt!=='all'?qFilt+' ':''} quotes found</div><div class="empty-s">${qFilt==='Won'?'Mark sent quotes as Won to see them here':qFilt==='Lost'?'No lost quotes — great news!':'Try a different filter or create a new quote'}</div></div>`;return;}
  renderVirtualList(el,list,q=>qItemHTML(q));
}

function qItemHTML(q){
  const cu=getCust(q.customerId),sp=getSP(q.salespersonId),tots=calcTotals(q);
  const od=isOverdue(q),fu=isFollowUpDue(q),exp=expiryLabel(q);
  const payBadge=q.isInvoice&&q.payment?.status?`<span style="font-size:10px;padding:2px 6px;border-radius:999px;font-weight:700;background:${q.payment.status==='Paid'?'#E6F4EA':q.payment.status==='Partially Paid'?'#FFF3E0':'#FCE8E6'};color:${q.payment.status==='Paid'?'#1E6E3A':q.payment.status==='Partially Paid'?'#B06000':'#B01010'}">${q.payment.status}</span>`:'';
  const statusColor={Draft:'#4285F4',Sent:'#F9AB00',Won:'#34A853',Lost:'#EA4335',Expired:'#9AA0A6'}[q.status]||'#9AA0A6';
  return`<div class="qi" data-qid="${q.id}" style="border-left:4px solid ${statusColor}" onclick="openQD('${q.id}')">
    <div class="qi-top">
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <span class="qi-id">${esc(q.isInvoice?q.invoiceId:q.id)}</span>
        ${q.isInvoice?'<span class="chip cs-Won" style="font-size:10px">INV</span>':''}
        ${payBadge}
      </div>
      <span class="qi-amt">${fmt(tots.total,q.currency)}</span>
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin:3px 0">
      <div class="av" style="width:24px;height:24px;font-size:10px;font-weight:800;border-radius:50%;background:${avColor(cu?.company||'?')};color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0">${avLetter(cu?.company||'?')}</div>
      <div class="qi-co" style="margin:0">${esc(cu?.company||'Unknown')}</div>
      ${sp?`<div style="font-size:11px;padding:1px 6px;border-radius:999px;background:${avColor(sp.name)}22;color:${avColor(sp.name)};font-weight:700;flex-shrink:0">${avLetter(sp.name)}</div>`:''}
    </div>
    <div class="qi-meta">
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        ${exp?`<span style="font-size:11px;font-weight:700;color:${exp.cls==='danger'?'var(--E)':exp.cls==='warn'?'var(--W)':'var(--P)'}">${exp.text}</span>`:`<span class="qi-date">${fmtDate(q.date)}</span>`}
        ${fu&&!od?'<span class="fu-badge"><span class="material-icons-round" style="font-size:10px">schedule</span> Follow-up</span>':''}
      </div>
      <span class="${chipCls(q.status)}">${q.status}</span>
    </div>
  </div>`;
}
function setQF(s){qFilt=s;document.querySelectorAll('#q-fbar .fc').forEach(c=>c.classList.toggle('on',c.textContent.trim()===s||(s==='all'&&c.textContent.trim()==='All')));renderQuotes();}
function clearDateFilter(){['q-date-from','q-date-to'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});renderQuotes();}
function toggleSearch(){const w=document.getElementById('q-srch-wrap');const show=!w.style.display||w.style.display==='none';w.style.display=show?'block':'none';if(show)setTimeout(()=>document.getElementById('q-srch-in')?.focus(),60);}
function closeSearch(){document.getElementById('q-srch-wrap').style.display='none';const e=document.getElementById('q-srch-in');if(e)e.value='';renderQuotes();}

// ── QUOTE DETAIL ────────────────────────────────────────
function openQD(qid){
  curQID=qid;
  const q=DB.quotes.find(x=>x.id===qid);if(!q)return;
  const cu=getCust(q.customerId),sp=getSP(q.salespersonId),tots=calcTotals(q);
  const mc=tots.margin<DB.settings.minMargin?'var(--E)':tots.margin<DB.settings.warnMargin?'#E65100':'var(--S)';
  const exp=expiryLabel(q);
  const revCount=(q.history||[]).length;
  const actCount=(q.activityLog||[]).length;
  document.getElementById('qd-id').textContent=q.isInvoice?q.invoiceId:q.id;
  document.getElementById('qd-body').innerHTML=`
    <div class="db2" style="margin-top:10px">
      <div class="dh2">
        <span class="dht">${q.isInvoice?'Invoice':'Quote'} Details</span>
        <div style="display:flex;gap:6px;align-items:center">
          ${exp?`<span style="font-size:11px;font-weight:700;color:${exp.cls==='danger'?'var(--E)':exp.cls==='warn'?'var(--W)':'var(--P)'}">${exp.text}</span>`:''}
          <span class="${chipCls(q.status)}">${q.status}</span>
        </div>
      </div>
      <div class="dr"><span class="dk">Customer</span><span class="dv fw7">${esc(cu?.company||'—')}</span></div>
      <div class="dr"><span class="dk">Contact</span><span class="dv">${esc(cu?.contact||'—')}</span></div>
      <div class="dr"><span class="dk">Sales Rep</span><span class="dv">${esc(sp?.name||'—')}</span></div>
      <div class="dr"><span class="dk">Date</span><span class="dv">${fmtDate(q.isInvoice?q.invoiceDate:q.date)}</span></div>
      <div class="dr"><span class="dk">Valid Until</span><span class="dv">${fmtDate(q.validUntil)}</span></div>
      <div class="dr"><span class="dk">Version</span><span class="dv">${esc(q.version||'v1')}${q.revision?' — '+esc(q.revision):''}</span></div>
      ${q.currency&&q.currency!==sym()?`<div class="dr"><span class="dk">Currency</span><span class="dv">${esc(q.currency)}</span></div>`:''}
    </div>
    <div class="db2">
      <div class="dh2"><span class="dht">Line Items</span></div>
      ${(q.items||[]).map(li=>{const lt=li.unitPrice*(li.qty||1)*(1-(li.discount||0));const p=getProd(li.itemId);return`<div class="dr"><span class="dk" style="flex:1">${esc(li.desc||li.itemId)}${p?.trackStock?`<div style="font-size:10px;color:${p.stock<li.qty?'var(--E)':'var(--t3)'}">${p.stock!=null?'Stock: '+p.stock:''}</div>`:''}</span><span class="dv" style="white-space:nowrap">${li.qty}× ${fmt(li.unitPrice)} = <b>${fmt(lt)}</b></span></div>`;}).join('')}
    </div>
    <div class="tots">
      <div class="tr2"><span class="tk">Subtotal</span><span class="tv">${fmt(tots.sub)}</span></div>
      ${tots.discAmt>0?`<div class="tr2"><span class="tk">Discount</span><span class="tv" style="color:var(--S)">−${fmt(tots.discAmt)}</span></div>`:''}
      <div class="tr2"><span class="tk">Net</span><span class="tv">${fmt(tots.net)}</span></div>
      <div class="tr2"><span class="tk">${q.taxable?DB.settings.taxLabel:'Tax Exempt'}</span><span class="tv">${q.taxable?fmt(tots.taxAmt):'—'}</span></div>
      <div class="tr2 grand"><span class="tk">Grand Total</span><span class="tv">${fmt(tots.total)}</span></div>
    </div>
    <div class="db2">
      <div class="dh2"><span class="dht">Profitability</span></div>
      <div class="dr"><span class="dk">Cost</span><span class="dv">${fmt(tots.cost)}</span></div>
      <div class="dr"><span class="dk">Gross Profit</span><span class="dv" style="color:${mc}">${fmt(tots.net-tots.cost)}</span></div>
      <div class="dr"><span class="dk">Margin</span><span class="dv" style="color:${mc}">${Math.round(tots.margin*100)}%${tots.margin<DB.settings.minMargin?' ⚠':''}</span></div>
    </div>
    ${q.isInvoice?renderPaymentBlock(q):''}
    ${q.notes?`<div class="db2"><div class="dh2"><span class="dht">Notes</span></div><div style="padding:12px 16px;font-size:14px;color:var(--t2);line-height:1.6">${esc(q.notes)}</div></div>`:''}
    <div style="display:flex;gap:8px;padding:8px 16px;flex-wrap:wrap">
      ${revCount>0?`<button class="btn bo" style="flex:1;min-width:130px" onclick="openRevHistory('${q.id}')"><span class="material-icons-round">history</span> History (${revCount})</button>`:''}
      ${actCount>0?`<button class="btn bo" style="flex:1;min-width:130px" onclick="openActivityLog('${q.id}')"><span class="material-icons-round">timeline</span> Activity (${actCount})</button>`:''}
      <button class="btn bo" style="flex:1;min-width:130px" onclick="openQRShare('${q.id}')"><span class="material-icons-round">qr_code</span> QR Code</button>
    </div>
    <div style="height:90px"></div>`;
  // Sticky bottom action bar
  document.getElementById('qd-actions').innerHTML=`
    <button class="btn bo" onclick="closeDlg('dlg-qd');setTimeout(()=>openQE('${q.id}'),120)"><span class="material-icons-round">edit</span> Edit</button>
    <button class="btn bp" onclick="openPreview('${q.id}')"><span class="material-icons-round">picture_as_pdf</span> PDF</button>
    <button class="btn btn-ton" onclick="openShareDialog('${q.id}')"><span class="material-icons-round">share</span> Share</button>
    <button class="ib" style="color:var(--E)" onclick="confirmAct('Delete this quote?',()=>softDelItem('quote','${q.id}'))"><span class="material-icons-round">delete</span></button>`;
  openDlg('dlg-qd');pushNav('qd-'+qid);
}

// ── PAYMENT TRACKING ───────────────────────────────────
function renderPaymentBlock(q){
  const tots=calcTotals(q);const pm=q.payment||{status:'Unpaid',amountPaid:0};
  const paid=pm.status==='Paid'?tots.total:pm.status==='Partially Paid'?(pm.amountPaid||0):0;
  const bal=tots.total-paid;
  const col=pm.status==='Paid'?'var(--S)':pm.status==='Partially Paid'?'var(--W)':'var(--E)';
  return`<div class="db2">
    <div class="dh2">
      <span class="dht">Payment Status</span>
      <button class="btn bp btn-sm" onclick="openPaymentEditor('${q.id}')"><span class="material-icons-round">edit</span> Update</button>
    </div>
    <div class="dr"><span class="dk">Status</span><span class="dv" style="color:${col};font-weight:700">${pm.status||'Unpaid'}</span></div>
    <div class="dr"><span class="dk">Amount Paid</span><span class="dv">${fmt(paid)}</span></div>
    <div class="dr"><span class="dk">Balance</span><span class="dv" style="color:${bal>0?'var(--E)':'var(--S)'};font-weight:700">${fmt(bal)}</span></div>
    ${paid>0?`<div class="dr" style="padding:4px 16px"><div class="pbar" style="margin:0"><div class="pfill" style="width:${Math.min(100,Math.round(paid/tots.total*100))}%;background:var(--S)"></div></div></div>`:''}
  </div>`;
}
function openPaymentEditor(qid){
  const q=DB.quotes.find(x=>x.id===qid);if(!q||!q.isInvoice)return;
  const tots=calcTotals(q);const pm=q.payment||{status:'Unpaid',amountPaid:0};
  const body=`<div class="db" style="padding:16px">
    <div class="fg"><label class="fl">Payment Status</label>${buildCustomSelect({id:'pay-status',label:'Status',options:['Unpaid','Partially Paid','Paid'].map(s=>({value:s,label:s})),value:pm.status||'Unpaid'})}</div>
    <div class="fg"><label class="fl">Amount Paid</label><input class="fi" type="number" id="pay-amt" value="${pm.amountPaid||0}" step="0.01" max="${tots.total}"></div>
    <div style="font-size:13px;color:var(--t2);margin-bottom:12px">Total: ${fmt(tots.total)}</div>
    <button class="btn bp btn-w" onclick="savePayment('${qid}')">Save Payment</button>
  </div>`;
  document.getElementById('set-ttl').textContent='Update Payment';
  document.getElementById('set-body').innerHTML=body;
  openDlg('dlg-set');
}
function savePayment(qid){
  const q=DB.quotes.find(x=>x.id===qid);if(!q)return;
  const status=v('pay-status')||'Unpaid';const amt=parseFloat(v('pay-amt'))||0;
  if(!q.payment)q.payment={};
  q.payment.status=status;q.payment.amountPaid=amt;
  logActivity(q,`Payment updated: ${status}${amt?' ('+fmt(amt)+')':''}`);
  save();closeDlg('dlg-set');closeDlg('dlg-qd');openQD(qid);snack('Payment updated');
}

// ── ACTIVITY LOG ────────────────────────────────────────
function openActivityLog(qid){
  const q=DB.quotes.find(x=>x.id===qid);if(!q)return;
  const log=(q.activityLog||[]).slice().reverse();
  document.getElementById('rev-body').innerHTML=`<div style="padding:10px 16px;font-size:11px;color:var(--t2);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Activity Log</div>`+
    (log.length===0?`<div class="empty"><span class="material-icons-round">timeline</span><div class="empty-t">No activity yet</div></div>`
    :log.map((a,i)=>`<div style="display:flex;gap:12px;padding:10px 16px;border-bottom:1px solid var(--ol2)">
      <div style="display:flex;flex-direction:column;align-items:center;gap:0"><div style="width:8px;height:8px;border-radius:50%;background:var(--P);margin-top:4px;flex-shrink:0"></div>${i<log.length-1?'<div style="width:2px;flex:1;background:var(--ol2);margin-top:4px"></div>':''}</div>
      <div style="flex:1"><div style="font-size:13px;font-weight:600">${esc(a.action)}</div><div style="font-size:11px;color:var(--t2);margin-top:2px">${esc(a.user||'System')} · ${fmtDate(a.ts?.slice(0,10))} ${a.ts?new Date(a.ts).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}):''}</div></div>
    </div>`).join(''));
  openDlg('dlg-rev');pushNav('activity-'+qid);
}

// ── QR CODE SHARE ───────────────────────────────────────
function openQRShare(qid){
  const q=DB.quotes.find(x=>x.id===qid);if(!q)return;
  const cu=getCust(q.customerId),tots=calcTotals(q);
  // Build a self-contained read-only quote summary as a data URL
  const co=getCo(q.companyId)||activeCo();
  const qrData=encodeURIComponent(JSON.stringify({id:q.isInvoice?q.invoiceId:q.id,customer:cu?.company,total:tots.total,currency:sym(),date:q.date,validUntil:q.validUntil,status:q.status}));
  const qrUrl=`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrData}`;
  document.getElementById('set-ttl').textContent='QR Code';
  document.getElementById('set-body').innerHTML=`<div style="padding:16px;text-align:center">
    <div style="font-size:14px;font-weight:700;margin-bottom:4px">${esc(q.isInvoice?q.invoiceId:q.id)}</div>
    <div style="font-size:13px;color:var(--t2);margin-bottom:16px">${esc(cu?.company||'—')} · ${fmt(tots.total)}</div>
    <div style="background:white;padding:16px;border-radius:12px;display:inline-block;margin-bottom:16px">
      <img src="${qrUrl}" width="180" height="180" alt="QR Code" style="display:block">
    </div>
    <div style="font-size:12px;color:var(--t2);margin-bottom:16px">Scan to view quote summary</div>
    <button class="btn bp btn-w" onclick="downloadQR('${qrUrl}','${q.isInvoice?q.invoiceId:q.id}')"><span class="material-icons-round">download</span> Save QR Code</button>
  </div>`;
  openDlg('dlg-set');pushNav('qr-'+qid);
}
function downloadQR(url,name){
  fetch(url).then(r=>r.blob()).then(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`QR_${name}.png`;a.click();}).catch(()=>snack('Download failed — check connection'));
}

// ── WIN ANIMATION ───────────────────────────────────────
function triggerWinAnimation(){
  const el=document.getElementById('win-anim');if(!el)return;
  el.innerHTML='';el.style.display='block';
  const emojis=['🎉','⭐','💰','🏆','✨'];
  for(let i=0;i<18;i++){
    const p=document.createElement('div');
    p.className='confetti-piece';
    p.style.cssText=`left:${Math.random()*100}%;animation-delay:${Math.random()*.8}s;animation-duration:${.8+Math.random()*.6}s;font-size:${18+Math.random()*14}px`;
    p.textContent=emojis[Math.floor(Math.random()*emojis.length)];
    el.appendChild(p);
  }
  setTimeout(()=>{el.style.display='none';el.innerHTML='';},2200);
}

// ── QUOTE ACTIONS ──────────────────────────────────────
function openQAct(qid){
  const id=qid||curQID;const q=DB.quotes.find(x=>x.id===id);if(!q)return;
  curQID=id;
  const others=['Draft','Sent','Won','Lost','Expired'].filter(s=>s!==q.status);
  const invHtml=q.isInvoice
    ?`<div class="si" onclick="revertToQuote('${q.id}');closeDlg('dlg-qact')"><div class="si-ic"><span class="material-icons-round">undo</span></div><div class="si-tx"><div class="si-m">Revert to Quote</div></div></div>`
    :`<div class="si" onclick="convertToInvoice('${q.id}');closeDlg('dlg-qact')"><div class="si-ic grn"><span class="material-icons-round">receipt</span></div><div class="si-tx"><div class="si-m">Convert to Invoice</div></div></div>`;
  document.getElementById('qact-body').innerHTML=`
    <div class="si" onclick="closeDlg('dlg-qact');closeDlg('dlg-qd');setTimeout(()=>openQE('${q.id}'),120)"><div class="si-ic"><span class="material-icons-round">edit</span></div><div class="si-tx"><div class="si-m">Edit Quote</div></div></div>
    <div class="si" onclick="dupQ('${q.id}');closeDlg('dlg-qact')"><div class="si-ic"><span class="material-icons-round">content_copy</span></div><div class="si-tx"><div class="si-m">Duplicate</div></div></div>
    <div class="si" onclick="saveAsTemplate('${q.id}');closeDlg('dlg-qact')"><div class="si-ic"><span class="material-icons-round">bookmark_add</span></div><div class="si-tx"><div class="si-m">Save as Template</div></div></div>
    ${invHtml}
    ${others.map(s=>`<div class="si" onclick="setQStat('${q.id}','${s}');closeDlg('dlg-qact')"><div class="si-ic"><span class="material-icons-round">label</span></div><div class="si-tx"><div class="si-m">Mark as ${s}</div></div></div>`).join('')}
    <div class="si" onclick="openRevHistory('${q.id}');closeDlg('dlg-qact')"><div class="si-ic"><span class="material-icons-round">history</span></div><div class="si-tx"><div class="si-m">Revision History</div><div class="si-s">${(q.history||[]).length} snapshots</div></div></div>
    <div class="si" onclick="openActivityLog('${q.id}');closeDlg('dlg-qact')"><div class="si-ic"><span class="material-icons-round">timeline</span></div><div class="si-tx"><div class="si-m">Activity Log</div></div></div>
    <div class="si" onclick="openQRShare('${q.id}');closeDlg('dlg-qact')"><div class="si-ic"><span class="material-icons-round">qr_code</span></div><div class="si-tx"><div class="si-m">QR Code</div></div></div>
    <div class="si" onclick="openPreview('${q.id}');closeDlg('dlg-qact')"><div class="si-ic"><span class="material-icons-round">preview</span></div><div class="si-tx"><div class="si-m">Preview PDF</div></div></div>
    <div class="si" onclick="openShareDialog('${q.id}');closeDlg('dlg-qact')"><div class="si-ic"><span class="material-icons-round">share</span></div><div class="si-tx"><div class="si-m">Share</div></div></div>
    <div class="si" onclick="confirmAct('Delete this quote?',()=>softDelItem('quote','${q.id}'))"><div class="si-ic red"><span class="material-icons-round">delete</span></div><div class="si-tx"><div class="si-m txt-e">Delete</div></div></div>`;
  openDlg('dlg-qact');pushNav('qact');
}
function convertToInvoice(qid){const q=DB.quotes.find(x=>x.id===qid);if(!q||q.isInvoice)return;const yr=new Date().getFullYear();const pfx=(DB.settings.invoicePrefix||'INV-')+yr+'-';const nums=DB.quotes.filter(x=>x.invoiceId&&x.invoiceId.startsWith(pfx)).map(x=>parseInt(x.invoiceId.replace(pfx,''))||0);q.isInvoice=true;q.invoiceId=pfx+String((nums.length?Math.max(...nums):0)+1).padStart(3,'0');q.invoiceDate=new Date().toISOString().slice(0,10);if(!q.payment)q.payment={status:'Unpaid',amountPaid:0};logActivity(q,'Converted to Invoice');save();closeDlg('dlg-qact');closeDlg('dlg-qd');snack('Converted to Invoice '+q.invoiceId);renderPage(curPage);}
function revertToQuote(qid){const q=DB.quotes.find(x=>x.id===qid);if(!q)return;confirmAct('Revert invoice back to quote?',()=>{q.isInvoice=false;q.invoiceId=null;q.invoiceDate=null;logActivity(q,'Reverted to quote');save();closeDlg('dlg-qd');renderPage(curPage);snack('Reverted to quote');});}
function setQStat(qid,s){
  const q=DB.quotes.find(x=>x.id===qid);if(!q)return;
  const old=q.status;q.status=s;
  logActivity(q,`Status changed: ${old} → ${s}`);
  if(s==='Won'){updateLTV(q.customerId);triggerWinAnimation();}
  if(old==='Won'&&s!=='Won')updateLTV(q.customerId);
  save();if(document.getElementById('dlg-qd').classList.contains('open'))openQD(qid);
  if(curPage==='dashboard')renderDash();snack('Marked as '+s);updateNavBadges();
}
function dupQ(qid){const q=DB.quotes.find(x=>x.id===qid);if(!q)return;const nq=JSON.parse(JSON.stringify(q));nq.id=nextQID();nq.date=new Date().toISOString().slice(0,10);const vd=new Date();vd.setDate(vd.getDate()+(DB.settings.quoteValidDays||30));nq.validUntil=vd.toISOString().slice(0,10);nq.status='Draft';nq.version='v1';nq.revision='Copy of '+q.id;nq.isInvoice=false;nq.invoiceId=null;nq.history=[];nq.activityLog=[{ts:new Date().toISOString(),action:'Duplicated from '+q.id,user:'You'}];DB.quotes.unshift(nq);save();closeDlg('dlg-qact');closeDlg('dlg-qd');renderPage(curPage);snack('Duplicated as '+nq.id);setTimeout(()=>openQD(nq.id),320);}


// ── REVISION HISTORY ────────────────────────────────────
function snapshotQuote(q){if(!q.history)q.history=[];q.history.push({ts:new Date().toISOString(),version:q.version,revision:q.revision,status:q.status,discount:q.discount,taxable:q.taxable,items:JSON.parse(JSON.stringify(q.items||[])),notes:q.notes,total:calcTotals(q).total});if(q.history.length>20)q.history.splice(0,q.history.length-20);}
function openRevHistory(qid){
  const q=DB.quotes.find(x=>x.id===qid);if(!q)return;
  const hist=(q.history||[]).slice().reverse();
  document.getElementById('rev-body').innerHTML=`<div style="padding:10px 16px;font-size:11px;color:var(--t2);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Revision Snapshots</div>`+
  (hist.length===0?`<div class="empty"><span class="material-icons-round">history</span><div class="empty-t">No snapshots yet</div><div class="empty-s">Saved each time you edit</div></div>`
  :hist.map((h,i)=>`<div class="rev-item${i===0?' current':''}" onclick="previewSnap(${JSON.stringify({ts:h.ts,version:h.version,revision:h.revision,status:h.status,total:h.total}).replace(/"/g,'&quot;')},'${qid}')"><div style="display:flex;gap:12px"><div class="rev-dot"></div><div style="flex:1"><div style="font-size:14px;font-weight:700">${esc(h.version||'v1')}${h.revision?' — '+esc(h.revision):''}</div><div style="font-size:12px;color:var(--t2)">${fmtDate(h.ts.slice(0,10))} · ${fmt(h.total)} · <span class="${chipCls(h.status)}">${h.status}</span></div></div>${i===0?'<span style="font-size:11px;background:var(--PC);color:var(--P);border-radius:999px;padding:2px 8px;font-weight:700">Latest</span>':''}</div></div>`).join(''));
  openDlg('dlg-rev');pushNav('rev-'+qid);
}
function previewSnap(snap,qid){snack(`${snap.version||'v1'}: ${fmt(snap.total)} · ${snap.status}`,'Restore',()=>restoreSnap(snap,qid));}
function restoreSnap(snap,qid){
  const q=DB.quotes.find(x=>x.id===qid);if(!q)return;
  confirmAct(`Restore snapshot "${snap.version||'v1'}"?`,()=>{
    const full=(q.history||[]).find(h=>h.ts===snap.ts);
    if(full){snapshotQuote(q);q.version=full.version;q.revision=full.revision;q.status=full.status;q.discount=full.discount;q.taxable=full.taxable;q.items=JSON.parse(JSON.stringify(full.items));q.notes=full.notes;logActivity(q,'Snapshot restored: '+snap.version);save();closeDlg('dlg-rev');openQD(qid);snack('Snapshot restored');}
  });
}

// ── TEMPLATES ───────────────────────────────────────────
function saveAsTemplate(qid){const q=DB.quotes.find(x=>x.id===qid);if(!q)return;const name=prompt('Template name:',q.revision||q.id);if(!name)return;if(!DB.templates)DB.templates=[];DB.templates.push({id:'TPL-'+uid().slice(0,6).toUpperCase(),name,createdAt:new Date().toISOString().slice(0,10),companyId:q.companyId,items:JSON.parse(JSON.stringify(q.items)),discount:q.discount,taxable:q.taxable,notes:q.notes,version:'v1'});save();snack(`Template "${name}" saved`);}
function openTemplates(){
  const tpls=DB.templates||[];
  document.getElementById('tpl-body').innerHTML=tpls.length===0?`<div class="empty"><span class="material-icons-round">bookmark</span><div class="empty-t">No templates yet</div><div class="empty-s">Open any quote → ⋮ → Save as Template</div></div>`
    :tpls.map(t=>`<div class="tpl-card"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px"><div style="font-size:15px;font-weight:700">${esc(t.name)}</div><div style="display:flex;gap:6px"><button class="btn bp btn-sm" onclick="useTemplate('${t.id}');closeDlg('dlg-tpl')">Use</button><button class="btn bd2 btn-sm" onclick="confirmAct('Delete template?',()=>deleteTpl('${t.id}'))">Del</button></div></div><div style="font-size:12px;color:var(--t2)">${(t.items||[]).length} items · ${fmtDate(t.createdAt)}</div><div style="font-size:12px;color:var(--t2);margin-top:2px">${(t.items||[]).slice(0,3).map(i=>esc(i.desc||i.itemId)).join(', ')}${(t.items||[]).length>3?' +'+((t.items||[]).length-3)+' more':''}</div></div>`).join('');
  openDlg('dlg-tpl');pushNav('templates');
}
function deleteTpl(id){DB.templates=(DB.templates||[]).filter(t=>t.id!==id);save();openTemplates();snack('Template deleted');}
function useTemplate(tplId){
  const t=DB.templates.find(x=>x.id===tplId);if(!t)return;
  const co=activeCo();qeStep=0;
  const vd=new Date();vd.setDate(vd.getDate()+(DB.settings.quoteValidDays||30));
  qeD={id:nextQID(),companyId:t.companyId||co?.id||'',customerId:'',date:new Date().toISOString().slice(0,10),validUntil:vd.toISOString().slice(0,10),status:'Draft',version:'v1',revision:'From template: '+t.name,salespersonId:acoSP()[0]?.id||'',notes:t.notes||'',taxable:t.taxable!==undefined?t.taxable:true,discount:t.discount||0,currency:sym(),items:JSON.parse(JSON.stringify(t.items||[])),history:[],activityLog:[{ts:new Date().toISOString(),action:'Created from template: '+t.name,user:'You'}],payment:{status:'Unpaid',amountPaid:0}};
  document.getElementById('qe-ttl').textContent='New Quote (Template)';
  renderQEStep();openDlg('dlg-qe');pushNav('qe-new');
}

// ── QUOTE EDITOR ────────────────────────────────────────
function openQE(qid){
  qeStep=0;const co=activeCo();
  if(qid){
    qeD=JSON.parse(JSON.stringify(DB.quotes.find(x=>x.id===qid)||{}));
    if(!qeD.history)qeD.history=[];if(!qeD.activityLog)qeD.activityLog=[];
    if(!qeD.currency)qeD.currency=sym();
    snapshotQuote(qeD);
  }else{
    const vd=new Date();vd.setDate(vd.getDate()+(DB.settings.quoteValidDays||30));
    qeD={id:nextQID(),companyId:co?.id||'',customerId:'',date:new Date().toISOString().slice(0,10),validUntil:vd.toISOString().slice(0,10),status:'Draft',version:'v1',revision:'',salespersonId:acoSP()[0]?.id||'',notes:'',taxable:true,discount:0,currency:sym(),items:[],history:[],activityLog:[{ts:new Date().toISOString(),action:'Created',user:'You'}],payment:{status:'Unpaid',amountPaid:0}};
  }
  document.getElementById('qe-ttl').textContent=qid?'Edit Quote':'New Quote';
  renderQEStep();openDlg('dlg-qe');pushNav('qe-'+(qid||'new'));
}
function renderQEStep(){
  for(let i=0;i<4;i++){const d=document.getElementById('sd'+i);d.className='sd'+(i<qeStep?' d':i===qeStep?' a':'');if(i<3)document.getElementById('sl'+i).className='sl'+(i<qeStep?' d':'');}
  document.getElementById('qe-bk').style.display=qeStep>0?'':'none';
  document.getElementById('qe-nx').textContent=qeStep===3?'✓ Save Quote':'Next →';
  const body=document.getElementById('qe-body');
  if(qeStep===0)renderQE0(body);
  if(qeStep===1)renderQE1(body);
  if(qeStep===2)renderQE2(body);
  if(qeStep===3)renderQE3(body);
}
function renderQE0(body){
  const sps=acoSP(),cos=DB.companies;
  const currencies=Object.keys(DB.settings.exchangeRates||{'KSh':1,'USD':0.0077,'EUR':0.0071});
  body.innerHTML=`<div class="fg"><label class="fl">Quote ID</label><input class="fi" id="qe-id" value="${esc(qeD.id)}" readonly></div>
  <div class="fr"><div class="fg"><label class="fl">Date *</label><input class="fi" type="date" id="qe-date" value="${qeD.date}"></div><div class="fg"><label class="fl">Valid Until *</label><input class="fi" type="date" id="qe-valid" value="${qeD.validUntil}"></div></div>
  <div class="fr"><div class="fg"><label class="fl">Status</label>${buildCustomSelect({id:'qe-status',label:'Status',options:['Draft','Sent','Won','Lost','Expired'].map(s=>({value:s,label:s})),value:qeD.status})}</div><div class="fg"><label class="fl">Version</label><input class="fi" id="qe-ver" value="${esc(qeD.version||'v1')}"></div></div>
  <div class="fg"><label class="fl">Salesperson</label>${buildCustomSelect({id:'qe-sp',label:'Salesperson',placeholder:'— None —',options:[{value:'',label:'— None —'},...sps.map(s=>({value:s.id,label:s.name,sub:s.title||''}))],value:qeD.salespersonId||'',searchable:sps.length>4})}</div>
  <div class="fg"><label class="fl">Company Profile</label>${buildCustomSelect({id:'qe-co',label:'Company',options:cos.map(c=>({value:c.id,label:c.name})),value:qeD.companyId})}</div>
  <div class="fr"><div class="fg"><label class="fl">Overall Discount %</label><input class="fi" type="number" id="qe-disc" value="${Math.round((qeD.discount||0)*100)}" min="0" max="100"></div><div class="fg"><label class="fl">Currency</label>${buildCustomSelect({id:'qe-curr',label:'Currency',options:currencies.map(c=>({value:c,label:c})),value:qeD.currency||sym()})}</div></div>
  <div class="fg"><label class="fl" style="display:flex;justify-content:space-between">Taxable<button class="tog ${qeD.taxable?'on':''}" id="qe-tax" onclick="this.classList.toggle('on')"></button></label></div>
  <div class="fg"><label class="fl">Revision Note</label><input class="fi" id="qe-rev" value="${esc(qeD.revision||'')}" placeholder="e.g. Initial proposal / Revised scope"></div>`;
}
function renderQE1(body){
  const custs=acoCusts();
  body.innerHTML=`<div class="fg"><label class="fl">Select Customer *</label>${buildCustomSelect({id:'qe-cust',label:'Customer',placeholder:'— Select —',options:[{value:'',label:'— Select a customer —'},...custs.map(c=>({value:c.id,label:c.company,sub:c.contact+' · '+(c.phone||'')}))],value:qeD.customerId||'',searchable:true})}</div>
  <div id="qe-cust-prev"></div>
  <div style="text-align:center;padding:8px 0;color:var(--t3);font-size:13px">— or —</div>
  <button class="btn bo btn-w" onclick="openCustEd(null,true)"><span class="material-icons-round">person_add</span> Create New Customer</button>`;
  previewCust();
}
function previewCust(){const id=v('qe-cust'),el=document.getElementById('qe-cust-prev');if(!el)return;const c=getCust(id);if(!c){el.innerHTML='';return;}el.innerHTML=`<div class="db2" style="margin:8px 0"><div class="dr"><span class="dk">Company</span><span class="dv">${esc(c.company)}</span></div><div class="dr"><span class="dk">Contact</span><span class="dv">${esc(c.contact)}</span></div><div class="dr"><span class="dk">Email</span><span class="dv">${esc(c.email||'—')}</span></div><div class="dr"><span class="dk">Tier</span><span class="dv"><span class="tier-${c.tier||'Bronze'}">${c.tier||'Bronze'}</span></span></div></div>`;}
function renderQE2(body){
  if(!qeD.items)qeD.items=[];
  body.innerHTML=`<div id="qe-items"></div><button class="btn btn-ton btn-w" style="margin-top:8px" onclick="addLI()"><span class="material-icons-round">add</span> Add Line Item</button>`;
  renderQEItems();updateLiveTotals();
}
function updateLiveTotals(){
  const bar=document.getElementById('qe-live-tots');if(!bar)return;
  const tots=calcTotals(qeD);
  bar.innerHTML=`<span style="font-size:12px;color:var(--t2)">Sub: <b>${fmt(tots.sub)}</b></span><span style="font-size:12px;color:var(--t2)">${qeD.taxable?DB.settings.taxLabel+': <b>'+fmt(tots.taxAmt)+'</b>':''}</span><span style="font-size:14px;font-weight:800;color:var(--P)">Total: ${fmt(tots.total)}</span>`;
}
function renderQEItems(){
  const el=document.getElementById('qe-items');if(!el)return;
  if(!qeD.items.length){el.innerHTML=`<div class="empty" style="padding:20px"><span class="material-icons-round">playlist_add</span><div class="empty-t">No items yet</div><div class="empty-s">Search from ${acoInv().length} products or type to add a custom item</div></div>`;updateLiveTotals();return;}
  el.innerHTML=qeD.items.map((li,i)=>{
    const lt=li.unitPrice*(li.qty||1)*(1-(li.discount||0));const prod=getProd(li.itemId);
    const stockWarn=prod?.trackStock&&prod.stock!=null&&prod.stock<li.qty;
    return`<div class="lir" id="lir-${i}"><div class="lir-top"><div style="flex:1;position:relative"><input class="fi ac-input" id="ac-input-${i}" style="width:100%;font-size:13px" placeholder="Search products…" value="${esc(li.desc||li.itemId||'')}" autocomplete="off" oninput="acSearch(${i},this.value)" onfocus="acSearch(${i},this.value)" onkeydown="acKeydown(event,${i})">${prod?'<span class="material-icons-round" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:15px;color:var(--S);pointer-events:none">check_circle</span>':''}<div class="ac-dropdown" id="ac-drop-${i}" style="display:none"></div></div><button class="ib" style="background:var(--E);color:#fff;width:30px;height:30px;border-radius:8px;flex-shrink:0" onclick="removeLI(${i})"><span class="material-icons-round" style="font-size:16px">close</span></button></div>
    ${prod?`<div style="font-size:11px;color:var(--t2);margin:-2px 0 6px;padding-left:2px;display:flex;align-items:center;gap:6px"><span style="background:var(--PC);color:var(--P);border-radius:4px;padding:1px 6px;font-size:10px;font-weight:600">${esc(prod.category)}</span>${prod.trackStock?`<span style="font-size:10px;color:${stockWarn?'var(--E)':'var(--t3)'}">Stock: ${prod.stock}</span>`:''}${stockWarn?'<span style="color:var(--E);font-size:10px;font-weight:700">⚠ Low stock</span>':''}</div>`:''}
    <div class="fr3"><div><div class="fl" style="margin-bottom:3px">Qty</div><input class="fi" type="number" id="li-qty-${i}" value="${li.qty||1}" min="1" onchange="liFC(${i},'qty',parseFloat(this.value)||1)"></div><div><div class="fl" style="margin-bottom:3px">Unit Price</div><input class="fi" type="number" id="li-price-${i}" value="${li.unitPrice||0}" step="0.01" onchange="liFC(${i},'unitPrice',parseFloat(this.value)||0)"></div><div><div class="fl" style="margin-bottom:3px">Disc %</div><input class="fi" type="number" id="li-disc-${i}" value="${Math.round((li.discount||0)*100)}" min="0" max="100" onchange="liFC(${i},'discount',(parseFloat(this.value)||0)/100)"></div></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px"><span style="font-size:12px;color:var(--t2)">${prod?esc(prod.name):li.desc?'Custom item':''}</span><span id="li-tot-${i}" style="font-weight:800;font-size:14px;color:var(--P)">${fmt(lt)}</span></div></div>`;
  }).join('');
  updateLiveTotals();
}
function acSearch(i,query){
  const drop=document.getElementById('ac-drop-'+i);if(!drop)return;
  const q=query.trim().toLowerCase();if(!q){drop.style.display='none';return;}
  const results=acoInv().map(p=>{const nm=p.name.toLowerCase(),id=p.id.toLowerCase(),ds=(p.description||'').toLowerCase();let sc=0;if(nm.startsWith(q))sc=3;else if(nm.includes(q))sc=2;else if(id.includes(q))sc=1;else if(ds.includes(q))sc=0.5;return{p,sc};}).filter(x=>x.sc>0).sort((a,b)=>b.sc-a.sc).slice(0,8);
  if(!results.length){drop.innerHTML=`<div class="ac-item ac-custom" onclick="acSelectCustom(${i},this.dataset.q)" data-q="${esc(query)}"><span class="material-icons-round" style="font-size:18px;color:var(--P)">add_circle</span><div><div style="font-size:13px;font-weight:600">Use "${esc(query)}" as custom item</div><div style="font-size:11px;color:var(--t2)">Enter price manually</div></div></div>`;drop.style.display='block';return;}
  drop.innerHTML=results.map(({p})=>{const price=p.unitCost*(1+p.markup);const nm=p.name;const idx=nm.toLowerCase().indexOf(q);const hl=idx>=0?esc(nm.slice(0,idx))+'<b>'+esc(nm.slice(idx,idx+q.length))+'</b>'+esc(nm.slice(idx+q.length)):esc(nm);const mg=Math.round(productMargin(p)*100);const mgCol=mg<DB.settings.minMargin*100?'var(--E)':mg<DB.settings.warnMargin*100?'var(--W)':'var(--S)';return`<div class="ac-item" onclick="acSelect(${i},'${p.id}')"><div style="flex:1"><div style="font-size:13px;font-weight:600">${hl}</div><div style="font-size:11px;color:var(--t2)">${esc(p.id)} · ${esc(p.category)}${p.trackStock&&p.stock!=null?' · Stock: '+p.stock:''}</div></div><div style="text-align:right"><div style="font-size:13px;font-weight:700;color:var(--P)">${fmt(price)}</div><div style="font-size:10px;color:${mgCol};font-weight:600">${mg}% margin</div></div></div>`;}).join('');
  drop.style.display='block';
}
function acSelect(i,prodId){const p=getProd(prodId);if(!p)return;const price=p.unitCost*(1+p.markup);qeD.items[i].itemId=p.id;qeD.items[i].desc=p.name;qeD.items[i].unitPrice=price;document.getElementById('ac-drop-'+i).style.display='none';setTimeout(()=>renderQEItems(),50);}
function acSelectCustom(i,desc){qeD.items[i].itemId='';qeD.items[i].desc=desc;document.getElementById('ac-drop-'+i).style.display='none';renderQEItems();setTimeout(()=>{const pr=document.getElementById('li-price-'+i);if(pr)pr.select();},60);}
function acKeydown(event,i){const drop=document.getElementById('ac-drop-'+i);if(!drop||drop.style.display==='none')return;const items=drop.querySelectorAll('.ac-item');if(!items.length)return;let active=drop.querySelector('.ac-active'),idx=Array.from(items).indexOf(active);if(event.key==='ArrowDown'){event.preventDefault();idx=Math.min(idx+1,items.length-1);}else if(event.key==='ArrowUp'){event.preventDefault();idx=Math.max(idx-1,0);}else if(event.key==='Enter'&&active){event.preventDefault();active.click();return;}else if(event.key==='Escape'){drop.style.display='none';return;}else return;items.forEach(el=>el.classList.remove('ac-active'));if(idx>=0){items[idx].classList.add('ac-active');items[idx].scrollIntoView({block:'nearest'});}}
document.addEventListener('click',e=>{if(!e.target.closest('.lir'))document.querySelectorAll('.ac-dropdown').forEach(d=>d.style.display='none');});
function addLI(){qeD.items.push({itemId:'',desc:'',qty:1,unitPrice:0,discount:0});renderQEItems();}
function removeLI(i){qeD.items.splice(i,1);renderQEItems();}
function liFC(i,f,val){if(!qeD.items[i])return;qeD.items[i][f]=val;const lt=qeD.items[i].unitPrice*(qeD.items[i].qty||1)*(1-(qeD.items[i].discount||0));const totEl=document.getElementById('li-tot-'+i);if(totEl)totEl.textContent=fmt(lt);updateLiveTotals();}
function renderQE3(body){
  collectQE(qeStep);const q=qeD,tots=calcTotals(q),cu=getCust(q.customerId);
  const mc=tots.margin<DB.settings.minMargin?'var(--E)':tots.margin<DB.settings.warnMargin?'#E65100':'var(--S)';
  body.innerHTML=`<div style="background:var(--su2);border-radius:12px;padding:16px;margin-bottom:14px"><div style="font-size:12px;color:var(--t2)">Grand Total ${q.currency?'('+q.currency+')':''}</div><div style="font-size:28px;font-weight:800;color:var(--P);line-height:1">${fmt(tots.total)}</div><div style="font-size:13px;color:${mc};margin-top:5px">Margin: ${Math.round(tots.margin*100)}%${tots.margin<DB.settings.minMargin?' ⚠ Below minimum':''}</div></div>
  <div class="db2" style="margin:0 0 12px"><div class="dr"><span class="dk">Quote ID</span><span class="dv">${esc(q.id)}</span></div><div class="dr"><span class="dk">Customer</span><span class="dv">${esc(cu?.company||'—')}</span></div><div class="dr"><span class="dk">Status</span><span class="dv"><span class="${chipCls(q.status)}">${q.status}</span></span></div><div class="dr"><span class="dk">Valid Until</span><span class="dv">${fmtDate(q.validUntil)}</span></div><div class="dr"><span class="dk">Items</span><span class="dv">${(q.items||[]).length} line item(s)</span></div></div>
  <div class="tots"><div class="tr2"><span class="tk">Subtotal</span><span class="tv">${fmt(tots.sub)}</span></div>${tots.discAmt>0?`<div class="tr2"><span class="tk">Discount</span><span class="tv" style="color:var(--S)">−${fmt(tots.discAmt)}</span></div>`:''}<div class="tr2"><span class="tk">Net</span><span class="tv">${fmt(tots.net)}</span></div><div class="tr2"><span class="tk">${q.taxable?DB.settings.taxLabel:'Tax Exempt'}</span><span class="tv">${q.taxable?fmt(tots.taxAmt):'—'}</span></div><div class="tr2 grand"><span class="tk">Grand Total</span><span class="tv">${fmt(tots.total)}</span></div></div>
  <div class="fg" style="margin-top:14px"><label class="fl">Notes</label><textarea class="fi" id="qe-notes">${esc(q.notes||'')}</textarea></div>`;
}
function collectQE(step){
  if(step===0){qeD.date=v('qe-date')||qeD.date;qeD.validUntil=v('qe-valid')||qeD.validUntil;qeD.status=v('qe-status')||qeD.status;qeD.salespersonId=v('qe-sp');qeD.companyId=v('qe-co')||qeD.companyId;qeD.version=v('qe-ver')||qeD.version;qeD.discount=(parseFloat(v('qe-disc'))||0)/100;qeD.taxable=!!document.getElementById('qe-tax')?.classList.contains('on');qeD.revision=v('qe-rev');qeD.currency=v('qe-curr')||sym();}
  if(step===1){qeD.customerId=v('qe-cust')||qeD.customerId;}
  if(step===3){qeD.notes=v('qe-notes');}
}
function qeNext(){collectQE(qeStep);if(qeStep===3){qeSave();return;}if(qeStep===1&&!qeD.customerId){snack('Please select a customer first');return;}qeStep++;renderQEStep();}
function qeBack(){collectQE(qeStep);if(qeStep>0){qeStep--;renderQEStep();}}
function qeSave(){
  collectQE(qeStep);
  if(!qeD.customerId){snack('Please select a customer');qeStep=1;renderQEStep();return;}
  if(!qeD.items||!qeD.items.length){snack('Add at least one item');qeStep=2;renderQEStep();return;}
  const isNew=!DB.quotes.find(q=>q.id===qeD.id);
  const idx=DB.quotes.findIndex(q=>q.id===qeD.id);
  if(idx>=0)DB.quotes[idx]=qeD;else DB.quotes.unshift(qeD);
  if(qeD.status==='Won')updateLTV(qeD.customerId);
  // Deduct stock
  (qeD.items||[]).forEach(li=>{
    const p=getProd(li.itemId);
    if(p&&p.trackStock&&p.stock!=null&&isNew)p.stock=Math.max(0,p.stock-(li.qty||1));
  });
  if(!isNew)logActivity(qeD,'Quote edited');
  save();closeDlg('dlg-qe');renderPage(curPage);snack(qeD.id+' saved ✓');updateNavBadges();
  setTimeout(()=>openQD(qeD.id),360);
}

// ── ANALYTICS ───────────────────────────────────────────
function openAnalytics(){
  const qs=acoQuotes(),sps=acoSP(),custs=acoCusts(),inv=acoInv();
  const won=qs.filter(q=>q.status==='Won'),sent=qs.filter(q=>q.status==='Sent'),lost=qs.filter(q=>q.status==='Lost');
  const total=qs.length,winRate=total>0?Math.round(won.length/total*100):0;
  const avgDeal=won.length>0?won.reduce((s,q)=>s+calcTotals(q).total,0)/won.length:0;
  const pipeline=sent.reduce((s,q)=>s+calcTotals(q).total,0);
  const avgMargin=won.length>0?won.reduce((s,q)=>s+calcTotals(q).margin,0)/won.length:0;
  // Product analytics — best performing
  const prodStats={};
  won.forEach(q=>(q.items||[]).forEach(li=>{if(!prodStats[li.itemId])prodStats[li.itemId]={id:li.itemId,name:li.desc||li.itemId,count:0,rev:0};prodStats[li.itemId].count+=li.qty||1;prodStats[li.itemId].rev+=li.unitPrice*(li.qty||1)*(1-(li.discount||0));}));
  const topProds=Object.values(prodStats).sort((a,b)=>b.rev-a.rev).slice(0,5);
  const custRev=custs.map(c=>{const cw=won.filter(q=>q.customerId===c.id);return{name:c.company,rev:cw.reduce((s,q)=>s+calcTotals(q).total,0),n:cw.length};}).filter(x=>x.rev>0).sort((a,b)=>b.rev-a.rev).slice(0,5);
  const spPerf=sps.map(sp=>{const sq=qs.filter(q=>q.salespersonId===sp.id);const sw=sq.filter(q=>q.status==='Won');return{name:sp.name,total:sq.length,won:sw.length,rev:sw.reduce((s,q)=>s+calcTotals(q).total,0),rate:sq.length>0?Math.round(sw.length/sq.length*100):0};}).sort((a,b)=>b.rev-a.rev);
  document.getElementById('analytics-body').innerHTML=`
  <div class="met" style="grid-template-columns:1fr 1fr"><div class="mc bl"><div class="mv">${winRate}%</div><div class="mlb">Win Rate</div></div><div class="mc gr"><div class="mv" style="font-size:16px">${fmtCompact(avgDeal)}</div><div class="mlb">Avg Deal</div></div><div class="mc or"><div class="mv" style="font-size:16px">${fmtCompact(pipeline)}</div><div class="mlb">Pipeline</div></div><div class="mc"><div class="mv">${Math.round(avgMargin*100)}%</div><div class="mlb">Avg Margin</div></div></div>
  <div class="st">Quote Funnel</div>
  <div style="margin:0 16px;background:var(--su);border-radius:12px;padding:14px 16px;box-shadow:var(--sh)">${[['Draft',qs.filter(q=>q.status==='Draft').length,'#4285F4'],['Sent',sent.length,'#F9AB00'],['Won',won.length,'#34A853'],['Lost',lost.length,'#EA4335'],['Expired',qs.filter(q=>q.status==='Expired').length,'#9AA0A6']].map(([s,n,c])=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--ol2)"><div style="display:flex;align-items:center;gap:8px"><span class="cdot" style="background:${c}"></span><span style="font-size:14px;font-weight:600">${s}</span></div><div style="display:flex;align-items:center;gap:10px"><div style="width:80px;height:6px;background:var(--ol2);border-radius:3px"><div style="height:100%;border-radius:3px;background:${c};width:${total?Math.round(n/total*100):0}%"></div></div><span style="font-size:13px;font-weight:700;min-width:20px;text-align:right">${n}</span></div></div>`).join('')}</div>
  ${topProds.length?`<div class="st">Best Performing Products</div><div style="margin:0 16px;background:var(--su);border-radius:12px;box-shadow:var(--sh);overflow:hidden">${topProds.map((p,i)=>`<div style="padding:11px 16px;border-bottom:1px solid var(--ol2);display:flex;gap:12px;align-items:center"><div style="font-size:15px;font-weight:900;color:var(--t3);width:20px">${i+1}</div><div style="flex:1"><div style="font-size:13px;font-weight:700">${esc(p.name)}</div><div style="font-size:11px;color:var(--t2)">${p.count} units sold</div></div><div style="font-size:13px;font-weight:700;color:var(--P)">${fmtCompact(p.rev)}</div></div>`).join('')}</div>`:''}
  ${spPerf.length?`<div class="st">Salesperson Performance</div><div style="margin:0 16px;background:var(--su);border-radius:12px;box-shadow:var(--sh);overflow:hidden">${spPerf.map(sp=>`<div style="padding:12px 16px;border-bottom:1px solid var(--ol2)"><div style="display:flex;justify-content:space-between"><div style="font-size:14px;font-weight:700">${esc(sp.name)}</div><div style="font-size:13px;font-weight:700;color:var(--P)">${fmtCompact(sp.rev)}</div></div><div style="font-size:12px;color:var(--t2);margin-top:3px">${sp.total} quotes · ${sp.won} won · ${sp.rate}% win rate</div></div>`).join('')}</div>`:''}
  ${custRev.length?`<div class="st">Top Customers</div><div style="margin:0 16px;background:var(--su);border-radius:12px;box-shadow:var(--sh);overflow:hidden">${custRev.map((c,i)=>`<div style="padding:12px 16px;border-bottom:1px solid var(--ol2);display:flex;gap:12px;align-items:center"><div style="font-size:16px;font-weight:900;color:var(--t3);width:20px">${i+1}</div><div style="flex:1"><div style="font-size:14px;font-weight:700">${esc(c.name)}</div><div style="font-size:12px;color:var(--t2)">${c.n} deal${c.n!==1?'s':''} won</div></div><div style="font-size:14px;font-weight:700;color:var(--P)">${fmt(c.rev)}</div></div>`).join('')}</div>`:''}
  <div class="sp"></div>`;
  openDlg('dlg-analytics');pushNav('analytics');
}


// ── PDF / PREVIEW ────────────────────────────────────────
function numberToWords(n){const ones=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];const tens=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];if(n===0)return'Zero';function conv(n){if(n<20)return ones[n];if(n<100)return tens[Math.floor(n/10)]+(n%10?' '+ones[n%10]:'');return ones[Math.floor(n/100)]+' Hundred'+(n%100?' '+conv(n%100):'');}const m=Math.floor(n/1000000),th=Math.floor((n%1000000)/1000),rem=n%1000;let r='';if(m)r+=conv(m)+' Million ';if(th)r+=conv(th)+' Thousand ';if(rem)r+=conv(rem);return r.trim();}
function amountInWords(total){const s=DB.settings.currencySymbol||'KSh';const int=Math.floor(total),cents=Math.round((total-int)*100);let w=s+' '+numberToWords(int)+' Only';if(cents>0)w+=' and '+numberToWords(cents)+' Cents';return w;}
function openPreview(qid){curQID=qid;buildPreview(qid);openDlg('dlg-prev');pushNav('prev-'+qid);}
function buildPreview(qid){
  const q=DB.quotes.find(x=>x.id===qid); if(!q) return;
  const co=getCo(q.companyId)||activeCo();
  const cu=getCust(q.customerId);
  const sp=getSP(q.salespersonId);
  const tots=calcTotals(q);
  const acc=ACCENTS.find(a=>a.name===DB.settings.accentName)||ACCENTS[0];
  const ac=acc.lc;
  const sym2=q.currency||DB.settings.currencySymbol||'KSh';
  const fmtN=n=>Number(n||0).toLocaleString('en-KE',{minimumFractionDigits:2,maximumFractionDigits:2});

  // ── Logo HTML ──
  const logoHTML=co?.logoImg
    ?`<div class="qv-logo-img"><img src="${co.logoImg}" alt="logo" crossorigin="anonymous"></div>`
    :`<div class="qv-logo-img" style="background:${co?.logoColor||ac};display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px;font-weight:900">${esc(co?.logoText||'A')}</div>`;

  // ── Line item rows ──
  const rows=(q.items||[]).map((li,i)=>{
    const lt=li.unitPrice*(li.qty||1)*(1-(li.discount||0));
    return `<tr><td>${i+1}.</td><td><div class="qv-tbl-desc">${esc(li.desc||li.itemId)}</div></td>`+
      `<td style="text-align:center">${li.qty||1}</td>`+
      `<td style="text-align:right">${fmtN(li.unitPrice)}</td>`+
      `<td style="text-align:right">${li.discount?'−'+Math.round(li.discount*100)+'%':'—'}</td>`+
      `<td style="text-align:right;font-weight:700">${fmtN(lt)}</td></tr>`;
  }).join('');

  // ── Payment methods ──
  const PR=(label,val,bold=true)=>val
    ?`<div class="qv-pay-row">${esc(label)}: ${bold?`<b>${esc(String(val))}</b>`:esc(String(val))}</div>`:''
  const pmHTML=(co?.paymentMethods||[]).map(pm=>{
    if(pm.type==='Bank') return `<div class="qv-pay-block"><div class="qv-pay-type" style="color:${ac}">🏦 BANK TRANSFER</div>${PR('Bank',pm.bankName)}${PR('Branch',pm.branch)}${PR('Account Name',pm.accName)}${PR('Account No',pm.accNum)}${PR('SWIFT',pm.swift)}${PR('Reference',pm.bankRef,false)}</div>`;
    if(pm.type==='M-Pesa Paybill') return `<div class="qv-pay-block"><div class="qv-pay-type" style="color:#2E7D32">📱 LIPA NA M-PESA — PAYBILL</div>${PR('Paybill No',pm.paybillBusiness)}${PR('Account No',pm.paybillAccount)}${PR('Business Name',pm.mpesaName)}</div>`;
    if(pm.type==='M-Pesa Till') return `<div class="qv-pay-block"><div class="qv-pay-type" style="color:#2E7D32">📱 LIPA NA M-PESA — BUY GOODS</div>${PR('Till No',pm.tillNumber)}${PR('Store Name',pm.mpesaName)}${PR('Reference',pm.tillRef,false)}</div>`;
    if(pm.type==='M-Pesa Send Money') return `<div class="qv-pay-block"><div class="qv-pay-type" style="color:#2E7D32">📱 M-PESA SEND MONEY</div>${PR('Phone No',pm.sendMoneyPhone)}${PR('Registered Name',pm.sendMoneyName)}${PR('Reference',pm.sendMoneyRef,false)}</div>`;
    if(pm.type==='Pochi la Biashara') return `<div class="qv-pay-block"><div class="qv-pay-type" style="color:#1565C0">💼 POCHI LA BIASHARA</div>${PR('Phone No',pm.pochiPhone)}${PR('Business Name',pm.pochiName)}${PR('Reference',pm.pochiRef,false)}</div>`;
    if(pm.type==='Cash') return `<div class="qv-pay-block"><div class="qv-pay-type" style="color:#6A1B9A">💵 CASH PAYMENT</div>${PR('Location',pm.cashLocation)}${PR('Contact',pm.cashContact,false)}${pm.details?`<div class="qv-pay-row">${esc(pm.details)}</div>`:''}</div>`;
    if(pm.type==='Cheque') return `<div class="qv-pay-block"><div class="qv-pay-type" style="color:#E65100">📄 CHEQUE PAYMENT</div>${PR('Payable To',pm.chequePayable)}${PR('Deliver To',pm.chequeAddress,false)}${pm.details?`<div class="qv-pay-row">${esc(pm.details)}</div>`:''}</div>`;
    return `<div class="qv-pay-block"><div class="qv-pay-type">${esc(pm.otherName||pm.type)}</div>${pm.details?`<div class="qv-pay-row">${esc(pm.details)}</div>`:''}</div>`;
  }).join('');

  // ── Terms HTML ──
  const termsHTML=(co?.terms||'').split('\n').filter(t=>t.trim()).map((t,i)=>
    `<div style="display:flex;gap:8px;margin-bottom:4px;align-items:flex-start">`+
    `<span style="font-size:8pt;color:${ac};font-weight:700;flex-shrink:0;min-width:18px;line-height:1.7">${i+1}.</span>`+
    `<span style="font-size:8pt;color:#555;line-height:1.7">${esc(t.replace(/^\d+\.\s*/,''))}</span></div>`
  ).join('');

  // ── Watermark ──
  const watermark={Won:'ACCEPTED',Lost:'DECLINED',Draft:'DRAFT'}[q.status]||'';

  // ── Signature ──
  const sigHTML=sp?.signatureImg
    ?`<div style="height:60px;display:flex;align-items:flex-end;justify-content:center;margin-bottom:4px"><img src="${sp.signatureImg}" style="max-height:56px;max-width:180px;object-fit:contain" crossorigin="anonymous" alt="signature"></div><div style="border-bottom:1.5px solid #BBB;margin-bottom:5px"></div>`
    :`<div class="qv-sig-line"></div>`;

  // ── Full document HTML ──
  const fullHTML=`
    ${watermark?`<div class="qv-wm">${watermark}</div>`:''}
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">
      <div>
        <div class="qv-title" style="color:${ac}">${q.isInvoice?'Invoice':'Quotation'}</div>
        <div class="qv-meta">
          ${q.isInvoice?'Invoice':'Quotation'} # &nbsp;<b>${esc(q.isInvoice?q.invoiceId:q.id)}</b><br>
          Date &nbsp;<b>${fmtDate(q.isInvoice?q.invoiceDate:q.date)}</b><br>
          Valid Until &nbsp;<b>${fmtDate(q.validUntil)}</b>
          ${q.currency&&q.currency!==sym()?`<br>Currency &nbsp;<b>${esc(q.currency)}</b>`:''}
        </div>
      </div>
      <div class="qv-logo-box">
        ${logoHTML}
        <div>
          <div class="qv-co-name">${esc(co?.name||'Your Company')}</div>
          <div class="qv-co-tag">${esc(co?.tagline||'')}</div>
        </div>
      </div>
    </div>
    <div class="qv-boxes">
      <div class="qv-box">
        <div class="qv-box-lbl">Quotation by</div>
        ${[['Name',`<b>${esc(co?.name||'')}</b>`],['Address',esc((co?.address||'').replace(/\n/g,', '))],['Phone',esc(co?.phone||'—')],['Email',esc(co?.email||'—')],co?.taxPin?['KRA PIN',esc(co.taxPin)]:null].filter(Boolean).map(([k,v])=>`<div class="qv-box-row"><span class="qv-box-key">${k}</span><span class="qv-box-val">${v}</span></div>`).join('')}
      </div>
      <div class="qv-box">
        <div class="qv-box-lbl">Quotation to</div>
        ${[['Name',`<b>${esc(cu?.company||'—')}</b>`],['Contact',esc(cu?.contact||'—')],['Address',esc((cu?.address||'—').replace(/\n/g,', '))],['Phone',esc(cu?.phone||'—')],['Email',esc(cu?.email||'—')],cu?.taxPin?['KRA PIN',esc(cu.taxPin)]:null].filter(Boolean).map(([k,v])=>`<div class="qv-box-row"><span class="qv-box-key">${k}</span><span class="qv-box-val">${v}</span></div>`).join('')}
      </div>
    </div>
    <div class="qv-meta-row">
      <span>Sales Rep: <b>${esc(sp?.name||'—')}</b>${sp?.phone?' | '+esc(sp.phone):''}${sp?.email?' | '+esc(sp.email):''}</span>
      <span>Payment Terms: <b>${esc(co?.paymentTerms||'Net 30')}</b></span>
    </div>
    <table class="qv-tbl">
      <thead><tr>
        <th style="width:22px">#</th><th>Description</th>
        <th style="width:44px;text-align:center">Qty</th>
        <th style="width:100px;text-align:right">Rate (${esc(sym2)})</th>
        <th style="width:46px;text-align:right">Disc</th>
        <th style="width:105px;text-align:right">Amount (${esc(sym2)})</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div id="qv-block-1">
      <div class="qv-bottom">
        <div>
          ${termsHTML?`<div class="qv-terms-title" style="color:${ac}">Terms and Conditions</div>${termsHTML}`:''}
        </div>
        <div class="qv-tot-wrap">
          <div class="qv-tr"><span class="qv-tk">Sub Total</span><span class="qv-tv">${sym2} ${fmtN(tots.sub)}</span></div>
          ${tots.discAmt>0?`<div class="qv-tr disc"><span class="qv-tk">Discount${q.discount?' ('+Math.round(q.discount*100)+'%)':''}</span><span>−${sym2} ${fmtN(tots.discAmt)}</span></div>`:''}
          <div class="qv-tr"><span class="qv-tk">Net Amount</span><span class="qv-tv">${sym2} ${fmtN(tots.net)}</span></div>
          <div class="qv-tr"><span class="qv-tk">${q.taxable?DB.settings.taxLabel+' ('+Math.round((DB.settings.taxRate||.16)*100)+'%)':'Tax Exempt'}</span><span class="qv-tv">${q.taxable?sym2+' '+fmtN(tots.taxAmt):'—'}</span></div>
          <div class="qv-tr grand-row"><span class="qv-tk">Total</span><span class="qv-tv" style="font-size:13pt;font-weight:900">${sym2} ${fmtN(tots.total)}</span></div>
          <div class="qv-words-lbl">Invoice Total (in words)</div>
          <div class="qv-words">${amountInWords(tots.total)}</div>
        </div>
      </div>
    </div>
    <div id="qv-block-2">
      ${q.notes?`<div style="margin-top:12px"><div class="qv-notes-title" style="color:${ac}">Additional Notes</div><div class="qv-notes-text">${esc(q.notes).replace(/\n/g,'<br>')}</div></div>`:''}
      <div class="qv-contact-line" style="margin-top:10px">
        For enquiries, email <a href="mailto:${esc(co?.email||'')}" style="color:${ac}">${esc(co?.email||'')}</a>${co?.phone?' or call <b>'+esc(co.phone)+'</b>':''}
      </div>
      ${(co?.paymentMethods||[]).length?`<div class="qv-pay-footer"><div class="qv-pay-title">Payment Details</div><div class="qv-pay-grid">${pmHTML}</div></div>`:''}
      <div class="qv-sig-area">
        <div class="qv-sig-block">
          ${sigHTML}
          <div class="qv-sig-lbl">Authorized Signature</div>
          <div class="qv-sig-name">${esc(sp?.name||co?.name||'')}</div>
        </div>
      </div>
    </div>`;

  // ── Write to hidden render div ──
  const docEl=document.getElementById('prev-doc');
  docEl.innerHTML=fullHTML;

  // ── Split into page sections ──
  const b1El=docEl.querySelector('#qv-block-1');
  const b2El=docEl.querySelector('#qv-block-2');
  const clone=docEl.cloneNode(true);
  clone.querySelector('#qv-block-1')?.remove();
  clone.querySelector('#qv-block-2')?.remove();

  window._previewAccent=ac;
  window._previewAbove=clone.innerHTML;
  window._previewBlock1=b1El?b1El.outerHTML:'';
  window._previewBlock2=b2El?b2El.outerHTML:'';
  window._previewHTML=fullHTML;

  setTimeout(()=>renderPreviewPage(),80);
}

// ── PDF CONSTANTS & ENGINE ─────────────────────────────
const A4_W=760, A4_H=1074, M=40;
let _renderLock=false;

function iframeCSS(ac){
  return `<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{font-family:'Inter',ui-sans-serif,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:10pt;color:#111;background:#fff;-webkit-font-smoothing:antialiased;word-spacing:.01em;letter-spacing:-.01em}
    .qv-title{font-size:22pt;font-weight:900;color:${ac};margin-bottom:6px;line-height:1}
    .qv-meta{font-size:9pt;color:#555;line-height:1.9}.qv-meta b{color:#111}
    .qv-logo-box{display:flex;align-items:center;gap:10px}
    .qv-logo-img{width:48px;height:48px;border-radius:8px;overflow:hidden;flex-shrink:0}
    .qv-logo-img img{width:100%;height:100%;object-fit:cover}
    .qv-co-name{font-size:14pt;font-weight:900;color:#111;letter-spacing:-.3px;line-height:1.1}
    .qv-co-tag{font-size:8pt;color:#777;margin-top:2px}
    .qv-boxes{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:16px 0}
    .qv-box{border:1px solid #E0E0E0;border-radius:6px;padding:12px 14px;background:#FAFAFA}
    .qv-box-lbl{font-size:8pt;color:#999;font-weight:600;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px}
    .qv-box-row{display:flex;gap:10px;margin-bottom:3px}
    .qv-box-key{font-size:8.5pt;color:#888;min-width:60px;flex-shrink:0}
    .qv-box-val{font-size:8.5pt;color:#111;font-weight:500;line-height:1.5;flex:1}
    .qv-meta-row{display:flex;justify-content:space-between;font-size:8.5pt;color:#666;padding:6px 0;border-top:1px solid #EEE;border-bottom:1px solid #EEE;margin-bottom:14px}
    .qv-meta-row b{color:#111}
    .qv-tbl{width:100%;border-collapse:collapse;margin-bottom:0}
    .qv-tbl thead tr{background:${ac}}
    .qv-tbl th{color:#fff;padding:7px 10px;font-size:8.5pt;font-weight:700;text-align:left}
    .qv-tbl td{padding:6px 10px;font-size:9pt;border-bottom:1px solid #F0F0F0;vertical-align:middle}
    .qv-tbl tr:nth-child(even) td{background:#FAFAFA}
    .qv-tbl td:first-child{color:#999;font-size:8pt;width:28px}
    .qv-tbl-desc{font-weight:600;color:#111;line-height:1.4}
    .qv-bottom{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:14px}
    .qv-tot-wrap{}
    .qv-tr{display:flex;justify-content:space-between;padding:5px 0;font-size:9.5pt;border-bottom:1px solid #F0F0F0}
    .qv-tr:last-child{border-bottom:none}
    .qv-tr.disc span:last-child{color:#E53935;font-weight:600}
    .qv-tr.grand-row{border-top:2px solid #E0E0E0;border-bottom:none;margin-top:8px;padding-top:10px}
    .qv-tr.grand-row .qv-tk{font-size:12pt;font-weight:700;color:#111}
    .qv-tr.grand-row .qv-tv{font-size:13pt;font-weight:900;color:#111}
    .qv-tk{color:#555;font-size:9pt}.qv-tv{font-weight:600;color:#111}
    .qv-words-lbl{font-size:8pt;color:#999;margin-top:10px;margin-bottom:2px}
    .qv-words{font-size:8.5pt;color:#333;font-weight:500;font-style:italic;line-height:1.5}
    .qv-terms-title,.qv-notes-title{font-size:10pt;font-weight:700;color:${ac};margin-bottom:6px;margin-top:14px}
    .qv-notes-text{font-size:8pt;color:#555;line-height:1.7}
    .qv-contact-line{font-size:8pt;color:#555;line-height:1.7}
    .qv-contact-line a{color:${ac};font-weight:600;text-decoration:none}
    .qv-sig-area{margin-top:20px;display:flex;justify-content:flex-end}
    .qv-sig-block{text-align:center;min-width:180px}
    .qv-sig-line{border-bottom:1.5px solid #BBB;margin-bottom:5px;height:40px}
    .qv-sig-lbl{font-size:8pt;color:#777}
    .qv-sig-name{font-size:8.5pt;font-weight:600;color:#333;margin-top:2px}
    .qv-wm{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:60pt;font-weight:900;opacity:.06;pointer-events:none;color:${ac};white-space:nowrap;text-transform:uppercase;letter-spacing:6px;z-index:0}
    .qv-pay-footer{border-top:1px solid #E8E8E8;margin-top:16px;padding-top:12px}
    .qv-pay-title{font-size:9pt;font-weight:700;color:#444;margin-bottom:8px}
    .qv-pay-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
    .qv-pay-block{margin-bottom:6px}
    .qv-pay-type{font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
    .qv-pay-row{font-size:8pt;color:#555;line-height:1.9}
    .qv-pay-row b{color:#222}
  </style>`;
}

function makePgDoc(content, ac){
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${iframeCSS(ac)}<style>html,body{overflow:hidden;margin:0;padding:0}</style></head>`+
    `<body style="padding:${M}px;width:${A4_W}px;min-height:${A4_H}px;box-sizing:border-box;background:#fff;position:relative">${content}</body></html>`;
}

function measureH(content, ac){
  return new Promise(resolve=>{
    const ifr=document.createElement('iframe');
    ifr.style.cssText=`position:fixed;top:-10000px;left:-10000px;width:${A4_W-M*2}px;height:8000px;border:none;visibility:hidden;pointer-events:none`;
    document.body.appendChild(ifr);
    const d=ifr.contentDocument||ifr.contentWindow.document;
    d.open();
    d.write(`<!DOCTYPE html><html><head><meta charset="utf-8">${iframeCSS(ac)}</head>`+
      `<body style="margin:0;padding:0;width:${A4_W-M*2}px;box-sizing:border-box;background:#fff">${content}</body></html>`);
    d.close();
    let tries=0, last=-1;
    const check=()=>{
      const h=d.body.scrollHeight;
      if(h===last&&h>0){clearInterval(timer);document.body.removeChild(ifr);resolve(h);}
      else{last=h;}
      if(++tries>40){clearInterval(timer);document.body.removeChild(ifr);resolve(Math.max(h,100));}
    };
    const timer=setInterval(check,100);
  });
}

function writeIframe(ifr, content, ac){
  const d=ifr.contentDocument||ifr.contentWindow.document;
  d.open(); d.write(makePgDoc(content,ac)); d.close();
}

async function renderPreviewPage(){
  if(_renderLock) return;
  _renderLock=true;
  const above=window._previewAbove||'';
  const block1=window._previewBlock1||'';
  const block2=window._previewBlock2||'';
  const ac=window._previewAccent||'#1A73E8';
  const outer=document.getElementById('prev-outer');
  if(!above||!outer){_renderLock=false;return;}

  outer.querySelectorAll('.prev-iframe-wrap').forEach(el=>el.remove());
  const avail=Math.max(outer.clientWidth-8,200);
  const ss=Math.min(avail/A4_W,1);
  const vW=Math.round(A4_W*ss);
  const vH=Math.round(A4_H*ss);

  // Show spinner
  const loader=document.createElement('div');
  loader.className='prev-iframe-wrap';
  loader.style.cssText=`width:${vW}px;height:${vH}px;background:#eee;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#999;font-size:13px;gap:10px;flex-shrink:0`;
  loader.innerHTML=`<div style="width:28px;height:28px;border:3px solid #ccc;border-top-color:#888;border-radius:50%;animation:spin .8s linear infinite"></div><span>Preparing preview…</span>`;
  outer.appendChild(loader);

  try{
    // Measure heights to decide pagination
    const [aboveH, b1H, b2H] = await Promise.all([
      measureH(above, ac),
      block1 ? measureH(block1, ac) : Promise.resolve(0),
      block2 ? measureH(block2, ac) : Promise.resolve(0),
    ]);
    const USABLE=A4_H-M*2;
    const totalH=aboveH+b1H+b2H;
    const p1H=aboveH+b1H;
    let pages;
    if(totalH<=USABLE)          pages=[above+block1+block2];
    else if(p1H<=USABLE)        pages=[above+block1, block2];
    else if(aboveH<=USABLE)     pages=[above, block1+block2];
    else                         pages=[above, block1, block2].filter(Boolean);

    loader.remove();

    pages.forEach((content,pi)=>{
      const wrap=document.createElement('div');
      wrap.className='prev-iframe-wrap';
      wrap.style.cssText=`width:${vW}px;height:${vH}px;overflow:hidden;flex-shrink:0;position:relative;touch-action:none;background:#fff`;

      const ifr=document.createElement('iframe');
      ifr.setAttribute('scrolling','no');
      ifr.style.cssText=`width:${A4_W}px;height:${A4_H}px;border:none;display:block;transform-origin:top left;transform:scale(${ss})`;

      wrap.appendChild(ifr);
      outer.appendChild(wrap);
      writeIframe(ifr,content,ac);

      // Pinch-to-zoom
      let curScale=ss, lastDist=0, isPinching=false;
      wrap.addEventListener('touchstart',e=>{
        if(e.touches.length===2){isPinching=true;lastDist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);}
      },{passive:true});
      wrap.addEventListener('touchmove',e=>{
        if(!isPinching||e.touches.length!==2) return;
        const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
        curScale=Math.min(Math.max(curScale*(d/lastDist),ss),ss*4);
        ifr.style.transform=`scale(${curScale})`;
        lastDist=d;
      },{passive:true});
      wrap.addEventListener('touchend',()=>{if(event.touches.length<2)isPinching=false;});
    });

    window._previewPagesArr=pages;
    window._previewAccentUsed=ac;
    window._previewPageCount=pages.length;

    // Update page count indicator if present
    const pgInd=document.getElementById('prev-page-count');
    if(pgInd) pgInd.textContent=pages.length+' page'+(pages.length>1?'s':'');

  }catch(e){
    console.error('Preview render error:',e);
    loader.innerHTML='<div style="color:#E53935;text-align:center;padding:20px"><span class="material-icons-round" style="font-size:32px;display:block;margin-bottom:8px">error</span>Preview failed — try again</div>';
  }finally{
    _renderLock=false;
  }
}

window.addEventListener('resize',()=>{
  if(window._previewHTML) renderPreviewPage();
});

function buildFileName(q){
  const cu=getCust(q.customerId);
  const nm=(cu?.company||'Client').replace(/[^\w\s-]/g,'').replace(/\s+/g,'-').replace(/-{2,}/g,'-').trim()||'Quote';
  const docId=q.isInvoice?q.invoiceId:q.id;
  const ver=(DB.settings.dlIncludeVersion!==false)&&q.version?'_'+q.version:'';
  return `${nm}_${docId}${ver}.pdf`;
}

async function doPDF(){
  if(!window.jspdf){snack('PDF library not loaded — check internet connection');return;}
  if(!window.html2canvas){snack('Rendering library not loaded — check internet connection');return;}
  const q=DB.quotes.find(x=>x.id===curQID);if(!q)return;
  // Make sure preview is built
  if(!window._previewPagesArr||!window._previewPagesArr.length){
    snack('Building preview first…');
    buildPreview(q.id);
    await new Promise(r=>setTimeout(r,1200));
  }
  const btn=document.querySelector('#dlg-prev .btn.bp');
  if(btn){btn.disabled=true;btn.innerHTML='<span class="material-icons-round" style="animation:spin .8s linear infinite">autorenew</span> Generating…';}
  try{
    const blob=await generatePDFBlob();
    if(!blob) throw new Error('PDF generation returned empty');
    const fname=buildFileName(q);
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=fname;
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url),15000);
    snack('✓ Saved: '+fname);hap(30);
  }catch(e){
    console.error('PDF error:',e);
    snack('PDF failed: '+e.message);
  }finally{
    if(btn){btn.disabled=false;btn.innerHTML='<span class="material-icons-round">download</span> Save PDF';}
  }
}

async function generatePDFBlob(){
  if(!window.jspdf||!window.html2canvas) return null;
  const pages=window._previewPagesArr;
  if(!pages||!pages.length){console.error('No pages to render');return null;}
  const ac=window._previewAccentUsed||window._previewAccent||'#1A73E8';

  // Wait for fonts
  try{await document.fonts.ready;}catch(e){}

  const {jsPDF}=window.jspdf;
  const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});

  for(let p=0;p<pages.length;p++){
    if(p>0) pdf.addPage();
    snack(`Rendering page ${p+1} of ${pages.length}…`);

    // Create hidden iframe for capture
    const ifr=document.createElement('iframe');
    ifr.style.cssText=`position:fixed;top:0;left:0;width:${A4_W}px;height:${A4_H}px;border:none;opacity:0.01;pointer-events:none;z-index:-999`;
    document.body.appendChild(ifr);
    writeIframe(ifr,pages[p],ac);

    // Wait for content + fonts to load
    await new Promise(r=>setTimeout(r,600));
    try{await ifr.contentDocument?.fonts?.ready;}catch(e){}
    await new Promise(r=>setTimeout(r,200));

    try{
      const captureEl=ifr.contentDocument?.body;
      if(!captureEl) throw new Error('iframe body not found');
      const canvas=await html2canvas(captureEl,{
        scale:2.5,
        useCORS:true,
        allowTaint:true,
        backgroundColor:'#ffffff',
        logging:false,
        width:A4_W,
        height:A4_H,
        windowWidth:A4_W,
        windowHeight:A4_H,
        x:0,y:0,
        scrollX:0,scrollY:0,
        imageTimeout:8000,
        onclone:(clonedDoc)=>{
          // Ensure cloned doc body has correct dimensions
          const body=clonedDoc.body;
          body.style.width=A4_W+'px';
          body.style.minHeight=A4_H+'px';
          body.style.padding=M+'px';
          body.style.boxSizing='border-box';
        }
      });
      const imgData=canvas.toDataURL('image/jpeg',0.95);
      pdf.addImage(imgData,'JPEG',0,0,210,297,'','FAST');
    }finally{
      document.body.removeChild(ifr);
    }
  }

  snack('Finalising PDF…');
  return pdf.output('blob');
}


// ── SHARE ────────────────────────────────────────────────
function openShareDialog(qid){
  curQID=qid;const q=DB.quotes.find(x=>x.id===qid);if(!q)return;
  const cu=getCust(q.customerId),tots=calcTotals(q);
  document.getElementById('share-quote-label').textContent=`${q.isInvoice?q.invoiceId:q.id} — ${cu?.company||'Unknown'} — ${fmt(tots.total)}`;
  document.getElementById('share-body').innerHTML=`
    <div class="si" onclick="copyQuoteText('${qid}');closeDlg('dlg-share')"><div class="si-ic"><span class="material-icons-round">content_copy</span></div><div class="si-tx"><div class="si-m">Copy Summary Text</div></div></div>
    ${cu?.email?`<div class="si" onclick="mailQuote('${qid}')"><div class="si-ic"><span class="material-icons-round">email</span></div><div class="si-tx"><div class="si-m">Draft Email</div><div class="si-s">${esc(cu.email)}</div></div></div>`:''}
    ${navigator.share?`<div class="si" onclick="nativeShare('${qid}')"><div class="si-ic"><span class="material-icons-round">ios_share</span></div><div class="si-tx"><div class="si-m">Share via…</div></div></div>`:''}`;
  document.getElementById('share-progress').style.display='none';
  openDlg('dlg-share');pushNav('share-'+qid);
}
function copyQuoteText(qid){const q=DB.quotes.find(x=>x.id===qid);if(!q)return;const cu=getCust(q.customerId),tots=calcTotals(q),co=activeCo();const text=`*Quotation ${q.isInvoice?q.invoiceId:q.id}*\nFrom: ${co?.name||''}\nTo: ${cu?.company||''} (${cu?.contact||''})\nAmount: ${fmt(tots.total)}\nValid until: ${fmtDate(q.validUntil)}\nContact: ${co?.email||''} ${co?.phone||''}`;navigator.clipboard?.writeText(text).then(()=>snack('Copied')).catch(()=>snack('Copy failed'));}
function mailQuote(qid){const q=DB.quotes.find(x=>x.id===qid);if(!q)return;const cu=getCust(q.customerId),tots=calcTotals(q),co=activeCo();const s=encodeURIComponent(`Quotation ${q.isInvoice?q.invoiceId:q.id} — ${cu?.company||''}`);const b=encodeURIComponent(`Dear ${cu?.contact||'Sir/Madam'},\n\nPlease find our quotation ${q.isInvoice?q.invoiceId:q.id} amounting to ${fmt(tots.total)} valid until ${fmtDate(q.validUntil)}.\n\nRegards,\n${co?.name||''}`);window.location.href=`mailto:${cu?.email||''}?subject=${s}&body=${b}`;}
async function nativeShare(qid){const q=DB.quotes.find(x=>x.id===qid);if(!q||!navigator.share)return;const cu=getCust(q.customerId),tots=calcTotals(q);try{await navigator.share({title:`Quotation ${q.isInvoice?q.invoiceId:q.id}`,text:`Quote for ${cu?.company||''}: ${fmt(tots.total)} valid until ${fmtDate(q.validUntil)}`});}catch(e){}}
async function doGeneratePDFAndShare(){
  const q=DB.quotes.find(x=>x.id===curQID);if(!q)return;
  const prog=document.getElementById('share-progress');prog.style.display='block';document.getElementById('share-progress-msg').textContent='Generating PDF…';
  try{const blob=await generatePDFBlob();if(!blob)throw new Error('no blob');const fname=buildFileName(q);if(navigator.share&&navigator.canShare&&navigator.canShare({files:[new File([blob],fname,{type:'application/pdf'})]})){await navigator.share({files:[new File([blob],fname,{type:'application/pdf'})],title:fname});}else{const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=fname;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);snack('PDF saved: '+fname);}closeDlg('dlg-share');}
  catch(e){console.error(e);snack('PDF generation failed');}finally{prog.style.display='none';}
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
  renderVirtualList(el,list,p=>{
    const price=p.unitCost*(1+p.markup);
    const mg=Math.round(productMargin(p)*100);
    const mgCol=mg<Math.round(DB.settings.minMargin*100)?'var(--E)':mg<Math.round(DB.settings.warnMargin*100)?'var(--W)':'var(--S)';
    const stockColor=p.trackStock&&p.stock!=null?(p.stock===0?'var(--E)':p.stock<5?'var(--W)':'var(--S)'):'transparent';
    return`<div class="ii" onclick="openInvEd('${p.id}')">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <div style="flex:1"><div style="font-size:11px;font-weight:600;color:var(--t2)">${esc(p.id)}</div>
          <div style="font-size:15px;font-weight:700;margin-top:1px">${esc(p.name)}</div>
          ${p.description?`<div style="font-size:12px;color:var(--t2);margin-top:2px">${esc(p.description)}</div>`:''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          <span style="background:var(--PC);color:var(--P);border-radius:999px;font-size:11px;padding:3px 8px;font-weight:600">${esc(p.category||'Other')}</span>
          ${p.trackStock&&p.stock!=null?`<span style="font-size:10px;font-weight:700;color:${stockColor}">Stock: ${p.stock}</span>`:''}
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:16px;font-weight:800;color:var(--P)">${fmt(price)}</div>
          <div style="font-size:11px;color:var(--t2)">Cost: ${fmt(p.unitCost)} · ${Math.round(p.markup*100)}% markup</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:13px;font-weight:700;color:${mgCol}">${mg}%</div>
          <div style="font-size:10px;color:var(--t2)">margin</div>
        </div>
      </div>
    </div>`;
  },100);
  if(!list.length)el.innerHTML=`<div class="empty"><span class="material-icons-round">inventory_2</span><div class="empty-t">No products found</div><div class="empty-s">Add products to search them in quotes</div></div>`;
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
    <div style="background:var(--su2);border-radius:8px;padding:10px 12px;font-size:13px;color:var(--t2);margin-bottom:12px">Sale price = Cost × (1 + Markup%)</div>
    <div style="height:1px;background:var(--ol2);margin-bottom:14px"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div><div style="font-size:14px;font-weight:600">Track Stock</div><div style="font-size:12px;color:var(--t2)">Monitor inventory levels</div></div>
      <button class="tog ${p?.trackStock?'on':''}" id="ii-track" onclick="this.classList.toggle('on');document.getElementById('ii-stock-row').style.display=this.classList.contains('on')?'block':'none'"></button>
    </div>
    <div id="ii-stock-row" style="display:${p?.trackStock?'block':'none'}">
      <div class="fg"><label class="fl">Current Stock Quantity</label><input class="fi" type="number" id="ii-stock" value="${p?.stock??0}" min="0" step="1"></div>
    </div>
    ${id?`<div style="margin-top:4px"><button class="btn bd2 btn-w" onclick="confirmAct('Delete this product?',()=>softDelItem('inv','${id}'))"><span class="material-icons-round">delete</span> Delete Product</button></div>`:''}`;
  openDlg('dlg-inv');pushNav('inv-ed-'+(id||'new'));
}
function saveInv(){
  const id=v('ii-id'),nm=v('ii-nm');if(!id||!nm){snack('ID and name required');return;}
  if(!editInvId&&DB.inventory.find(i=>i.id===id)){snack('Product ID already exists');return;}
  const trackStock=!!document.getElementById('ii-track')?.classList.contains('on');
  const item={id,name:nm,description:v('ii-desc'),category:v('ii-cat')||getCategories()[0],unitCost:parseFloat(v('ii-cost'))||0,markup:(parseFloat(v('ii-mkup'))||30)/100,trackStock,stock:trackStock?(parseInt(v('ii-stock'))||0):null,companyId:(activeCo()||{}).id};
  const idx=DB.inventory.findIndex(i=>i.id===id);if(idx>=0)DB.inventory[idx]=item;else DB.inventory.push(item);
  save();closeDlg('dlg-inv');renderInv();snack('Product saved');
}

// ── CUSTOMERS ────────────────────────────────────────────
let _custIndFilt2='all';
function renderCusts(){
  const srch=(document.getElementById('cust-srch')||{}).value?.toLowerCase()||'';
  let list=acoCusts().sort((a,b)=>(b.ltv||0)-(a.ltv||0));
  if(_custIndFilt2!=='all')list=list.filter(c=>c.industry===_custIndFilt2);
  if(srch)list=list.filter(c=>c.company.toLowerCase().includes(srch)||(c.contact||'').toLowerCase().includes(srch)||(c.email||'').toLowerCase().includes(srch));
  // Industry filter bar
  const industries=['all',...new Set(acoCusts().map(c=>c.industry).filter(Boolean))];
  const fbar=document.getElementById('cust-ind-fbar');
  if(fbar)fbar.innerHTML=industries.map(ind=>`<button class="fc${_custIndFilt2===ind?' on':''}" onclick="_custIndFilt2='${ind}';renderCusts()">${ind==='all'?'All':esc(ind)}</button>`).join('');
  const el=document.getElementById('cust-list');
  renderVirtualList(el,list,c=>`<div class="qi" data-qid="${c.id}" style="display:flex;gap:12px;align-items:center" onclick="openCustEd('${c.id}')">
    <div class="av" style="width:42px;height:42px;font-size:16px;background:${avColor(c.company)}">${avLetter(c.company)}</div>
    <div style="flex:1;min-width:0">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><div style="font-size:15px;font-weight:700">${esc(c.company)}</div><span class="tier-${c.tier||'Bronze'}">${c.tier||'Bronze'}</span></div>
      <div style="font-size:13px;color:var(--t2)">${esc(c.contact||'—')}${c.industry?' · '+esc(c.industry):''}</div>
      <div style="font-size:12px;color:var(--t2)">${esc(c.email||'')}</div>
    </div>
    <div style="text-align:right;flex-shrink:0">
      <div style="font-size:13px;font-weight:700;color:var(--P)">${fmt(c.ltv||0)}</div>
      <div style="font-size:10px;color:var(--t2)">Lifetime</div>
    </div>
  </div>`,70);
  if(!list.length)el.innerHTML=`<div class="empty"><span class="material-icons-round">people</span><div class="empty-t">${_custIndFilt2!=='all'?'No '+_custIndFilt2+' customers':'No customers yet'}</div></div>`;
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
    ${c?.ltv?`<div style="background:var(--su2);border-radius:8px;padding:10px 12px;margin-bottom:10px"><div style="font-size:12px;color:var(--t2)">Lifetime Value (Won quotes)</div><div style="font-size:18px;font-weight:800;color:var(--P)">${fmt(c.ltv)}</div></div>`:''}
    ${id?`<div style="margin-top:4px"><button class="btn bd2 btn-w" onclick="confirmAct('Delete this customer?',()=>softDelItem('cust','${id}'))"><span class="material-icons-round">delete</span> Delete Customer</button></div>`:''}`;
  openDlg('dlg-cust');pushNav('cust-ed-'+(id||'new'));
}
function saveCust(){
  const id=v('ci-id'),co=v('ci-co');if(!id||!co){snack('ID and company name required');return;}
  if(!editCustId&&DB.customers.find(c=>c.id===id)){snack('Customer ID already exists');return;}
  const cust={id,company:co,contact:v('ci-cnt'),email:v('ci-em'),phone:v('ci-ph'),address:v('ci-addr'),industry:v('ci-ind'),tier:v('ci-tier')||'Bronze',taxPin:v('ci-pin'),companyId:(activeCo()||{}).id,ltv:getCust(id)?.ltv||0};
  const idx=DB.customers.findIndex(c=>c.id===id);if(idx>=0)DB.customers[idx]=cust;else DB.customers.push(cust);
  save();closeDlg('dlg-cust');renderCusts();snack('Customer saved');
}

// ── COMPANY EDITOR ───────────────────────────────────────
function openCoEd(id){editCoId=id;document.getElementById('co-ttl').textContent=id?'Edit Company':'New Company Profile';buildCoForm(id?getCo(id):null);openDlg('dlg-co');pushNav('co-ed-'+(id||'new'));}
function buildCoForm(co){
  const pms=co?.paymentMethods||[];
  document.getElementById('co-body').innerHTML=`
    <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px">
      <div id="logo-prev" onclick="document.getElementById('logo-file').click()" style="width:64px;height:64px;border-radius:10px;background:${co?.logoColor||'#1A73E8'};display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px;font-weight:900;cursor:pointer;overflow:hidden;flex-shrink:0">${co?.logoImg?`<img src="${co.logoImg}" style="width:100%;height:100%;object-fit:cover">`:(co?.logoText||'A')}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn bo btn-sm" onclick="document.getElementById('logo-file').click()"><span class="material-icons-round">upload</span> Logo</button>
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
    <div class="fg"><label class="fl">Terms &amp; Conditions</label><textarea class="fi" id="co-tc" rows="6">${esc(co?.terms||'')}</textarea></div>
    ${editCoId?`<div style="margin-top:4px"><button class="btn bd2 btn-w" onclick="confirmAct('Delete company profile?',()=>softDelItem('co','${editCoId}'))"><span class="material-icons-round">delete</span> Delete Profile</button></div>`:''}
    <div style="height:20px"></div>`;
  setTimeout(wirePMSelects,50);
}
function pmCardHTML(pm,i){return`<div class="pmcard" id="pm-${i}"><div class="pmhead"><span class="pm-badge" id="pm-badge-${i}">${esc(pm.type)}</span><div style="flex:1">${buildCustomSelect({id:'pm-type-'+i,label:'Type',options:['Bank','M-Pesa Paybill','M-Pesa Till','M-Pesa Send Money','Pochi la Biashara','Cash','Cheque','Other'].map(t=>({value:t,label:t})),value:pm.type})}</div><button class="ib" style="width:30px;height:30px;color:var(--E)" onclick="removePM(${i})"><span class="material-icons-round" style="font-size:18px">delete</span></button></div><div id="pm-fields-${i}">${pmFieldsHTML(pm,i)}</div></div>`;}
function pmFieldsHTML(pm,i){
  const v=(id,fallback='')=>typeof pm[id]!=='undefined'?pm[id]:fallback;
  /* ── BANK ── */
  if(pm.type==='Bank') return `
    <div class="fr">
      <div class="fg"><label class="fl">Bank Name</label><input class="fi" id="pm-bank-${i}" value="${esc(pm.bankName||'')}" placeholder="e.g. Equity Bank Kenya"></div>
      <div class="fg"><label class="fl">Branch</label><input class="fi" id="pm-branch-${i}" value="${esc(pm.branch||'')}" placeholder="e.g. Westlands"></div>
    </div>
    <div class="fr">
      <div class="fg"><label class="fl">Account Name</label><input class="fi" id="pm-accnm-${i}" value="${esc(pm.accName||'')}" placeholder="Registered account name"></div>
      <div class="fg"><label class="fl">Account Number</label><input class="fi" id="pm-accn-${i}" value="${esc(pm.accNum||'')}" placeholder="0123456789"></div>
    </div>
    <div class="fr">
      <div class="fg"><label class="fl">SWIFT / Sort Code</label><input class="fi" id="pm-swift-${i}" value="${esc(pm.swift||'')}" placeholder="e.g. EQBLKENA"></div>
      <div class="fg"><label class="fl">Bank Reference (optional)</label><input class="fi" id="pm-bankref-${i}" value="${esc(pm.bankRef||'')}" placeholder="e.g. Invoice number"></div>
    </div>`;

  /* ── M-PESA PAYBILL ── */
  if(pm.type==='M-Pesa Paybill') return `
    <div style="background:#E8F5E9;border-radius:8px;padding:9px 12px;margin-bottom:12px;display:flex;align-items:center;gap:8px">
      <span style="font-size:20px">📱</span>
      <div><div style="font-size:12px;font-weight:700;color:#2E7D32">M-Pesa Paybill</div><div style="font-size:11px;color:#388E3C">Customer: Lipa na M-Pesa → Paybill</div></div>
    </div>
    <div class="fr">
      <div class="fg"><label class="fl">Paybill Number *</label><input class="fi" id="pm-pb-${i}" value="${esc(pm.paybillBusiness||'')}" placeholder="e.g. 123456" type="tel"></div>
      <div class="fg"><label class="fl">Account Number / Field *</label><input class="fi" id="pm-pba-${i}" value="${esc(pm.paybillAccount||'')}" placeholder="e.g. Invoice No."></div>
    </div>
    <div class="fg"><label class="fl">Business Name (as registered on M-Pesa)</label><input class="fi" id="pm-mpnm-${i}" value="${esc(pm.mpesaName||'')}" placeholder="e.g. Acme Corporation Ltd"></div>`;

  /* ── M-PESA TILL (BUY GOODS) ── */
  if(pm.type==='M-Pesa Till') return `
    <div style="background:#E8F5E9;border-radius:8px;padding:9px 12px;margin-bottom:12px;display:flex;align-items:center;gap:8px">
      <span style="font-size:20px">📱</span>
      <div><div style="font-size:12px;font-weight:700;color:#2E7D32">M-Pesa Till — Buy Goods</div><div style="font-size:11px;color:#388E3C">Customer: Lipa na M-Pesa → Buy Goods & Services</div></div>
    </div>
    <div class="fr">
      <div class="fg"><label class="fl">Till Number *</label><input class="fi" id="pm-till-${i}" value="${esc(pm.tillNumber||'')}" placeholder="e.g. 5012345" type="tel"></div>
      <div class="fg"><label class="fl">Store / Business Name</label><input class="fi" id="pm-mpnm-${i}" value="${esc(pm.mpesaName||'')}" placeholder="e.g. Acme Store"></div>
    </div>
    <div class="fg"><label class="fl">Reference Instruction (optional)</label><input class="fi" id="pm-tillref-${i}" value="${esc(pm.tillRef||'')}" placeholder="e.g. Use invoice number as reference"></div>`;

  /* ── M-PESA SEND MONEY ── */
  if(pm.type==='M-Pesa Send Money') return `
    <div style="background:#E8F5E9;border-radius:8px;padding:9px 12px;margin-bottom:12px;display:flex;align-items:center;gap:8px">
      <span style="font-size:20px">📱</span>
      <div><div style="font-size:12px;font-weight:700;color:#2E7D32">M-Pesa Send Money</div><div style="font-size:11px;color:#388E3C">Customer: M-Pesa → Send Money → Phone Number</div></div>
    </div>
    <div class="fr">
      <div class="fg"><label class="fl">M-Pesa Phone Number *</label><input class="fi" id="pm-smphone-${i}" value="${esc(pm.sendMoneyPhone||'')}" placeholder="+254 7xx xxx xxx" type="tel"></div>
      <div class="fg"><label class="fl">Registered Name on M-Pesa *</label><input class="fi" id="pm-smnm-${i}" value="${esc(pm.sendMoneyName||'')}" placeholder="Full name as on M-Pesa"></div>
    </div>
    <div class="fg"><label class="fl">Reference / Description for Payer</label><input class="fi" id="pm-smref-${i}" value="${esc(pm.sendMoneyRef||'')}" placeholder="e.g. Include invoice number as reference"></div>`;

  /* ── POCHI LA BIASHARA ── */
  if(pm.type==='Pochi la Biashara') return `
    <div style="background:#E3F2FD;border-radius:8px;padding:9px 12px;margin-bottom:12px;display:flex;align-items:center;gap:8px">
      <span style="font-size:20px">💼</span>
      <div><div style="font-size:12px;font-weight:700;color:#1565C0">Pochi la Biashara</div><div style="font-size:11px;color:#1976D2">Customer: M-Pesa → Pochi la Biashara → Phone Number</div></div>
    </div>
    <div class="fr">
      <div class="fg"><label class="fl">Pochi Phone Number *</label><input class="fi" id="pm-pochphone-${i}" value="${esc(pm.pochiPhone||'')}" placeholder="+254 7xx xxx xxx" type="tel"></div>
      <div class="fg"><label class="fl">Business / Owner Name *</label><input class="fi" id="pm-pochnm-${i}" value="${esc(pm.pochiName||'')}" placeholder="e.g. Acme Corporation"></div>
    </div>
    <div class="fg"><label class="fl">Reference Instruction for Payer</label><input class="fi" id="pm-pochref-${i}" value="${esc(pm.pochiRef||'')}" placeholder="e.g. State invoice number when sending"></div>`;

  /* ── CASH ── */
  if(pm.type==='Cash') return `
    <div style="background:#F3E5F5;border-radius:8px;padding:9px 12px;margin-bottom:12px;display:flex;align-items:center;gap:8px">
      <span style="font-size:20px">💵</span>
      <div><div style="font-size:12px;font-weight:700;color:#6A1B9A">Cash Payment</div><div style="font-size:11px;color:#7B1FA2">Payment collected in cash</div></div>
    </div>
    <div class="fg"><label class="fl">Collection Address / Location</label><input class="fi" id="pm-cash-loc-${i}" value="${esc(pm.cashLocation||'')}" placeholder="e.g. Head Office, Westlands Nairobi"></div>
    <div class="fg"><label class="fl">Contact Person</label><input class="fi" id="pm-cash-contact-${i}" value="${esc(pm.cashContact||'')}" placeholder="e.g. Finance Office"></div>
    <div class="fg"><label class="fl">Cash Notes</label><textarea class="fi" id="pm-det-${i}" style="min-height:54px" placeholder="e.g. Receipt issued upon payment">${esc(pm.details||'')}</textarea></div>`;

  /* ── CHEQUE ── */
  if(pm.type==='Cheque') return `
    <div style="background:#FFF8E1;border-radius:8px;padding:9px 12px;margin-bottom:12px;display:flex;align-items:center;gap:8px">
      <span style="font-size:20px">📄</span>
      <div><div style="font-size:12px;font-weight:700;color:#F57F17">Cheque Payment</div><div style="font-size:11px;color:#F9A825">Pay by cheque</div></div>
    </div>
    <div class="fg"><label class="fl">Cheque Payable To *</label><input class="fi" id="pm-chq-payable-${i}" value="${esc(pm.chequePayable||'')}" placeholder="e.g. Acme Corporation Ltd"></div>
    <div class="fg"><label class="fl">Delivery Address for Cheque</label><input class="fi" id="pm-chq-addr-${i}" value="${esc(pm.chequeAddress||'')}" placeholder="Where to deliver / post the cheque"></div>
    <div class="fg"><label class="fl">Additional Instructions</label><textarea class="fi" id="pm-det-${i}" style="min-height:54px" placeholder="e.g. Mark envelope Finance Dept.">${esc(pm.details||'')}</textarea></div>`;

  /* ── OTHER / FALLBACK ── */
  return `
    <div class="fg"><label class="fl">Payment Method Name</label><input class="fi" id="pm-other-name-${i}" value="${esc(pm.otherName||pm.type||'')}" placeholder="e.g. Wire Transfer, Crypto, etc."></div>
    <div class="fg"><label class="fl">Payment Details</label><textarea class="fi" id="pm-det-${i}" placeholder="Enter full payment instructions…">${esc(pm.details||'')}</textarea></div>`;
}

function pmTypeChange(i,type){document.getElementById('pm-badge-'+i).textContent=type;document.getElementById('pm-fields-'+i).innerHTML=pmFieldsHTML({type},i);}
function wirePMSelects(){document.querySelectorAll('[id^="pm-type-"]').forEach(sel=>{sel.addEventListener('change',function(){pmTypeChange(this.id.replace('pm-type-',''),this.value);});});}
function addPayMethod(){const list=document.getElementById('pm-list');const idx=list.querySelectorAll('.pmcard').length;const div=document.createElement('div');div.innerHTML=pmCardHTML({type:'Bank'},idx);list.appendChild(div.firstElementChild);setTimeout(wirePMSelects,50);}
function removePM(i){document.getElementById('pm-'+i)?.remove();}
function collectPMs(){return Array.from(document.querySelectorAll('#pm-list .pmcard')).map((_,i)=>{
  const g=id=>document.getElementById(id)?.value||'';
  const type=g('pm-type-'+i)||'Bank'; const pm={type};
  if(type==='Bank'){
    pm.bankName=g('pm-bank-'+i); pm.branch=g('pm-branch-'+i);
    pm.accName=g('pm-accnm-'+i); pm.accNum=g('pm-accn-'+i);
    pm.swift=g('pm-swift-'+i);   pm.bankRef=g('pm-bankref-'+i);
  } else if(type==='M-Pesa Paybill'){
    pm.paybillBusiness=g('pm-pb-'+i); pm.paybillAccount=g('pm-pba-'+i); pm.mpesaName=g('pm-mpnm-'+i);
  } else if(type==='M-Pesa Till'){
    pm.tillNumber=g('pm-till-'+i); pm.mpesaName=g('pm-mpnm-'+i); pm.tillRef=g('pm-tillref-'+i);
  } else if(type==='M-Pesa Send Money'){
    pm.sendMoneyPhone=g('pm-smphone-'+i); pm.sendMoneyName=g('pm-smnm-'+i); pm.sendMoneyRef=g('pm-smref-'+i);
  } else if(type==='Pochi la Biashara'){
    pm.pochiPhone=g('pm-pochphone-'+i); pm.pochiName=g('pm-pochnm-'+i); pm.pochiRef=g('pm-pochref-'+i);
  } else if(type==='Cash'){
    pm.cashLocation=g('pm-cash-loc-'+i); pm.cashContact=g('pm-cash-contact-'+i); pm.details=g('pm-det-'+i);
  } else if(type==='Cheque'){
    pm.chequePayable=g('pm-chq-payable-'+i); pm.chequeAddress=g('pm-chq-addr-'+i); pm.details=g('pm-det-'+i);
  } else {
    pm.otherName=g('pm-other-name-'+i); pm.details=g('pm-det-'+i);
  }
  return pm;});}
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
let _settingsSrch='';
function renderSettings(){
  const cos=DB.companies;
  document.getElementById('co-list-el').innerHTML=cos.length?cos.map(co=>`<div class="si" onclick="openCoEd('${co.id}')"><div style="width:38px;height:38px;border-radius:50%;background:${co.logoColor||'#1A73E8'};display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:900;flex-shrink:0;overflow:hidden">${co.logoImg?`<img src="${co.logoImg}" style="width:100%;height:100%;object-fit:cover">`:esc(co.logoText||'A')}</div><div class="si-tx"><div class="si-m">${esc(co.name)}</div><div class="si-s">${co.id===DB.settings.activeCompanyId?'● Active':esc(co.tagline||co.id)}</div></div>${co.id===DB.settings.activeCompanyId?'<span class="material-icons-round" style="color:var(--S)">check_circle</span>':`<button class="btn bt btn-sm" onclick="event.stopPropagation();setActiveCo('${co.id}')">Activate</button>`}<span class="material-icons-round" style="color:var(--t3)">chevron_right</span></div>`).join(''):`<div class="empty" style="padding:24px"><span class="material-icons-round">business</span><div class="empty-t">No company profiles</div></div>`;
  document.getElementById('acc-sub').textContent=DB.settings.accentName;
  document.getElementById('sp-sub').textContent=acoSP().length+' members';
  document.getElementById('cat-sub').textContent=getCategories().join(', ');
  const tog=document.getElementById('dark-tog');if(tog)tog.classList.toggle('on',DB.settings.darkMode);
  // Settings search filter
  const srch=_settingsSrch.toLowerCase();
  if(srch){
    document.querySelectorAll('#page-settings .si').forEach(row=>{
      const txt=(row.textContent||'').toLowerCase();row.style.display=txt.includes(srch)?'flex':'none';
    });
  } else {
    document.querySelectorAll('#page-settings .si').forEach(row=>row.style.display='');
  }
}
function filterSettings(q){_settingsSrch=q;renderSettings();}
function setActiveCo(id){DB.settings.activeCompanyId=id;save();renderSettings();renderDash();snack('Active company updated');}
function openSetSheet(type){
  setType=type;const s=DB.settings;let title='',html='';
  if(type==='quote'){title='Quote Defaults';html=`<div class="fg"><label class="fl">Quote ID Prefix</label><input class="fi" id="ss-pfx" value="${esc(s.quotePrefix||'QMS-')}"></div><div class="fg"><label class="fl">Invoice ID Prefix</label><input class="fi" id="ss-invpfx" value="${esc(s.invoicePrefix||'INV-')}"></div><div class="fr"><div class="fg"><label class="fl">Valid Days</label><input class="fi" type="number" id="ss-vd" value="${s.quoteValidDays||30}"></div><div class="fg"><label class="fl">Follow-up Days</label><input class="fi" type="number" id="ss-fu" value="${s.followUpDays||7}"></div></div><div class="fr"><div class="fg"><label class="fl">Tax Rate %</label><input class="fi" type="number" id="ss-tax" value="${Math.round((s.taxRate||.16)*100)}" step=".1"></div><div class="fg"><label class="fl">Tax Label</label><input class="fi" id="ss-taxlbl" value="${esc(s.taxLabel||'VAT')}"></div></div><div class="fg"><label class="fl">Currency Symbol</label><input class="fi" id="ss-curr" value="${esc(s.currencySymbol||'KSh')}"></div>`;}
  else if(type==='margin'){title='Margin Thresholds';html=`<div class="fg"><label class="fl">Minimum Margin % (Red ⚠)</label><input class="fi" type="number" id="ss-mm" value="${Math.round((s.minMargin||.20)*100)}"></div><div class="fg"><label class="fl">Warning Margin % (Orange)</label><input class="fi" type="number" id="ss-wm" value="${Math.round((s.warnMargin||.25)*100)}"></div>`;}
  else if(type==='categories'){title='Product Categories';const cats=getCategories();html=`<div id="cat-list-ed">${cats.map((c,i)=>`<div style="display:flex;gap:8px;margin-bottom:8px;align-items:center"><input class="fi" style="flex:1" value="${esc(c)}" id="cat-item-${i}" placeholder="Category name"><button class="ib" style="color:var(--E);flex-shrink:0" onclick="this.closest('div').remove()"><span class="material-icons-round">delete</span></button></div>`).join('')}</div><button class="btn btn-ton btn-w" onclick="addCatItem()"><span class="material-icons-round">add</span> Add Category</button>`;}
  else if(type==='download'){title='Download Settings';html=`<div class="fg"><label class="fl" style="display:flex;justify-content:space-between;align-items:center">Include version in filename<button class="tog ${s.dlIncludeVersion!==false?'on':''}" id="ss-dlv" onclick="this.classList.toggle('on')"></button></label><div style="font-size:12px;color:var(--t2);margin-top:4px">e.g. ClientName_QMS-2026-001_v1.pdf</div></div>`;}
  else if(type==='dashboard'){title='Dashboard Sections';const ds=s.dashSections||{alerts:true,chart:true,pipeline:true,recent:true};html=`<div style="font-size:13px;color:var(--t2);margin-bottom:12px">Choose which sections appear on your dashboard.</div>${[['alerts','Alerts & Follow-ups','notifications'],['chart','Revenue Chart','bar_chart'],['pipeline','Pipeline','show_chart'],['recent','Recent Quotes','receipt_long']].map(([k,l,ic])=>`<div class="si" onclick="event.stopPropagation()"><div class="si-ic"><span class="material-icons-round">${ic}</span></div><div class="si-tx"><div class="si-m">${l}</div></div><button class="tog ${ds[k]?'on':''}" id="ds-${k}" onclick="this.classList.toggle('on')"></button></div>`).join('')}`;}
  document.getElementById('set-ttl').textContent=title;document.getElementById('set-body').innerHTML=html;openDlg('dlg-set');pushNav('settings-'+type);
}
function saveSetSheet(){
  const s=DB.settings;
  if(setType==='quote'){s.quotePrefix=v('ss-pfx')||'QMS-';s.invoicePrefix=v('ss-invpfx')||'INV-';s.quoteValidDays=parseInt(v('ss-vd'))||30;s.followUpDays=parseInt(v('ss-fu'))||7;s.taxRate=(parseFloat(v('ss-tax'))||16)/100;s.taxLabel=v('ss-taxlbl')||'VAT';s.currencySymbol=v('ss-curr')||'KSh';}
  else if(setType==='margin'){s.minMargin=(parseFloat(v('ss-mm'))||20)/100;s.warnMargin=(parseFloat(v('ss-wm'))||25)/100;}
  else if(setType==='categories'){const inputs=document.querySelectorAll('[id^="cat-item-"]');const cats=Array.from(inputs).map(el=>el.value.trim()).filter(Boolean);if(!cats.length){snack('Need at least one category');return;}s.productCategories=cats;}
  else if(setType==='download'){s.dlIncludeVersion=!!document.getElementById('ss-dlv')?.classList.contains('on');}
  else if(setType==='dashboard'){if(!s.dashSections)s.dashSections={};['alerts','chart','pipeline','recent'].forEach(k=>{s.dashSections[k]=!!document.getElementById('ds-'+k)?.classList.contains('on');});}
  save();closeDlg('dlg-set');renderSettings();snack('Settings saved');
}
function addCatItem(){const list=document.getElementById('cat-list-ed');if(!list)return;const idx=list.querySelectorAll('div').length;const row=document.createElement('div');row.style.cssText='display:flex;gap:8px;margin-bottom:8px;align-items:center';row.innerHTML=`<input class="fi" style="flex:1" value="" id="cat-item-${idx}" placeholder="Category name"><button class="ib" style="color:var(--E);flex-shrink:0" onclick="this.closest('div').remove()"><span class="material-icons-round">delete</span></button>`;list.appendChild(row);}

// ── SALES TEAM ───────────────────────────────────────────
function openSalesTeam(){renderSPList();openDlg('dlg-sp');pushNav('salesteam');}
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
          <button class="btn bo btn-sm" onclick="document.getElementById('sp-sig-file').click()"><span class="material-icons-round">upload</span> Upload</button>
          ${sp?.signatureImg?`<button class="btn bt btn-sm" style="color:var(--E)" onclick="clearSpSig()"><span class="material-icons-round">delete</span> Remove</button>`:''}
        </div>
        <input type="file" id="sp-sig-file" accept="image/*" style="display:none" onchange="previewSpSig(this)">
        <input type="hidden" id="sp-sig-img" value="${sp?.signatureImg||''}">
      </div>
    </div>
    ${id?`<div style="margin-top:4px"><button class="btn bd2 btn-w" onclick="confirmAct('Remove salesperson?',()=>softDelItem('sp','${id}'))"><span class="material-icons-round">delete</span> Remove</button></div>`:''}`;
  openDlg('dlg-spe');pushNav('sp-ed-'+(id||'new'));
}
function saveSp(){const id=v('sp-id'),name=v('sp-nm');if(!id||!name){snack('ID and name required');return;}if(!editSpId&&DB.salespeople.find(s=>s.id===id)){snack('ID already exists');return;}const sp={id,name,title:v('sp-ttl2'),email:v('sp-em'),phone:v('sp-ph'),companyId:v('sp-coid'),signatureImg:document.getElementById('sp-sig-img')?.value||''};const idx=DB.salespeople.findIndex(s=>s.id===id);if(idx>=0)DB.salespeople[idx]=sp;else DB.salespeople.push(sp);save();closeDlg('dlg-spe');renderSPList();renderSettings();snack('Salesperson saved');}
function previewSpSig(input){const file=input.files[0];if(!file)return;const r=new FileReader();r.onload=e=>{document.getElementById('sp-sig-img').value=e.target.result;document.getElementById('sp-sig-preview').innerHTML=`<img src="${e.target.result}" style="max-height:70px;max-width:240px;object-fit:contain">`;};r.readAsDataURL(file);}
function clearSpSig(){document.getElementById('sp-sig-img').value='';document.getElementById('sp-sig-preview').innerHTML='';}

// ── THEME ────────────────────────────────────────────────
function applyTheme(){
  const dark=DB.settings.darkMode;document.documentElement.dataset.theme=dark?'dark':'light';
  const acc=ACCENTS.find(a=>a.name===DB.settings.accentName)||ACCENTS[0];const color=dark?acc.dc:acc.lc;
  document.documentElement.style.setProperty('--P',color);document.documentElement.style.setProperty('--PC',dark?'rgba(138,180,248,0.15)':color+'1A');
  document.getElementById('theme-meta').content=dark?'#1E1E1E':color;
  const tog=document.getElementById('dark-tog');if(tog)tog.classList.toggle('on',dark);
}
function toggleTheme(){DB.settings.darkMode=!DB.settings.darkMode;save();applyTheme();}
function openAccentPicker(){document.getElementById('acc-body').innerHTML=ACCENTS.map(a=>`<div class="si" onclick="setAccent('${a.name}')"><div style="width:32px;height:32px;border-radius:50%;background:${a.lc};flex-shrink:0;box-shadow:0 2px 6px rgba(0,0,0,.2);border:${a.name===DB.settings.accentName?'3px solid var(--t1)':'3px solid transparent'}"></div><div class="si-tx"><div class="si-m">${a.name}</div></div>${a.name===DB.settings.accentName?'<span class="material-icons-round" style="color:var(--P)">check_circle</span>':''}</div>`).join('');openDlg('dlg-acc');pushNav('accent');}
function setAccent(name){DB.settings.accentName=name;save();applyTheme();document.getElementById('acc-sub').textContent=name;closeDlg('dlg-acc');snack('Accent updated');}

// ── DIALOGS ──────────────────────────────────────────────
function openDlg(id){document.getElementById(id).classList.add('open');document.body.style.overflow='hidden';pushNav('dlg-'+id);}
function closeDlg(id){document.getElementById(id).classList.remove('open');if(!document.querySelector('.bd.open'))document.body.style.overflow='';}

// ── CUSTOM SELECT ────────────────────────────────────────
const _csOptsMap={};
let _csId=null,_csOpts=[];
function buildCustomSelect({id,label,options,value,placeholder,searchable}){
  _csOptsMap[id]={label,options,searchable};
  const sel=options.find(o=>String(o.value)===String(value??''));
  const disp=sel?sel.label:(placeholder||'— Select —');
  return`<div class="cs-wrap" id="cswrap-${id}"><input type="hidden" id="${id}" value="${esc(value!==undefined&&value!==null?value:'')}"><div class="cs-display" tabindex="0" id="csdisp-${id}" onclick="csOpen('${id}')" onkeydown="if(event.key==='Enter'||event.key===' ')csOpen('${id}')"><span class="cs-display-text${sel?'':' placeholder'}" id="csdt-${id}">${esc(disp)}</span><span class="material-icons-round cs-arrow" id="csarr-${id}">expand_more</span></div></div>`;
}
function csOpen(id){
  const opts=_csOptsMap[id];if(!opts)return;
  _csId=id;_csOpts=opts.options;
  document.getElementById('cs-title').textContent=opts.label||'Select';
  const sw=document.getElementById('cs-search-wrap');
  if(opts.searchable&&opts.options.length>5){sw.style.display='block';document.getElementById('cs-search').value='';}else sw.style.display='none';
  const curVal=document.getElementById(id)?.value||'';
  renderCSOpts(_csOpts,curVal);
  document.getElementById('cs-sheet').classList.add('open');
  document.getElementById('csarr-'+id)?.classList.add('open');
  document.getElementById('csdisp-'+id)?.classList.add('open');
  pushNav('cs-'+id);
  if(opts.searchable)setTimeout(()=>document.getElementById('cs-search')?.focus(),200);
}
function renderCSOpts(opts,curVal){document.getElementById('cs-list').innerHTML=opts.map(o=>`<div class="cs-opt${String(o.value)===String(curVal)?' selected':''}" onclick="csSelect('${_csId}','${esc(String(o.value))}','${esc(o.label)}')"><div class="cs-opt-check">${String(o.value)===String(curVal)?'✓':''}</div><div class="cs-opt-label"><div>${esc(o.label)}</div>${o.sub?`<div class="cs-opt-sub">${esc(o.sub)}</div>`:''}</div></div>`).join('');}
function csFilter(q){if(!q){renderCSOpts(_csOpts,document.getElementById(_csId)?.value||'');return;}const lq=q.toLowerCase();renderCSOpts(_csOpts.filter(o=>o.label.toLowerCase().includes(lq)||(o.sub||'').toLowerCase().includes(lq)),document.getElementById(_csId)?.value||'');}
function csSelect(id,value,label){const h=document.getElementById(id);if(h)h.value=value;const dt=document.getElementById('csdt-'+id);if(dt){dt.textContent=label;dt.classList.remove('placeholder');}h?.dispatchEvent(new Event('change',{bubbles:true}));csClose();if(id==='qe-cust')setTimeout(previewCust,50);}
function csClose(){document.getElementById('cs-sheet').classList.remove('open');if(_csId){document.getElementById('csarr-'+_csId)?.classList.remove('open');document.getElementById('csdisp-'+_csId)?.classList.remove('open');}_csId=null;}

// ── SNACKBAR ─────────────────────────────────────────────
let _snackTimer=null;
function snack(msg,actionLabel,actionFn){
  const el=document.getElementById('snack');document.getElementById('snack-msg').textContent=msg;
  const act=document.getElementById('snack-act');
  if(actionLabel&&actionFn){act.textContent=actionLabel;act.onclick=()=>{actionFn();el.classList.remove('show');};act.style.display='block';}else act.style.display='none';
  el.classList.add('show');clearTimeout(_snackTimer);_snackTimer=setTimeout(()=>el.classList.remove('show'),actionLabel?5000:3000);
}

// ── MORE MENU ────────────────────────────────────────────
function openMore(){
  document.getElementById('more-body').innerHTML=`
    <div class="si" onclick="openAnalytics();closeDlg('dlg-more')"><div class="si-ic"><span class="material-icons-round">analytics</span></div><div class="si-tx"><div class="si-m">Sales Analytics</div></div></div>
    <div class="si" onclick="openTemplates();closeDlg('dlg-more')"><div class="si-ic"><span class="material-icons-round">bookmark</span></div><div class="si-tx"><div class="si-m">Quote Templates</div></div></div>
    <div class="si" onclick="openSetSheet('dashboard');closeDlg('dlg-more')"><div class="si-ic"><span class="material-icons-round">dashboard_customize</span></div><div class="si-tx"><div class="si-m">Dashboard Sections</div></div></div>
    <div class="si" onclick="toggleTheme();closeDlg('dlg-more')"><div class="si-ic"><span class="material-icons-round">dark_mode</span></div><div class="si-tx"><div class="si-m">Toggle Dark Mode</div></div></div>
    <div class="si" onclick="exportData();closeDlg('dlg-more')"><div class="si-ic"><span class="material-icons-round">download</span></div><div class="si-tx"><div class="si-m">Export Backup</div></div></div>
    <div class="si" onclick="go('settings');closeDlg('dlg-more')"><div class="si-ic"><span class="material-icons-round">settings</span></div><div class="si-tx"><div class="si-m">Settings</div></div></div>`;
  openDlg('dlg-more');
}

// ── CONFIRM ──────────────────────────────────────────────
function confirmAct(msg,fn){document.getElementById('cfm-ttl').textContent='Confirm';document.getElementById('cfm-msg').textContent=msg;document.getElementById('cfm-ok').onclick=()=>{fn();closeDlg('dlg-cfm');};openDlg('dlg-cfm');}
function clearAllData(){openIDB().then(db=>{const tx=db.transaction(IDB_STORE,'readwrite');tx.objectStore(IDB_STORE).clear();tx.oncomplete=()=>{localStorage.clear();location.reload();};}).catch(()=>{localStorage.clear();location.reload();});}

// ── DATA IMPORT/EXPORT ───────────────────────────────────
function exportData(){const blob=new Blob([JSON.stringify(DB,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`quotes_backup_${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);snack('Backup exported');}
function importData(){const inp=document.createElement('input');inp.type='file';inp.accept='.json';inp.onchange=e=>{const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=ev=>{try{const d=JSON.parse(ev.target.result);if(!d.companies&&!d.quotes)throw new Error('Invalid');confirmAct('Replace ALL data with this backup?',()=>{DB=d;ensureDefaults();recalcAllLTV();_doSave();location.reload();});}catch(err){snack('Invalid backup file');}};r.readAsText(file);};inp.click();}

// ── SW ───────────────────────────────────────────────────
function registerSW(){
  if(!('serviceWorker' in navigator))return;
  navigator.serviceWorker.register('sw.js').then(reg=>{
    reg.addEventListener('updatefound',()=>{const nw=reg.installing;nw.addEventListener('statechange',()=>{if(nw.state==='installed'&&navigator.serviceWorker.controller)document.getElementById('update-banner').classList.add('show');});});
  }).catch(e=>console.warn('SW:',e));
}

// ── KEYBOARD SHORTCUTS ────────────────────────────────────
document.addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.isContentEditable)return;
  if(document.querySelector('.bd.open')){if(e.key==='Escape'){const open=[...document.querySelectorAll('.bd.open')];if(open.length){open[open.length-1].classList.remove('open');if(!document.querySelector('.bd.open'))document.body.style.overflow='';}}return;}
  if(e.key==='n'||e.key==='N'){e.preventDefault();openQE(null);}
  else if(e.key==='1')go('dashboard');else if(e.key==='2')go('quotes');else if(e.key==='3')go('inventory');else if(e.key==='4')go('customers');else if(e.key==='5')go('settings');
});

// ── INIT ─────────────────────────────────────────────────
async function init(){
  await load();
  autoExpireQuotes();
  applyTheme();
  initNav();
  go('dashboard');
  renderSettings();
  registerSW();
  initOfflineIndicator();
}
document.addEventListener('DOMContentLoaded',init);
// ═══════════════════════════════════════════════════════
// QUOTES PWA v5.0 — Feature Extension Block
// Appended to app_v5_work.js
// Covers: customer statement, bulk actions, CSV import,
//   recurring quotes, smart pricing, XLSX export,
//   print-to-PDF, product bundles, signature pad,
//   animated counters, haptic feedback, long-press menu,
//   custom quote fields, rich text notes, diff viewer,
//   quote approval workflow, offline PDF queue,
//   notification reminders
// ═══════════════════════════════════════════════════════

// ── HAPTIC FEEDBACK ─────────────────────────────────────
function hap(ms=10){try{navigator.vibrate&&navigator.vibrate(ms);}catch(e){}}

// ── ANIMATED COUNTER ────────────────────────────────────
function animateCounter(el,target,duration=600,prefix='',suffix=''){
  const start=Date.now();const from=0;
  const tick=()=>{
    const elapsed=Date.now()-start;const progress=Math.min(elapsed/duration,1);
    const ease=1-Math.pow(1-progress,3);
    const val=Math.round(from+(target-from)*ease);
    el.textContent=prefix+val.toLocaleString()+suffix;
    if(progress<1)requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function animateDashMetrics(){
  const qs=acoQuotes();
  const pairs=[
    ['d-met-sent',qs.filter(q=>q.status==='Sent').length,'',''],
    ['d-met-won',qs.filter(q=>q.status==='Won').length,'',''],
    ['d-met-overdue',qs.filter(isOverdue).length,'',''],
  ];
  pairs.forEach(([id,val,pre,suf])=>{
    const el=document.getElementById(id);if(el)animateCounter(el,val,700,pre,suf);
  });
}

// ── LONG-PRESS CONTEXT MENU ─────────────────────────────
let _lpTimer=null;
function initLongPress(container){
  container.querySelectorAll('.qi[data-qid]').forEach(card=>{
    card.addEventListener('touchstart',e=>{
      _lpTimer=setTimeout(()=>{hap(30);showLongPressMenu(card.dataset.qid,e.touches[0].clientX,e.touches[0].clientY);},500);
    },{passive:true});
    card.addEventListener('touchend',()=>{clearTimeout(_lpTimer);},{passive:true});
    card.addEventListener('touchmove',()=>{clearTimeout(_lpTimer);},{passive:true});
    card.addEventListener('contextmenu',e=>{e.preventDefault();showLongPressMenu(card.dataset.qid,e.clientX,e.clientY);});
  });
}
function showLongPressMenu(qid,cx,cy){
  const q=DB.quotes.find(x=>x.id===qid);if(!q)return;
  const existing=document.getElementById('lp-menu');if(existing)existing.remove();
  const menu=document.createElement('div');
  menu.id='lp-menu';
  menu.style.cssText=`position:fixed;left:${Math.min(cx,window.innerWidth-200)}px;top:${Math.min(cy,window.innerHeight-200)}px;background:var(--su);border-radius:12px;box-shadow:var(--sh2);z-index:8000;overflow:hidden;min-width:180px;animation:dropIn .15s ease;border:1px solid var(--ol2)`;
  const acts=[
    ['edit','Edit',`closeDlg('dlg-qd');setTimeout(()=>openQE('${qid}'),120)`],
    ['content_copy','Duplicate',`dupQ('${qid}')`],
    ['bookmark_add','Save as Template',`saveAsTemplate('${qid}')`],
    ['check_circle','Mark as Won',`setQStat('${qid}','Won')`],
    ['send','Mark as Sent',`setQStat('${qid}','Sent')`],
    ['picture_as_pdf','Preview PDF',`openPreview('${qid}')`],
    ['share','Share',`openShareDialog('${qid}')`],
    ['delete','Delete',`softDelItem('quote','${qid}')`],
  ];
  menu.innerHTML=acts.map(([ic,lbl,fn])=>`<div onclick="${fn};document.getElementById('lp-menu')?.remove()" style="display:flex;align-items:center;gap:10px;padding:11px 14px;cursor:pointer;border-bottom:1px solid var(--ol2);font-size:13px;font-weight:500;transition:background .1s" onmouseover="this.style.background='var(--su2)'" onmouseout="this.style.background=''"><span class="material-icons-round" style="font-size:18px;color:var(--P)">${ic}</span>${lbl}</div>`).join('');
  document.body.appendChild(menu);
  setTimeout(()=>document.addEventListener('touchstart',()=>menu.remove(),{once:true}),100);
}

// ── CUSTOMER STATEMENT ──────────────────────────────────
function openCustomerStatement(custId){
  const c=getCust(custId);if(!c)return;
  const qs=DB.quotes.filter(q=>q.customerId===custId).sort((a,b)=>b.date.localeCompare(a.date));
  const won=qs.filter(q=>q.status==='Won');
  const outstanding=qs.filter(q=>q.isInvoice&&q.payment?.status!=='Paid');
  const totalWon=won.reduce((s,q)=>s+calcTotals(q).total,0);
  const totalOutstanding=outstanding.reduce((s,q)=>{const tots=calcTotals(q);const paid=q.payment?.status==='Paid'?tots.total:q.payment?.amountPaid||0;return s+(tots.total-paid);},0);
  document.getElementById('set-ttl').textContent='Customer Statement';
  document.getElementById('set-body').innerHTML=`
    <div style="padding:0 0 12px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
        <div class="av" style="width:48px;height:48px;font-size:20px;background:${avColor(c.company)}">${avLetter(c.company)}</div>
        <div><div style="font-size:17px;font-weight:800">${esc(c.company)}</div><div style="font-size:13px;color:var(--t2)">${esc(c.contact||'')}${c.industry?' · '+esc(c.industry):''}</div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
        <div style="background:var(--su2);border-radius:10px;padding:12px"><div style="font-size:11px;color:var(--t2)">Lifetime Value</div><div style="font-size:18px;font-weight:800;color:var(--S)">${fmt(c.ltv||0)}</div></div>
        <div style="background:var(--su2);border-radius:10px;padding:12px"><div style="font-size:11px;color:var(--t2)">Outstanding</div><div style="font-size:18px;font-weight:800;color:${totalOutstanding>0?'var(--E)':'var(--S)'}">${fmt(totalOutstanding)}</div></div>
        <div style="background:var(--su2);border-radius:10px;padding:12px"><div style="font-size:11px;color:var(--t2)">Total Deals</div><div style="font-size:18px;font-weight:800">${qs.length}</div></div>
        <div style="background:var(--su2);border-radius:10px;padding:12px"><div style="font-size:11px;color:var(--t2)">Won Deals</div><div style="font-size:18px;font-weight:800;color:var(--P)">${won.length}</div></div>
      </div>
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--t2);margin-bottom:8px">All Quotes & Invoices</div>
      ${qs.length===0?`<div class="empty" style="padding:20px"><span class="material-icons-round">receipt_long</span><div class="empty-t">No quotes yet</div></div>`
      :qs.map(q=>{const tots=calcTotals(q);const statusColor={Draft:'#4285F4',Sent:'#F9AB00',Won:'#34A853',Lost:'#EA4335',Expired:'#9AA0A6'}[q.status]||'#9AA0A6';return`<div onclick="closeDlg('dlg-set');setTimeout(()=>openQD('${q.id}'),120)" style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--ol2);cursor:pointer">
        <div style="width:4px;height:40px;border-radius:2px;background:${statusColor};flex-shrink:0"></div>
        <div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700">${esc(q.isInvoice?q.invoiceId:q.id)}</div><div style="font-size:11px;color:var(--t2)">${fmtDate(q.date)} · <span class="${chipCls(q.status)}">${q.status}</span>${q.isInvoice&&q.payment?.status?` · ${q.payment.status}`:''}</div></div>
        <div style="font-size:14px;font-weight:700">${fmt(tots.total)}</div>
      </div>`;}).join('')}
    </div>`;
  openDlg('dlg-set');pushNav('statement-'+custId);
}

// ── BULK STATUS UPDATE ──────────────────────────────────
let _bulkSelected=new Set();
let _bulkMode=false;
function toggleBulkMode(){
  _bulkMode=!_bulkMode;_bulkSelected.clear();
  renderQuotes();
  const bar=document.getElementById('bulk-bar');
  if(bar)bar.style.display=_bulkMode?'flex':'none';
}
function toggleBulkSelect(qid){
  hap(8);
  if(_bulkSelected.has(qid))_bulkSelected.delete(qid);else _bulkSelected.add(qid);
  document.getElementById('bulk-count').textContent=_bulkSelected.size+' selected';
  const card=document.querySelector(`.qi[data-qid="${qid}"]`);
  if(card)card.classList.toggle('bulk-selected',_bulkSelected.has(qid));
}
function bulkSetStatus(status){
  if(!_bulkSelected.size){snack('Select quotes first');return;}
  confirmAct(`Mark ${_bulkSelected.size} quote(s) as ${status}?`,()=>{
    _bulkSelected.forEach(qid=>{const q=DB.quotes.find(x=>x.id===qid);if(q){q.status=status;logActivity(q,'Bulk status: '+status);}if(status==='Won'&&q)updateLTV(q.customerId);});
    save();_bulkMode=false;_bulkSelected.clear();renderQuotes();updateNavBadges();snack('Updated '+_bulkSelected.size+' quotes');
    const bar=document.getElementById('bulk-bar');if(bar)bar.style.display='none';
  });
}
function bulkDelete(){
  if(!_bulkSelected.size){snack('Select quotes first');return;}
  confirmAct(`Delete ${_bulkSelected.size} quote(s)? This cannot be undone.`,()=>{
    const ids=[..._bulkSelected];
    ids.forEach(qid=>{const q=DB.quotes.find(x=>x.id===qid);if(q)updateLTV(q.customerId);DB.quotes=DB.quotes.filter(x=>x.id!==qid);});
    save();_bulkMode=false;_bulkSelected.clear();renderQuotes();updateNavBadges();snack(ids.length+' quotes deleted');
    const bar=document.getElementById('bulk-bar');if(bar)bar.style.display='none';
  });
}

// ── CSV IMPORT ───────────────────────────────────────────
function openCSVImport(type){
  document.getElementById('set-ttl').textContent=`Import ${type==='inventory'?'Products':'Customers'} from CSV`;
  document.getElementById('set-body').innerHTML=`
    <div style="background:var(--su2);border-radius:8px;padding:12px;margin-bottom:14px;font-size:13px;color:var(--t2);line-height:1.7">
      <b>Expected columns for ${type==='inventory'?'Products':'Customers'}:</b><br>
      ${type==='inventory'?'<code>id, name, category, description, unitCost, markup, stock</code>':'<code>id, company, contact, email, phone, address, industry, tier, taxPin</code>'}
      <br><br>First row must be the header row. Fields can be in any order.
    </div>
    <input type="file" id="csv-file" accept=".csv,.txt" class="fi" onchange="previewCSV('${type}',this)">
    <div id="csv-preview" style="margin-top:12px"></div>
    <div id="csv-import-btn" style="margin-top:10px;display:none">
      <button class="btn bp btn-w" onclick="doCSVImport('${type}')"><span class="material-icons-round">upload</span> Import Data</button>
    </div>`;
  openDlg('dlg-set');pushNav('csv-import-'+type);
}
let _csvParsed=[];
function previewCSV(type,input){
  const file=input.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    const text=e.target.result;const lines=text.split('\n').filter(l=>l.trim());
    if(lines.length<2){snack('CSV must have a header row and at least one data row');return;}
    const headers=lines[0].split(',').map(h=>h.trim().replace(/^"|"$/g,'').toLowerCase());
    const rows=lines.slice(1).map(line=>{
      const vals=[];let cur='',inQ=false;
      for(const ch of line){if(ch==='"')inQ=!inQ;else if(ch===','&&!inQ){vals.push(cur.trim());cur='';}else cur+=ch;}
      vals.push(cur.trim());
      const obj={};headers.forEach((h,i)=>obj[h]=(vals[i]||'').replace(/^"|"$/g,''));
      return obj;
    }).filter(r=>Object.values(r).some(v=>v));
    _csvParsed=rows;
    const preview=document.getElementById('csv-preview');
    preview.innerHTML=`<div style="font-size:13px;font-weight:700;margin-bottom:8px">${rows.length} rows found — Preview (first 3):</div>`+
      rows.slice(0,3).map(r=>`<div style="background:var(--su2);border-radius:6px;padding:8px 10px;margin-bottom:6px;font-size:12px;font-family:monospace">${Object.entries(r).slice(0,5).map(([k,v])=>`<span style="color:var(--t2)">${k}:</span> ${esc(v)}`).join(' &nbsp;·&nbsp; ')}</div>`).join('');
    document.getElementById('csv-import-btn').style.display='block';
  };
  reader.readAsText(file);
}
function doCSVImport(type){
  if(!_csvParsed.length){snack('No data to import');return;}
  const co=activeCo();let added=0,skipped=0;
  _csvParsed.forEach(row=>{
    if(type==='inventory'){
      const id=(row.id||row.ID||nextId('ITM',DB.inventory)).trim();
      if(DB.inventory.find(i=>i.id===id)){skipped++;return;}
      DB.inventory.push({id,name:row.name||row.Name||id,category:row.category||row.Category||getCategories()[0],description:row.description||row.Description||'',unitCost:parseFloat(row.unitcost||row.unitCost||row['unit cost']||0),markup:parseFloat(row.markup||row.Markup||0.3),stock:row.stock?parseInt(row.stock):null,trackStock:!!row.stock,companyId:co?.id});added++;
    } else {
      const id=(row.id||row.ID||nextId('CUS',DB.customers)).trim();
      if(DB.customers.find(c=>c.id===id)){skipped++;return;}
      DB.customers.push({id,company:row.company||row.Company||id,contact:row.contact||row.Contact||'',email:row.email||row.Email||'',phone:row.phone||row.Phone||'',address:row.address||row.Address||'',industry:row.industry||row.Industry||'',tier:row.tier||row.Tier||'Bronze',taxPin:row.taxpin||row.taxPin||'',companyId:co?.id,ltv:0});added++;
    }
  });
  save();closeDlg('dlg-set');renderPage(curPage);snack(`Imported ${added} records${skipped?', '+skipped+' skipped (duplicate IDs)':''}`);
}

// ── XLSX EXPORT ──────────────────────────────────────────
function exportToXLSX(type){
  const qs=acoQuotes(),custs=acoCusts(),inv=acoInv();
  let csv='',filename='';
  if(type==='quotes'){
    csv='Quote ID,Customer,Date,Valid Until,Status,Salesperson,Subtotal,Discount,Net,Tax,Total,Margin %\n';
    qs.forEach(q=>{const cu=getCust(q.customerId),sp=getSP(q.salespersonId),tots=calcTotals(q);csv+=`"${q.isInvoice?q.invoiceId:q.id}","${(cu?.company||'').replace(/"/g,'""')}","${q.date}","${q.validUntil}","${q.status}","${(sp?.name||'').replace(/"/g,'""')}",${tots.sub.toFixed(2)},${tots.discAmt.toFixed(2)},${tots.net.toFixed(2)},${tots.taxAmt.toFixed(2)},${tots.total.toFixed(2)},${Math.round(tots.margin*100)}\n`;});
    filename='quotes_export.csv';
  } else if(type==='customers'){
    csv='ID,Company,Contact,Email,Phone,Industry,Tier,LTV\n';
    custs.forEach(c=>csv+=`"${c.id}","${(c.company||'').replace(/"/g,'""')}","${(c.contact||'').replace(/"/g,'""')}","${c.email||''}","${c.phone||''}","${c.industry||''}","${c.tier||''}",${(c.ltv||0).toFixed(2)}\n`);
    filename='customers_export.csv';
  } else if(type==='inventory'){
    csv='ID,Name,Category,Description,Unit Cost,Markup %,Sale Price,Margin %,Stock\n';
    inv.forEach(p=>{const price=p.unitCost*(1+p.markup);const mg=Math.round(productMargin(p)*100);csv+=`"${p.id}","${(p.name||'').replace(/"/g,'""')}","${p.category||''}","${(p.description||'').replace(/"/g,'""')}",${p.unitCost},${Math.round(p.markup*100)},${price.toFixed(2)},${mg},${p.stock!=null?p.stock:''}\n`;});
    filename='inventory_export.csv';
  }
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=filename;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),5000);snack('Exported: '+filename);
}

// ── PRINT TO PDF VIA @MEDIA PRINT ───────────────────────
function printQuote(qid){
  buildPreview(qid||curQID);
  setTimeout(()=>{
    const pages=window._previewPagesArr;if(!pages?.length)return;
    const ac=window._previewAccentUsed||'#1A73E8';
    const w=window.open('','_blank','width=860,height=1100');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Quote</title><style>@media print{body{margin:0}@page{size:A4;margin:0}}body{margin:0;font-family:'Inter',sans-serif}</style></head><body>`);
    pages.forEach((content,i)=>{
      w.document.write(`<div style="width:210mm;min-height:297mm;page-break-after:${i<pages.length-1?'always':'avoid'};position:relative;overflow:hidden;box-sizing:border-box;padding:40px;font-family:'Inter',ui-sans-serif,sans-serif">`);
      // inline the CSS from iframeCSS
      const tmp=document.createElement('div');tmp.innerHTML=content;w.document.write(content);
      w.document.write('</div>');
    });
    w.document.write(`</body></html>`);
    w.document.close();
    setTimeout(()=>{w.focus();w.print();},800);
  },400);
}

// ── RECURRING QUOTE REMINDERS ────────────────────────────
function openRecurringSetup(qid){
  const q=DB.quotes.find(x=>x.id===qid);if(!q)return;
  const rec=q.recurring||{enabled:false,interval:'annually',nextDate:''};
  document.getElementById('set-ttl').textContent='Recurring Quote';
  document.getElementById('set-body').innerHTML=`
    <div style="font-size:13px;color:var(--t2);margin-bottom:12px;line-height:1.6">Mark this quote as recurring. A dashboard reminder will appear when renewal is due.</div>
    <div class="fg"><label class="fl" style="display:flex;justify-content:space-between;align-items:center">Enable Recurring<button class="tog ${rec.enabled?'on':''}" id="rec-tog" onclick="this.classList.toggle('on')"></button></label></div>
    <div class="fg"><label class="fl">Renewal Interval</label>${buildCustomSelect({id:'rec-interval',label:'Interval',options:['monthly','quarterly','bi-annually','annually'].map(v=>({value:v,label:v.charAt(0).toUpperCase()+v.slice(1)})),value:rec.interval||'annually'})}</div>
    <div class="fg"><label class="fl">Next Renewal Date</label><input class="fi" type="date" id="rec-date" value="${rec.nextDate||''}"></div>
    <button class="btn bp btn-w" onclick="saveRecurring('${qid}')">Save</button>`;
  openDlg('dlg-set');pushNav('recurring-'+qid);
}
function saveRecurring(qid){
  const q=DB.quotes.find(x=>x.id===qid);if(!q)return;
  q.recurring={enabled:!!document.getElementById('rec-tog')?.classList.contains('on'),interval:v('rec-interval')||'annually',nextDate:v('rec-date')};
  logActivity(q,'Recurring setup: '+(q.recurring.enabled?q.recurring.interval:'disabled'));
  save();closeDlg('dlg-set');snack('Recurring settings saved');
}
function getRecurringAlerts(){
  const today=new Date().toISOString().slice(0,10);
  return DB.quotes.filter(q=>q.recurring?.enabled&&q.recurring.nextDate&&q.recurring.nextDate<=today);
}

// ── SMART SUGGESTED PRICING ──────────────────────────────
function getLastPriceForProduct(customerId,itemId){
  const won=DB.quotes.filter(q=>q.customerId===customerId&&q.status==='Won').sort((a,b)=>b.date.localeCompare(a.date));
  for(const q of won){const li=(q.items||[]).find(i=>i.itemId===itemId);if(li)return{price:li.unitPrice,quoteId:q.id,date:q.date};}
  return null;
}

// ── PRODUCT BUNDLING ─────────────────────────────────────
function openBundleManager(){
  const bundles=DB.settings.bundles||[];
  document.getElementById('set-ttl').textContent='Product Bundles';
  document.getElementById('set-body').innerHTML=`
    <div style="font-size:13px;color:var(--t2);margin-bottom:12px">Bundles appear as single searchable items in the quote editor and expand into their component products.</div>
    <button class="btn bp btn-w" style="margin-bottom:12px" onclick="openBundleEditor(null)"><span class="material-icons-round">add</span> New Bundle</button>
    ${bundles.length===0?`<div class="empty" style="padding:20px"><span class="material-icons-round">inventory_2</span><div class="empty-t">No bundles yet</div></div>`
    :bundles.map(b=>`<div style="background:var(--su2);border-radius:10px;padding:12px;margin-bottom:8px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><div style="font-size:14px;font-weight:700">${esc(b.name)}</div><div style="display:flex;gap:6px"><button class="btn bt btn-sm" onclick="openBundleEditor('${b.id}')">Edit</button><button class="btn bd2 btn-sm" onclick="deleteBundle('${b.id}')">Del</button></div></div><div style="font-size:12px;color:var(--t2)">${(b.items||[]).length} products · ${esc(b.description||'')}</div></div>`).join('')}`;
  openDlg('dlg-set');pushNav('bundles');
}
function openBundleEditor(id){
  const bundles=DB.settings.bundles||[];const b=id?bundles.find(x=>x.id===id):null;
  const inv=acoInv();
  document.getElementById('set-ttl').textContent=id?'Edit Bundle':'New Bundle';
  document.getElementById('set-body').innerHTML=`
    <div class="fg"><label class="fl">Bundle Name *</label><input class="fi" id="bnd-nm" value="${esc(b?.name||'')}" placeholder="e.g. Starter Pack"></div>
    <div class="fg"><label class="fl">Description</label><input class="fi" id="bnd-desc" value="${esc(b?.description||'')}" placeholder="Short description for search"></div>
    <div class="fg"><label class="fl">Products in Bundle</label>
      <div id="bnd-items" style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px">
        ${(b?.items||[]).map((bi,i)=>{const p=getProd(bi.itemId);return`<div style="display:flex;gap:8px;align-items:center;background:var(--su2);border-radius:6px;padding:8px 10px"><div style="flex:1;font-size:13px">${esc(p?.name||bi.itemId)}</div><input type="number" class="fi" style="width:70px;height:32px;padding:4px 8px;font-size:13px" value="${bi.qty||1}" id="bnd-qty-${i}" min="1"><button class="ib" style="width:28px;height:28px;color:var(--E)" onclick="this.closest('div[style]').remove()"><span class="material-icons-round" style="font-size:16px">close</span></button></div>`;}).join('')}
      </div>
      ${buildCustomSelect({id:'bnd-add-item',label:'Add Product',placeholder:'— Select product to add —',options:[{value:'',label:'— Select product —'},...inv.map(p=>({value:p.id,label:p.name}))],value:'',searchable:true})}
      <button class="btn btn-ton btn-w" style="margin-top:8px" onclick="addBundleItem()"><span class="material-icons-round">add</span> Add Selected Product</button>
    </div>
    <button class="btn bp btn-w" onclick="saveBundle('${id||''}')">Save Bundle</button>
    ${id?`<button class="btn bd2 btn-w" style="margin-top:8px" onclick="deleteBundle('${id}')">Delete Bundle</button>`:''}`;
  // Stay in same sheet
}
function addBundleItem(){
  const prodId=v('bnd-add-item');if(!prodId)return;const p=getProd(prodId);if(!p)return;
  const container=document.getElementById('bnd-items');
  const idx=container.querySelectorAll('div[style]').length;
  const div=document.createElement('div');div.style.cssText='display:flex;gap:8px;align-items:center;background:var(--su2);border-radius:6px;padding:8px 10px';
  div.innerHTML=`<div style="flex:1;font-size:13px" data-itemid="${p.id}">${esc(p.name)}</div><input type="number" class="fi" style="width:70px;height:32px;padding:4px 8px;font-size:13px" value="1" id="bnd-qty-${idx}" min="1"><button class="ib" style="width:28px;height:28px;color:var(--E)" onclick="this.closest('div[style]').remove()"><span class="material-icons-round" style="font-size:16px">close</span></button>`;
  container.appendChild(div);
}
function saveBundle(id){
  const name=v('bnd-nm');if(!name){snack('Bundle name required');return;}
  const container=document.getElementById('bnd-items');
  const items=[...container.querySelectorAll('[data-itemid]')].map((el,i)=>({itemId:el.dataset.itemid,qty:parseInt(document.getElementById('bnd-qty-'+i)?.value)||1}));
  if(!items.length){snack('Add at least one product');return;}
  if(!DB.settings.bundles)DB.settings.bundles=[];
  const bundle={id:id||'BND-'+uid().slice(0,6).toUpperCase(),name,description:v('bnd-desc'),items};
  const idx=DB.settings.bundles.findIndex(b=>b.id===bundle.id);
  if(idx>=0)DB.settings.bundles[idx]=bundle;else DB.settings.bundles.push(bundle);
  save();openBundleManager();snack('Bundle saved');
}
function deleteBundle(id){DB.settings.bundles=(DB.settings.bundles||[]).filter(b=>b.id!==id);save();openBundleManager();snack('Bundle deleted');}
function expandBundleIntoItems(bundleId){
  const b=(DB.settings.bundles||[]).find(x=>x.id===bundleId);if(!b)return[];
  return (b.items||[]).map(bi=>{const p=getProd(bi.itemId);return{itemId:bi.itemId,desc:p?.name||bi.itemId,qty:bi.qty||1,unitPrice:p?p.unitCost*(1+p.markup):0,discount:0};});
}

// ── SIGNATURE PAD (CANVAS DRAW) ──────────────────────────
function openSignaturePad(spId){
  document.getElementById('set-ttl').textContent='Draw Signature';
  document.getElementById('set-body').innerHTML=`
    <div style="font-size:13px;color:var(--t2);margin-bottom:10px">Draw your signature with your finger or mouse.</div>
    <div style="border:2px solid var(--ol);border-radius:8px;overflow:hidden;background:#fff;touch-action:none">
      <canvas id="sig-canvas" width="340" height="160" style="display:block;width:100%;cursor:crosshair"></canvas>
    </div>
    <div style="display:flex;gap:8px;margin-top:10px">
      <button class="btn bo" onclick="clearSigPad()"><span class="material-icons-round">clear</span> Clear</button>
      <button class="btn bp" style="flex:1" onclick="saveSigPad('${spId}')"><span class="material-icons-round">check</span> Save Signature</button>
    </div>`;
  openDlg('dlg-set');pushNav('sigpad-'+spId);
  setTimeout(initSigPad,100);
}
function initSigPad(){
  const canvas=document.getElementById('sig-canvas');if(!canvas)return;
  const ctx=canvas.getContext('2d');
  ctx.strokeStyle='#111';ctx.lineWidth=2.5;ctx.lineCap='round';ctx.lineJoin='round';
  let drawing=false,lastX=0,lastY=0;
  function getPos(e){const r=canvas.getBoundingClientRect();const t=e.touches?e.touches[0]:e;return{x:(t.clientX-r.left)*(canvas.width/r.width),y:(t.clientY-r.top)*(canvas.height/r.height)};}
  canvas.addEventListener('mousedown',e=>{drawing=true;const p=getPos(e);lastX=p.x;lastY=p.y;});
  canvas.addEventListener('touchstart',e=>{e.preventDefault();drawing=true;const p=getPos(e);lastX=p.x;lastY=p.y;},{passive:false});
  function draw(e){if(!drawing)return;e.preventDefault?.();const p=getPos(e);ctx.beginPath();ctx.moveTo(lastX,lastY);ctx.lineTo(p.x,p.y);ctx.stroke();lastX=p.x;lastY=p.y;}
  canvas.addEventListener('mousemove',draw);canvas.addEventListener('touchmove',draw,{passive:false});
  canvas.addEventListener('mouseup',()=>drawing=false);canvas.addEventListener('touchend',()=>drawing=false);
}
function clearSigPad(){const c=document.getElementById('sig-canvas');if(c)c.getContext('2d').clearRect(0,0,c.width,c.height);}
function saveSigPad(spId){
  const c=document.getElementById('sig-canvas');if(!c)return;
  const dataUrl=c.toDataURL('image/png');
  const sp=getSP(spId);if(sp){sp.signatureImg=dataUrl;save();snack('Signature saved');}
  closeDlg('dlg-set');
}

// ── CUSTOM QUOTE FIELDS ──────────────────────────────────
function openCustomFieldsManager(){
  const fields=DB.settings.customQuoteFields||[];
  document.getElementById('set-ttl').textContent='Custom Quote Fields';
  document.getElementById('set-body').innerHTML=`
    <div style="font-size:13px;color:var(--t2);margin-bottom:12px">These fields appear in the quote editor and on the PDF.</div>
    <div id="cqf-list">${fields.map((f,i)=>`<div style="display:flex;gap:8px;margin-bottom:8px;align-items:center"><input class="fi" style="flex:1" id="cqf-${i}" value="${esc(f)}" placeholder="Field name (e.g. PO Number)"><button class="ib" style="color:var(--E);flex-shrink:0" onclick="this.closest('div').remove()"><span class="material-icons-round">delete</span></button></div>`).join('')}</div>
    <button class="btn btn-ton btn-w" style="margin-bottom:10px" onclick="addCQFItem()"><span class="material-icons-round">add</span> Add Field</button>
    <button class="btn bp btn-w" onclick="saveCQF()">Save Fields</button>`;
  openDlg('dlg-set');pushNav('customfields');
}
function addCQFItem(){const list=document.getElementById('cqf-list');const idx=list.querySelectorAll('div').length;const row=document.createElement('div');row.style.cssText='display:flex;gap:8px;margin-bottom:8px;align-items:center';row.innerHTML=`<input class="fi" style="flex:1" id="cqf-${idx}" placeholder="Field name (e.g. PO Number)"><button class="ib" style="color:var(--E);flex-shrink:0" onclick="this.closest('div').remove()"><span class="material-icons-round">delete</span></button>`;list.appendChild(row);}
function saveCQF(){const inputs=document.querySelectorAll('[id^="cqf-"]');DB.settings.customQuoteFields=Array.from(inputs).map(el=>el.value.trim()).filter(Boolean);save();closeDlg('dlg-set');renderSettings();snack('Custom fields saved');}

// ── RICH TEXT NOTES ──────────────────────────────────────
function openRichNotes(qid){
  const q=DB.quotes.find(x=>x.id===qid);if(!q)return;
  document.getElementById('set-ttl').textContent='Edit Notes';
  document.getElementById('set-body').innerHTML=`
    <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">
      <button class="btn btn-ton btn-sm" onclick="rtnFmt('bold')"><b>B</b></button>
      <button class="btn btn-ton btn-sm" onclick="rtnFmt('italic')"><i>I</i></button>
      <button class="btn btn-ton btn-sm" onclick="rtnFmt('insertUnorderedList')">• List</button>
      <button class="btn btn-ton btn-sm" onclick="rtnFmt('insertOrderedList')">1. List</button>
    </div>
    <div id="rtn-editor" contenteditable="true" style="min-height:160px;border:1.5px solid var(--ol);border-radius:8px;padding:10px 13px;font-size:14px;color:var(--t1);background:var(--su);line-height:1.7;outline:none">${q.notes||''}</div>
    <button class="btn bp btn-w" style="margin-top:10px" onclick="saveRichNotes('${qid}')">Save Notes</button>`;
  openDlg('dlg-set');pushNav('richnotes-'+qid);
}
function rtnFmt(cmd){document.execCommand(cmd,false,null);document.getElementById('rtn-editor')?.focus();}
function saveRichNotes(qid){
  const q=DB.quotes.find(x=>x.id===qid);if(!q)return;
  const el=document.getElementById('rtn-editor');if(!el)return;
  q.notes=el.innerHTML;logActivity(q,'Notes updated');
  save();closeDlg('dlg-set');closeDlg('dlg-qd');openQD(qid);snack('Notes saved');
}

// ── OFFLINE PDF QUEUE ─────────────────────────────────────
const _pdfQueue=[];
function queuePDFExport(qid){
  _pdfQueue.push(qid);snack('PDF queued — will download when online');
  window.addEventListener('online',flushPDFQueue,{once:true});
}
async function flushPDFQueue(){
  if(!_pdfQueue.length)return;
  snack('Back online — generating '+_pdfQueue.length+' queued PDF(s)…');
  while(_pdfQueue.length){
    const qid=_pdfQueue.shift();const q=DB.quotes.find(x=>x.id===qid);if(!q)continue;
    buildPreview(qid);await new Promise(r=>setTimeout(r,800));
    try{const blob=await generatePDFBlob();if(blob){const fname=buildFileName(q);const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=fname;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}}
    catch(e){console.warn('Queued PDF failed:',e);}
  }
  snack('All queued PDFs generated!');
}

// ── QUOTE APPROVAL WORKFLOW ───────────────────────────────
function submitForApproval(qid){
  const q=DB.quotes.find(x=>x.id===qid);if(!q)return;
  q.status='Pending Approval';q.approvalRequestedAt=new Date().toISOString();
  logActivity(q,'Submitted for approval');save();closeDlg('dlg-qd');closeDlg('dlg-qact');renderPage(curPage);snack('Submitted for approval');updateNavBadges();
}
function approveQuote(qid){
  const q=DB.quotes.find(x=>x.id===qid);if(!q)return;
  q.status='Draft';q.approvedAt=new Date().toISOString();
  logActivity(q,'Approved — ready to send');save();closeDlg('dlg-qd');renderPage(curPage);snack('Quote approved ✓',null,null);triggerWinAnimation();
}
function rejectQuote(qid){
  const q=DB.quotes.find(x=>x.id===qid);if(!q)return;
  q.status='Draft';logActivity(q,'Approval rejected — returned to Draft');
  save();closeDlg('dlg-qd');renderPage(curPage);snack('Quote returned for revision');
}

// ── QUOTE COMPARISON ─────────────────────────────────────
let _compareIds=[];
function openCompare(){
  const qs=acoQuotes();
  document.getElementById('set-ttl').textContent='Compare Quotes';
  document.getElementById('set-body').innerHTML=`
    <div style="font-size:13px;color:var(--t2);margin-bottom:12px">Select exactly 2 quotes to compare side by side.</div>
    ${buildCustomSelect({id:'cmp-q1',label:'Quote 1',options:[{value:'',label:'— Select —'},...qs.map(q=>{const cu=getCust(q.customerId);return{value:q.id,label:(q.isInvoice?q.invoiceId:q.id)+' — '+(cu?.company||'')};})],value:'',searchable:true})}
    <div style="margin-top:10px"></div>
    ${buildCustomSelect({id:'cmp-q2',label:'Quote 2',options:[{value:'',label:'— Select —'},...qs.map(q=>{const cu=getCust(q.customerId);return{value:q.id,label:(q.isInvoice?q.invoiceId:q.id)+' — '+(cu?.company||'')};})],value:'',searchable:true})}
    <button class="btn bp btn-w" style="margin-top:14px" onclick="doCompare()"><span class="material-icons-round">compare_arrows</span> Compare</button>
    <div id="cmp-result" style="margin-top:16px"></div>`;
  openDlg('dlg-set');pushNav('compare');
}
function doCompare(){
  const id1=v('cmp-q1'),id2=v('cmp-q2');
  if(!id1||!id2||id1===id2){snack('Select 2 different quotes');return;}
  const q1=DB.quotes.find(x=>x.id===id1),q2=DB.quotes.find(x=>x.id===id2);if(!q1||!q2)return;
  const t1=calcTotals(q1),t2=calcTotals(q2);
  const cu1=getCust(q1.customerId),cu2=getCust(q2.customerId);
  const row=(label,v1,v2,higher='higher')=>{
    const diff=parseFloat(v1)!==parseFloat(v2);
    const v1Num=parseFloat(String(v1).replace(/[^0-9.-]/g,''));const v2Num=parseFloat(String(v2).replace(/[^0-9.-]/g,''));
    const win1=higher==='higher'?v1Num>v2Num:v1Num<v2Num;const win2=higher==='higher'?v2Num>v1Num:v2Num<v1Num;
    return`<tr><td style="padding:7px 10px;font-size:12px;color:var(--t2);border-bottom:1px solid var(--ol2)">${label}</td><td style="padding:7px 10px;font-size:13px;font-weight:600;text-align:right;border-bottom:1px solid var(--ol2);color:${diff&&win1?'var(--S)':'var(--t1)'}">${v1}</td><td style="padding:7px 10px;font-size:13px;font-weight:600;text-align:right;border-bottom:1px solid var(--ol2);color:${diff&&win2?'var(--S)':'var(--t1)'}">${v2}</td></tr>`;
  };
  document.getElementById('cmp-result').innerHTML=`
    <table style="width:100%;border-collapse:collapse;background:var(--su);border-radius:10px;overflow:hidden;box-shadow:var(--sh)">
      <thead><tr style="background:var(--P)"><th style="padding:9px 10px;font-size:12px;color:#fff;text-align:left">Metric</th><th style="padding:9px 10px;font-size:12px;color:#fff;text-align:right">${esc(q1.isInvoice?q1.invoiceId:q1.id)}</th><th style="padding:9px 10px;font-size:12px;color:#fff;text-align:right">${esc(q2.isInvoice?q2.invoiceId:q2.id)}</th></tr></thead>
      <tbody>
        ${row('Customer',cu1?.company||'—',cu2?.company||'—','none')}
        ${row('Status',q1.status,q2.status,'none')}
        ${row('Items',(q1.items||[]).length,(q2.items||[]).length)}
        ${row('Subtotal',fmt(t1.sub),fmt(t2.sub))}
        ${row('Discount',fmt(t1.discAmt),fmt(t2.discAmt),'lower')}
        ${row('Tax',fmt(t1.taxAmt),fmt(t2.taxAmt),'none')}
        ${row('Total',fmt(t1.total),fmt(t2.total))}
        ${row('Cost',fmt(t1.cost),fmt(t2.cost),'lower')}
        ${row('Margin',Math.round(t1.margin*100)+'%',Math.round(t2.margin*100)+'%')}
        ${row('Valid Until',fmtDate(q1.validUntil),fmtDate(q2.validUntil),'none')}
      </tbody>
    </table>`;
}

// ── NOTIFICATION REMINDERS ───────────────────────────────
function requestNotifPermission(){
  if(!('Notification' in window))return Promise.resolve('denied');
  if(Notification.permission==='granted')return Promise.resolve('granted');
  return Notification.requestPermission();
}
function scheduleExpiryReminder(qid){
  const q=DB.quotes.find(x=>x.id===qid);if(!q)return;
  requestNotifPermission().then(perm=>{
    if(perm!=='granted'){snack('Enable notifications in browser settings');return;}
    const due=new Date(q.validUntil);due.setDate(due.getDate()-1);
    const delay=due-new Date();if(delay<0){snack('Quote already expired or expires today');return;}
    setTimeout(()=>{
      const cu=getCust(q.customerId);
      new Notification('Quote Expiring Tomorrow',{body:`${q.isInvoice?q.invoiceId:q.id} for ${cu?.company||'Unknown'} — ${fmt(calcTotals(q).total)}`,icon:'./icon-192.svg'});
    },delay);
    q.reminderSet=true;save();snack('Reminder set for '+fmtDate(due.toISOString().slice(0,10)));
  });
}

// ── PATCH: acSearch to show smart pricing and bundles ────
const _origAcSearch=acSearch;
window.acSearchWithBundles=function(i,query){
  const drop=document.getElementById('ac-drop-'+i);if(!drop)return;
  const q=query.trim().toLowerCase();if(!q){drop.style.display='none';return;}
  const bundles=(DB.settings.bundles||[]).filter(b=>b.name.toLowerCase().includes(q));
  const prods=acoInv().map(p=>{const nm=p.name.toLowerCase(),id=p.id.toLowerCase(),ds=(p.description||'').toLowerCase();let sc=0;if(nm.startsWith(q))sc=3;else if(nm.includes(q))sc=2;else if(id.includes(q))sc=1;else if(ds.includes(q))sc=0.5;return{p,sc};}).filter(x=>x.sc>0).sort((a,b)=>b.sc-a.sc).slice(0,7);
  const custId=qeD.customerId;
  let html='';
  bundles.slice(0,3).forEach(b=>{
    html+=`<div class="ac-item" style="background:var(--PC)" onclick="acSelectBundle(${i},'${b.id}')"><span class="material-icons-round" style="color:var(--P);font-size:18px">inventory_2</span><div style="flex:1"><div style="font-size:13px;font-weight:700">${esc(b.name)} <span style="font-size:10px;font-weight:700;background:var(--P);color:#fff;border-radius:4px;padding:1px 5px">BUNDLE</span></div><div style="font-size:11px;color:var(--t2)">${(b.items||[]).length} products</div></div></div>`;
  });
  prods.forEach(({p})=>{
    const price=p.unitCost*(1+p.markup);const nm=p.name;const idx=nm.toLowerCase().indexOf(q);
    const hl=idx>=0?esc(nm.slice(0,idx))+'<b>'+esc(nm.slice(idx,idx+q.length))+'</b>'+esc(nm.slice(idx+q.length)):esc(nm);
    const mg=Math.round(productMargin(p)*100);const mgCol=mg<Math.round(DB.settings.minMargin*100)?'var(--E)':mg<Math.round(DB.settings.warnMargin*100)?'var(--W)':'var(--S)';
    const lastPrice=custId?getLastPriceForProduct(custId,p.id):null;
    html+=`<div class="ac-item" onclick="acSelect(${i},'${p.id}')"><div style="flex:1"><div style="font-size:13px;font-weight:600">${hl}</div><div style="font-size:11px;color:var(--t2)">${esc(p.id)} · ${esc(p.category)}${p.trackStock&&p.stock!=null?' · Stock: '+p.stock:''}</div>${lastPrice?`<div style="font-size:10px;color:var(--P);font-weight:600">Last quoted: ${fmt(lastPrice.price)} (${lastPrice.quoteId})</div>`:''}</div><div style="text-align:right"><div style="font-size:13px;font-weight:700;color:var(--P)">${fmt(price)}</div><div style="font-size:10px;color:${mgCol};font-weight:600">${mg}% margin</div></div></div>`;
  });
  if(!html)html=`<div class="ac-item ac-custom" onclick="acSelectCustom(${i},this.dataset.q)" data-q="${esc(query)}"><span class="material-icons-round" style="font-size:18px;color:var(--P)">add_circle</span><div><div style="font-size:13px;font-weight:600">Use "${esc(query)}" as custom item</div></div></div>`;
  drop.innerHTML=html;drop.style.display='block';
};
function acSelectBundle(i,bundleId){
  const items=expandBundleIntoItems(bundleId);if(!items.length)return;
  // Replace current empty item with all bundle items
  qeD.items.splice(i,1,...items);
  document.getElementById('ac-drop-'+i).style.display='none';
  renderQEItems();hap(15);snack('Bundle expanded into '+items.length+' items');
}
// Override acSearch to use bundle-aware version
window.acSearch=window.acSearchWithBundles;

// ── DISCOUNT APPROVAL RULES ───────────────────────────────
DB.settings.maxDiscountPct=DB.settings.maxDiscountPct||100;
function checkDiscountLimit(){
  const maxD=(DB.settings.maxDiscountPct||100)/100;
  const overallDisc=(parseFloat(v('qe-disc'))||0)/100;
  const lineOverDisc=(qeD.items||[]).some(li=>(li.discount||0)>maxD);
  if(overallDisc>maxD||lineOverDisc){
    qeD.status='Pending Approval';snack('Discount exceeds limit — submitted for approval');return true;
  }
  return false;
}

// ── INIT EXTENSIONS ──────────────────────────────────────
const _origInit=window.init;
window.init=async function(){
  await _origInit();
  // Patch qeSave to check discount limits and apply smart pricing notice
  const _origQESave=window.qeSave;
  window.qeSave=function(){checkDiscountLimit();_origQESave();};
  // Patch renderQuotes to support bulk mode and long-press
  const _origRenderQ=window.renderQuotes;
  window.renderQuotes=function(){
    _origRenderQ();
    const el=document.getElementById('q-list');
    if(el)initLongPress(el);
  };
  // Patch renderDash to animate counters
  const _origRDash=window.renderDash;
  window.renderDash=function(){
    _origRDash();
    // Animate metric values
    setTimeout(()=>{
      document.querySelectorAll('.mv').forEach(el=>{
        const n=parseFloat(el.textContent.replace(/[^0-9.]/g,''));
        if(!isNaN(n)&&n>0&&n<100000)animateCounter(el,n,700);
      });
    },50);
    // Show recurring alerts
    const recAlerts=getRecurringAlerts();
    const alertsEl=document.getElementById('d-alerts');
    if(alertsEl&&recAlerts.length){
      const extra=recAlerts.map(q=>{const cu=getCust(q.customerId);return`<div class="alert-card info" onclick="openQD('${q.id}')"><div style="display:flex;align-items:center;gap:10px"><span class="material-icons-round" style="color:var(--P);font-size:20px">autorenew</span><div style="flex:1"><div style="font-size:13px;font-weight:700">${esc(cu?.company||'?')} — Renewal Due</div><div style="font-size:12px;color:var(--t2)">${esc(q.recurring?.interval||'')} · ${fmt(calcTotals(q).total)}</div></div><span class="material-icons-round" style="color:var(--t3)">chevron_right</span></div></div>`;}).join('');
      alertsEl.insertAdjacentHTML('afterbegin',extra);
    }
  };
  // Patch openQAct to include new actions
  const _origOpenQAct=window.openQAct;
  window.openQAct=function(qid){
    _origOpenQAct(qid);
    const q=DB.quotes.find(x=>x.id===qid||x.id===curQID);if(!q)return;
    const body=document.getElementById('qact-body');if(!body)return;
    const extra=`
      <div class="si" onclick="openRecurringSetup('${q.id}');closeDlg('dlg-qact')"><div class="si-ic"><span class="material-icons-round">autorenew</span></div><div class="si-tx"><div class="si-m">Recurring Setup</div><div class="si-s">${q.recurring?.enabled?'Enabled: '+q.recurring.interval:'Not set'}</div></div></div>
      <div class="si" onclick="scheduleExpiryReminder('${q.id}');closeDlg('dlg-qact')"><div class="si-ic"><span class="material-icons-round">notifications</span></div><div class="si-tx"><div class="si-m">Set Expiry Reminder</div><div class="si-s">Notify 1 day before expiry</div></div></div>
      <div class="si" onclick="openRichNotes('${q.id}');closeDlg('dlg-qact')"><div class="si-ic"><span class="material-icons-round">edit_note</span></div><div class="si-tx"><div class="si-m">Edit Notes (Rich Text)</div></div></div>
      <div class="si" onclick="printQuote('${q.id}');closeDlg('dlg-qact')"><div class="si-ic"><span class="material-icons-round">print</span></div><div class="si-tx"><div class="si-m">Print Quote</div><div class="si-s">Via browser print dialog</div></div></div>
      ${navigator.onLine?'':`<div class="si" onclick="queuePDFExport('${q.id}');closeDlg('dlg-qact')"><div class="si-ic"><span class="material-icons-round">schedule_send</span></div><div class="si-tx"><div class="si-m">Queue PDF Export</div><div class="si-s">Will download when online</div></div></div>`}
      ${q.status==='Draft'?`<div class="si" onclick="submitForApproval('${q.id}');closeDlg('dlg-qact')"><div class="si-ic"><span class="material-icons-round">approval</span></div><div class="si-tx"><div class="si-m">Submit for Approval</div></div></div>`:''}
      ${q.status==='Pending Approval'?`<div class="si" onclick="approveQuote('${q.id}');closeDlg('dlg-qact')"><div class="si-ic grn"><span class="material-icons-round">check_circle</span></div><div class="si-tx"><div class="si-m">Approve Quote</div></div></div><div class="si" onclick="rejectQuote('${q.id}');closeDlg('dlg-qact')"><div class="si-ic red"><span class="material-icons-round">cancel</span></div><div class="si-tx"><div class="si-m">Reject / Return</div></div></div>`:''}`;
    body.insertAdjacentHTML('beforeend',extra);
  };
  // Add customer statement link into customer editor
  const _origOpenCustEd=window.openCustEd;
  window.openCustEd=function(id,fromQE){
    _origOpenCustEd(id,fromQE);
    if(id){
      const body=document.getElementById('cust-body');if(!body)return;
      body.insertAdjacentHTML('beforeend',`<div style="margin-top:8px"><button class="btn btn-ton btn-w" onclick="openCustomerStatement('${id}')"><span class="material-icons-round">summarize</span> View Statement</button></div>`);
    }
  };
  // Flushqe offline queue if online
  if(navigator.onLine)flushPDFQueue();
};
// ═══════════════════════════════════════════════════
// v5 FORM SAVE FIXES + REMAINING FEATURE COMPLETIONS
// ═══════════════════════════════════════════════════

// ── FIXED: saveInv — properly reads all fields including stock toggle ──
function saveInv() {
  const id = v('ii-id'), nm = v('ii-nm');
  if (!id || !nm) { snack('ID and name required'); return; }
  if (!editInvId && DB.inventory.find(i => i.id === id)) { snack('Product ID already exists — use a unique ID'); return; }
  const trackStock = !!document.getElementById('ii-track')?.classList.contains('on');
  const stockVal = trackStock ? (parseInt(v('ii-stock')) || 0) : null;
  const item = {
    id, name: nm,
    description: v('ii-desc'),
    category: v('ii-cat') || getCategories()[0],
    unitCost: parseFloat(v('ii-cost')) || 0,
    markup: (parseFloat(v('ii-mkup')) || 30) / 100,
    trackStock, stock: stockVal,
    companyId: (activeCo() || {}).id
  };
  const idx = DB.inventory.findIndex(i => i.id === id);
  if (idx >= 0) DB.inventory[idx] = item; else DB.inventory.push(item);
  save(); closeDlg('dlg-inv'); renderInv(); snack('✓ Product saved'); hap(20);
}

// ── FIXED: saveCust — validates all required fields + duplicate ID guard ──
function saveCust() {
  const id = v('ci-id'), co = v('ci-co');
  if (!id) { snack('Customer ID is required'); return; }
  if (!co) { snack('Company name is required'); return; }
  if (!editCustId && DB.customers.find(c => c.id === id)) { snack('Customer ID already exists — use a unique ID'); return; }
  const cust = {
    id, company: co,
    contact: v('ci-cnt'),
    email: v('ci-em'),
    phone: v('ci-ph'),
    address: v('ci-addr'),
    industry: v('ci-ind'),
    tier: v('ci-tier') || 'Bronze',
    taxPin: v('ci-pin'),
    companyId: (activeCo() || {}).id,
    ltv: getCust(id)?.ltv || 0
  };
  const idx = DB.customers.findIndex(c => c.id === id);
  if (idx >= 0) DB.customers[idx] = cust; else DB.customers.push(cust);
  save(); closeDlg('dlg-cust'); renderCusts(); snack('✓ Customer saved'); hap(20);
}

// ── FIXED: saveCo — validates name, collects all payment methods, logo ──
function saveCo() {
  const name = v('co-nm');
  if (!name) { snack('Company name is required'); return; }
  const id = editCoId || 'CO-' + uid().slice(0, 6).toUpperCase();
  const logoColEl = document.getElementById('logo-col');
  const co = {
    id, name,
    tagline: v('co-tag'),
    address: v('co-addr'),
    phone: v('co-ph'),
    email: v('co-em'),
    website: v('co-web'),
    taxPin: v('co-pin'),
    paymentMethods: collectPMs(),
    paymentTerms: v('co-pterms') || 'Net 30',
    terms: v('co-tc'),
    logoText: v('co-lt') || name[0].toUpperCase(),
    logoColor: logoColEl ? logoColEl.value : '#1A73E8',
    logoImg: document.getElementById('co-img')?.value || null
  };
  const idx = DB.companies.findIndex(c => c.id === id);
  if (idx >= 0) DB.companies[idx] = co;
  else { DB.companies.push(co); if (!DB.settings.activeCompanyId) DB.settings.activeCompanyId = id; }
  save(); closeDlg('dlg-co'); renderSettings(); snack('✓ Company profile saved'); hap(20);
}

// ── FIXED: saveSp — validates, saves signature, handles missing company ──
function saveSp() {
  const id = v('sp-id'), name = v('sp-nm');
  if (!id) { snack('Salesperson ID is required'); return; }
  if (!name) { snack('Name is required'); return; }
  if (!editSpId && DB.salespeople.find(s => s.id === id)) { snack('Salesperson ID already exists'); return; }
  const sp = {
    id, name,
    title: v('sp-ttl2'),
    email: v('sp-em'),
    phone: v('sp-ph'),
    companyId: v('sp-coid') || DB.settings.activeCompanyId || '',
    signatureImg: document.getElementById('sp-sig-img')?.value || ''
  };
  const idx = DB.salespeople.findIndex(s => s.id === id);
  if (idx >= 0) DB.salespeople[idx] = sp; else DB.salespeople.push(sp);
  save(); closeDlg('dlg-spe'); renderSPList(); renderSettings(); snack('✓ Salesperson saved'); hap(20);
}

// ── FIXED: qeSave — full validation with helpful field errors ──
function qeSave() {
  collectQE(qeStep);
  if (!qeD.companyId) { snack('Select a company profile first'); qeStep = 0; renderQEStep(); return; }
  if (!qeD.customerId) { snack('Select a customer first'); qeStep = 1; renderQEStep(); return; }
  if (!qeD.items || !qeD.items.length) { snack('Add at least one line item'); qeStep = 2; renderQEStep(); return; }
  const emptyItems = qeD.items.filter(li => !li.desc && !li.itemId);
  if (emptyItems.length) { snack('Remove or fill in all empty line items'); qeStep = 2; renderQEStep(); return; }
  const zeroItems = qeD.items.filter(li => !li.unitPrice);
  if (zeroItems.length) { snack('Some items have zero price — is that correct?', 'Save Anyway', () => _doQESave()); return; }
  _doQESave();
}
function _doQESave() {
  // Discount limit check
  const maxD = (DB.settings.maxDiscountPct || 100) / 100;
  const lineOver = (qeD.items || []).some(li => (li.discount || 0) > maxD);
  const overallOver = (qeD.discount || 0) > maxD;
  if (lineOver || overallOver) {
    qeD.status = 'Pending Approval';
    logActivity(qeD, 'Auto-submitted for approval: discount exceeds limit');
    snack('Discount exceeds limit — submitted for manager approval');
  }
  const isNew = !DB.quotes.find(q => q.id === qeD.id);
  if (!isNew) logActivity(qeD, 'Quote edited');
  const idx = DB.quotes.findIndex(q => q.id === qeD.id);
  if (idx >= 0) DB.quotes[idx] = qeD; else DB.quotes.unshift(qeD);
  if (qeD.status === 'Won') updateLTV(qeD.customerId);
  // Deduct stock for new quotes only
  if (isNew) {
    (qeD.items || []).forEach(li => {
      const p = getProd(li.itemId);
      if (p && p.trackStock && p.stock != null) p.stock = Math.max(0, p.stock - (li.qty || 1));
    });
  }
  save(); closeDlg('dlg-qe'); renderPage(curPage);
  snack(qeD.id + ' saved ✓'); hap(20); updateNavBadges();
  setTimeout(() => openQD(qeD.id), 360);
}

// ── FIXED: saveSetSheet — all setting types handled with validation ──
function saveSetSheet() {
  const s = DB.settings;
  if (setType === 'quote') {
    const pfx = v('ss-pfx').trim(); if (!pfx) { snack('Quote prefix cannot be empty'); return; }
    s.quotePrefix = pfx;
    s.invoicePrefix = v('ss-invpfx').trim() || 'INV-';
    s.quoteValidDays = Math.max(1, parseInt(v('ss-vd')) || 30);
    s.followUpDays = Math.max(1, parseInt(v('ss-fu')) || 7);
    s.taxRate = (parseFloat(v('ss-tax')) || 16) / 100;
    s.taxLabel = v('ss-taxlbl').trim() || 'VAT';
    s.currencySymbol = v('ss-curr').trim() || 'KSh';
  } else if (setType === 'margin') {
    const minM = parseFloat(v('ss-mm')) || 20;
    const warnM = parseFloat(v('ss-wm')) || 25;
    if (minM >= warnM) { snack('Warning margin must be higher than minimum margin'); return; }
    s.minMargin = minM / 100; s.warnMargin = warnM / 100;
  } else if (setType === 'categories') {
    const inputs = document.querySelectorAll('[id^="cat-item-"]');
    const cats = Array.from(inputs).map(el => el.value.trim()).filter(Boolean);
    if (!cats.length) { snack('Need at least one category'); return; }
    s.productCategories = [...new Set(cats)]; // deduplicate
  } else if (setType === 'download') {
    s.dlIncludeVersion = !!document.getElementById('ss-dlv')?.classList.contains('on');
  } else if (setType === 'dashboard') {
    if (!s.dashSections) s.dashSections = {};
    ['alerts','chart','pipeline','recent'].forEach(k => {
      s.dashSections[k] = !!document.getElementById('ds-' + k)?.classList.contains('on');
    });
  } else if (setType === 'discount') {
    const maxD = parseFloat(v('ss-maxd')) || 100;
    if (maxD < 0 || maxD > 100) { snack('Discount must be 0–100'); return; }
    s.maxDiscountPct = maxD;
  }
  save(); closeDlg('dlg-set'); renderSettings(); snack('✓ Settings saved'); hap(15);
}

// ── FIXED: savePayment — validates amount vs total ──
function savePayment(qid) {
  const q = DB.quotes.find(x => x.id === qid); if (!q) return;
  const tots = calcTotals(q);
  const status = v('pay-status') || 'Unpaid';
  const amt = parseFloat(v('pay-amt')) || 0;
  if (amt < 0) { snack('Amount paid cannot be negative'); return; }
  if (amt > tots.total) { snack('Amount paid exceeds invoice total'); return; }
  if (!q.payment) q.payment = {};
  q.payment.status = status;
  q.payment.amountPaid = status === 'Paid' ? tots.total : amt;
  // Auto-correct status
  if (q.payment.amountPaid >= tots.total) q.payment.status = 'Paid';
  else if (q.payment.amountPaid > 0) q.payment.status = 'Partially Paid';
  else q.payment.status = 'Unpaid';
  logActivity(q, `Payment: ${q.payment.status} — ${fmt(q.payment.amountPaid)}`);
  save(); closeDlg('dlg-set'); closeDlg('dlg-qd'); openQD(qid);
  snack('✓ Payment updated'); hap(15);
}

// ── FIXED: saveRecurring — validates date ──
function saveRecurring(qid) {
  const q = DB.quotes.find(x => x.id === qid); if (!q) return;
  const enabled = !!document.getElementById('rec-tog')?.classList.contains('on');
  const interval = v('rec-interval') || 'annually';
  const nextDate = v('rec-date');
  if (enabled && !nextDate) { snack('Set the next renewal date'); return; }
  q.recurring = { enabled, interval, nextDate };
  logActivity(q, 'Recurring: ' + (enabled ? interval + ' from ' + nextDate : 'disabled'));
  save(); closeDlg('dlg-set'); snack('✓ Recurring settings saved'); hap(15);
}

// ── FIXED: saveSigPad — checks canvas is not blank ──
function saveSigPad(spId) {
  const c = document.getElementById('sig-canvas'); if (!c) return;
  // Check not blank
  const ctx = c.getContext('2d');
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  const hasContent = data.some((v, i) => i % 4 === 3 && v > 0);
  if (!hasContent) { snack('Please draw your signature first'); return; }
  const dataUrl = c.toDataURL('image/png');
  const sp = getSP(spId);
  if (sp) { sp.signatureImg = dataUrl; save(); snack('✓ Signature saved'); hap(20); }
  closeDlg('dlg-set');
}

// ── FIXED: saveBundle — full validation ──
function saveBundle(id) {
  const name = v('bnd-nm');
  if (!name) { snack('Bundle name is required'); return; }
  const container = document.getElementById('bnd-items'); if (!container) return;
  const itemDivs = [...container.querySelectorAll('[data-itemid]')];
  const items = itemDivs.map((el, i) => ({
    itemId: el.dataset.itemid,
    qty: Math.max(1, parseInt(document.getElementById('bnd-qty-' + i)?.value) || 1)
  })).filter(x => x.itemId);
  if (!items.length) { snack('Add at least one product to the bundle'); return; }
  if (!DB.settings.bundles) DB.settings.bundles = [];
  const bundle = { id: id || 'BND-' + uid().slice(0, 6).toUpperCase(), name, description: v('bnd-desc'), items };
  const idx = DB.settings.bundles.findIndex(b => b.id === bundle.id);
  if (idx >= 0) DB.settings.bundles[idx] = bundle; else DB.settings.bundles.push(bundle);
  save(); openBundleManager(); snack('✓ Bundle saved'); hap(20);
}

// ── FIXED: saveCQF — deduplicates and trims ──
function saveCQF() {
  const inputs = document.querySelectorAll('[id^="cqf-"]');
  const fields = [...new Set(Array.from(inputs).map(el => el.value.trim()).filter(Boolean))];
  DB.settings.customQuoteFields = fields;
  save(); closeDlg('dlg-set'); renderSettings(); snack('✓ Custom fields saved'); hap(15);
}

// ── FIXED: saveRichNotes — strips dangerous tags ──
function saveRichNotes(qid) {
  const q = DB.quotes.find(x => x.id === qid); if (!q) return;
  const el = document.getElementById('rtn-editor'); if (!el) return;
  // Allow only safe inline HTML
  const allowed = el.innerHTML
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/javascript:/gi, '');
  q.notes = allowed;
  logActivity(q, 'Notes updated (rich text)');
  save(); closeDlg('dlg-set'); closeDlg('dlg-qd'); openQD(qid); snack('✓ Notes saved'); hap(15);
}

// ── OPEN SETTINGS SHEET — add discount type ──
const _origOpenSetSheet = window.openSetSheet;
window.openSetSheet = function(type) {
  if (type === 'discount') {
    setType = 'discount';
    document.getElementById('set-ttl').textContent = 'Discount Approval Rules';
    document.getElementById('set-body').innerHTML = `
      <div style="background:var(--su2);border-radius:8px;padding:12px;margin-bottom:14px;font-size:13px;color:var(--t2);line-height:1.7">
        Set the maximum discount % a salesperson can apply. Any quote exceeding this is automatically submitted for manager approval.
      </div>
      <div class="fg">
        <label class="fl">Maximum Discount % (0 = no discount allowed, 100 = unlimited)</label>
        <input class="fi" type="number" id="ss-maxd" value="${DB.settings.maxDiscountPct || 100}" min="0" max="100" step="1">
      </div>
      <div style="font-size:12px;color:var(--t2)">Current: ${DB.settings.maxDiscountPct || 100}%</div>`;
    openDlg('dlg-set'); pushNav('settings-discount');
  } else {
    _origOpenSetSheet(type);
  }
};

// ── EXPORT SHEET — open export options ──
function openExportSheet() {
  document.getElementById('set-ttl').textContent = 'Export Data';
  document.getElementById('set-body').innerHTML = `
    <div style="font-size:13px;color:var(--t2);margin-bottom:14px">Export your data as CSV files readable in Excel, Google Sheets, or any spreadsheet app.</div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <button class="btn bp btn-w" onclick="exportToXLSX('quotes')"><span class="material-icons-round">table_chart</span> Export Quotes to CSV</button>
      <button class="btn bp btn-w" onclick="exportToXLSX('customers')"><span class="material-icons-round">people</span> Export Customers to CSV</button>
      <button class="btn bp btn-w" onclick="exportToXLSX('inventory')"><span class="material-icons-round">inventory_2</span> Export Products to CSV</button>
      <div style="height:1px;background:var(--ol2)"></div>
      <button class="btn bo btn-w" onclick="exportData()"><span class="material-icons-round">download</span> Full JSON Backup</button>
      <button class="btn bo btn-w" onclick="importData()"><span class="material-icons-round">upload</span> Restore from JSON Backup</button>
    </div>`;
  openDlg('dlg-set'); pushNav('export');
}

// ── IMPORT SHEET ──
function openImportSheet() {
  document.getElementById('set-ttl').textContent = 'Import from CSV';
  document.getElementById('set-body').innerHTML = `
    <div style="font-size:13px;color:var(--t2);margin-bottom:14px">Import products or customers from a CSV file. First row must be the header row.</div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <button class="btn bp btn-w" onclick="openCSVImport('inventory')"><span class="material-icons-round">inventory_2</span> Import Products from CSV</button>
      <button class="btn bp btn-w" onclick="openCSVImport('customers')"><span class="material-icons-round">people</span> Import Customers from CSV</button>
    </div>`;
  openDlg('dlg-set'); pushNav('import');
}

// ── MORE MENU — updated with all new options ──
function openMore() {
  document.getElementById('more-body').innerHTML = `
    <div class="si" onclick="openAnalytics();closeDlg('dlg-more')"><div class="si-ic"><span class="material-icons-round">analytics</span></div><div class="si-tx"><div class="si-m">Sales Analytics</div></div></div>
    <div class="si" onclick="openTemplates();closeDlg('dlg-more')"><div class="si-ic"><span class="material-icons-round">bookmark</span></div><div class="si-tx"><div class="si-m">Quote Templates</div></div></div>
    <div class="si" onclick="openCompare();closeDlg('dlg-more')"><div class="si-ic"><span class="material-icons-round">compare_arrows</span></div><div class="si-tx"><div class="si-m">Compare Quotes</div></div></div>
    <div class="si" onclick="openBundleManager();closeDlg('dlg-more')"><div class="si-ic"><span class="material-icons-round">inventory_2</span></div><div class="si-tx"><div class="si-m">Product Bundles</div></div></div>
    <div class="si" onclick="openCustomFieldsManager();closeDlg('dlg-more')"><div class="si-ic"><span class="material-icons-round">tune</span></div><div class="si-tx"><div class="si-m">Custom Quote Fields</div></div></div>
    <div class="si" onclick="openImportSheet();closeDlg('dlg-more')"><div class="si-ic"><span class="material-icons-round">upload_file</span></div><div class="si-tx"><div class="si-m">Import from CSV</div></div></div>
    <div class="si" onclick="openExportSheet();closeDlg('dlg-more')"><div class="si-ic"><span class="material-icons-round">download</span></div><div class="si-tx"><div class="si-m">Export Data</div></div></div>
    <div class="si" onclick="openSetSheet('dashboard');closeDlg('dlg-more')"><div class="si-ic"><span class="material-icons-round">dashboard_customize</span></div><div class="si-tx"><div class="si-m">Dashboard Sections</div></div></div>
    <div class="si" onclick="toggleTheme();closeDlg('dlg-more')"><div class="si-ic"><span class="material-icons-round">dark_mode</span></div><div class="si-tx"><div class="si-m">Toggle Dark Mode</div></div></div>
    <div class="si" onclick="go('settings');closeDlg('dlg-more')"><div class="si-ic"><span class="material-icons-round">settings</span></div><div class="si-tx"><div class="si-m">Settings</div></div></div>`;
  openDlg('dlg-more');
}

// ── RENDER SETTINGS — add new rows ──
const _origRenderSettings = window.renderSettings;
window.renderSettings = function() {
  _origRenderSettings();
  // Inject extra settings rows if containers exist
  const extraCard = document.getElementById('settings-extra-card');
  if (extraCard) {
    extraCard.innerHTML = `
      <div class="si" onclick="openSetSheet('discount')"><div class="si-ic ora"><span class="material-icons-round">percent</span></div><div class="si-tx"><div class="si-m">Discount Approval Rules</div><div class="si-s">Max discount: ${DB.settings.maxDiscountPct || 100}%</div></div><span class="material-icons-round" style="color:var(--t2)">chevron_right</span></div>
      <div class="si" onclick="openCustomFieldsManager()"><div class="si-ic"><span class="material-icons-round">tune</span></div><div class="si-tx"><div class="si-m">Custom Quote Fields</div><div class="si-s">${(DB.settings.customQuoteFields || []).length} field(s)</div></div><span class="material-icons-round" style="color:var(--t2)">chevron_right</span></div>
      <div class="si" onclick="openBundleManager()"><div class="si-ic"><span class="material-icons-round">inventory_2</span></div><div class="si-tx"><div class="si-m">Product Bundles</div><div class="si-s">${(DB.settings.bundles || []).length} bundle(s)</div></div><span class="material-icons-round" style="color:var(--t2)">chevron_right</span></div>`;
  }
};

// ── CUSTOM QUOTE FIELDS IN QE STEP 0 ──
const _origRenderQE0 = window.renderQE0;
window.renderQE0 = function(body) {
  _origRenderQE0(body);
  const fields = DB.settings.customQuoteFields || [];
  if (!fields.length) return;
  const existing = qeD.customFields || {};
  const extra = document.createElement('div');
  extra.innerHTML = `<div style="height:1px;background:var(--ol2);margin:4px 0 12px"></div>
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--t2);margin-bottom:10px">Custom Fields</div>
    ${fields.map(f => `<div class="fg"><label class="fl">${esc(f)}</label><input class="fi" id="cqf-val-${esc(f).replace(/\s/g,'_')}" value="${esc(existing[f] || '')}" placeholder="${esc(f)}"></div>`).join('')}`;
  body.appendChild(extra);
};

// Patch collectQE to also collect custom field values
const _origCollectQE = window.collectQE;
window.collectQE = function(step) {
  _origCollectQE(step);
  if (step === 0) {
    const fields = DB.settings.customQuoteFields || [];
    if (fields.length) {
      if (!qeD.customFields) qeD.customFields = {};
      fields.forEach(f => {
        const el = document.getElementById('cqf-val-' + f.replace(/\s/g, '_'));
        if (el) qeD.customFields[f] = el.value;
      });
    }
  }
};

// ── SHOW CUSTOM FIELDS IN QUOTE DETAIL ──
const _origOpenQD = window.openQD;
window.openQD = function(qid) {
  _origOpenQD(qid);
  const q = DB.quotes.find(x => x.id === qid);
  if (q && q.customFields && Object.keys(q.customFields).length) {
    const body = document.getElementById('qd-body');
    if (!body) return;
    const block = `<div class="db2" style="margin-top:0">
      <div class="dh2"><span class="dht">Custom Fields</span></div>
      ${Object.entries(q.customFields).filter(([,v]) => v).map(([k, val]) =>
        `<div class="dr"><span class="dk">${esc(k)}</span><span class="dv">${esc(val)}</span></div>`
      ).join('')}
    </div>`;
    // Insert after first .db2
    const firstBlock = body.querySelector('.db2');
    if (firstBlock) firstBlock.insertAdjacentHTML('afterend', block);
  }
};

// ── QUOTE DIFF VIEWER ──
function openQuoteDiff(qid) {
  const q = DB.quotes.find(x => x.id === qid); if (!q) return;
  const hist = (q.history || []);
  if (hist.length < 2) { snack('Need at least 2 snapshots to compare'); return; }
  const a = hist[hist.length - 2], b = hist[hist.length - 1];
  const allItemIds = [...new Set([...(a.items||[]).map(i=>i.itemId||i.desc),...(b.items||[]).map(i=>i.itemId||i.desc)])];
  document.getElementById('set-ttl').textContent = 'Version Diff';
  document.getElementById('set-body').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;margin-bottom:12px">
      <div style="padding:8px 12px;background:rgba(234,67,53,.08);border-radius:8px 0 0 8px;font-size:12px;font-weight:700;color:var(--E)">◀ ${esc(a.version||'v?')} — ${fmt(a.total)}</div>
      <div style="padding:8px 12px;background:rgba(52,168,83,.08);border-radius:0 8px 8px 0;font-size:12px;font-weight:700;color:var(--S)">▶ ${esc(b.version||'v?')} — ${fmt(b.total)}</div>
    </div>
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--t2);margin-bottom:8px">Line Items</div>
    ${allItemIds.map(itemId => {
      const ai = (a.items||[]).find(i=>(i.itemId||i.desc)===itemId);
      const bi = (b.items||[]).find(i=>(i.itemId||i.desc)===itemId);
      const added = !ai && !!bi, removed = !!ai && !bi;
      const changed = ai && bi && (ai.unitPrice !== bi.unitPrice || ai.qty !== bi.qty);
      const bg = added ? 'rgba(52,168,83,.08)' : removed ? 'rgba(234,67,53,.08)' : changed ? 'rgba(249,171,0,.08)' : 'transparent';
      const icon = added ? '➕' : removed ? '➖' : changed ? '✏️' : '✓';
      const item = bi || ai;
      return `<div style="background:${bg};border-radius:6px;padding:8px 10px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:13px">${icon} ${esc(item.desc||item.itemId)}</div>
        <div style="font-size:12px;text-align:right;color:var(--t2)">
          ${ai?`<del style="color:var(--E)">${ai.qty}×${fmt(ai.unitPrice)}</del> `:''}
          ${bi?`<span style="color:var(--S)">${bi.qty}×${fmt(bi.unitPrice)}</span>`:''}
        </div>
      </div>`;
    }).join('')}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
      <div style="background:var(--su2);border-radius:8px;padding:10px;text-align:center"><div style="font-size:11px;color:var(--t2)">Old Total</div><div style="font-size:16px;font-weight:800;color:var(--E)">${fmt(a.total)}</div></div>
      <div style="background:var(--su2);border-radius:8px;padding:10px;text-align:center"><div style="font-size:11px;color:var(--t2)">New Total</div><div style="font-size:16px;font-weight:800;color:var(--S)">${fmt(b.total)}</div></div>
    </div>
    <div style="text-align:center;margin-top:8px;font-size:13px;color:${b.total>a.total?'var(--E)':'var(--S)'}">
      ${b.total>a.total?'▲':'▼'} ${fmt(Math.abs(b.total-a.total))} ${b.total>a.total?'increase':'decrease'}
    </div>`;
  openDlg('dlg-set'); pushNav('diff-'+qid);
}

// Hook diff into revision history view
const _origOpenRevHistory = window.openRevHistory;
window.openRevHistory = function(qid) {
  _origOpenRevHistory(qid);
  const q = DB.quotes.find(x => x.id === qid);
  if (q && (q.history||[]).length >= 2) {
    const body = document.getElementById('rev-body');
    if (body) {
      const btn = document.createElement('div');
      btn.style.cssText = 'padding:10px 16px;border-bottom:1px solid var(--ol2)';
      btn.innerHTML = `<button class="btn btn-ton btn-w" onclick="openQuoteDiff('${qid}')"><span class="material-icons-round">compare_arrows</span> View Latest vs Previous (Diff)</button>`;
      body.insertBefore(btn, body.firstChild);
    }
  }
};

// ── APPROVAL BADGE IN QUOTE STATUS CHIP ──
// Patch chipCls to handle Pending Approval
const _origChipCls = window.chipCls;
window.chipCls = function(s) {
  if (s === 'Pending Approval') return 'chip' + ' cs-Sent';
  return _origChipCls(s);
};

// ── BULK MODE UI TOGGLE ──
function renderBulkBar() {
  const bar = document.getElementById('bulk-bar');
  if (!bar) return;
  bar.style.display = _bulkMode ? 'flex' : 'none';
  const cnt = document.getElementById('bulk-count');
  if (cnt) cnt.textContent = _bulkSelected.size + ' selected';
}

// ── ADD HAP CALLS TO EXISTING ACTIONS ──
const _origSetQStat = window.setQStat;
window.setQStat = function(qid, s) { hap(s === 'Won' ? 50 : 10); _origSetQStat(qid, s); };

const _origDupQ = window.dupQ;
window.dupQ = function(qid) { hap(15); _origDupQ(qid); };


// ═══════════════════════════════════════════════════════
// NEW FEATURES BLOCK — v5.1
// ═══════════════════════════════════════════════════════

// ── 1. QUOTE SEARCH — full-text index for speed ─────────
let _searchIdx = null;
function buildSearchIndex() {
  _searchIdx = acoQuotes().map(q => {
    const cu = getCust(q.customerId), sp = getSP(q.salespersonId);
    return {
      id: q.id,
      text: [
        q.id, q.isInvoice ? q.invoiceId : '', q.status,
        cu?.company||'', cu?.contact||'', cu?.email||'',
        sp?.name||'', q.revision||'', q.notes||'',
        (q.items||[]).map(i=>i.desc||i.itemId).join(' ')
      ].join(' ').toLowerCase()
    };
  });
}
function searchQuotes(srch) {
  if (!srch) return acoQuotes();
  if (!_searchIdx) buildSearchIndex();
  const terms = srch.toLowerCase().split(/\s+/).filter(Boolean);
  const matchIds = new Set(_searchIdx.filter(e => terms.every(t => e.text.includes(t))).map(e => e.id));
  return acoQuotes().filter(q => matchIds.has(q.id));
}
// Invalidate index on save
const _origSave2 = window.save;
window.save = function() { _searchIdx = null; _origSave2(); };

// ── 2. QUICK ESTIMATOR ───────────────────────────────────
function openEstimator() {
  const inv = acoInv();
  document.getElementById('set-ttl').textContent = 'Quick Estimator';
  document.getElementById('set-body').innerHTML = `
    <div style="font-size:13px;color:var(--t2);margin-bottom:12px">Build a quick price estimate without creating a full quote.</div>
    <div id="est-items" style="display:flex;flex-direction:column;gap:8px"></div>
    <button class="btn btn-ton btn-w" style="margin:8px 0" onclick="addEstItem()">
      <span class="material-icons-round">add</span> Add Item
    </button>
    <div style="height:1px;background:var(--ol2);margin:8px 0"></div>
    <div id="est-total" style="font-size:20px;font-weight:800;color:var(--P);text-align:right;padding:4px 0"></div>
    <div id="est-margin" style="font-size:12px;color:var(--t2);text-align:right;margin-bottom:12px"></div>
    <button class="btn bp btn-w" onclick="convertEstimatorToQuote()">
      <span class="material-icons-round">receipt_long</span> Convert to Quote
    </button>`;
  window._estItems = [];
  addEstItem();
  openDlg('dlg-set'); pushNav('estimator');
}
function addEstItem() {
  const inv = acoInv();
  const idx = (window._estItems || []).length;
  window._estItems = window._estItems || [];
  window._estItems.push({ itemId: '', desc: '', qty: 1, unitPrice: 0 });
  const container = document.getElementById('est-items'); if (!container) return;
  const row = document.createElement('div');
  row.id = 'est-row-' + idx;
  row.style.cssText = 'background:var(--su2);border-radius:8px;padding:10px;border:1.5px solid var(--ol2)';
  row.innerHTML = `
    <div style="position:relative;margin-bottom:8px">
      <input class="fi" id="est-inp-${idx}" placeholder="Search product…" autocomplete="off"
        oninput="estSearch(${idx},this.value)" onfocus="estSearch(${idx},this.value)"
        style="width:100%;font-size:13px">
      <div class="ac-dropdown" id="est-drop-${idx}" style="display:none"></div>
    </div>
    <div class="fr3">
      <div><div class="fl" style="margin-bottom:3px">Qty</div>
        <input class="fi" type="number" id="est-qty-${idx}" value="1" min="1"
          onchange="estCalc(${idx})"></div>
      <div><div class="fl" style="margin-bottom:3px">Unit Price</div>
        <input class="fi" type="number" id="est-price-${idx}" value="0" step="0.01"
          onchange="estCalc(${idx})"></div>
      <div style="display:flex;flex-direction:column;justify-content:flex-end">
        <button class="ib" style="background:var(--E);color:#fff;width:100%;height:40px;border-radius:8px"
          onclick="removeEstItem(${idx})">
          <span class="material-icons-round" style="font-size:16px">close</span></button>
      </div>
    </div>
    <div id="est-lt-${idx}" style="text-align:right;font-size:13px;font-weight:700;color:var(--P);margin-top:4px">${fmt(0)}</div>`;
  container.appendChild(row);
}
function estSearch(idx, query) {
  const drop = document.getElementById('est-drop-' + idx); if (!drop) return;
  const q = query.trim().toLowerCase(); if (!q) { drop.style.display = 'none'; return; }
  const results = acoInv().filter(p => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)).slice(0, 6);
  if (!results.length) { drop.style.display = 'none'; return; }
  drop.innerHTML = results.map(p => {
    const price = p.unitCost * (1 + p.markup);
    return `<div class="ac-item" onclick="estSelectProduct(${idx},'${p.id}')">
      <div style="flex:1"><div style="font-size:13px;font-weight:600">${esc(p.name)}</div>
        <div style="font-size:11px;color:var(--t2)">${esc(p.id)}</div></div>
      <div style="font-size:13px;font-weight:700;color:var(--P)">${fmt(price)}</div>
    </div>`;
  }).join('');
  drop.style.display = 'block';
}
function estSelectProduct(idx, prodId) {
  const p = getProd(prodId); if (!p) return;
  const price = p.unitCost * (1 + p.markup);
  if (window._estItems[idx]) { window._estItems[idx].itemId = p.id; window._estItems[idx].desc = p.name; window._estItems[idx].unitPrice = price; }
  const inp = document.getElementById('est-inp-' + idx); if (inp) inp.value = p.name;
  const priceEl = document.getElementById('est-price-' + idx); if (priceEl) priceEl.value = price.toFixed(2);
  document.getElementById('est-drop-' + idx).style.display = 'none';
  estCalc(idx);
}
function estCalc(idx) {
  if (!window._estItems) return;
  const qty = parseFloat(document.getElementById('est-qty-' + idx)?.value) || 1;
  const price = parseFloat(document.getElementById('est-price-' + idx)?.value) || 0;
  if (window._estItems[idx]) { window._estItems[idx].qty = qty; window._estItems[idx].unitPrice = price; }
  const lt = qty * price;
  const ltEl = document.getElementById('est-lt-' + idx); if (ltEl) ltEl.textContent = fmt(lt);
  // Recalculate total
  const total = window._estItems.reduce((s, item) => s + (item.qty || 1) * (item.unitPrice || 0), 0);
  const cost = window._estItems.reduce((s, item) => { const p = getProd(item.itemId); return s + (p ? p.unitCost : item.unitPrice * 0.7) * (item.qty || 1); }, 0);
  const margin = total > 0 ? (total - cost) / total : 0;
  const mc = margin < DB.settings.minMargin ? 'var(--E)' : margin < DB.settings.warnMargin ? 'var(--W)' : 'var(--S)';
  const totEl = document.getElementById('est-total'); if (totEl) totEl.textContent = fmt(total);
  const mgEl = document.getElementById('est-margin'); if (mgEl) { mgEl.textContent = 'Margin: ' + Math.round(margin * 100) + '%'; mgEl.style.color = mc; }
}
function removeEstItem(idx) {
  if (window._estItems) window._estItems.splice(idx, 1);
  const row = document.getElementById('est-row-' + idx); if (row) row.remove();
}
function convertEstimatorToQuote() {
  const items = (window._estItems || []).filter(i => i.unitPrice > 0);
  if (!items.length) { snack('Add at least one item with a price'); return; }
  closeDlg('dlg-set');
  qeStep = 0;
  const co = activeCo(), vd = new Date();
  vd.setDate(vd.getDate() + (DB.settings.quoteValidDays || 30));
  qeD = {
    id: nextQID(), companyId: co?.id || '', customerId: '',
    date: new Date().toISOString().slice(0, 10),
    validUntil: vd.toISOString().slice(0, 10),
    status: 'Draft', version: 'v1', revision: 'From Estimator',
    salespersonId: acoSP()[0]?.id || '', notes: '', taxable: true,
    discount: 0, currency: sym(), items, history: [],
    activityLog: [{ ts: new Date().toISOString(), action: 'Created from Estimator', user: 'You' }],
    payment: { status: 'Unpaid', amountPaid: 0 }
  };
  document.getElementById('qe-ttl').textContent = 'New Quote (from Estimator)';
  renderQEStep(); openDlg('dlg-qe'); pushNav('qe-new');
  snack('Items loaded — select a customer to continue');
}

// ── 3. SUPPLIER / COST TRACKING ─────────────────────────
function openSupplierManager() {
  if (!DB.suppliers) DB.suppliers = [];
  document.getElementById('set-ttl').textContent = 'Suppliers';
  document.getElementById('set-body').innerHTML = `
    <div style="font-size:13px;color:var(--t2);margin-bottom:12px">Track your product suppliers and cost updates.</div>
    <button class="btn bp btn-w" style="margin-bottom:12px" onclick="openSupplierEditor(null)">
      <span class="material-icons-round">add</span> Add Supplier
    </button>
    ${(DB.suppliers||[]).length === 0
      ? `<div class="empty" style="padding:20px"><span class="material-icons-round">local_shipping</span><div class="empty-t">No suppliers yet</div></div>`
      : (DB.suppliers||[]).map(s => `
        <div style="background:var(--su2);border-radius:10px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:12px">
          <div style="flex:1">
            <div style="font-size:14px;font-weight:700">${esc(s.name)}</div>
            <div style="font-size:12px;color:var(--t2)">${esc(s.contact||'')}${s.email?' · '+esc(s.email):''}</div>
          </div>
          <button class="btn bt btn-sm" onclick="openSupplierEditor('${s.id}')">Edit</button>
        </div>`).join('')}`;
  openDlg('dlg-set'); pushNav('suppliers');
}
function openSupplierEditor(id) {
  if (!DB.suppliers) DB.suppliers = [];
  const s = id ? DB.suppliers.find(x => x.id === id) : null;
  document.getElementById('set-ttl').textContent = id ? 'Edit Supplier' : 'New Supplier';
  document.getElementById('set-body').innerHTML = `
    <div class="fg"><label class="fl">Supplier Name *</label>
      <input class="fi" id="sup-nm" value="${esc(s?.name||'')}" placeholder="e.g. Tech Distributors Ltd"></div>
    <div class="fg"><label class="fl">Contact Person</label>
      <input class="fi" id="sup-cnt" value="${esc(s?.contact||'')}" placeholder="Full name"></div>
    <div class="fr">
      <div class="fg"><label class="fl">Email</label>
        <input class="fi" id="sup-em" value="${esc(s?.email||'')}" placeholder="email@supplier.com"></div>
      <div class="fg"><label class="fl">Phone</label>
        <input class="fi" id="sup-ph" value="${esc(s?.phone||'')}" placeholder="+254 7xx xxx xxx"></div>
    </div>
    <div class="fg"><label class="fl">Notes</label>
      <textarea class="fi" id="sup-notes">${esc(s?.notes||'')}</textarea></div>
    <button class="btn bp btn-w" onclick="saveSupplier('${id||''}')">Save Supplier</button>
    ${id ? `<button class="btn bd2 btn-w" style="margin-top:8px" onclick="deleteSupplier('${id}')">Delete</button>` : ''}`;
}
function saveSupplier(id) {
  const name = v('sup-nm'); if (!name) { snack('Supplier name required'); return; }
  if (!DB.suppliers) DB.suppliers = [];
  const sup = { id: id || 'SUP-' + uid().slice(0,6).toUpperCase(), name, contact: v('sup-cnt'), email: v('sup-em'), phone: v('sup-ph'), notes: v('sup-notes') };
  const idx = DB.suppliers.findIndex(s => s.id === sup.id);
  if (idx >= 0) DB.suppliers[idx] = sup; else DB.suppliers.push(sup);
  save(); openSupplierManager(); snack('✓ Supplier saved'); hap(15);
}
function deleteSupplier(id) {
  DB.suppliers = (DB.suppliers||[]).filter(s => s.id !== id);
  save(); openSupplierManager(); snack('Supplier deleted');
}

// ── 4. FINANCIAL YEAR NUMBERING ──────────────────────────
function getCurrentFY() {
  const now = new Date();
  const fyStartMonth = (DB.settings.fyStartMonth || 1) - 1; // 0-indexed, default Jan
  const fyStart = new Date(now.getFullYear(), fyStartMonth, 1);
  if (now < fyStart) return now.getFullYear() - 1;
  return now.getFullYear();
}
function nextQIDWithFY() {
  const yr = getCurrentFY();
  const pfx = (DB.settings.quotePrefix || 'QMS-') + yr + '-';
  const nums = DB.quotes.filter(q => q.id.startsWith(pfx)).map(q => parseInt(q.id.replace(pfx, '')) || 0);
  return pfx + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0');
}
// Override nextQID globally
window.nextQID = nextQIDWithFY;

// ── 5. DARK MODE PDF ─────────────────────────────────────
function iframeCSSDark(ac) {
  return `<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{font-family:'Inter',ui-sans-serif,-apple-system,sans-serif;font-size:10pt;color:#E8EAED;background:#1E1E1E;-webkit-font-smoothing:antialiased}
    .qv-title{font-size:22pt;font-weight:900;color:${ac};margin-bottom:6px;line-height:1}
    .qv-meta{font-size:9pt;color:#9AA0A6;line-height:1.9}.qv-meta b{color:#E8EAED}
    .qv-logo-box{display:flex;align-items:center;gap:10px}
    .qv-logo-img{width:48px;height:48px;border-radius:8px;overflow:hidden;flex-shrink:0}
    .qv-logo-img img{width:100%;height:100%;object-fit:cover}
    .qv-co-name{font-size:14pt;font-weight:900;color:#E8EAED;line-height:1.1}
    .qv-co-tag{font-size:8pt;color:#9AA0A6;margin-top:2px}
    .qv-boxes{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:16px 0}
    .qv-box{border:1px solid #444;border-radius:6px;padding:12px 14px;background:#252525}
    .qv-box-lbl{font-size:8pt;color:#777;font-weight:600;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px}
    .qv-box-row{display:flex;gap:10px;margin-bottom:3px}
    .qv-box-key{font-size:8.5pt;color:#777;min-width:60px;flex-shrink:0}
    .qv-box-val{font-size:8.5pt;color:#E8EAED;font-weight:500;line-height:1.5;flex:1}
    .qv-meta-row{display:flex;justify-content:space-between;font-size:8.5pt;color:#777;padding:6px 0;border-top:1px solid #333;border-bottom:1px solid #333;margin-bottom:14px}
    .qv-meta-row b{color:#E8EAED}
    .qv-tbl{width:100%;border-collapse:collapse}
    .qv-tbl thead tr{background:${ac}}
    .qv-tbl th{color:#fff;padding:7px 10px;font-size:8.5pt;font-weight:700;text-align:left}
    .qv-tbl td{padding:6px 10px;font-size:9pt;border-bottom:1px solid #333;vertical-align:middle;color:#E8EAED}
    .qv-tbl tr:nth-child(even) td{background:#252525}
    .qv-tbl td:first-child{color:#666;font-size:8pt}
    .qv-tbl-desc{font-weight:600;color:#E8EAED}
    .qv-bottom{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:14px}
    .qv-tot-wrap{}
    .qv-tr{display:flex;justify-content:space-between;padding:5px 0;font-size:9.5pt;border-bottom:1px solid #333}
    .qv-tr.disc span:last-child{color:#F28B82;font-weight:600}
    .qv-tr.grand-row{border-top:2px solid ${ac};border-bottom:none;margin-top:8px;padding-top:10px}
    .qv-tr.grand-row .qv-tk{font-size:12pt;font-weight:700;color:#E8EAED}
    .qv-tr.grand-row .qv-tv{font-size:13pt;font-weight:900;color:${ac}}
    .qv-tk{color:#9AA0A6;font-size:9pt}.qv-tv{font-weight:600;color:#E8EAED}
    .qv-words-lbl{font-size:8pt;color:#666;margin-top:10px;margin-bottom:2px}
    .qv-words{font-size:8.5pt;color:#9AA0A6;font-weight:500;font-style:italic;line-height:1.5}
    .qv-terms-title,.qv-notes-title{font-size:10pt;font-weight:700;color:${ac};margin-bottom:6px;margin-top:14px}
    .qv-notes-text{font-size:8pt;color:#9AA0A6;line-height:1.7}
    .qv-contact-line{font-size:8pt;color:#777;line-height:1.7}
    .qv-contact-line a{color:${ac};font-weight:600;text-decoration:none}
    .qv-sig-area{margin-top:20px;display:flex;justify-content:flex-end}
    .qv-sig-block{text-align:center;min-width:180px}
    .qv-sig-line{border-bottom:1.5px solid #555;margin-bottom:5px;height:40px}
    .qv-sig-lbl{font-size:8pt;color:#666}
    .qv-sig-name{font-size:8.5pt;font-weight:600;color:#9AA0A6;margin-top:2px}
    .qv-wm{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:60pt;font-weight:900;opacity:.08;pointer-events:none;color:${ac};white-space:nowrap;text-transform:uppercase;letter-spacing:6px}
    .qv-pay-footer{border-top:1px solid #333;margin-top:16px;padding-top:12px}
    .qv-pay-title{font-size:9pt;font-weight:700;color:#9AA0A6;margin-bottom:8px}
    .qv-pay-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
    .qv-pay-type{font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
    .qv-pay-row{font-size:8pt;color:#777;line-height:1.9}
    .qv-pay-row b{color:#E8EAED}
  </style>`;
}
let _pdfDarkMode = false;
function togglePDFDarkMode() {
  _pdfDarkMode = !_pdfDarkMode;
  snack(_pdfDarkMode ? '🌙 Dark PDF mode on' : '☀️ Light PDF mode on');
  if (curQID) { buildPreview(curQID); }
}
// Override makePgDoc to respect dark mode
const _origMakePgDoc = window.makePgDoc;
window.makePgDoc = function(content, ac) {
  const css = _pdfDarkMode ? iframeCSSDark(ac) : iframeCSS(ac);
  const bg = _pdfDarkMode ? '#1E1E1E' : '#ffffff';
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${css}<style>html,body{overflow:hidden;margin:0;padding:0}</style></head>` +
    `<body style="padding:${M}px;width:${A4_W}px;min-height:${A4_H}px;box-sizing:border-box;background:${bg};position:relative">${content}</body></html>`;
};

// ── 6. PRODUCT PHOTO SUPPORT ─────────────────────────────
// Adds photo upload to product editor — shown in PDF
function addProductPhotoUI(body, p) {
  const photoSection = document.createElement('div');
  photoSection.style.cssText = 'height:1px;background:var(--ol2);margin:4px 0 14px';
  body.appendChild(photoSection);
  const photoDiv = document.createElement('div');
  photoDiv.className = 'fg';
  photoDiv.innerHTML = `<label class="fl">Product Photo (shown in PDF)</label>
    <div style="display:flex;align-items:center;gap:10px">
      <div id="prod-photo-prev" style="width:56px;height:56px;border-radius:8px;border:1.5px solid var(--ol);overflow:hidden;flex-shrink:0;background:var(--su2);display:flex;align-items:center;justify-content:center">
        ${p?.photo ? `<img src="${p.photo}" style="width:100%;height:100%;object-fit:cover">` : '<span class="material-icons-round" style="color:var(--t3)">image</span>'}
      </div>
      <div>
        <button class="btn bo btn-sm" onclick="document.getElementById('prod-photo-file').click()">
          <span class="material-icons-round">upload</span> Upload Photo</button>
        <input type="file" id="prod-photo-file" accept="image/*" style="display:none" onchange="previewProductPhoto(this)">
        <input type="hidden" id="prod-photo-data" value="${p?.photo||''}">
        ${p?.photo ? `<button class="btn bt btn-sm" style="color:var(--E);margin-top:4px" onclick="clearProductPhoto()">Remove</button>` : ''}
      </div>
    </div>`;
  body.appendChild(photoDiv);
}
function previewProductPhoto(input) {
  const file = input.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = e => {
    document.getElementById('prod-photo-data').value = e.target.result;
    const prev = document.getElementById('prod-photo-prev');
    if (prev) prev.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover">`;
  };
  r.readAsDataURL(file);
}
function clearProductPhoto() {
  document.getElementById('prod-photo-data').value = '';
  const prev = document.getElementById('prod-photo-prev');
  if (prev) prev.innerHTML = '<span class="material-icons-round" style="color:var(--t3)">image</span>';
}

// ── 7. PAYMENT RECEIPT GENERATOR ────────────────────────
function generateReceipt(qid) {
  const q = DB.quotes.find(x => x.id === qid); if (!q || !q.isInvoice) return;
  const cu = getCust(q.customerId), co = activeCo(), tots = calcTotals(q);
  const paid = q.payment?.status === 'Paid' ? tots.total : (q.payment?.amountPaid || 0);
  const acc = ACCENTS.find(a => a.name === DB.settings.accentName) || ACCENTS[0];
  const ac = acc.lc;
  const rcptHTML = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}body{font-family:'Inter',sans-serif;padding:40px;background:#fff;color:#111;max-width:480px;margin:0 auto}
    .rc-head{text-align:center;border-bottom:2px solid ${ac};padding-bottom:16px;margin-bottom:20px}
    .rc-title{font-size:22pt;font-weight:900;color:${ac}}
    .rc-sub{font-size:10pt;color:#777;margin-top:4px}
    .rc-num{font-size:9pt;color:#555;margin-top:8px}
    .rc-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #F0F0F0;font-size:10pt}
    .rc-row:last-child{border:none}.rc-label{color:#777}.rc-val{font-weight:600}
    .rc-amount{text-align:center;padding:20px 0;border-top:2px solid ${ac};border-bottom:2px solid ${ac};margin:16px 0}
    .rc-amount-label{font-size:9pt;color:#777;margin-bottom:4px}
    .rc-amount-val{font-size:24pt;font-weight:900;color:${ac}}
    .rc-footer{text-align:center;font-size:8pt;color:#999;margin-top:20px}
    </style></head><body>
    <div class="rc-head">
      <div class="rc-title">RECEIPT</div>
      <div class="rc-sub">${esc(co?.name||'')}</div>
      <div class="rc-num">Receipt for Invoice ${esc(q.invoiceId)} · ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}</div>
    </div>
    <div class="rc-row"><span class="rc-label">Received From</span><span class="rc-val">${esc(cu?.company||'—')}</span></div>
    <div class="rc-row"><span class="rc-label">Invoice No.</span><span class="rc-val">${esc(q.invoiceId)}</span></div>
    <div class="rc-row"><span class="rc-label">Invoice Total</span><span class="rc-val">${fmt(tots.total)}</span></div>
    <div class="rc-row"><span class="rc-label">Payment Status</span><span class="rc-val" style="color:${q.payment?.status==='Paid'?'#2E7D32':'#E65100'}">${q.payment?.status||'Unpaid'}</span></div>
    <div class="rc-amount">
      <div class="rc-amount-label">Amount Received</div>
      <div class="rc-amount-val">${fmt(paid)}</div>
    </div>
    ${paid < tots.total ? `<div class="rc-row"><span class="rc-label">Balance Outstanding</span><span class="rc-val" style="color:#E53935">${fmt(tots.total - paid)}</span></div>` : ''}
    <div class="rc-row"><span class="rc-label">Received by</span><span class="rc-val">${esc(co?.name||'')}</span></div>
    <div class="rc-footer">${esc(co?.address||'')} · ${esc(co?.email||'')} · ${esc(co?.phone||'')}</div>
    </body></html>`;
  const w = window.open('', '_blank', 'width=560,height=700');
  w.document.write(rcptHTML);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 600);
}

// ── 8. QUOTE EXPIRY AUTO-EMAIL DRAFT ────────────────────
function draftExpiryFollowUp(qid) {
  const q = DB.quotes.find(x => x.id === qid); if (!q) return;
  const cu = getCust(q.customerId), co = activeCo(), tots = calcTotals(q);
  const subj = encodeURIComponent(`Follow-up: Quotation ${q.isInvoice ? q.invoiceId : q.id}`);
  const body = encodeURIComponent(
    `Dear ${cu?.contact || 'Sir/Madam'},\n\n` +
    `I hope this message finds you well. I wanted to follow up on our quotation ${q.id} ` +
    `dated ${fmtDate(q.date)} for ${fmt(tots.total)}, which is valid until ${fmtDate(q.validUntil)}.\n\n` +
    `Please let us know if you have any questions or if we can adjust anything to meet your requirements.\n\n` +
    `We look forward to hearing from you.\n\nKind regards,\n${co?.name || ''}`
  );
  window.location.href = `mailto:${cu?.email || ''}?subject=${subj}&body=${body}`;
  logActivity(q, 'Follow-up email drafted');
  save();
}

// ── 9. DASHBOARD QUICK ACTIONS ───────────────────────────
function renderQuickActions() {
  const el = document.getElementById('d-quick-actions'); if (!el) return;
  el.innerHTML = `
    <div style="display:flex;gap:8px;padding:8px 16px;overflow-x:auto;scrollbar-width:none">
      <button class="btn btn-ton btn-sm" style="flex-shrink:0" onclick="openQE(null)">
        <span class="material-icons-round">add</span> New Quote</button>
      <button class="btn btn-ton btn-sm" style="flex-shrink:0" onclick="openEstimator()">
        <span class="material-icons-round">calculate</span> Estimator</button>
      <button class="btn btn-ton btn-sm" style="flex-shrink:0" onclick="openAnalytics()">
        <span class="material-icons-round">analytics</span> Analytics</button>
      <button class="btn btn-ton btn-sm" style="flex-shrink:0" onclick="openTemplates()">
        <span class="material-icons-round">bookmark</span> Templates</button>
      <button class="btn btn-ton btn-sm" style="flex-shrink:0" onclick="openCompare()">
        <span class="material-icons-round">compare_arrows</span> Compare</button>
    </div>`;
}

// ── 10. PATCH EXISTING FUNCTIONS ────────────────────────

// Patch renderDash to include quick actions
const _origRenderDash2 = window.renderDash;
window.renderDash = function() {
  _origRenderDash2();
  renderQuickActions();
};

// Patch openQD to add receipt + follow-up buttons for invoices
const _origOpenQD2 = window.openQD;
window.openQD = function(qid) {
  _origOpenQD2(qid);
  const q = DB.quotes.find(x => x.id === qid); if (!q) return;
  const actionsEl = document.getElementById('qd-actions');
  if (!actionsEl) return;
  // Add receipt button for paid/partial invoices
  if (q.isInvoice && q.payment && q.payment.amountPaid > 0) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-ton btn-sm';
    btn.style.flexShrink = '0';
    btn.innerHTML = '<span class="material-icons-round">receipt</span>';
    btn.title = 'Print Receipt';
    btn.onclick = () => generateReceipt(qid);
    actionsEl.appendChild(btn);
  }
};

// Patch openQAct to include follow-up email, dark PDF, receipt
const _origOpenQAct2 = window.openQAct;
window.openQAct = function(qid) {
  _origOpenQAct2(qid);
  const q = DB.quotes.find(x => x.id === (qid || curQID)); if (!q) return;
  const body = document.getElementById('qact-body'); if (!body) return;
  const extra = `
    ${q.status === 'Sent' ? `<div class="si" onclick="draftExpiryFollowUp('${q.id}');closeDlg('dlg-qact')"><div class="si-ic"><span class="material-icons-round">forward_to_inbox</span></div><div class="si-tx"><div class="si-m">Draft Follow-up Email</div></div></div>` : ''}
    ${q.isInvoice && q.payment?.amountPaid > 0 ? `<div class="si" onclick="generateReceipt('${q.id}');closeDlg('dlg-qact')"><div class="si-ic grn"><span class="material-icons-round">receipt</span></div><div class="si-tx"><div class="si-m">Print Payment Receipt</div></div></div>` : ''}
    <div class="si" onclick="togglePDFDarkMode();closeDlg('dlg-qact')"><div class="si-ic"><span class="material-icons-round">dark_mode</span></div><div class="si-tx"><div class="si-m">${_pdfDarkMode ? 'Switch to Light PDF' : 'Switch to Dark PDF'}</div><div class="si-s">Current: ${_pdfDarkMode ? 'Dark 🌙' : 'Light ☀️'}</div></div></div>`;
  body.insertAdjacentHTML('beforeend', extra);
};

// Patch openInvEd to include photo upload
const _origOpenInvEd2 = window.openInvEd;
window.openInvEd = function(id) {
  _origOpenInvEd2(id);
  const body = document.getElementById('inv-body'); if (!body) return;
  const p = id ? getProd(id) : null;
  addProductPhotoUI(body, p);
};

// Patch saveInv to also save photo
const _origSaveInv2 = window.saveInv;
window.saveInv = function() {
  const id = v('ii-id');
  const photoData = document.getElementById('prod-photo-data')?.value || '';
  _origSaveInv2();
  // Add photo to saved item
  const item = DB.inventory.find(i => i.id === id);
  if (item) { item.photo = photoData; save(); }
};

// Patch renderSettings to add new rows
const _origRenderSettings2 = window.renderSettings;
window.renderSettings = function() {
  _origRenderSettings2();
  const extra = document.getElementById('settings-extra-card');
  if (extra && !extra.querySelector('[data-v51]')) {
    extra.insertAdjacentHTML('beforeend', `
      <div class="si" data-v51="1" onclick="openSupplierManager()"><div class="si-ic"><span class="material-icons-round">local_shipping</span></div><div class="si-tx"><div class="si-m">Suppliers</div><div class="si-s">${(DB.suppliers||[]).length} supplier(s)</div></div><span class="material-icons-round" style="color:var(--t2)">chevron_right</span></div>
      <div class="si" data-v51="1" onclick="openSetSheet('fy')"><div class="si-ic ora"><span class="material-icons-round">calendar_today</span></div><div class="si-tx"><div class="si-m">Financial Year Start</div><div class="si-s">Month ${DB.settings.fyStartMonth||1} (${new Date(2000,((DB.settings.fyStartMonth||1)-1),1).toLocaleString('default',{month:'long'})})</div></div><span class="material-icons-round" style="color:var(--t2)">chevron_right</span></div>`);
  }
};

// Patch openSetSheet for FY
const _origOpenSetSheet2 = window.openSetSheet;
window.openSetSheet = function(type) {
  if (type === 'fy') {
    setType = 'fy';
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    document.getElementById('set-ttl').textContent = 'Financial Year Start';
    document.getElementById('set-body').innerHTML = `
      <div style="font-size:13px;color:var(--t2);margin-bottom:14px;line-height:1.6">
        Set the month your financial year begins. Quote IDs will reset at the start of each FY.<br>
        <b>Kenyan default:</b> July (FY starts 1 July).
      </div>
      <div class="fg"><label class="fl">FY Start Month</label>
        ${buildCustomSelect({id:'fy-month',label:'Month',options:months.map((m,i)=>({value:i+1,label:m})),value:DB.settings.fyStartMonth||1})}
      </div>
      <button class="btn bp btn-w" onclick="saveFYSetting()">Save</button>`;
    openDlg('dlg-set'); pushNav('settings-fy');
  } else {
    _origOpenSetSheet2(type);
  }
};
function saveFYSetting() {
  DB.settings.fyStartMonth = parseInt(v('fy-month')) || 1;
  save(); closeDlg('dlg-set'); renderSettings(); snack('✓ Financial year updated');
}

// Patch saveSetSheet for fy type
const _origSaveSetSheet2 = window.saveSetSheet;
window.saveSetSheet = function() {
  if (setType === 'fy') { saveFYSetting(); return; }
  _origSaveSetSheet2();
};

// Patch openMore to include new options
const _origOpenMore2 = window.openMore;
window.openMore = function() {
  _origOpenMore2();
  const body = document.getElementById('more-body'); if (!body) return;
  body.insertAdjacentHTML('afterbegin', `
    <div class="si" onclick="openEstimator();closeDlg('dlg-more')"><div class="si-ic"><span class="material-icons-round">calculate</span></div><div class="si-tx"><div class="si-m">Quick Estimator</div><div class="si-s">Price check without creating a quote</div></div></div>`);
};

// Patch renderQuotes to use new search index
const _origRenderQuotes2 = window.renderQuotes;
window.renderQuotes = function() {
  const srch = (document.getElementById('q-srch-in')||{}).value?.toLowerCase()||'';
  const df = v('q-date-from'), dt = v('q-date-to');
  let list = srch ? searchQuotes(srch) : acoQuotes();
  list = list.sort((a,b) => b.date.localeCompare(a.date));
  if (qFilt !== 'all') list = list.filter(q => q.status === qFilt);
  if (df) list = list.filter(q => q.date >= df);
  if (dt) list = list.filter(q => q.date <= dt);
  const el = document.getElementById('q-list');
  if (!list.length) {
    el.innerHTML = `<div class="empty"><span class="material-icons-round">search_off</span><div class="empty-t">No ${qFilt!=='all'?qFilt+' ':''}quotes found</div><div class="empty-s">${qFilt==='Won'?'Mark sent quotes as Won to see them here':qFilt==='Lost'?'No lost quotes — great news!':'Try a different filter or create a new quote'}</div></div>`;
    return;
  }
  renderVirtualList(el, list, q => qItemHTML(q));
  if (el) { initLongPress(el); attachSwipeHandlers(el); }
};

// ── INIT FINAL ───────────────────────────────────────────
const _origInit2 = window.init;
window.init = async function() {
  await _origInit2();
  // Ensure suppliers array exists
  if (!DB.suppliers) { DB.suppliers = []; }
  // Add quick actions div to dashboard if not present
  const dash = document.getElementById('page-dashboard');
  if (dash && !document.getElementById('d-quick-actions')) {
    const div = document.createElement('div');
    div.id = 'd-quick-actions';
    const met = document.getElementById('d-met');
    if (met && met.parentNode) met.parentNode.insertBefore(div, met.nextSibling);
  }
};

// ═══════════════════════════════════════════════════════
// FORMS REWRITE PATCH — complete replacement
// Fixes: customers, products, salespeople, quotes, company
// Adds: custom colour picker for logo
// ═══════════════════════════════════════════════════════

// ── UTILITY: field value readers ──────────────────────
function fv(id, fallback='') {
  const el = document.getElementById(id);
  if (!el) return fallback;
  if (el.type === 'checkbox') return el.checked;
  return el.value ?? fallback;
}
function setFV(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.type === 'checkbox') el.checked = !!val;
  else el.value = val ?? '';
}
function togOn(id) {
  return !!document.getElementById(id)?.classList.contains('on');
}
function showErr(msg, focusId) {
  snack(msg);
  if (focusId) {
    const el = document.getElementById(focusId);
    if (el) { el.focus(); el.classList.add('fi-err'); setTimeout(() => el.classList.remove('fi-err'), 2000); }
  }
  hap(40);
}

// ── CUSTOM COLOUR PICKER ───────────────────────────────
// Replaces the native <input type="color"> with a branded swatch grid + hex input
const COLOR_PALETTE = [
  // Row 1 — Blues
  '#1A73E8','#1565C0','#0D47A1','#1976D2','#42A5F5','#90CAF9',
  // Row 2 — Greens
  '#2E7D32','#388E3C','#43A047','#66BB6A','#00897B','#26A69A',
  // Row 3 — Reds/Oranges
  '#C62828','#E53935','#E65100','#F57C00','#FB8C00','#FFA726',
  // Row 4 — Purples/Pinks
  '#6A1B9A','#8E24AA','#C2185B','#D81B60','#AD1457','#E91E63',
  // Row 5 — Dark tones
  '#212121','#37474F','#455A64','#546E7A','#78909C','#90A4AE',
  // Row 6 — Warm neutrals
  '#BF360C','#4E342E','#3E2723','#FFF8E1','#F3E5F5','#FAFAFA',
];

function openColorPicker(currentColor, onSelect) {
  // Store callback
  window._colorPickerCb = onSelect;
  window._colorPickerCurrent = currentColor || '#1A73E8';

  const overlay = document.createElement('div');
  overlay.id = 'color-picker-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;animation:bfi .18s';
  overlay.innerHTML = `
    <div id="color-picker-panel" style="background:var(--su);width:100%;max-width:420px;border-radius:16px 16px 0 0;padding:0 0 env(safe-area-inset-bottom,0px);animation:shup .25s cubic-bezier(.2,0,0,1)">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px 10px;border-bottom:1px solid var(--ol2)">
        <span style="font-size:16px;font-weight:700">Choose Colour</span>
        <button class="ib" onclick="closeColorPicker()"><span class="material-icons-round">close</span></button>
      </div>
      <div style="padding:14px 16px">
        <!-- Preview -->
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
          <div id="cp-preview" style="width:52px;height:52px;border-radius:10px;background:${currentColor||'#1A73E8'};flex-shrink:0;border:2px solid var(--ol)"></div>
          <div style="flex:1">
            <div style="font-size:11px;color:var(--t2);margin-bottom:4px;font-weight:600">HEX CODE</div>
            <input id="cp-hex" class="fi" value="${currentColor||'#1A73E8'}"
              placeholder="#000000" maxlength="7"
              oninput="cpHexInput(this.value)"
              style="font-family:monospace;font-size:15px;letter-spacing:1px">
          </div>
          <button class="btn bp btn-sm" onclick="cpConfirm()">Select</button>
        </div>
        <!-- Swatch grid -->
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-bottom:8px">
          ${COLOR_PALETTE.map(c => `
            <div onclick="cpSelectSwatch('${c}')"
              style="aspect-ratio:1;border-radius:8px;background:${c};cursor:pointer;
                border:3px solid ${c===currentColor?'var(--t1)':'transparent'};
                transition:transform .1s,border-color .1s;position:relative"
              id="cp-swatch-${c.replace('#','')}"
              title="${c}">
              ${c===currentColor?'<span class="material-icons-round" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;text-shadow:0 1px 3px rgba(0,0,0,.5)">check</span>':''}
            </div>`).join('')}
        </div>
        <!-- RGB sliders -->
        <div style="margin-top:10px;border-top:1px solid var(--ol2);padding-top:12px">
          <div style="font-size:11px;font-weight:600;color:var(--t2);margin-bottom:8px">CUSTOM RGB</div>
          ${['R','G','B'].map((ch,i) => {
            const rgb = hexToRGB(currentColor||'#1A73E8');
            const val = rgb ? [rgb.r,rgb.g,rgb.b][i] : 0;
            const clr = ['#E53935','#43A047','#1976D2'][i];
            return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <span style="font-size:11px;font-weight:700;color:${clr};width:12px">${ch}</span>
              <input type="range" id="cp-${ch.toLowerCase()}" min="0" max="255" value="${val}"
                style="flex:1;accent-color:${clr}" oninput="cpRGBInput()">
              <span id="cp-${ch.toLowerCase()}-val" style="font-size:11px;width:26px;text-align:right;color:var(--t2)">${val}</span>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;

  overlay.addEventListener('click', e => { if (e.target === overlay) closeColorPicker(); });
  document.body.appendChild(overlay);
}

function hexToRGB(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? { r: parseInt(r[1],16), g: parseInt(r[2],16), b: parseInt(r[3],16) } : null;
}
function rgbToHex(r,g,b) {
  return '#' + [r,g,b].map(v => Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
}

function cpHexInput(val) {
  const hex = val.startsWith('#') ? val : '#'+val;
  if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    cpApplyColor(hex);
  }
  // Keep hex field showing what user typed
}
function cpSelectSwatch(color) {
  document.querySelectorAll('[id^="cp-swatch-"]').forEach(el => {
    el.style.borderColor = 'transparent';
    el.innerHTML = '';
  });
  const sw = document.getElementById('cp-swatch-' + color.replace('#',''));
  if (sw) {
    sw.style.borderColor = 'var(--t1)';
    sw.innerHTML = '<span class="material-icons-round" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;text-shadow:0 1px 3px rgba(0,0,0,.5)">check</span>';
  }
  cpApplyColor(color);
}
function cpRGBInput() {
  const r = parseInt(document.getElementById('cp-r')?.value)||0;
  const g = parseInt(document.getElementById('cp-g')?.value)||0;
  const b = parseInt(document.getElementById('cp-b')?.value)||0;
  document.getElementById('cp-r-val').textContent = r;
  document.getElementById('cp-g-val').textContent = g;
  document.getElementById('cp-b-val').textContent = b;
  const hex = rgbToHex(r,g,b);
  cpApplyColor(hex, false);
}
function cpApplyColor(hex, updateSliders=true) {
  const prev = document.getElementById('cp-preview');
  const hexInput = document.getElementById('cp-hex');
  if (prev) prev.style.background = hex;
  if (hexInput && document.activeElement !== hexInput) hexInput.value = hex;
  window._colorPickerCurrent = hex;
  if (updateSliders) {
    const rgb = hexToRGB(hex);
    if (rgb) {
      ['r','g','b'].forEach(c => {
        const sl = document.getElementById('cp-'+c);
        const vl = document.getElementById('cp-'+c+'-val');
        if (sl) sl.value = rgb[c];
        if (vl) vl.textContent = rgb[c];
      });
    }
  }
}
function cpConfirm() {
  const color = window._colorPickerCurrent || '#1A73E8';
  closeColorPicker();
  if (window._colorPickerCb) window._colorPickerCb(color);
}
function closeColorPicker() {
  const el = document.getElementById('color-picker-overlay');
  if (el) el.remove();
}

// ── PRODUCT EDITOR — full rewrite ───────────────────────
function openInvEd(id) {
  editInvId = id;
  const p = id ? getProd(id) : null;
  const nid = nextId('ITM', DB.inventory);
  const cats = getCategories();
  const salePrice = p ? (p.unitCost * (1 + p.markup)) : 0;

  document.getElementById('inv-ttl').textContent = id ? 'Edit Product' : 'New Product';
  document.getElementById('inv-body').innerHTML = `
    <div class="fg">
      <label class="fl">Item ID <span style="color:var(--t3);font-weight:400">${id ? '(read-only)' : '(auto-generated)'}</span></label>
      <input class="fi" id="ii-id" value="${esc(p?.id || nid)}" ${id ? 'readonly' : ''}>
    </div>
    <div class="fg">
      <label class="fl">Product / Service Name <span style="color:var(--E)">*</span></label>
      <input class="fi" id="ii-nm" value="${esc(p?.name || '')}" placeholder="e.g. Enterprise Software License">
    </div>
    <div class="fg">
      <label class="fl">Description</label>
      <textarea class="fi" id="ii-desc" placeholder="Brief description shown in quotes and PDF">${esc(p?.description || '')}</textarea>
    </div>
    <div class="fg">
      <label class="fl">Category</label>
      ${buildCustomSelect({ id: 'ii-cat', label: 'Category', options: cats.map(c => ({ value: c, label: c })), value: p?.category || cats[0] })}
    </div>
    <div style="height:1px;background:var(--ol2);margin:4px 0 14px"></div>
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--t2);margin-bottom:10px">Pricing</div>
    <div class="fr">
      <div class="fg">
        <label class="fl">Unit Cost <span style="color:var(--E)">*</span></label>
        <input class="fi" type="number" id="ii-cost" value="${p?.unitCost ?? 0}" step="0.01" min="0" placeholder="0.00" oninput="updateSalePreview()">
      </div>
      <div class="fg">
        <label class="fl">Markup %</label>
        <input class="fi" type="number" id="ii-mkup" value="${Math.round((p?.markup ?? 0.30) * 100)}" min="0" placeholder="30" oninput="updateSalePreview()">
      </div>
    </div>
    <div id="sale-preview" style="background:var(--su2);border-radius:8px;padding:10px 14px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:13px;color:var(--t2)">Sale Price</span>
      <span id="sale-preview-val" style="font-size:16px;font-weight:800;color:var(--P)">${fmt(salePrice)}</span>
    </div>
    <div style="height:1px;background:var(--ol2);margin:4px 0 14px"></div>
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--t2);margin-bottom:10px">Inventory</div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding:12px 14px;background:var(--su2);border-radius:8px">
      <div>
        <div style="font-size:14px;font-weight:600">Track Stock Level</div>
        <div style="font-size:12px;color:var(--t2);margin-top:2px">Show stock count and warn when running low</div>
      </div>
      <button class="tog ${p?.trackStock ? 'on' : ''}" id="ii-track"
        onclick="this.classList.toggle('on');document.getElementById('ii-stock-row').style.display=this.classList.contains('on')?'block':'none'"></button>
    </div>
    <div id="ii-stock-row" style="display:${p?.trackStock ? 'block' : 'none'}">
      <div class="fg">
        <label class="fl">Current Stock Quantity</label>
        <input class="fi" type="number" id="ii-stock" value="${p?.stock ?? 0}" min="0" step="1" placeholder="0">
      </div>
    </div>
    ${id ? `
      <div style="height:1px;background:var(--ol2);margin:4px 0 14px"></div>
      <button class="btn bd2 btn-w" onclick="confirmAct('Delete this product? It will be removed from the catalogue.',()=>softDelItem('inv','${id}'))">
        <span class="material-icons-round">delete</span> Delete Product
      </button>` : ''}
    <div style="height:8px"></div>`;

  openDlg('dlg-inv');
  pushNav('inv-ed-' + (id || 'new'));
}

function updateSalePreview() {
  const cost = parseFloat(fv('ii-cost')) || 0;
  const mkup = (parseFloat(fv('ii-mkup')) || 0) / 100;
  const price = cost * (1 + mkup);
  const el = document.getElementById('sale-preview-val');
  if (el) el.textContent = fmt(price);
}

function saveInv() {
  const id = fv('ii-id').trim();
  const nm = fv('ii-nm').trim();
  if (!id)   { showErr('Item ID is required', 'ii-id'); return; }
  if (!nm)   { showErr('Product name is required', 'ii-nm'); return; }
  if (!editInvId && DB.inventory.find(i => i.id === id)) {
    showErr('A product with this ID already exists — change the ID', 'ii-id'); return;
  }
  const cost = parseFloat(fv('ii-cost'));
  if (isNaN(cost) || cost < 0) { showErr('Unit cost must be 0 or more', 'ii-cost'); return; }
  const mkup = parseFloat(fv('ii-mkup'));
  if (isNaN(mkup) || mkup < 0) { showErr('Markup must be 0 or more', 'ii-mkup'); return; }
  const trackStock = togOn('ii-track');
  const stockVal = trackStock ? (parseInt(fv('ii-stock')) || 0) : null;
  const photoData = document.getElementById('prod-photo-data')?.value || getProd(id)?.photo || '';
  const item = {
    id, name: nm,
    description: fv('ii-desc'),
    category: fv('ii-cat') || getCategories()[0],
    unitCost: cost,
    markup: mkup / 100,
    trackStock,
    stock: stockVal,
    photo: photoData,
    companyId: (activeCo() || {}).id
  };
  const idx = DB.inventory.findIndex(i => i.id === id);
  if (idx >= 0) DB.inventory[idx] = item; else DB.inventory.push(item);
  save();
  closeDlg('dlg-inv');
  renderInv();
  snack('✓ Product saved');
  hap(20);
}

// ── CUSTOMER EDITOR — full rewrite ───────────────────────
function openCustEd(id, fromQE = false) {
  editCustId = id;
  const c = id ? getCust(id) : null;
  const nid = nextId('CUS', DB.customers);
  const tiers = ['Platinum', 'Gold', 'Silver', 'Bronze'];

  document.getElementById('cust-ttl').textContent = id ? 'Edit Customer' : 'New Customer';
  document.getElementById('cust-body').innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
      <div class="av" style="width:52px;height:52px;font-size:22px;background:${avColor(c?.company || '?')};flex-shrink:0">${avLetter(c?.company || '?')}</div>
      <div>
        <div style="font-size:16px;font-weight:800">${esc(c?.company || 'New Customer')}</div>
        <div style="font-size:12px;color:var(--t2)">${id ? 'ID: '+id : 'Fill in details below'}</div>
      </div>
    </div>
    <div class="fg">
      <label class="fl">Customer ID <span style="color:var(--t3);font-weight:400">${id ? '(read-only)' : '(auto-generated)'}</span></label>
      <input class="fi" id="ci-id" value="${esc(c?.id || nid)}" ${id ? 'readonly' : ''}>
    </div>
    <div style="height:1px;background:var(--ol2);margin:4px 0 14px"></div>
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--t2);margin-bottom:10px">Company</div>
    <div class="fg">
      <label class="fl">Company Name <span style="color:var(--E)">*</span></label>
      <input class="fi" id="ci-co" value="${esc(c?.company || '')}" placeholder="e.g. Nexus Technologies Ltd">
    </div>
    <div class="fg">
      <label class="fl">Contact Person</label>
      <input class="fi" id="ci-cnt" value="${esc(c?.contact || '')}" placeholder="Full name">
    </div>
    <div class="fr">
      <div class="fg">
        <label class="fl">Email</label>
        <input class="fi" type="email" id="ci-em" value="${esc(c?.email || '')}" placeholder="email@company.com">
      </div>
      <div class="fg">
        <label class="fl">Phone</label>
        <input class="fi" type="tel" id="ci-ph" value="${esc(c?.phone || '')}" placeholder="+254 7xx xxx xxx">
      </div>
    </div>
    <div class="fg">
      <label class="fl">Physical Address</label>
      <textarea class="fi" id="ci-addr" placeholder="Street, Area, City">${esc(c?.address || '')}</textarea>
    </div>
    <div style="height:1px;background:var(--ol2);margin:4px 0 14px"></div>
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--t2);margin-bottom:10px">Classification</div>
    <div class="fr">
      <div class="fg">
        <label class="fl">Industry</label>
        <input class="fi" id="ci-ind" value="${esc(c?.industry || '')}" placeholder="e.g. Technology">
      </div>
      <div class="fg">
        <label class="fl">Tier</label>
        ${buildCustomSelect({ id: 'ci-tier', label: 'Tier', options: tiers.map(t => ({ value: t, label: t })), value: c?.tier || 'Bronze' })}
      </div>
    </div>
    <div class="fg">
      <label class="fl">KRA PIN</label>
      <input class="fi" id="ci-pin" value="${esc(c?.taxPin || '')}" placeholder="P051234567A">
    </div>
    ${c?.ltv ? `
      <div style="background:linear-gradient(135deg,var(--PC),var(--su2));border-radius:10px;padding:12px 14px;margin-bottom:10px;border:1px solid var(--ol2)">
        <div style="font-size:11px;color:var(--t2);font-weight:600;text-transform:uppercase;letter-spacing:.5px">Lifetime Value (Won Quotes)</div>
        <div style="font-size:22px;font-weight:900;color:var(--P);margin-top:3px">${fmt(c.ltv)}</div>
      </div>` : ''}
    ${id ? `
      <div style="height:1px;background:var(--ol2);margin:4px 0 14px"></div>
      <button class="btn btn-ton btn-w" style="margin-bottom:8px" onclick="openCustomerStatement('${id}')">
        <span class="material-icons-round">summarize</span> View Account Statement
      </button>
      <button class="btn bd2 btn-w" onclick="confirmAct('Delete this customer? Their quotes will still exist.',()=>softDelItem('cust','${id}'))">
        <span class="material-icons-round">delete</span> Delete Customer
      </button>` : ''}
    <div style="height:8px"></div>`;

  openDlg('dlg-cust');
  pushNav('cust-ed-' + (id || 'new'));
}

function saveCust() {
  const id  = fv('ci-id').trim();
  const co  = fv('ci-co').trim();
  const em  = fv('ci-em').trim();
  const ph  = fv('ci-ph').trim();
  if (!id)  { showErr('Customer ID is required', 'ci-id'); return; }
  if (!co)  { showErr('Company name is required', 'ci-co'); return; }
  if (!editCustId && DB.customers.find(c => c.id === id)) {
    showErr('A customer with this ID already exists', 'ci-id'); return;
  }
  if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
    showErr('Enter a valid email address', 'ci-em'); return;
  }
  const cust = {
    id, company: co,
    contact:  fv('ci-cnt'),
    email:    em,
    phone:    ph,
    address:  fv('ci-addr'),
    industry: fv('ci-ind'),
    tier:     fv('ci-tier') || 'Bronze',
    taxPin:   fv('ci-pin'),
    companyId: (activeCo() || {}).id,
    ltv:      getCust(id)?.ltv || 0
  };
  const idx = DB.customers.findIndex(c => c.id === id);
  if (idx >= 0) DB.customers[idx] = cust; else DB.customers.push(cust);
  save();
  closeDlg('dlg-cust');
  renderCusts();
  // If opened from QE, refresh customer list
  const custEl = document.getElementById('qe-cust');
  if (custEl) {
    // Rebuild the select
    const custs = acoCusts();
    _csOptsMap['qe-cust'] = { label: 'Customer', options: [{ value: '', label: '— Select a customer —' }, ...custs.map(c => ({ value: c.id, label: c.company, sub: c.contact + ' · ' + (c.phone || '') }))], searchable: true };
    // Auto-select the new customer
    csSelect('qe-cust', id, co);
    previewCust();
  }
  snack('✓ Customer saved');
  hap(20);
}

// ── SALESPERSON EDITOR — full rewrite ────────────────────
function openSpEd(id) {
  editSpId = id;
  const sp = id ? getSP(id) : null;
  const nid = nextId('SP', DB.salespeople);

  document.getElementById('spe-ttl').textContent = id ? 'Edit Salesperson' : 'New Salesperson';
  document.getElementById('spe-body').innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
      <div class="av" style="width:52px;height:52px;font-size:22px;background:${avColor(sp?.name || '?')};flex-shrink:0">${avLetter(sp?.name || '?')}</div>
      <div>
        <div style="font-size:16px;font-weight:800">${esc(sp?.name || 'New Team Member')}</div>
        <div style="font-size:12px;color:var(--t2)">${esc(sp?.title || 'Sales Team')}</div>
      </div>
    </div>
    <div class="fg">
      <label class="fl">ID <span style="color:var(--t3);font-weight:400">${id ? '(read-only)' : '(auto-generated)'}</span></label>
      <input class="fi" id="sp-id" value="${esc(sp?.id || nid)}" ${id ? 'readonly' : ''}>
    </div>
    <div class="fg">
      <label class="fl">Full Name <span style="color:var(--E)">*</span></label>
      <input class="fi" id="sp-nm" value="${esc(sp?.name || '')}" placeholder="e.g. Sarah Kamau">
    </div>
    <div class="fg">
      <label class="fl">Job Title</label>
      <input class="fi" id="sp-ttl2" value="${esc(sp?.title || '')}" placeholder="e.g. Senior Sales Executive">
    </div>
    <div class="fr">
      <div class="fg">
        <label class="fl">Email</label>
        <input class="fi" type="email" id="sp-em" value="${esc(sp?.email || '')}" placeholder="name@company.com">
      </div>
      <div class="fg">
        <label class="fl">Phone</label>
        <input class="fi" type="tel" id="sp-ph" value="${esc(sp?.phone || '')}" placeholder="+254 7xx xxx xxx">
      </div>
    </div>
    <div class="fg">
      <label class="fl">Company Profile</label>
      ${buildCustomSelect({ id: 'sp-coid', label: 'Company', options: DB.companies.map(co => ({ value: co.id, label: co.name })), value: sp?.companyId || DB.settings.activeCompanyId || '' })}
    </div>
    <div style="height:1px;background:var(--ol2);margin:4px 0 14px"></div>
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--t2);margin-bottom:10px">Digital Signature</div>
    <div style="background:var(--su2);border-radius:10px;padding:14px;border:1.5px dashed var(--ol)">
      <div id="sp-sig-preview" style="min-height:70px;display:flex;align-items:center;justify-content:center;margin-bottom:12px">
        ${sp?.signatureImg
          ? `<img src="${sp.signatureImg}" style="max-height:70px;max-width:240px;object-fit:contain;border-radius:4px">`
          : `<div style="text-align:center;color:var(--t3)"><span class="material-icons-round" style="font-size:36px;display:block;margin-bottom:4px">draw</span><div style="font-size:12px">No signature uploaded</div></div>`}
      </div>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
        <button class="btn bo btn-sm" onclick="document.getElementById('sp-sig-file').click()">
          <span class="material-icons-round">upload</span> Upload Image
        </button>
        <button class="btn btn-ton btn-sm" onclick="openSignaturePad('${id || ''}')">
          <span class="material-icons-round">draw</span> Draw Signature
        </button>
        ${sp?.signatureImg ? `<button class="btn bt btn-sm" style="color:var(--E)" onclick="clearSpSig()">
          <span class="material-icons-round">delete</span> Remove
        </button>` : ''}
      </div>
      <input type="file" id="sp-sig-file" accept="image/*" style="display:none" onchange="previewSpSig(this)">
      <input type="hidden" id="sp-sig-img" value="${sp?.signatureImg || ''}">
      <div style="font-size:11px;color:var(--t3);text-align:center;margin-top:10px">PNG with transparent background works best</div>
    </div>
    ${id ? `
      <div style="height:1px;background:var(--ol2);margin:14px 0 10px"></div>
      <button class="btn bd2 btn-w" onclick="confirmAct('Remove this salesperson from the team?',()=>softDelItem('sp','${id}'))">
        <span class="material-icons-round">person_remove</span> Remove from Team
      </button>` : ''}
    <div style="height:8px"></div>`;

  openDlg('dlg-spe');
  pushNav('sp-ed-' + (id || 'new'));
}

function saveSp() {
  const id   = fv('sp-id').trim();
  const name = fv('sp-nm').trim();
  const em   = fv('sp-em').trim();
  if (!id)   { showErr('Salesperson ID is required', 'sp-id'); return; }
  if (!name) { showErr('Full name is required', 'sp-nm'); return; }
  if (!editSpId && DB.salespeople.find(s => s.id === id)) {
    showErr('A salesperson with this ID already exists', 'sp-id'); return;
  }
  if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
    showErr('Enter a valid email address', 'sp-em'); return;
  }
  const sigImg = document.getElementById('sp-sig-img')?.value || '';
  const sp = {
    id, name,
    title:       fv('sp-ttl2'),
    email:       em,
    phone:       fv('sp-ph'),
    companyId:   fv('sp-coid') || DB.settings.activeCompanyId || '',
    signatureImg: sigImg
  };
  const idx = DB.salespeople.findIndex(s => s.id === id);
  if (idx >= 0) DB.salespeople[idx] = sp; else DB.salespeople.push(sp);
  save();
  closeDlg('dlg-spe');
  renderSPList();
  renderSettings();
  snack('✓ Salesperson saved');
  hap(20);
}

// ── COMPANY EDITOR — full rewrite with custom colour picker ──
function openCoEd(id) {
  editCoId = id;
  document.getElementById('co-ttl').textContent = id ? 'Edit Company Profile' : 'New Company Profile';
  buildCoForm(id ? getCo(id) : null);
  openDlg('dlg-co');
  pushNav('co-ed-' + (id || 'new'));
}

function buildCoForm(co) {
  const pms = co?.paymentMethods || [];
  const logoColor = co?.logoColor || '#1A73E8';

  document.getElementById('co-body').innerHTML = `
    <!-- Logo Section -->
    <div style="background:var(--su2);border-radius:12px;padding:16px;margin-bottom:16px">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--t2);margin-bottom:12px">Company Logo</div>
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">
        <div id="logo-prev"
          style="width:72px;height:72px;border-radius:12px;background:${logoColor};display:flex;align-items:center;justify-content:center;color:#fff;font-size:28px;font-weight:900;cursor:pointer;overflow:hidden;flex-shrink:0;border:2px solid var(--ol)"
          onclick="document.getElementById('logo-file').click()">
          ${co?.logoImg ? `<img src="${co.logoImg}" style="width:100%;height:100%;object-fit:cover">` : esc(co?.logoText || 'A')}
        </div>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:600;margin-bottom:6px">${esc(co?.name || 'Company Name')}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn bo btn-sm" onclick="document.getElementById('logo-file').click()">
              <span class="material-icons-round">upload</span> Upload Logo
            </button>
            ${co?.logoImg ? `<button class="btn bt btn-sm" style="color:var(--E)" onclick="clearLogoImg()">
              <span class="material-icons-round">delete</span> Remove
            </button>` : ''}
          </div>
          <div style="font-size:11px;color:var(--t3);margin-top:6px">PNG/JPG, square image recommended</div>
        </div>
      </div>
      <input type="file" id="logo-file" accept="image/*" style="display:none" onchange="previewLogo(this)">
      <input type="hidden" id="co-img" value="${co?.logoImg || ''}">
      <input type="hidden" id="co-logo-color" value="${logoColor}">

      <!-- Initials + Custom colour picker -->
      <div class="fr">
        <div class="fg">
          <label class="fl">Initials (shown without logo)</label>
          <input class="fi" id="co-lt" value="${esc(co?.logoText || 'A')}" maxlength="3"
            oninput="updLogoText(this.value)" placeholder="A">
        </div>
        <div class="fg">
          <label class="fl">Background Colour</label>
          <div id="co-color-btn"
            onclick="openColorPicker(document.getElementById('co-logo-color').value, applyLogoColor)"
            style="height:43px;border-radius:8px;background:${logoColor};cursor:pointer;border:1.5px solid var(--ol);display:flex;align-items:center;justify-content:space-between;padding:0 12px;gap:8px">
            <span id="co-color-hex" style="font-family:monospace;font-size:13px;color:#fff;font-weight:600;text-shadow:0 1px 3px rgba(0,0,0,.4)">${logoColor}</span>
            <span class="material-icons-round" style="color:#fff;font-size:18px;opacity:.8">colorize</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Company Info -->
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--t2);margin-bottom:10px">Company Information</div>
    <div class="fg">
      <label class="fl">Company Name <span style="color:var(--E)">*</span></label>
      <input class="fi" id="co-nm" value="${esc(co?.name || '')}" placeholder="e.g. Acme Corporation Ltd.">
    </div>
    <div class="fg">
      <label class="fl">Tagline / Slogan</label>
      <input class="fi" id="co-tag" value="${esc(co?.tagline || '')}" placeholder="e.g. Enterprise Solutions">
    </div>
    <div class="fg">
      <label class="fl">Physical Address</label>
      <textarea class="fi" id="co-addr" placeholder="Street, Area, City, Country">${esc(co?.address || '')}</textarea>
    </div>
    <div class="fr">
      <div class="fg">
        <label class="fl">Phone</label>
        <input class="fi" type="tel" id="co-ph" value="${esc(co?.phone || '')}" placeholder="+254 700 000 000">
      </div>
      <div class="fg">
        <label class="fl">Email</label>
        <input class="fi" type="email" id="co-em" value="${esc(co?.email || '')}" placeholder="info@company.com">
      </div>
    </div>
    <div class="fr">
      <div class="fg">
        <label class="fl">Website</label>
        <input class="fi" id="co-web" value="${esc(co?.website || '')}" placeholder="www.company.com">
      </div>
      <div class="fg">
        <label class="fl">KRA PIN</label>
        <input class="fi" id="co-pin" value="${esc(co?.taxPin || '')}" placeholder="P051234567A">
      </div>
    </div>

    <div style="height:1px;background:var(--ol2);margin:4px 0 16px"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--t2)">Payment Methods</div>
      <button class="btn btn-ton btn-sm" onclick="addPayMethod()">
        <span class="material-icons-round">add</span> Add Method
      </button>
    </div>
    <div id="pm-list">${pms.map((pm, i) => pmCardHTML(pm, i)).join('')}</div>

    <div style="height:1px;background:var(--ol2);margin:4px 0 16px"></div>
    <div class="fg">
      <label class="fl">Default Payment Terms</label>
      ${buildCustomSelect({ id: 'co-pterms', label: 'Payment Terms', options: ['Net 7','Net 14','Net 30','Net 60','Due on Receipt','50% Upfront','COD'].map(t => ({ value: t, label: t })), value: co?.paymentTerms || 'Net 30' })}
    </div>

    <div style="height:1px;background:var(--ol2);margin:4px 0 16px"></div>
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--t2);margin-bottom:10px">Terms &amp; Conditions</div>
    <div class="fg">
      <textarea class="fi" id="co-tc" rows="6" placeholder="1. Payment is due within 30 days…">${esc(co?.terms || '')}</textarea>
    </div>

    ${editCoId ? `
      <div style="height:1px;background:var(--ol2);margin:4px 0 14px"></div>
      <button class="btn bd2 btn-w" onclick="confirmAct('Delete this company profile? Associated quotes will lose their company link.',()=>{softDelItem('co','${editCoId}');closeDlg('dlg-co')})">
        <span class="material-icons-round">delete</span> Delete Profile
      </button>` : ''}
    <div style="height:20px"></div>`;

  setTimeout(wirePMSelects, 50);
}

function applyLogoColor(color) {
  // Update hidden field
  const hid = document.getElementById('co-logo-color');
  if (hid) hid.value = color;
  // Update preview div
  const prev = document.getElementById('logo-prev');
  if (prev && !document.getElementById('co-img')?.value) prev.style.background = color;
  // Update colour button
  const btn = document.getElementById('co-color-btn');
  if (btn) btn.style.background = color;
  const hex = document.getElementById('co-color-hex');
  if (hex) hex.textContent = color;
}

function clearLogoImg() {
  document.getElementById('co-img').value = '';
  const prev = document.getElementById('logo-prev');
  const color = document.getElementById('co-logo-color')?.value || '#1A73E8';
  const text = fv('co-lt') || 'A';
  if (prev) { prev.style.background = color; prev.innerHTML = text; }
}

function saveCo() {
  const name = fv('co-nm').trim();
  if (!name) { showErr('Company name is required', 'co-nm'); return; }
  const em = fv('co-em').trim();
  if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
    showErr('Enter a valid email address', 'co-em'); return;
  }
  const id = editCoId || 'CO-' + uid().slice(0, 6).toUpperCase();
  const logoColor = document.getElementById('co-logo-color')?.value || '#1A73E8';
  const co = {
    id, name,
    tagline:        fv('co-tag'),
    address:        fv('co-addr'),
    phone:          fv('co-ph'),
    email:          em,
    website:        fv('co-web'),
    taxPin:         fv('co-pin'),
    paymentMethods: collectPMs(),
    paymentTerms:   fv('co-pterms') || 'Net 30',
    terms:          fv('co-tc'),
    logoText:       fv('co-lt') || (name[0] || 'A').toUpperCase(),
    logoColor,
    logoImg:        document.getElementById('co-img')?.value || null
  };
  const idx = DB.companies.findIndex(c => c.id === id);
  if (idx >= 0) DB.companies[idx] = co;
  else { DB.companies.push(co); if (!DB.settings.activeCompanyId) DB.settings.activeCompanyId = id; }
  save();
  closeDlg('dlg-co');
  renderSettings();
  renderDash();
  snack('✓ Company profile saved');
  hap(20);
}

// Keep existing helpers working
function previewLogo(input) {
  const file = input.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = e => {
    document.getElementById('co-img').value = e.target.result;
    const prev = document.getElementById('logo-prev');
    if (prev) prev.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover">`;
  };
  r.readAsDataURL(file);
}
function updLogoColor(val) {
  applyLogoColor(val);
}
function updLogoText(t) {
  if (!document.getElementById('co-img')?.value) {
    const prev = document.getElementById('logo-prev');
    if (prev) prev.textContent = t || 'A';
  }
}

// ── QUOTE EDITOR STEP 0 — rewrite ───────────────────────
function renderQE0(body) {
  const sps = acoSP(), cos = DB.companies;
  const currencies = Object.keys(DB.settings.exchangeRates || { KSh: 1, USD: 0.0077, EUR: 0.0071 });
  body.innerHTML = `
    <!-- Quote ID row -->
    <div class="fg">
      <label class="fl">Quote ID</label>
      <div style="display:flex;gap:8px;align-items:center">
        <input class="fi" id="qe-id" value="${esc(qeD.id)}" readonly style="flex:1;font-family:monospace;font-weight:700">
        <div style="padding:6px 10px;background:var(--PC);border-radius:8px;font-size:11px;font-weight:700;color:var(--P);white-space:nowrap">${qeD.isInvoice ? 'INVOICE' : 'QUOTE'}</div>
      </div>
    </div>
    <!-- Dates -->
    <div class="fr">
      <div class="fg">
        <label class="fl">Quote Date <span style="color:var(--E)">*</span></label>
        <input class="fi" type="date" id="qe-date" value="${qeD.date}">
      </div>
      <div class="fg">
        <label class="fl">Valid Until <span style="color:var(--E)">*</span></label>
        <input class="fi" type="date" id="qe-valid" value="${qeD.validUntil}">
      </div>
    </div>
    <!-- Status + Version -->
    <div class="fr">
      <div class="fg">
        <label class="fl">Status</label>
        ${buildCustomSelect({ id: 'qe-status', label: 'Status', options: ['Draft','Sent','Won','Lost','Expired','Pending Approval'].map(s => ({ value: s, label: s })), value: qeD.status })}
      </div>
      <div class="fg">
        <label class="fl">Version</label>
        <input class="fi" id="qe-ver" value="${esc(qeD.version || 'v1')}" placeholder="v1">
      </div>
    </div>
    <!-- Salesperson -->
    <div class="fg">
      <label class="fl">Salesperson</label>
      ${sps.length === 0
        ? `<div style="background:var(--su2);border-radius:8px;padding:10px 13px;font-size:13px;color:var(--t2);display:flex;align-items:center;gap:8px"><span class="material-icons-round" style="font-size:16px">info</span>No salespeople added yet — <button class="btn bt btn-sm" onclick="openSalesTeam()" style="padding:0 6px">Add one</button></div>`
        : buildCustomSelect({ id: 'qe-sp', label: 'Salesperson', placeholder: '— None —', options: [{ value: '', label: '— None —' }, ...sps.map(s => ({ value: s.id, label: s.name, sub: s.title || '' }))], value: qeD.salespersonId || '', searchable: sps.length > 4 })}
    </div>
    <!-- Company -->
    <div class="fg">
      <label class="fl">Company Profile</label>
      ${cos.length === 0
        ? `<div style="background:var(--su2);border-radius:8px;padding:10px 13px;font-size:13px;color:var(--t2);display:flex;align-items:center;gap:8px"><span class="material-icons-round" style="font-size:16px">info</span>No company yet — <button class="btn bt btn-sm" onclick="openCoEd(null)" style="padding:0 6px">Add one</button></div>`
        : buildCustomSelect({ id: 'qe-co', label: 'Company', options: cos.map(c => ({ value: c.id, label: c.name })), value: qeD.companyId })}
    </div>
    <!-- Discount + Currency -->
    <div class="fr">
      <div class="fg">
        <label class="fl">Overall Discount %</label>
        <input class="fi" type="number" id="qe-disc" value="${Math.round((qeD.discount || 0) * 100)}" min="0" max="100" placeholder="0">
      </div>
      <div class="fg">
        <label class="fl">Currency</label>
        ${buildCustomSelect({ id: 'qe-curr', label: 'Currency', options: currencies.map(c => ({ value: c, label: c })), value: qeD.currency || sym() })}
      </div>
    </div>
    <!-- Taxable toggle -->
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:var(--su2);border-radius:8px;margin-bottom:13px">
      <div>
        <div style="font-size:14px;font-weight:600">Apply ${DB.settings.taxLabel || 'VAT'} (${Math.round((DB.settings.taxRate || 0.16) * 100)}%)</div>
        <div style="font-size:12px;color:var(--t2);margin-top:1px">Toggle off for tax-exempt quotes</div>
      </div>
      <button class="tog ${qeD.taxable ? 'on' : ''}" id="qe-tax" onclick="this.classList.toggle('on')"></button>
    </div>
    <!-- Revision note -->
    <div class="fg">
      <label class="fl">Revision Note</label>
      <input class="fi" id="qe-rev" value="${esc(qeD.revision || '')}" placeholder="e.g. Initial proposal / Revised scope after meeting">
    </div>`;
}

// ── QUOTE EDITOR — collectQE rewrite ────────────────────
function collectQE(step) {
  if (step === 0) {
    qeD.date         = fv('qe-date')  || qeD.date;
    qeD.validUntil   = fv('qe-valid') || qeD.validUntil;
    qeD.status       = fv('qe-status')|| qeD.status;
    qeD.salespersonId= fv('qe-sp');
    qeD.companyId    = fv('qe-co')    || qeD.companyId;
    qeD.version      = fv('qe-ver')   || qeD.version;
    qeD.discount     = (parseFloat(fv('qe-disc')) || 0) / 100;
    qeD.taxable      = togOn('qe-tax');
    qeD.revision     = fv('qe-rev');
    qeD.currency     = fv('qe-curr')  || sym();
    // Custom fields
    const fields = DB.settings.customQuoteFields || [];
    if (fields.length) {
      if (!qeD.customFields) qeD.customFields = {};
      fields.forEach(f => {
        const el = document.getElementById('cqf-val-' + f.replace(/\s/g, '_'));
        if (el) qeD.customFields[f] = el.value;
      });
    }
  }
  if (step === 1) {
    qeD.customerId = fv('qe-cust') || qeD.customerId;
  }
  if (step === 3) {
    qeD.notes = fv('qe-notes');
  }
}

// ── QUOTE SAVE — rewrite ────────────────────────────────
function qeSave() {
  collectQE(qeStep);
  // Validate date
  if (!qeD.date)      { showErr('Quote date is required'); qeStep=0; renderQEStep(); return; }
  if (!qeD.validUntil){ showErr('Valid until date is required'); qeStep=0; renderQEStep(); return; }
  if (qeD.validUntil < qeD.date) { showErr('Valid until must be after the quote date'); qeStep=0; renderQEStep(); return; }
  if (!qeD.customerId){ showErr('Please select a customer', 'qe-cust'); qeStep=1; renderQEStep(); return; }
  if (!qeD.items || !qeD.items.length) { showErr('Add at least one line item'); qeStep=2; renderQEStep(); return; }
  const emptyItems = qeD.items.filter(li => !li.desc && !li.itemId);
  if (emptyItems.length) { showErr('Some items have no description — fill them in or remove them'); qeStep=2; renderQEStep(); return; }
  const zeroItems = qeD.items.filter(li => !(li.unitPrice > 0));
  if (zeroItems.length) {
    confirmAct(`${zeroItems.length} item(s) have a zero price. Save anyway?`, _doQESave);
    return;
  }
  _doQESave();
}

function _doQESave() {
  const maxD = (DB.settings.maxDiscountPct || 100) / 100;
  const lineOver  = (qeD.items || []).some(li => (li.discount || 0) > maxD);
  const totalOver = (qeD.discount || 0) > maxD;
  if (lineOver || totalOver) {
    qeD.status = 'Pending Approval';
    logActivity(qeD, 'Auto-submitted for approval: discount exceeds limit');
    snack('Discount exceeds limit — submitted for manager approval');
  }
  const isNew = !DB.quotes.find(q => q.id === qeD.id);
  if (!isNew) logActivity(qeD, 'Quote edited');
  const idx = DB.quotes.findIndex(q => q.id === qeD.id);
  if (idx >= 0) DB.quotes[idx] = qeD; else DB.quotes.unshift(qeD);
  if (qeD.status === 'Won') updateLTV(qeD.customerId);
  // Deduct stock (new quotes only)
  if (isNew) {
    (qeD.items || []).forEach(li => {
      const p = getProd(li.itemId);
      if (p && p.trackStock && p.stock != null) p.stock = Math.max(0, p.stock - (li.qty || 1));
    });
  }
  save();
  closeDlg('dlg-qe');
  renderPage(curPage);
  snack(qeD.id + ' saved ✓');
  hap(20);
  updateNavBadges();
  setTimeout(() => openQD(qeD.id), 360);
}

// ── ADD fi-err STYLE DYNAMICALLY ────────────────────────
(function addErrStyle() {
  const s = document.createElement('style');
  s.textContent = `
    .fi-err { border-color: var(--E) !important; box-shadow: 0 0 0 3px rgba(234,67,53,.15) !important; animation: shake .3s ease; }
    @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }
  `;
  document.head.appendChild(s);
})();
