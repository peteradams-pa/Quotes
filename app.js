'use strict';
// ═══════════════════════════════════════════════════════
// QUOTES PWA v2.1 — Full rebuild, all issues fixed
// ═══════════════════════════════════════════════════════

// ── STATE ──────────────────────────────────────────────
let DB = {
  companies: [], customers: [], inventory: [], quotes: [], salespeople: [],
  settings: {
    quotePrefix:'QMS-', quoteValidDays:30, followUpDays:7,
    taxRate:0.16, taxLabel:'VAT', currencySymbol:'KSh',
    minMargin:.20, warnMargin:.25,
    activeCompanyId:null,
    darkMode:false, accentName:'Google Blue',
    dlIncludeVersion:true,
    productCategories:['Software','Hardware','Services','Other'],
  }
};

let curPage = 'dashboard';
let curQID  = null;
let qeStep  = 0;
let qeD     = {};
let qFilt   = 'all';
let invFilt = 'all';
let setType = '';
let editCoId = null, editCustId = null, editInvId = null, editSpId = null;

// ── ACCENTS ────────────────────────────────────────────
const ACCENTS = [
  {name:'Google Blue',  lc:'#1A73E8', dc:'#8AB4F8'},
  {name:'Teal',         lc:'#00897B', dc:'#4DB6AC'},
  {name:'Indigo',       lc:'#3949AB', dc:'#9FA8DA'},
  {name:'Green',        lc:'#2E7D32', dc:'#81C995'},
  {name:'Purple',       lc:'#7B1FA2', dc:'#CE93D8'},
  {name:'Deep Orange',  lc:'#E65100', dc:'#FFAB76'},
  {name:'Pink',         lc:'#C2185B', dc:'#F48FB1'},
  {name:'Cyan',         lc:'#0097A7', dc:'#80DEEA'},
];

// ── STORAGE ────────────────────────────────────────────
function save() { try { localStorage.setItem('qpwa3', JSON.stringify(DB)); } catch(e){} }
function load() {
  try {
    const r = localStorage.getItem('qpwa3');
    if (r) DB = JSON.parse(r); else seed();
  } catch(e) { seed(); }
}

// ── SEED DATA ──────────────────────────────────────────
function seed() {
  DB.companies = [{
    id:'CO-001', name:'Acme Corporation', tagline:'Enterprise Solutions',
    address:'123 Business Ave\nNairobi, Kenya 00100',
    phone:'+254 700 000 000', email:'sales@acme.co.ke', website:'www.acme.co.ke',
    taxPin:'P051234567A',
    paymentMethods:[
      { type:'Bank', bankName:'Equity Bank Kenya', accName:'Acme Corporation Ltd',
        accNum:'0123456789', branch:'Westlands Branch', swift:'EQBLKENA' },
      { type:'M-Pesa', paybillBusiness:'123456', paybillAccount:'Invoice No.',
        tillNumber:'', mpesaName:'Acme Corporation' },
    ],
    paymentTerms:'Net 30',
    terms:'1. Payment is due within 30 days of invoice date.\n2. Late payments accrue 1.5% interest per month.\n3. All prices are quoted in KSh and subject to change without notice.\n4. Goods remain property of Acme Corporation until full payment is received.',
    logoText:'A', logoColor:'#1A73E8', logoImg:null,
  }];
  DB.settings.activeCompanyId = 'CO-001';

  DB.salespeople = [
    { id:'SP-001', name:'Sarah Kamau', title:'Senior Sales Executive',
      email:'sarah@acme.co.ke', phone:'+254 711 000 001', companyId:'CO-001' },
    { id:'SP-002', name:'Mike Odhiambo', title:'Account Manager',
      email:'mike@acme.co.ke', phone:'+254 711 000 002', companyId:'CO-001' },
  ];

  DB.customers = [
    { id:'CUS-001', companyId:'CO-001', company:'Nexus Technologies', contact:'Alex Chen',
      email:'alex@nexus.co.ke', phone:'+254 722 010 101', address:'Westlands, Nairobi',
      taxPin:'P051111111A', industry:'Technology', tier:'Gold', ltv:0 },
    { id:'CUS-002', companyId:'CO-001', company:'Pinnacle Group', contact:'Maria Santos',
      email:'m.santos@pinnacle.co.ke', phone:'+254 722 010 102', address:'Upper Hill, Nairobi',
      taxPin:'P052222222A', industry:'Finance', tier:'Platinum', ltv:0 },
    { id:'CUS-003', companyId:'CO-001', company:'Horizon Health', contact:'James Wright',
      email:'j.wright@horizon.co.ke', phone:'+254 722 010 103', address:'Karen, Nairobi',
      taxPin:'', industry:'Healthcare', tier:'Silver', ltv:0 },
    { id:'CUS-004', companyId:'CO-001', company:'Summit Retail', contact:'Sarah Kim',
      email:'s.kim@summit.co.ke', phone:'+254 722 010 104', address:'CBD, Nairobi',
      taxPin:'', industry:'Retail', tier:'Bronze', ltv:0 },
  ];

  DB.inventory = [
    { id:'ITM-001', companyId:'CO-001', name:'Enterprise Software License',
      category:'Software', unitCost:60000, markup:.50,
      description:'Full enterprise license with unlimited users.' },
    { id:'ITM-002', companyId:'CO-001', name:'Implementation Services (hr)',
      category:'Services', unitCost:7500, markup:.40,
      description:'Professional implementation and setup.' },
    { id:'ITM-003', companyId:'CO-001', name:'Annual Support Package',
      category:'Services', unitCost:40000, markup:.60,
      description:'12-month support and maintenance plan.' },
    { id:'ITM-004', companyId:'CO-001', name:'Hardware Server Unit',
      category:'Hardware', unitCost:175000, markup:.30,
      description:'High-performance rack server unit.' },
    { id:'ITM-005', companyId:'CO-001', name:'Network Switch 48-port',
      category:'Hardware', unitCost:32500, markup:.35,
      description:'Managed gigabit 48-port switch.' },
    { id:'ITM-006', companyId:'CO-001', name:'Training (per day)',
      category:'Services', unitCost:25000, markup:.50,
      description:'On-site or remote training sessions.' },
    { id:'ITM-007', companyId:'CO-001', name:'Cloud Storage (TB/month)',
      category:'Software', unitCost:1250, markup:.80,
      description:'Secure cloud storage per TB per month.' },
    { id:'ITM-008', companyId:'CO-001', name:'Security Suite License',
      category:'Software', unitCost:22500, markup:.55,
      description:'Comprehensive cybersecurity suite.' },
  ];

  DB.quotes = [
    { id:'QMS-2026-001', companyId:'CO-001', customerId:'CUS-002',
      date:'2026-01-05', validUntil:'2026-02-04', status:'Won',
      version:'v1', revision:'Initial proposal', salespersonId:'SP-001',
      notes:'Client approved on first presentation.', taxable:true, discount:0.05,
      items:[
        { itemId:'ITM-001', desc:'Enterprise Software License', qty:3, unitPrice:90000, discount:0 },
        { itemId:'ITM-002', desc:'Implementation Services (hr)', qty:40, unitPrice:10500, discount:0 },
        { itemId:'ITM-003', desc:'Annual Support Package', qty:1, unitPrice:64000, discount:0.05 },
      ]},
    { id:'QMS-2026-002', companyId:'CO-001', customerId:'CUS-003',
      date:'2026-02-01', validUntil:'2026-03-03', status:'Draft',
      version:'v1', revision:'Service expansion', salespersonId:'SP-001',
      notes:'Needs internal sign-off.', taxable:false, discount:0,
      items:[
        { itemId:'ITM-003', desc:'Annual Support Package', qty:3, unitPrice:64000, discount:0 },
        { itemId:'ITM-006', desc:'Training (per day)', qty:8, unitPrice:37500, discount:0 },
      ]},
    { id:'QMS-2026-003', companyId:'CO-001', customerId:'CUS-001',
      date:'2026-03-15', validUntil:'2026-04-14', status:'Sent',
      version:'v2', revision:'Revised scope', salespersonId:'SP-002',
      notes:'Board approval pending.', taxable:true, discount:0,
      items:[
        { itemId:'ITM-004', desc:'Hardware Server Unit', qty:2, unitPrice:227500, discount:0 },
        { itemId:'ITM-005', desc:'Network Switch 48-port', qty:4, unitPrice:43875, discount:0.10 },
        { itemId:'ITM-007', desc:'Cloud Storage (TB/month)', qty:12, unitPrice:2250, discount:0 },
      ]},
  ];
  save();
}

// ── HELPERS ────────────────────────────────────────────
const sym = () => DB.settings.currencySymbol || 'KSh';
function fmt(n) {
  return sym() + ' ' + Number(n||0).toLocaleString('en-KE',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); }
  catch { return d; }
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function v(id) { return (document.getElementById(id)||{}).value || ''; }

function activeCo() { return DB.companies.find(c=>c.id===DB.settings.activeCompanyId) || DB.companies[0] || null; }
function getCo(id)  { return DB.companies.find(c=>c.id===id) || null; }
function getCust(id){ return DB.customers.find(c=>c.id===id) || null; }
function getProd(id){ return DB.inventory.find(i=>i.id===id) || null; }
function getSP(id)  { return DB.salespeople.find(s=>s.id===id) || null; }
function getCategories() { return DB.settings.productCategories || ['Software','Hardware','Services','Other']; }

// Company-scoped data (fix #7 — only show active company's data)
function acoCusts() {
  const co = activeCo();
  return DB.customers.filter(c => !c.companyId || c.companyId === (co && co.id));
}
function acoInv() {
  const co = activeCo();
  return DB.inventory.filter(i => !i.companyId || i.companyId === (co && co.id));
}
function acoQuotes() {
  const co = activeCo();
  return DB.quotes.filter(q => !q.companyId || q.companyId === (co && co.id));
}
function acoSP() {
  const co = activeCo();
  return DB.salespeople.filter(s => !s.companyId || s.companyId === (co && co.id));
}

function calcTotals(q) {
  let sub = 0, cost = 0;
  (q.items||[]).forEach(li => {
    const p = getProd(li.itemId);
    const lt = li.unitPrice * (li.qty||1) * (1 - (li.discount||0));
    const lc = (p ? p.unitCost : li.unitPrice * 0.7) * (li.qty||1);
    sub += lt; cost += lc;
  });
  const discAmt = sub * (q.discount||0);
  const net     = sub - discAmt;
  const taxAmt  = q.taxable ? net * (DB.settings.taxRate||0.16) : 0;
  const total   = net + taxAmt;
  const margin  = net > 0 ? (net - cost) / net : 0;
  return { sub, discAmt, net, taxAmt, total, cost, margin };
}

function nextQID() {
  const yr  = new Date().getFullYear();
  const pfx = (DB.settings.quotePrefix||'QMS-') + yr + '-';
  const nums = DB.quotes.filter(q=>q.id.startsWith(pfx)).map(q=>parseInt(q.id.replace(pfx,''))||0);
  return pfx + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3,'0');
}

function isOverdue(q) { return q.status==='Sent' && new Date(q.validUntil) < new Date(); }
function chipCls(s)   { return `chip cs-${s||'Draft'}`; }
function avColor(name){
  const c=['#4285F4','#EA4335','#FBBC04','#34A853','#FF6D00','#7B1FA2','#00897B','#C62828'];
  let h=0; for(const ch of (name||'')) h=ch.charCodeAt(0)+((h<<5)-h);
  return c[Math.abs(h)%c.length];
}
function avLetter(n) { return (n||'?')[0].toUpperCase(); }

// ── NAVIGATION ──────────────────────────────────────────
function go(page) {
  curPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('on'));
  document.getElementById('page-' + page).classList.add('on');
  document.querySelectorAll('.nv').forEach(b => b.classList.toggle('on', b.dataset.p===page));
  const titles = {dashboard:'Quotes',quotes:'Quotes',inventory:'Products',customers:'Clients',settings:'Settings'};
  document.getElementById('tbar-title').textContent = titles[page] || 'Quotes';
  // FAB — always visible on these pages
  const fab = document.getElementById('fab');
  const lbl = document.getElementById('fab-lbl');
  const fabMap = {dashboard:'New Quote', quotes:'New Quote', inventory:'Add Product', customers:'Add Client'};
  if (fabMap[page]) {
    lbl.textContent = fabMap[page];
    fab.classList.remove('gone');
  } else {
    fab.classList.add('gone');
  }
  // Search btn
  document.getElementById('btn-srch').style.display = page==='quotes' ? 'flex' : 'none';
  renderPage(page);
}

function renderPage(p) {
  if (p==='dashboard')  renderDash();
  else if (p==='quotes')     renderQuotes();
  else if (p==='inventory')  renderInv();
  else if (p==='customers')  renderCusts();
  else if (p==='settings')   renderSettings();
}

function fabClick() {
  if (curPage==='dashboard'||curPage==='quotes') openQE(null);
  else if (curPage==='inventory') openInvEd(null);
  else if (curPage==='customers') openCustEd(null);
}

// ── DASHBOARD (fix #6 — auto-refresh, fix #7 — company scoped) ──
function renderDash() {
  const co = activeCo();
  document.getElementById('d-coname').textContent = co ? co.name : 'Set up a company profile';
  const qs  = acoQuotes();
  const sent = qs.filter(q=>q.status==='Sent').length;
  const won  = qs.filter(q=>q.status==='Won');
  const wonV = won.reduce((s,q)=>s+calcTotals(q).total, 0);
  const pipe = qs.filter(q=>q.status==='Sent').reduce((s,q)=>s+calcTotals(q).total, 0);
  const od   = qs.filter(isOverdue).length;

  document.getElementById('d-met').innerHTML = `
    <div class="mc bl"><div class="mv">${sent}</div><div class="mlb">Sent / Pending</div></div>
    <div class="mc gr"><div class="mv">${won.length}</div><div class="mlb">Won</div></div>
    <div class="mc"><div class="mv" style="font-size:17px;color:var(--P)">${fmt(wonV)}</div><div class="mlb">Revenue Won</div></div>
    <div class="mc re"><div class="mv">${od}</div><div class="mlb">Overdue</div></div>`;

  const stats = ['Draft','Sent','Won','Lost','Expired'];
  const cols  = {Draft:'#4285F4',Sent:'#F9AB00',Won:'#34A853',Lost:'#EA4335',Expired:'#9AA0A6'};
  const grp   = {};
  stats.forEach(s => { grp[s] = {n:0,v:0}; });
  qs.forEach(q => {
    const g = grp[q.status] || grp.Draft;
    g.n++; g.v += calcTotals(q).total;
  });
  const grand = Object.values(grp).reduce((s,v)=>s+v.v, 0);

  document.getElementById('d-pipe').innerHTML = stats.map(s => `
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;margin-bottom:3px">
        <div style="font-size:13px;font-weight:600;display:flex;align-items:center">
          <span class="cdot" style="background:${cols[s]}"></span>${s}
          <span style="margin-left:6px;background:${cols[s]};color:#fff;border-radius:999px;
            padding:1px 7px;font-size:11px;font-weight:700">${grp[s].n}</span>
        </div>
        <div style="font-size:13px;font-weight:700">${fmt(grp[s].v)}</div>
      </div>
      <div class="pbar">
        <div class="pfill" style="width:${grand?Math.round(grp[s].v/grand*100):0}%;background:${cols[s]}"></div>
      </div>
    </div>`).join('');

  const rec = [...qs].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
  document.getElementById('d-rec').innerHTML = rec.length
    ? rec.map(qItemHTML).join('')
    : `<div class="empty"><span class="material-icons-round">receipt_long</span>
       <div class="empty-t">No quotes yet</div>
       <div class="empty-s">Tap + to create your first quote</div></div>`;
}

// ── QUOTES ─────────────────────────────────────────────
function renderQuotes() {
  const srch = (document.getElementById('q-srch-in')||{}).value?.toLowerCase()||'';
  let list = acoQuotes().sort((a,b)=>b.date.localeCompare(a.date));
  if (qFilt !== 'all') list = list.filter(q=>q.status===qFilt);
  if (srch) list = list.filter(q=>
    q.id.toLowerCase().includes(srch) ||
    (getCust(q.customerId)||{}).company?.toLowerCase().includes(srch) ||
    (getSP(q.salespersonId)||{}).name?.toLowerCase().includes(srch)
  );
  const el = document.getElementById('q-list');
  el.innerHTML = list.length ? list.map(qItemHTML).join('')
    : `<div class="empty"><span class="material-icons-round">search_off</span>
       <div class="empty-t">No quotes found</div>
       <div class="empty-s">Try a different filter or create a new quote</div></div>`;
}

function qItemHTML(q) {
  const cust = getCust(q.customerId);
  const sp   = getSP(q.salespersonId);
  const tots = calcTotals(q);
  const od   = isOverdue(q);
  return `<div class="qi" onclick="openQD('${q.id}')">
    <div class="qi-top">
      <span class="qi-id">${q.id}</span>
      <span class="qi-amt">${fmt(tots.total)}</span>
    </div>
    <div class="qi-co">${cust?.company||'Unknown Customer'}</div>
    <div style="font-size:12px;color:var(--t2)">${cust?.contact||''}${sp?' · '+sp.name:''}</div>
    <div class="qi-meta">
      <div style="display:flex;align-items:center">
        ${od?'<span style="width:7px;height:7px;border-radius:50%;background:var(--E);display:inline-block;margin-right:5px"></span>':''}
        <span class="qi-date">${fmtDate(q.date)} · until ${fmtDate(q.validUntil)}</span>
      </div>
      <span class="${chipCls(q.status)}">${q.status}</span>
    </div>
  </div>`;
}

function setQF(s) {
  qFilt = s;
  document.querySelectorAll('#q-fbar .fc').forEach(c=>c.classList.toggle('on',c.textContent.trim()===s||(s==='all'&&c.textContent.trim()==='All')));
  renderQuotes();
}

function toggleSearch() {
  const w = document.getElementById('q-srch-wrap');
  const show = w.style.display==='none'||!w.style.display;
  w.style.display = show ? 'block' : 'none';
  if (show) setTimeout(()=>document.getElementById('q-srch-in')?.focus(), 50);
}
function closeSearch() {
  document.getElementById('q-srch-wrap').style.display='none';
  const el=document.getElementById('q-srch-in'); if(el) el.value='';
  renderQuotes();
}

// ── QUOTE DETAIL ───────────────────────────────────────
function openQD(qid) {
  curQID = qid;
  const q    = DB.quotes.find(x=>x.id===qid); if (!q) return;
  const cust = getCust(q.customerId);
  const sp   = getSP(q.salespersonId);
  const co   = getCo(q.companyId);
  const tots = calcTotals(q);
  const mc   = tots.margin < DB.settings.minMargin  ? 'var(--E)'
              : tots.margin < DB.settings.warnMargin ? '#E65100' : 'var(--S)';

  document.getElementById('qd-id').textContent = q.id;

  const itemsH = (q.items||[]).map(li => {
    const lt = li.unitPrice*(li.qty||1)*(1-(li.discount||0));
    return `<div class="dr">
      <div style="flex:1">
        <div style="font-size:14px;font-weight:600">${li.desc||li.itemId}</div>
        <div style="font-size:12px;color:var(--t2)">${li.qty} × ${fmt(li.unitPrice)}${li.discount?' (−'+Math.round(li.discount*100)+'%)':''}</div>
      </div>
      <div style="font-size:14px;font-weight:700;flex-shrink:0">${fmt(lt)}</div>
    </div>`;
  }).join('');

  document.getElementById('qd-body').innerHTML = `
    <div style="padding:12px 16px 14px;background:var(--su2);border-bottom:1px solid var(--ol2);display:flex;align-items:center;justify-content:space-between">
      <div>
        <div style="font-size:26px;font-weight:800">${fmt(tots.total)}</div>
        <div style="font-size:13px;color:var(--t2)">${cust?.company||'—'}</div>
      </div>
      <span class="${chipCls(q.status)}" style="font-size:13px;padding:5px 12px">${q.status}</span>
    </div>
    <div class="db2"><div class="dh2"><span class="dht">Quote Info</span></div>
      <div class="dr"><span class="dk">Company</span><span class="dv">${co?.name||'—'}</span></div>
      <div class="dr"><span class="dk">Customer</span><span class="dv">${cust?.company||'—'}</span></div>
      <div class="dr"><span class="dk">Contact</span><span class="dv">${cust?.contact||'—'} · ${cust?.phone||'—'}</span></div>
      <div class="dr"><span class="dk">Sales Person</span><span class="dv">${sp?.name||'—'}${sp?.phone?' · '+sp.phone:''}</span></div>
      <div class="dr"><span class="dk">Date</span><span class="dv">${fmtDate(q.date)}</span></div>
      <div class="dr"><span class="dk">Valid Until</span><span class="dv">${fmtDate(q.validUntil)}</span></div>
      <div class="dr"><span class="dk">Version</span><span class="dv">${q.version||'v1'}</span></div>
      ${q.revision?`<div class="dr"><span class="dk">Revision</span><span class="dv">${q.revision}</span></div>`:''}
    </div>
    <div class="db2"><div class="dh2"><span class="dht">Line Items</span></div>${itemsH}</div>
    <div class="tots">
      <div class="tr2"><span class="tk">Subtotal</span><span class="tv">${fmt(tots.sub)}</span></div>
      ${tots.discAmt>0?`<div class="tr2"><span class="tk">Discount</span><span class="tv" style="color:var(--S)">− ${fmt(tots.discAmt)}</span></div>`:''}
      <div class="tr2"><span class="tk">Net Amount</span><span class="tv">${fmt(tots.net)}</span></div>
      <div class="tr2"><span class="tk">${q.taxable?DB.settings.taxLabel:'Tax Exempt'}</span><span class="tv">${q.taxable?fmt(tots.taxAmt):'—'}</span></div>
      <div class="tr2 grand"><span class="tk">Grand Total</span><span class="tv">${fmt(tots.total)}</span></div>
    </div>
    <div class="db2"><div class="dh2"><span class="dht">Margin Analysis</span>
      <span style="font-size:14px;font-weight:800;color:${mc}">${Math.round(tots.margin*100)}%</span></div>
      <div class="dr"><span class="dk">Revenue</span><span class="dv">${fmt(tots.net)}</span></div>
      <div class="dr"><span class="dk">Cost</span><span class="dv">${fmt(tots.cost)}</span></div>
      <div class="dr"><span class="dk">Gross Profit</span><span class="dv" style="color:${mc}">${fmt(tots.net-tots.cost)}</span></div>
      <div class="dr"><span class="dk">Margin %</span><span class="dv" style="color:${mc}">${Math.round(tots.margin*100)}%${tots.margin<DB.settings.minMargin?' ⚠':''}</span></div>
    </div>
    ${q.notes?`<div class="db2"><div class="dh2"><span class="dht">Notes</span></div>
      <div style="padding:12px 16px;font-size:14px;color:var(--t2);line-height:1.6">${q.notes}</div></div>`:''}
    <div style="padding:14px 16px 8px;display:flex;gap:10px">
      <button class="btn bo" style="flex:1" onclick="editQuoteFromDetail('${q.id}')">
        <span class="material-icons-round">edit</span> Edit
      </button>
      <button class="btn bd2" style="flex:1" onclick="confirmAct('Delete this quote permanently?',()=>delItem('quote','${q.id}'))">
        <span class="material-icons-round">delete</span> Del
      </button>
    </div>
    <div style="padding:0 16px 20px">
      <button class="btn bp" style="width:100%" onclick="openPreview('${q.id}')">
        <span class="material-icons-round">picture_as_pdf</span> Export PDF Report
      </button>
    </div>
    <div style="height:20px"></div>`;
  openDlg('dlg-qd');
}

function openQAct() {
  const q = DB.quotes.find(x=>x.id===curQID); if (!q) return;
  const others = ['Draft','Sent','Won','Lost','Expired'].filter(s=>s!==q.status);
  document.getElementById('qact-body').innerHTML = `
    <div class="si" onclick="editQuoteFromAction('${q.id}')">
      <div class="si-ic"><span class="material-icons-round">edit</span></div>
      <div class="si-tx"><div class="si-m">Edit Quote</div></div>
    </div>
    <div class="si" onclick="dupQ('${q.id}')">
      <div class="si-ic"><span class="material-icons-round">content_copy</span></div>
      <div class="si-tx"><div class="si-m">Duplicate Quote</div></div>
    </div>
    ${others.map(s=>`<div class="si" onclick="setQStat('${q.id}','${s}')">
      <div class="si-ic"><span class="material-icons-round">label</span></div>
      <div class="si-tx"><div class="si-m">Mark as ${s}</div></div>
    </div>`).join('')}
    <div class="si" onclick="openPreview('${q.id}');closeDlg('dlg-qact')">
      <div class="si-ic"><span class="material-icons-round">preview</span></div>
      <div class="si-tx"><div class="si-m">Print Preview</div></div>
    </div>
    <div class="si" onclick="doPDFById('${q.id}');closeDlg('dlg-qact')">
      <div class="si-ic"><span class="material-icons-round">picture_as_pdf</span></div>
      <div class="si-tx"><div class="si-m">Export to PDF</div></div>
    </div>
    <div class="si" onclick="openShareDialog('${q.id}');closeDlg('dlg-qact')">
      <div class="si-ic"><span class="material-icons-round">share</span></div>
      <div class="si-tx"><div class="si-m">Share Quote</div></div>
    </div>
    <div class="si" onclick="confirmAct('Delete this quote permanently?',()=>delItem('quote','${q.id}'))">
      <div class="si-ic red"><span class="material-icons-round">delete</span></div>
      <div class="si-tx"><div class="si-m txt-e">Delete Quote</div></div>
    </div>`;
  openDlg('dlg-qact');
}

// Fix: Edit from action — close both dialogs then open editor
function editQuoteFromAction(qid) {
  closeDlg('dlg-qact');
  closeDlg('dlg-qd');
  // Small delay to let dialogs close before opening editor
  setTimeout(() => openQE(qid), 120);
}

function setQStat(qid, s) {
  const q = DB.quotes.find(x=>x.id===qid);
  if (q) { q.status = s; save(); }
  closeDlg('dlg-qact');
  openQD(qid);
  if (curPage==='dashboard') renderDash();
  snack('Marked as ' + s);
}

function dupQ(qid) {
  const q = DB.quotes.find(x=>x.id===qid); if (!q) return;
  const nq = JSON.parse(JSON.stringify(q));
  nq.id = nextQID();
  nq.date = new Date().toISOString().slice(0,10);
  const vd = new Date(); vd.setDate(vd.getDate()+(DB.settings.quoteValidDays||30));
  nq.validUntil = vd.toISOString().slice(0,10);
  nq.status  = 'Draft'; nq.version = 'v1'; nq.revision = 'Copy of '+q.id;
  DB.quotes.unshift(nq); save();
  closeDlg('dlg-qact'); closeDlg('dlg-qd');
  renderPage(curPage);
  snack('Duplicated as '+nq.id);
  setTimeout(()=>openQD(nq.id), 320);
}

// ── QUOTE EDITOR (fix #4 — all buttons work) ──────────
function openQE(qid) {
  qeStep = 0;
  const co = activeCo();
  qeD = qid ? JSON.parse(JSON.stringify(DB.quotes.find(x=>x.id===qid)||{})) : {
    id: nextQID(), companyId: co?.id||'', customerId:'',
    date: new Date().toISOString().slice(0,10),
    validUntil: (() => { const d=new Date(); d.setDate(d.getDate()+(DB.settings.quoteValidDays||30)); return d.toISOString().slice(0,10); })(),
    status:'Draft', version:'v1', revision:'', salespersonId: acoSP()[0]?.id||'',
    notes:'', taxable:true, discount:0, items:[],
  };
  document.getElementById('qe-ttl').textContent = qid ? 'Edit Quote' : 'New Quote';
  renderQEStep();
  openDlg('dlg-qe');
}

function renderQEStep() {
  for (let i=0; i<4; i++) {
    const d = document.getElementById('sd'+i);
    d.className = 'sd' + (i<qeStep?' d': i===qeStep?' a':'');
    if (i<3) document.getElementById('sl'+i).className = 'sl'+(i<qeStep?' d':'');
  }
  document.getElementById('qe-bk').style.display = qeStep>0 ? '' : 'none';
  document.getElementById('qe-nx').textContent   = qeStep===3 ? '✓ Save Quote' : 'Next →';
  const body = document.getElementById('qe-body');
  if (qeStep===0) renderQE0(body);
  if (qeStep===1) renderQE1(body);
  if (qeStep===2) renderQE2(body);
  if (qeStep===3) renderQE3(body);
}

function renderQE0(body) {
  const cos = DB.companies;
  const sps = acoSP();
  body.innerHTML = `
    <div class="fg"><label class="fl">Quote ID</label>
      <input class="fi" id="qe-id" value="${qeD.id}" readonly></div>
    <div class="fr">
      <div class="fg"><label class="fl">Quote Date *</label>
        <input class="fi" type="date" id="qe-date" value="${qeD.date}"></div>
      <div class="fg"><label class="fl">Valid Until *</label>
        <input class="fi" type="date" id="qe-valid" value="${qeD.validUntil}"></div>
    </div>
    <div class="fr">
      <div class="fg"><label class="fl">Status</label>
        <select class="fi" id="qe-status">
          ${['Draft','Sent','Won','Lost','Expired'].map(s=>`<option${s===qeD.status?' selected':''}>${s}</option>`).join('')}
        </select></div>
      <div class="fg"><label class="fl">Version</label>
        <input class="fi" id="qe-ver" value="${qeD.version||'v1'}"></div>
    </div>
    <div class="fg"><label class="fl">Sales Person</label>
      <select class="fi" id="qe-sp">
        <option value="">— None —</option>
        ${sps.map(s=>`<option value="${s.id}"${s.id===qeD.salespersonId?' selected':''}>${s.name} — ${s.title||''}</option>`).join('')}
      </select></div>
    <div class="fg"><label class="fl">Company Profile</label>
      <select class="fi" id="qe-co">
        ${cos.map(c=>`<option value="${c.id}"${c.id===qeD.companyId?' selected':''}>${c.name}</option>`).join('')}
      </select></div>
    <div class="fr">
      <div class="fg"><label class="fl">Overall Discount %</label>
        <input class="fi" type="number" id="qe-disc" value="${Math.round((qeD.discount||0)*100)}" min="0" max="100"></div>
      <div class="fg">
        <label class="fl" style="display:flex;justify-content:space-between;align-items:center">
          Taxable
          <button class="tog ${qeD.taxable?'on':''}" id="qe-tax"
            onclick="this.classList.toggle('on')"></button>
        </label>
        <div style="height:40px"></div>
      </div>
    </div>
    <div class="fg"><label class="fl">Revision Note</label>
      <input class="fi" id="qe-rev" value="${qeD.revision||''}" placeholder="e.g. Initial proposal"></div>`;
}

function renderQE1(body) {
  const custs = acoCusts();
  body.innerHTML = `
    <div class="fg"><label class="fl">Select Customer *</label>
      <select class="fi" id="qe-cust" onchange="previewCust()">
        <option value="">— Select a customer —</option>
        ${custs.map(c=>`<option value="${c.id}"${c.id===qeD.customerId?' selected':''}>${c.company} — ${c.contact}</option>`).join('')}
      </select></div>
    <div id="qe-cust-prev"></div>
    <div style="text-align:center;padding:10px 0;color:var(--t2);font-size:13px">— or —</div>
    <button class="btn bo btn-w" onclick="openCustEd(null,true)">
      <span class="material-icons-round">person_add</span> Create New Customer
    </button>`;
  previewCust();
}

function previewCust() {
  const id  = v('qe-cust');
  const el  = document.getElementById('qe-cust-prev'); if (!el) return;
  const c   = getCust(id);
  if (!c) { el.innerHTML=''; return; }
  el.innerHTML = `<div class="db2" style="margin:8px 0">
    <div class="dr"><span class="dk">Company</span><span class="dv">${c.company}</span></div>
    <div class="dr"><span class="dk">Contact</span><span class="dv">${c.contact}</span></div>
    <div class="dr"><span class="dk">Email</span><span class="dv">${c.email||'—'}</span></div>
    <div class="dr"><span class="dk">Phone</span><span class="dv">${c.phone||'—'}</span></div>
    <div class="dr"><span class="dk">Tier</span><span class="dv">
      <span class="tier-${c.tier||'Bronze'}">${c.tier||'Bronze'}</span></span></div>
  </div>`;
}

function renderQE2(body) {
  if (!qeD.items) qeD.items = [];
  body.innerHTML = `<div id="qe-items"></div>
    <button class="btn btn-ton btn-w" style="margin-top:6px" onclick="addLI()">
      <span class="material-icons-round">add</span> Add Line Item
    </button>`;
  renderQEItems();
}

function renderQEItems() {
  const el = document.getElementById('qe-items'); if (!el) return;
  if (!qeD.items.length) {
    el.innerHTML = `<div class="empty" style="padding:28px">
      <span class="material-icons-round">playlist_add</span>
      <div class="empty-t">No items yet</div>
      <div class="empty-s">Type to search from your ${acoInv().length} products</div></div>`;
    return;
  }
  el.innerHTML = qeD.items.map((li,i) => {
    const lt = li.unitPrice * (li.qty||1) * (1-(li.discount||0));
    const prod = getProd(li.itemId);
    return `<div class="lir" id="lir-${i}">
      <div class="lir-top">
        <div style="flex:1;position:relative">
          <input class="fi ac-input" id="ac-input-${i}"
            style="width:100%;font-size:13px;padding-right:32px"
            placeholder="Type to search products…"
            value="${(li.desc||'').replace(/"/g,'&quot;')}"
            autocomplete="off"
            oninput="acSearch(${i},this.value)"
            onfocus="acSearch(${i},this.value)"
            onkeydown="acKeydown(event,${i})">
          ${prod ? `<span class="material-icons-round" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:16px;color:var(--S);pointer-events:none">check_circle</span>` : ''}
          <div class="ac-dropdown" id="ac-drop-${i}" style="display:none"></div>
        </div>
        <button class="ib" style="background:var(--E);color:#fff;width:30px;height:30px;border-radius:8px;flex-shrink:0"
          onclick="removeLI(${i})"><span class="material-icons-round" style="font-size:16px">close</span></button>
      </div>
      ${prod ? `<div style="font-size:11px;color:var(--t2);margin:-4px 0 6px;padding-left:2px">
        <span style="background:var(--PC);color:var(--P);border-radius:4px;padding:1px 6px;font-weight:600;font-size:10px">${prod.category}</span>
        &nbsp;${prod.id}
      </div>` : ''}
      <div class="fr3">
        <div><div class="fl" style="margin-bottom:4px">Qty</div>
          <input class="fi" type="number" id="li-qty-${i}" value="${li.qty||1}" min="1"
            onchange="liFieldChg(${i},'qty',parseFloat(this.value)||1)"></div>
        <div><div class="fl" style="margin-bottom:4px">Unit Price</div>
          <input class="fi" type="number" id="li-price-${i}" value="${li.unitPrice||0}" step="0.01"
            onchange="liFieldChg(${i},'unitPrice',parseFloat(this.value)||0)"></div>
        <div><div class="fl" style="margin-bottom:4px">Disc %</div>
          <input class="fi" type="number" id="li-disc-${i}" value="${Math.round((li.discount||0)*100)}" min="0" max="100"
            onchange="liFieldChg(${i},'discount',(parseFloat(this.value)||0)/100)"></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:5px">
        <span style="font-size:12px;color:var(--t2)">${prod ? prod.name : (li.itemId ? '' : 'Custom item')}</span>
        <span style="font-weight:800;font-size:14px;color:var(--P)">${fmt(lt)}</span>
      </div>
    </div>`;
  }).join('');
}

// Autocomplete search — filters products as user types
function acSearch(i, query) {
  const drop = document.getElementById('ac-drop-' + i);
  if (!drop) return;
  const q = query.trim().toLowerCase();

  // Close if empty
  if (!q) { drop.style.display = 'none'; return; }

  const prods = acoInv();
  // Score: name starts-with > name contains > description contains
  const results = prods
    .map(p => {
      const nm  = p.name.toLowerCase();
      const id  = p.id.toLowerCase();
      const dsc = (p.description||'').toLowerCase();
      let score = 0;
      if (nm.startsWith(q))        score = 3;
      else if (nm.includes(q))     score = 2;
      else if (id.includes(q))     score = 1;
      else if (dsc.includes(q))    score = 0.5;
      return { p, score };
    })
    .filter(x => x.score > 0)
    .sort((a,b) => b.score - a.score)
    .slice(0, 8); // max 8 results

  if (!results.length) {
    // Show "add as custom" option
    drop.innerHTML = `
      <div class="ac-item ac-custom" onclick="acSelectCustom(${i},'${query.replace(/'/g,"\\'")}')">
        <span class="material-icons-round" style="font-size:18px;color:var(--P)">add_circle</span>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600">Use "${query}" as custom item</div>
          <div style="font-size:11px;color:var(--t2)">Enter price manually</div>
        </div>
      </div>`;
    drop.style.display = 'block';
    return;
  }

  drop.innerHTML = results.map(({p}) => {
    const price = p.unitCost * (1 + p.markup);
    const nm    = p.name;
    // Highlight matching portion
    const idx   = nm.toLowerCase().indexOf(q);
    const highlighted = idx >= 0
      ? nm.slice(0,idx) + '<mark style="background:var(--PC);color:var(--P);border-radius:2px;padding:0 1px">' + nm.slice(idx, idx+q.length) + '</mark>' + nm.slice(idx+q.length)
      : nm;
    return `<div class="ac-item" onclick="acSelectProd(${i},'${p.id}')">
      <span class="material-icons-round" style="font-size:18px;color:var(--t2)">inventory_2</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${highlighted}</div>
        <div style="font-size:11px;color:var(--t2)">${p.id} &nbsp;·&nbsp; <span style="background:var(--PC);color:var(--P);border-radius:3px;padding:0 4px;font-size:10px;font-weight:600">${p.category}</span></div>
      </div>
      <div style="font-size:13px;font-weight:700;color:var(--P);flex-shrink:0">${fmt(price)}</div>
    </div>`;
  }).join('');

  // Custom item option at bottom
  drop.innerHTML += `<div class="ac-item ac-custom" onclick="acSelectCustom(${i},'${query.replace(/'/g,"\\'")}')">
    <span class="material-icons-round" style="font-size:18px;color:var(--t2)">edit</span>
    <div style="flex:1"><div style="font-size:13px;font-weight:500;color:var(--t2)">Use "${query}" as custom description</div></div>
  </div>`;

  drop.style.display = 'block';
}

// Select a product from the dropdown
function acSelectProd(i, prodId) {
  const p = getProd(prodId); if (!p) return;
  qeD.items[i].itemId    = p.id;
  qeD.items[i].desc      = p.name;
  qeD.items[i].unitPrice = p.unitCost * (1 + p.markup);
  // Close dropdown then re-render this row
  const drop = document.getElementById('ac-drop-' + i);
  if (drop) drop.style.display = 'none';
  renderQEItems();
  // Slight delay then focus qty field for fast entry
  setTimeout(() => {
    const qty = document.getElementById('li-qty-' + i);
    if (qty) qty.select();
  }, 50);
}

// Select a custom item (not in catalogue)
function acSelectCustom(i, desc) {
  qeD.items[i].itemId    = '';
  qeD.items[i].desc      = desc;
  qeD.items[i].unitPrice = qeD.items[i].unitPrice || 0;
  const drop = document.getElementById('ac-drop-' + i);
  if (drop) drop.style.display = 'none';
  renderQEItems();
  setTimeout(() => {
    const pr = document.getElementById('li-price-' + i);
    if (pr) pr.select();
  }, 50);
}

// Keyboard navigation in autocomplete
function acKeydown(event, i) {
  const drop = document.getElementById('ac-drop-' + i);
  if (!drop || drop.style.display === 'none') return;
  const items = drop.querySelectorAll('.ac-item');
  if (!items.length) return;
  let active = drop.querySelector('.ac-item.ac-active');
  let idx = Array.from(items).indexOf(active);

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    idx = Math.min(idx + 1, items.length - 1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    idx = Math.max(idx - 1, 0);
  } else if (event.key === 'Enter' && active) {
    event.preventDefault();
    active.click();
    return;
  } else if (event.key === 'Escape') {
    drop.style.display = 'none';
    return;
  } else {
    return;
  }

  items.forEach(el => el.classList.remove('ac-active'));
  if (idx >= 0) {
    items[idx].classList.add('ac-active');
    items[idx].scrollIntoView({ block:'nearest' });
  }
}

// Close all dropdowns when clicking outside
document.addEventListener('click', e => {
  if (!e.target.closest('.lir')) {
    document.querySelectorAll('.ac-dropdown').forEach(d => d.style.display = 'none');
  }
});

function addLI() { qeD.items.push({itemId:'',desc:'',qty:1,unitPrice:0,discount:0}); renderQEItems(); }
function removeLI(i) { qeD.items.splice(i,1); renderQEItems(); }

// liFieldChg updates a field WITHOUT re-rendering (preserves focus)
function liFieldChg(i, f, val) {
  if (!qeD.items[i]) return;
  qeD.items[i][f] = val;
  // Just update the line total display in-place
  const lt = qeD.items[i].unitPrice * (qeD.items[i].qty||1) * (1-(qeD.items[i].discount||0));
  const lir = document.getElementById('lir-' + i);
  if (lir) {
    const totEl = lir.querySelector('span[style*="font-weight:800"]');
    if (totEl) totEl.textContent = fmt(lt);
  }
}

// Legacy liChg kept for safety
function liChg(i, f, val) {
  if (!qeD.items[i]) return;
  qeD.items[i][f] = val;
  if (f==='itemId' && val) {
    const p = getProd(val);
    if (p) { qeD.items[i].desc=p.name; qeD.items[i].unitPrice=p.unitCost*(1+p.markup); }
  }
  renderQEItems();
}

function renderQE3(body) {
  collectQE(qeStep);
  const q = qeD, cust = getCust(q.customerId), tots = calcTotals(q);
  const mc = tots.margin < DB.settings.minMargin  ? 'var(--E)'
           : tots.margin < DB.settings.warnMargin ? '#E65100' : 'var(--S)';
  body.innerHTML = `
    <div style="background:var(--su2);border-radius:12px;padding:16px;margin-bottom:14px">
      <div style="font-size:12px;color:var(--t2)">Total</div>
      <div style="font-size:28px;font-weight:800;color:var(--P);line-height:1">${fmt(tots.total)}</div>
      <div style="font-size:13px;color:${mc};margin-top:5px">Margin: ${Math.round(tots.margin*100)}%${tots.margin<DB.settings.minMargin?' ⚠ Below minimum':''}</div>
    </div>
    <div class="db2" style="margin:0 0 12px">
      <div class="dr"><span class="dk">Quote ID</span><span class="dv">${q.id}</span></div>
      <div class="dr"><span class="dk">Customer</span><span class="dv">${cust?.company||'—'}</span></div>
      <div class="dr"><span class="dk">Sales Person</span><span class="dv">${getSP(q.salespersonId)?.name||'—'}</span></div>
      <div class="dr"><span class="dk">Status</span><span class="dv"><span class="${chipCls(q.status)}">${q.status}</span></span></div>
      <div class="dr"><span class="dk">Valid Until</span><span class="dv">${fmtDate(q.validUntil)}</span></div>
      <div class="dr"><span class="dk">Items</span><span class="dv">${(q.items||[]).length} line item(s)</span></div>
    </div>
    <div class="tots">
      <div class="tr2"><span class="tk">Subtotal</span><span class="tv">${fmt(tots.sub)}</span></div>
      ${tots.discAmt>0?`<div class="tr2"><span class="tk">Discount</span><span class="tv" style="color:var(--S)">−${fmt(tots.discAmt)}</span></div>`:''}
      <div class="tr2"><span class="tk">Net Amount</span><span class="tv">${fmt(tots.net)}</span></div>
      <div class="tr2"><span class="tk">${q.taxable?DB.settings.taxLabel:'Tax Exempt'}</span><span class="tv">${q.taxable?fmt(tots.taxAmt):'—'}</span></div>
      <div class="tr2 grand"><span class="tk">Grand Total</span><span class="tv">${fmt(tots.total)}</span></div>
    </div>
    <div class="fg" style="margin-top:14px"><label class="fl">Notes / Additional Terms</label>
      <textarea class="fi" id="qe-notes" placeholder="Special conditions, delivery notes…">${q.notes||''}</textarea>
    </div>`;
}

function collectQE(step) {
  if (step===0) {
    qeD.date         = v('qe-date')   || qeD.date;
    qeD.validUntil   = v('qe-valid')  || qeD.validUntil;
    qeD.status       = v('qe-status') || qeD.status;
    qeD.salespersonId= v('qe-sp');
    qeD.companyId    = v('qe-co')     || qeD.companyId;
    qeD.version      = v('qe-ver')    || qeD.version;
    qeD.discount     = (parseFloat(v('qe-disc'))||0)/100;
    qeD.taxable      = !!document.getElementById('qe-tax')?.classList.contains('on');
    qeD.revision     = v('qe-rev');
  }
  if (step===1) { qeD.customerId = v('qe-cust') || qeD.customerId; }
  if (step===3) { qeD.notes = v('qe-notes'); }
}

function qeNext() {
  collectQE(qeStep);
  if (qeStep===3) { qeSave(); return; }
  if (qeStep===1 && !qeD.customerId) { snack('Please select a customer first'); return; }
  qeStep++; renderQEStep();
}
function qeBack() { collectQE(qeStep); if(qeStep>0){ qeStep--; renderQEStep(); } }
function qeSave() {
  collectQE(qeStep);
  if (!qeD.customerId)                { snack('Please select a customer'); qeStep=1; renderQEStep(); return; }
  if (!qeD.items||!qeD.items.length) { snack('Add at least one item');    qeStep=2; renderQEStep(); return; }
  const idx = DB.quotes.findIndex(q=>q.id===qeD.id);
  if (idx>=0) DB.quotes[idx] = qeD; else DB.quotes.unshift(qeD);
  save();
  closeDlg('dlg-qe');
  renderPage(curPage);
  snack(qeD.id+' saved ✓');
  setTimeout(()=>openQD(qeD.id), 350);
}

// Edit from detail view — close detail then open editor immediately
function editQuoteFromDetail(qid) {
  closeDlg('dlg-qd');
  setTimeout(() => openQE(qid), 120);
}

// ── PRINT PREVIEW — matches sample invoice layout ──────
function openPreview(qid) {
  curQID = qid;
  buildPreview(qid);
  openDlg('dlg-prev');
}

function numberToWords(n) {
  const ones=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
    'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  if (n===0) return 'Zero';
  function conv(n) {
    if (n<20) return ones[n];
    if (n<100) return tens[Math.floor(n/10)]+(n%10?' '+ones[n%10]:'');
    return ones[Math.floor(n/100)]+' Hundred'+(n%100?' '+conv(n%100):'');
  }
  const millions=Math.floor(n/1000000);
  const thousands=Math.floor((n%1000000)/1000);
  const remainder=n%1000;
  let result='';
  if (millions)   result+=conv(millions)+' Million ';
  if (thousands)  result+=conv(thousands)+' Thousand ';
  if (remainder)  result+=conv(remainder);
  return result.trim();
}

function amountInWords(total) {
  const sym   = DB.settings.currencySymbol || 'KSh';
  const int   = Math.floor(total);
  const cents = Math.round((total - int)*100);
  let w = sym + ' ' + numberToWords(int) + ' Only';
  if (cents>0) w += ' and ' + numberToWords(cents) + ' Cents';
  return w;
}

function buildPreview(qid) {
  const q    = DB.quotes.find(x=>x.id===qid); if (!q) return;
  const co   = getCo(q.companyId) || activeCo();
  const cust = getCust(q.customerId);
  const sp   = getSP(q.salespersonId);
  const tots = calcTotals(q);
  const acc  = ACCENTS.find(a=>a.name===DB.settings.accentName) || ACCENTS[0];
  const accentColor = acc.lc; // always use light color for print

  // Status badge
  const stBg  = {Draft:'#E8F0FE',Sent:'#FFF3E0',Won:'#E8F5E9',Lost:'#FFEBEE',Expired:'#F5F5F5'};
  const stCol = {Draft:'#1565C0',Sent:'#BF360C',Won:'#1B5E20',Lost:'#B71C1C',Expired:'#616161'};

  const logoHTML = co?.logoImg
    ? `<div class="qv-logo-img"><img src="${co.logoImg}" alt="logo"></div>`
    : `<div class="qv-logo-img" style="background:${co?.logoColor||accentColor}">${co?.logoText||'A'}</div>`;

  // Build items rows
  const rows = (q.items||[]).map((li,i) => {
    const lt = li.unitPrice*(li.qty||1)*(1-(li.discount||0));
    return `<tr>
      <td>${i+1}.</td>
      <td><div class="qv-tbl-desc">${li.desc||li.itemId}</div></td>
      <td>${li.qty||1}</td>
      <td>${fmt(li.unitPrice)}</td>
      <td>${li.discount?'−'+Math.round(li.discount*100)+'%':'—'}</td>
      <td>${fmt(lt)}</td>
    </tr>`;
  }).join('');

  // Payment methods block
  const pmHTML = (co?.paymentMethods||[]).map(pm => {
    if (pm.type==='Bank') return `
      <div class="qv-pay-block">
        <div class="qv-pay-type" style="color:${accentColor}">🏦 Bank Transfer</div>
        ${pm.bankName?`<div class="qv-pay-row">Bank: <b>${pm.bankName}</b></div>`:''}
        ${pm.branch?`<div class="qv-pay-row">Branch: <b>${pm.branch}</b></div>`:''}
        ${pm.accName?`<div class="qv-pay-row">Account: <b>${pm.accName}</b></div>`:''}
        ${pm.accNum?`<div class="qv-pay-row">A/C No: <b>${pm.accNum}</b></div>`:''}
        ${pm.swift?`<div class="qv-pay-row">SWIFT: <b>${pm.swift}</b></div>`:''}
      </div>`;
    if (pm.type==='M-Pesa') return `
      <div class="qv-pay-block">
        <div class="qv-pay-type" style="color:#4CAF50">📱 M-Pesa</div>
        ${pm.paybillBusiness?`<div class="qv-pay-row">Paybill: <b>${pm.paybillBusiness}</b></div>`:''}
        ${pm.paybillAccount?`<div class="qv-pay-row">Account: <b>${pm.paybillAccount}</b></div>`:''}
        ${pm.tillNumber?`<div class="qv-pay-row">Till No: <b>${pm.tillNumber}</b></div>`:''}
        ${pm.mpesaName?`<div class="qv-pay-row">Name: <b>${pm.mpesaName}</b></div>`:''}
      </div>`;
    return `<div class="qv-pay-block">
      <div class="qv-pay-type">${pm.type}</div>
      <div class="qv-pay-row">${pm.details||''}</div>
    </div>`;
  }).join('');

  // Terms list — fully inline-styled so html2canvas clone renders identically
  const termsItems = (co?.terms||'').split('\n').filter(t=>t.trim())
    .map((t,i)=>{
      const text = t.replace(/^\d+\.\s*/,'');
      return `<div style="display:flex;gap:8px;margin-bottom:4px;align-items:flex-start">
        <span style="font-size:8pt;color:${accentColor};font-weight:700;flex-shrink:0;min-width:16px;line-height:1.7">${i+1}.</span>
        <span style="font-size:8pt;color:#555;line-height:1.7">${text}</span>
      </div>`;
    }).join('');

  const watermark = {Won:'ACCEPTED',Lost:'DECLINED',Draft:'DRAFT'}[q.status]||'';

  // Set CSS accent variable and force consistent font (critical for offline PDF matching online)
  const docEl = document.getElementById('prev-doc');
  docEl.style.setProperty('--qAccent', accentColor);
  // Force the full font stack explicitly so html2canvas uses the same font online and offline
  docEl.style.fontFamily = "'Inter', ui-sans-serif, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
  docEl.style.letterSpacing = '-0.01em';
  docEl.style.wordSpacing   = '0.01em';

  docEl.innerHTML = `
    ${watermark?`<div class="qv-wm">${watermark}</div>`:''}

    <!-- HEADER ROW -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">
      <div>
        <div class="qv-title" style="color:${accentColor}">Quotation</div>
        <div class="qv-meta">
          Quotation&nbsp;# &nbsp;<b>${q.id}</b><br>
          Quotation Date &nbsp;<b>${fmtDate(q.date)}</b><br>
          Valid Until &nbsp;<b>${fmtDate(q.validUntil)}</b>
          &nbsp;&nbsp;<span style="background:${stBg[q.status]||'#F5F5F5'};color:${stCol[q.status]||'#333'};
            padding:2px 9px;border-radius:999px;font-size:8pt;font-weight:700">${q.status.toUpperCase()}</span>
        </div>
      </div>
      <div class="qv-logo-box">
        ${logoHTML}
        <div>
          <div class="qv-co-name">${co?.name||'Your Company'}</div>
          <div class="qv-co-tag">${co?.tagline||''}</div>
        </div>
      </div>
    </div>

    <!-- FROM / TO BOXES -->
    <div class="qv-boxes">
      <div class="qv-box">
        <div class="qv-box-lbl">Quotation by</div>
        <div class="qv-box-row"><span class="qv-box-key">Name</span><span class="qv-box-val"><b>${co?.name||''}</b></span></div>
        <div class="qv-box-row"><span class="qv-box-key">Address</span><span class="qv-box-val">${(co?.address||'').replace(/\n/g,', ')}</span></div>
        <div class="qv-box-row"><span class="qv-box-key">Phone</span><span class="qv-box-val">${co?.phone||'—'}</span></div>
        <div class="qv-box-row"><span class="qv-box-key">Email</span><span class="qv-box-val">${co?.email||'—'}</span></div>
        ${co?.taxPin?`<div class="qv-box-row"><span class="qv-box-key">PIN</span><span class="qv-box-val">${co.taxPin}</span></div>`:''}
      </div>
      <div class="qv-box">
        <div class="qv-box-lbl">Quotation to</div>
        <div class="qv-box-row"><span class="qv-box-key">Name</span><span class="qv-box-val"><b>${cust?.company||'—'}</b></span></div>
        <div class="qv-box-row"><span class="qv-box-key">Contact</span><span class="qv-box-val">${cust?.contact||'—'}</span></div>
        <div class="qv-box-row"><span class="qv-box-key">Address</span><span class="qv-box-val">${(cust?.address||'').replace(/\n/g,', ')||'—'}</span></div>
        <div class="qv-box-row"><span class="qv-box-key">Phone</span><span class="qv-box-val">${cust?.phone||'—'}</span></div>
        <div class="qv-box-row"><span class="qv-box-key">Email</span><span class="qv-box-val">${cust?.email||'—'}</span></div>
        ${cust?.taxPin?`<div class="qv-box-row"><span class="qv-box-key">PIN</span><span class="qv-box-val">${cust.taxPin}</span></div>`:''}
      </div>
    </div>

    <!-- META ROW -->
    <div class="qv-meta-row">
      <span>Sales Representative: <b>${sp?.name||'—'}</b>${sp?.phone?' | '+sp.phone:''}${sp?.email?' | '+sp.email:''}</span>
      <span>Payment Terms: <b>${co?.paymentTerms||'Net 30'}</b></span>
    </div>

    <!-- ITEMS TABLE -->
    <table class="qv-tbl" style="--qAccent:${accentColor}">
      <thead>
        <tr>
          <th style="width:24px">Item #</th>
          <th>Item Description</th>
          <th style="width:48px;text-align:center">Qty.</th>
          <th style="width:90px;text-align:right">Rate</th>
          <th style="width:54px;text-align:right">Disc</th>
          <th style="width:95px;text-align:right">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <!-- BOTTOM: TERMS LEFT, TOTALS RIGHT -->
    <div class="qv-bottom">
      <div>
        ${termsItems?`<div class="qv-terms-title" style="color:${accentColor}">Terms and Conditions</div>
        <div style="margin-bottom:12px">${termsItems}</div>`:''}
        ${q.notes?`<div class="qv-notes-title" style="color:${accentColor}">Additional Notes</div>
        <div class="qv-notes-text">${q.notes.replace(/\n/g,'<br>')}</div>`:''}
        <div class="qv-contact-line">
          For enquiries, email <a href="mailto:${co?.email||''}" style="color:${accentColor}">${co?.email||''}</a>
          ${co?.phone?' or call <b>'+co.phone+'</b>':''}
        </div>
      </div>
      <div class="qv-tot-wrap">
        <div class="qv-tr"><span class="qv-tk">Sub Total</span><span class="qv-tv">${fmt(tots.sub)}</span></div>
        ${tots.discAmt>0?`<div class="qv-tr disc"><span class="qv-tk">Discount${q.discount?'('+Math.round(q.discount*100)+'%)':''}</span><span>−${fmt(tots.discAmt)}</span></div>`:''}
        <div class="qv-tr"><span class="qv-tk">Net Amount</span><span class="qv-tv">${fmt(tots.net)}</span></div>
        <div class="qv-tr"><span class="qv-tk">${q.taxable?DB.settings.taxLabel+' ('+Math.round((DB.settings.taxRate||.16)*100)+'%)':'Tax Exempt'}</span>
          <span class="qv-tv">${q.taxable?fmt(tots.taxAmt):'—'}</span></div>
        <div class="qv-tr grand-row">
          <span class="qv-tk">Total</span>
          <span class="qv-tv" style="font-size:13pt;font-weight:900">${fmt(tots.total)}</span>
        </div>
        <div class="qv-words-lbl">Invoice Total (in words)</div>
        <div class="qv-words">${amountInWords(tots.total)}</div>
      </div>
    </div>

    <!-- PAYMENT METHODS FOOTER -->
    ${(co?.paymentMethods||[]).length?`<div class="qv-pay-footer">
      <div class="qv-pay-title">Payment Details</div>
      <div class="qv-pay-grid">${pmHTML}</div>
    </div>`:''}

    <!-- SIGNATURE -->
    <div class="qv-sig-area">
      <div class="qv-sig-block">
        <div class="qv-sig-line"></div>
        <div class="qv-sig-lbl">Authorized Signature</div>
        <div class="qv-sig-name">${sp?.name||co?.name||''}</div>
      </div>
    </div>`;

  // Scale to fit screen (fix #2)
  setTimeout(scalePreview, 60);
}

// Fix #2 — scale A4 doc to fit preview container
function scalePreview() {
  const wrap  = document.getElementById('prev-wrap'); if (!wrap) return;
  const outer = document.getElementById('prev-outer');
  const avail = outer ? outer.clientWidth - 24 : window.innerWidth - 24;
  const scale = Math.min(avail / 760, 1);
  wrap.style.transform       = `scale(${scale})`;
  wrap.style.transformOrigin = 'top center';
  const doc = document.getElementById('prev-doc');
  if (doc) {
    // Shrink the outer so the page flows naturally below the scaled doc
    const scaledH = doc.scrollHeight * scale;
    wrap.style.marginBottom = (scaledH - doc.scrollHeight) + 'px';
  }
}
window.addEventListener('resize', scalePreview);

// ── PDF EXPORT — html2canvas renders the exact preview HTML into PDF ──
function buildFileName(q) {
  const cust = getCust(q.customerId);
  const name = (cust?.company||'Client').replace(/[^\w\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-');
  const ver  = (DB.settings.dlIncludeVersion !== false && q.version) ? '_'+q.version : '';
  return `${name}_${q.id}${ver}.pdf`;
}

function doPDFById(qid) {
  curQID = qid;
  buildPreview(qid);
  openDlg('dlg-prev');
  setTimeout(doPDF, 800);
}

// doPDF — waits for fonts to load, then renders exact HTML preview into PDF
// Using PNG (not JPEG) avoids compression artifacts on text
async function doPDF() {
  if (!window.jspdf) { snack('PDF library not ready, please try again'); return; }
  const q = DB.quotes.find(x=>x.id===curQID);
  if (!q) { snack('Quote not found'); return; }

  const docEl = document.getElementById('prev-doc');
  if (!docEl) { snack('Please open Preview first'); return; }

  snack('Generating PDF…');

  try {
    const blob = await generatePDFBlob();
    if (!blob) throw new Error('Failed to generate PDF blob');
    const fname = buildFileName(q);
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href = url; a.download = fname; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    snack('Downloaded: ' + fname);
  } catch(err) {
    console.error('PDF error:', err);
    snack('PDF generation failed — try again');
  }
}

// ── SHARE QUOTE ──────────────────────────────────────────
function openShareDialog(qid) {
  curQID = qid;
  const q    = DB.quotes.find(x=>x.id===qid); if (!q) return;
  const cust = getCust(q.customerId);
  const tots = calcTotals(q);

  document.getElementById('share-quote-label').textContent =
    `${q.id} · ${cust?.company||'Unknown'} · ${fmt(tots.total)}`;

  const email   = cust?.email || '';
  const subject = encodeURIComponent(`Quotation ${q.id} from ${(activeCo()||{}).name||'Us'}`);
  const body    = encodeURIComponent(
    `Dear ${cust?.contact||'Sir/Madam'},\n\nPlease find attached your quotation ${q.id} for ${fmt(tots.total)}.\n\nValid until: ${fmtDate(q.validUntil)}\n\nKind regards,\n${(activeCo()||{}).name||''}`
  );
  const waText  = encodeURIComponent(
    `Hello ${cust?.contact||''},\n\nYour quotation *${q.id}* for *${fmt(tots.total)}* is ready.\nValid until: ${fmtDate(q.validUntil)}\n\n_${(activeCo()||{}).name||''}_`
  );

  const shareItems = [
    { icon:'email',        color:'#EA4335', label:'Email',        action:`window.open('mailto:${email}?subject=${subject}&body=${body}','_blank')` },
    { icon:'chat',         color:'#25D366', label:'WhatsApp',     action:`window.open('https://wa.me/?text=${waText}','_blank')` },
    { icon:'content_copy', color:'#5F6368', label:'Copy Link',    action:`copyQuoteText('${qid}')` },
    { icon:'picture_as_pdf',color:'#F4511E',label:'Download PDF', action:`doSharePDF('${qid}')` },
  ];

  // Add native share if supported
  const nativeBtn = navigator.share ? `
    <div class="si" onclick="doNativeShare('${qid}')">
      <div class="si-ic" style="background:#1A73E820;color:#1A73E8">
        <span class="material-icons-round">ios_share</span>
      </div>
      <div class="si-tx"><div class="si-m">Share via…</div>
        <div class="si-s">Use device share sheet</div></div>
    </div>` : '';

  document.getElementById('share-body').innerHTML = nativeBtn + shareItems.map(item => `
    <div class="si" onclick="${item.action};closeDlg('dlg-share')">
      <div class="si-ic" style="background:${item.color}20;color:${item.color}">
        <span class="material-icons-round">${item.icon}</span>
      </div>
      <div class="si-tx"><div class="si-m">${item.label}</div></div>
    </div>`).join('');

  document.getElementById('share-progress').style.display = 'none';
  openDlg('dlg-share');
}

async function doGeneratePDFAndShare() {
  const q = DB.quotes.find(x=>x.id===curQID); if (!q) return;

  // Build preview if not already built
  if (!document.getElementById('prev-doc').innerHTML.trim()) {
    buildPreview(curQID);
    await new Promise(r => setTimeout(r, 600));
  }

  const progress = document.getElementById('share-progress');
  const genBtn   = document.querySelector('#dlg-share .btn.bp.btn-w');
  if (genBtn) genBtn.style.display = 'none';
  progress.style.display = 'block';
  document.getElementById('share-progress-msg').textContent = 'Generating PDF…';

  try {
    const pdfBlob = await generatePDFBlob();
    if (!pdfBlob) throw new Error('No blob');

    const fname = buildFileName(q);
    const file  = new File([pdfBlob], fname, { type:'application/pdf' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files:[file] })) {
      document.getElementById('share-progress-msg').textContent = 'Opening share sheet…';
      await navigator.share({
        title: `Quotation ${q.id}`,
        text: `Quotation ${q.id} for ${fmt(calcTotals(q).total)}`,
        files: [file],
      });
      snack('Shared successfully');
    } else {
      // Fallback: just download the PDF
      const url = URL.createObjectURL(pdfBlob);
      const a   = document.createElement('a');
      a.href = url; a.download = fname; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      snack('PDF downloaded: ' + fname);
    }
  } catch(err) {
    if (err.name !== 'AbortError') {
      snack('Could not share — PDF downloaded instead');
    }
  }

  progress.style.display = 'none';
  if (genBtn) genBtn.style.display = '';
  closeDlg('dlg-share');
}

async function doNativeShare(qid) {
  curQID = qid;
  closeDlg('dlg-share');
  buildPreview(qid);
  openDlg('dlg-prev');
  await new Promise(r => setTimeout(r, 700));
  await doGeneratePDFAndShare();
}

async function doSharePDF(qid) {
  curQID = qid;
  buildPreview(qid);
  openDlg('dlg-prev');
  setTimeout(doPDF, 700);
}

// Generate PDF as a Blob (for sharing)
async function generatePDFBlob() {
  if (!window.jspdf || !window.html2canvas) return null;
  const docEl = document.getElementById('prev-doc');
  if (!docEl) return null;

  // KEY FIX: wait for all fonts to finish loading before capture
  // This ensures the offline fallback font is fully applied — same metrics online & offline
  try { await document.fonts.ready; } catch(e) {}
  await new Promise(r => requestAnimationFrame(r));
  await new Promise(r => setTimeout(r, 100));

  // CRITICAL: Do NOT touch wrap.style.transform — that would cause the visible zoom-out bug.
  // Instead we clone the element, render it off-screen at full 760px width.
  const FONT_STACK = "'Inter', ui-sans-serif, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";

  // Create invisible off-screen clone at full resolution
  const clone = docEl.cloneNode(true);
  clone.style.cssText = [
    'position:fixed', 'top:-99999px', 'left:-99999px',
    'width:760px', 'transform:none', 'pointer-events:none',
    'z-index:-1', 'font-family:'+FONT_STACK,
    'letter-spacing:-0.01em', 'word-spacing:0.01em',
  ].join(';');
  document.body.appendChild(clone);

  let canvas;
  try {
    canvas = await html2canvas(clone, {
      scale: 2.5,           // Higher = crisper text
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      removeContainer: true,
      // onclone injects font CSS into the captured clone
      // This guarantees the same font renders whether online or offline
      onclone: (clonedDoc, clonedEl) => {
        const style = clonedDoc.createElement('style');
        style.textContent = [
          '@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap");',
          '* { font-family: ' + FONT_STACK + ' !important;',
          '    letter-spacing: -0.01em !important;',
          '    word-spacing: 0.01em !important; }',
          'b, strong { font-weight: 700 !important; }',
          'body { -webkit-font-smoothing: antialiased; }',
        ].join('\n');
        clonedDoc.head.insertBefore(style, clonedDoc.head.firstChild);
        // Also set inline on the doc element
        if (clonedEl) {
          clonedEl.style.fontFamily = FONT_STACK;
          clonedEl.style.letterSpacing = '-0.01em';
          clonedEl.style.wordSpacing = '0.01em';
        }
      }
    });
  } finally {
    if (clone && clone.parentNode) clone.parentNode.removeChild(clone);
  }

  const { jsPDF } = window.jspdf;
  const pdf   = new jsPDF({ orientation:'p', unit:'mm', format:'a4' });
  const pageW = 210, pageH = 297;

  // PNG preserves text sharpness better than JPEG
  const imgData = canvas.toDataURL('image/png');
  const imgH    = (canvas.height * pageW) / canvas.width;

  if (imgH <= pageH) {
    pdf.addImage(imgData, 'PNG', 0, 0, pageW, imgH, '', 'FAST');
  } else {
    const canvasPageH = Math.floor(canvas.width * (pageH / pageW));
    let srcY = 0, first = true;
    while (srcY < canvas.height) {
      if (!first) pdf.addPage();
      const sliceH = Math.min(canvasPageH, canvas.height - srcY);
      const sc = document.createElement('canvas');
      sc.width = canvas.width; sc.height = sliceH;
      sc.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      const renderedH = (sliceH * pageW) / canvas.width;
      pdf.addImage(sc.toDataURL('image/png'), 'PNG', 0, 0, pageW, renderedH, '', 'FAST');
      srcY += sliceH; first = false;
    }
  }

  return pdf.output('blob');
}

function addCatItem() {
  const list = document.getElementById('cat-list-ed'); if (!list) return;
  const idx  = list.querySelectorAll('input').length;
  const row  = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;align-items:center';
  row.innerHTML = `<input class="fi" style="flex:1" value="" id="cat-item-${idx}" placeholder="Category name">
    <button class="ib" style="color:var(--E);flex-shrink:0" onclick="this.closest('div').remove()">
      <span class="material-icons-round">delete</span>
    </button>`;
  list.appendChild(row);
}
function removeCatItem(i) {
  const el = document.getElementById('cat-item-'+i);
  if (el) el.closest('div').remove();
}

function copyQuoteText(qid) {
  const q    = DB.quotes.find(x=>x.id===qid); if (!q) return;
  const cust = getCust(q.customerId);
  const tots = calcTotals(q);
  const co   = activeCo();
  const text = `*Quotation ${q.id}*\n` +
    `From: ${co?.name||''}\n` +
    `To: ${cust?.company||''} — ${cust?.contact||''}\n` +
    `Amount: ${fmt(tots.total)}\n` +
    `Valid until: ${fmtDate(q.validUntil)}\n` +
    `Contact: ${co?.email||''} ${co?.phone||''}`;
  navigator.clipboard?.writeText(text)
    .then(()=>snack('Quote details copied to clipboard'))
    .catch(()=>snack('Could not copy — try manually'));
}

// ── INVENTORY ──────────────────────────────────────────
let invF = 'all';

function setInvF(c) {
  invF = c;
  renderInvFilterBar();
  renderInv();
}

// Renders dynamic category filter chips from user-defined categories
function renderInvFilterBar() {
  const fbar = document.getElementById('inv-fbar'); if (!fbar) return;
  const cats = getCategories();
  // Use data-cat attribute to avoid any quote-escaping issues in onclick
  fbar.innerHTML = [
    `<button class="fc${invF==='all'?' on':''}" data-cat="all">All</button>`,
    ...cats.map(c=>`<button class="fc${invF===c?' on':''}" data-cat="${c.replace(/"/g,'&quot;')}">${c}</button>`)
  ].join('');
  // Re-attach event listener each render (clean, no escaping issues)
  fbar.querySelectorAll('button[data-cat]').forEach(btn => {
    btn.addEventListener('click', () => setInvF(btn.dataset.cat));
  });
}

function renderInv() {
  renderInvFilterBar();
  const srch = (document.getElementById('inv-srch')||{}).value?.toLowerCase()||'';
  let list = acoInv();
  if (invF!=='all') list = list.filter(i=>i.category===invF);
  if (srch) list = list.filter(i=>i.name.toLowerCase().includes(srch)||i.id.toLowerCase().includes(srch));
  const el = document.getElementById('inv-list');
  el.innerHTML = list.length ? list.map(p=>`
    <div class="ii" onclick="openInvEd('${p.id}')">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <div style="flex:1">
          <div style="font-size:11px;font-weight:600;color:var(--t2)">${p.id}</div>
          <div style="font-size:15px;font-weight:700;margin-top:1px">${p.name}</div>
          ${p.description?`<div style="font-size:12px;color:var(--t2);margin-top:2px">${p.description}</div>`:''}
        </div>
        <span class="cat-pill" style="background:var(--PC);color:var(--P)">${p.category||'Other'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:16px;font-weight:800;color:var(--P)">${fmt(p.unitCost*(1+p.markup))}</div>
          <div style="font-size:11px;color:var(--t2)">Cost: ${fmt(p.unitCost)} · ${Math.round(p.markup*100)}% markup</div>
        </div>
        <button class="ib" style="color:var(--E)" onclick="event.stopPropagation();confirmAct('Delete this product?',()=>delItem('inv','${p.id}'))">
          <span class="material-icons-round">delete</span>
        </button>
      </div>
    </div>`).join('')
    : `<div class="empty"><span class="material-icons-round">inventory_2</span>
       <div class="empty-t">No products found</div></div>`;
}

function openInvEd(id) {
  editInvId = id;
  const p = id ? getProd(id) : null;
  document.getElementById('inv-ttl').textContent = id ? 'Edit Product' : 'New Product';
  const nid = 'ITM-' + String(acoInv().length+1).padStart(3,'0');
  document.getElementById('inv-body').innerHTML = `
    <div class="fg"><label class="fl">Item ID</label>
      <input class="fi" id="ii-id" value="${p?.id||nid}" ${id?'readonly':''}></div>
    <div class="fg"><label class="fl">Name *</label>
      <input class="fi" id="ii-nm" value="${p?.name||''}" placeholder="Product or service name"></div>
    <div class="fg"><label class="fl">Description</label>
      <textarea class="fi" id="ii-desc">${p?.description||''}</textarea></div>
    <div class="fg"><label class="fl">Category</label>
      <select class="fi" id="ii-cat">
        ${getCategories().map(c=>`<option${c===(p?.category||getCategories()[0])?' selected':''}>${c}</option>`).join('')}
      </select></div>
    <div class="fr">
      <div class="fg"><label class="fl">Unit Cost *</label>
        <input class="fi" type="number" id="ii-cost" value="${p?.unitCost||0}" step="0.01"></div>
      <div class="fg"><label class="fl">Markup %</label>
        <input class="fi" type="number" id="ii-mkup" value="${Math.round((p?.markup||.30)*100)}" min="0"></div>
    </div>
    <div style="background:var(--su2);border-radius:8px;padding:11px;font-size:13px;color:var(--t2)">
      Sale price = Cost × (1 + Markup %)
    </div>
    ${id?`<div style="margin-top:14px"><button class="btn bd2 btn-w"
      onclick="confirmAct('Delete this product?',()=>delItem('inv','${id}'))">
      <span class="material-icons-round">delete</span> Delete Product</button></div>`:''}`;
  openDlg('dlg-inv');
}

function saveInv() {
  const id=v('ii-id'), nm=v('ii-nm');
  if (!id||!nm) { snack('ID and name required'); return; }
  const item = {id, name:nm, description:v('ii-desc'), category:v('ii-cat'),
    unitCost:parseFloat(v('ii-cost'))||0, markup:(parseFloat(v('ii-mkup'))||30)/100,
    companyId:(activeCo()||{}).id};
  const idx = DB.inventory.findIndex(i=>i.id===id);
  if (idx>=0) DB.inventory[idx]=item; else DB.inventory.push(item);
  save(); closeDlg('dlg-inv'); renderInv(); snack('Product saved');
}

// ── CUSTOMERS ──────────────────────────────────────────
function renderCusts() {
  const srch = (document.getElementById('cust-srch')||{}).value?.toLowerCase()||'';
  let list = acoCusts();
  if (srch) list = list.filter(c=>c.company.toLowerCase().includes(srch)||c.contact.toLowerCase().includes(srch));
  const el = document.getElementById('cust-list');
  el.innerHTML = list.length ? list.map(c=>`
    <div class="qi" style="display:flex;gap:12px;align-items:center" onclick="openCustEd('${c.id}')">
      <div class="av" style="width:42px;height:42px;font-size:16px;background:${avColor(c.company)}">${avLetter(c.company)}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <div style="font-size:15px;font-weight:700">${c.company}</div>
          <span class="tier-${c.tier||'Bronze'}">${c.tier||'Bronze'}</span>
        </div>
        <div style="font-size:13px;color:var(--t2)">${c.contact}${c.industry?' · '+c.industry:''}</div>
        <div style="font-size:12px;color:var(--t2)">${c.email||''}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:13px;font-weight:700;color:var(--P)">${fmt(c.ltv||0)}</div>
        <div style="font-size:10px;color:var(--t2)">Lifetime</div>
      </div>
    </div>`)
    .join('')
    : `<div class="empty"><span class="material-icons-round">people</span>
       <div class="empty-t">No customers yet</div>
       <div class="empty-s">Add your first customer to get started</div></div>`;
}

function openCustEd(id, fromQE=false) {
  editCustId = id;
  const c = id ? getCust(id) : null;
  document.getElementById('cust-ttl').textContent = id ? 'Edit Customer' : 'New Customer';
  const nid = 'CUS-'+String(acoCusts().length+1).padStart(3,'0');
  document.getElementById('cust-body').innerHTML = `
    <div class="fg"><label class="fl">Customer ID</label>
      <input class="fi" id="ci-id" value="${c?.id||nid}" ${id?'readonly':''}></div>
    <div class="fg"><label class="fl">Company Name *</label>
      <input class="fi" id="ci-co" value="${c?.company||''}" placeholder="Company name"></div>
    <div class="fg"><label class="fl">Contact Person</label>
      <input class="fi" id="ci-cnt" value="${c?.contact||''}" placeholder="Full name"></div>
    <div class="fr">
      <div class="fg"><label class="fl">Email</label>
        <input class="fi" type="email" id="ci-em" value="${c?.email||''}" placeholder="email@example.com"></div>
      <div class="fg"><label class="fl">Phone</label>
        <input class="fi" type="tel" id="ci-ph" value="${c?.phone||''}" placeholder="+254 7xx xxx xxx"></div>
    </div>
    <div class="fg"><label class="fl">Address</label>
      <textarea class="fi" id="ci-addr">${c?.address||''}</textarea></div>
    <div class="fr">
      <div class="fg"><label class="fl">Industry</label>
        <input class="fi" id="ci-ind" value="${c?.industry||''}" placeholder="e.g. Technology"></div>
      <div class="fg"><label class="fl">Tier</label>
        <select class="fi" id="ci-tier">
          ${['Gold','Platinum','Silver','Bronze'].map(t=>`<option${t===(c?.tier||'Bronze')?' selected':''}>${t}</option>`).join('')}
        </select></div>
    </div>
    <div class="fg"><label class="fl">Tax PIN / Reg No.</label>
      <input class="fi" id="ci-pin" value="${c?.taxPin||''}" placeholder="P051234567A"></div>
    <div class="fg"><label class="fl">Company Profile</label>
      <select class="fi" id="ci-coid">
        ${DB.companies.map(co=>`<option value="${co.id}"${co.id===(c?.companyId||DB.settings.activeCompanyId)?' selected':''}>${co.name}</option>`).join('')}
      </select></div>
    <input type="hidden" id="ci-fromqe" value="${fromQE?1:0}">
    ${id?`<div style="margin-top:14px"><button class="btn bd2 btn-w"
      onclick="confirmAct('Delete this customer?',()=>delItem('cust','${id}'))">
      <span class="material-icons-round">delete</span> Delete Customer</button></div>`:''}`;
  openDlg('dlg-cust');
}

function saveCust() {
  const id=v('ci-id'), co2=v('ci-co');
  if (!id||!co2) { snack('ID and company name required'); return; }
  const fromQE = document.getElementById('ci-fromqe')?.value==='1';
  const cust = {id, company:co2, contact:v('ci-cnt'), email:v('ci-em'), phone:v('ci-ph'),
    address:v('ci-addr'), industry:v('ci-ind'), tier:v('ci-tier'),
    taxPin:v('ci-pin'), companyId:v('ci-coid'), ltv:0};
  const idx = DB.customers.findIndex(c=>c.id===id);
  if (idx>=0) { cust.ltv=DB.customers[idx].ltv; DB.customers[idx]=cust; }
  else DB.customers.push(cust);
  save(); closeDlg('dlg-cust');
  if (fromQE) { qeD.customerId=id; renderQEStep(); }
  renderCusts(); snack('Customer saved');
}

// ── SETTINGS PAGE (fix #7 — active company scoped) ────
function renderSettings() {
  const coList = document.getElementById('co-list-el');
  if (!DB.companies.length) {
    coList.innerHTML = `<div class="si"><div class="si-tx" style="color:var(--t2)">No profiles — add one below</div></div>`;
  } else {
    coList.innerHTML = DB.companies.map(c=>`
      <div class="si" onclick="openCoEd('${c.id}')">
        <div class="si-ic" style="background:${c.logoColor||'#1A73E8'}22;color:${c.logoColor||'#1A73E8'}">
          ${c.logoImg?`<img src="${c.logoImg}" style="width:28px;height:28px;border-radius:50%;object-fit:cover">`
            :`<span style="font-weight:900;font-size:17px">${c.logoText||'A'}</span>`}
        </div>
        <div class="si-tx">
          <div class="si-m">${c.name}</div>
          <div class="si-s">${c.email||'No email set'}${c.id===DB.settings.activeCompanyId?' · ✓ Active':''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:4px">
          ${c.id!==DB.settings.activeCompanyId
            ?`<button class="btn bt btn-sm" onclick="event.stopPropagation();setActiveCo('${c.id}')">Set Active</button>
              <button class="ib" style="color:var(--E)" onclick="event.stopPropagation();confirmAct('Delete company profile \\'${c.name}\\'? This cannot be undone.',()=>delItem('co','${c.id}'))">
                <span class="material-icons-round" style="font-size:20px">delete</span>
              </button>`
            :`<span class="chip cs-Won" style="font-size:11px">Active</span>`}
          <span class="material-icons-round" style="color:var(--t2);font-size:18px">chevron_right</span>
        </div>
      </div>`).join('');
  }
  document.getElementById('dark-tog').classList.toggle('on', DB.settings.darkMode);
  document.getElementById('acc-sub').textContent = DB.settings.accentName||'Google Blue';
  document.getElementById('sp-sub').textContent  = acoSP().length+' members';
  const cats = getCategories();
  const catSubEl = document.getElementById('cat-sub');
  if (catSubEl) catSubEl.textContent = cats.length+' categories: '+cats.slice(0,3).join(', ')+(cats.length>3?'…':'');
  document.getElementById('dl-sub').textContent  = 'e.g. ClientName_QMS-2026-001_v1.pdf';
}

function setActiveCo(id) {
  DB.settings.activeCompanyId = id;
  save();
  renderSettings();
  renderDash(); // fix #6 — instant dashboard update
  snack('Active company changed');
}

// ── COMPANY EDITOR (fix #8 — multiple payment methods) ──
function openCoEd(id) {
  editCoId = id;
  const co = id ? getCo(id) : null;
  document.getElementById('co-ttl').textContent = id ? 'Edit Profile' : 'New Company';
  document.getElementById('co-body').innerHTML = buildCoForm(co);
  openDlg('dlg-co');
}

function buildCoForm(co) {
  const pms = co?.paymentMethods || [];
  return `
  <!-- LOGO -->
  <div style="text-align:center;padding:12px 0 16px">
    <div id="logo-prev" onclick="document.getElementById('logo-file').click()" style="width:68px;height:68px;border-radius:14px;margin:0 auto 10px;
      background:${co?.logoColor||'#1A73E8'};display:flex;align-items:center;justify-content:center;
      color:#fff;font-size:26px;font-weight:900;overflow:hidden;cursor:pointer">
      ${co?.logoImg?`<img src="${co.logoImg}" style="width:100%;height:100%;object-fit:cover">`:(co?.logoText||'A')}
    </div>
    <div style="display:flex;gap:8px;justify-content:center">
      <button class="btn bo btn-sm" onclick="document.getElementById('logo-file').click()">
        <span class="material-icons-round">upload</span> Upload Logo
      </button>
      <input type="file" id="logo-file" accept="image/*" style="display:none" onchange="previewLogo(this)">
      <input type="color" id="logo-col" value="${co?.logoColor||'#1A73E8'}" style="display:none" onchange="updLogoColor(this.value)">
      <button class="btn bo btn-sm" onclick="document.getElementById('logo-col').click()">
        <span class="material-icons-round">palette</span> Color
      </button>
    </div>
  </div>
  <input type="hidden" id="co-img" value="${co?.logoImg||''}">
  <div class="fr">
    <div class="fg"><label class="fl">Logo Initials</label>
      <input class="fi" id="co-lt" value="${co?.logoText||'A'}" maxlength="3" oninput="updLogoText(this.value)"></div>
    <div class="fg"><label class="fl">Logo Color</label>
      <div id="co-col-show" onclick="document.getElementById('logo-col').click()"
        style="height:40px;border-radius:8px;background:${co?.logoColor||'#1A73E8'};cursor:pointer;border:1.5px solid var(--ol)"></div></div>
  </div>

  <div style="height:1px;background:var(--ol2);margin:4px 0 14px"></div>
  <div class="st" style="padding:0 0 8px">Company Information</div>
  <div class="fg"><label class="fl">Company Name *</label>
    <input class="fi" id="co-nm" value="${co?.name||''}" placeholder="Acme Corporation Ltd."></div>
  <div class="fg"><label class="fl">Tagline / Slogan</label>
    <input class="fi" id="co-tag" value="${co?.tagline||''}" placeholder="e.g. Enterprise Solutions"></div>
  <div class="fg"><label class="fl">Address</label>
    <textarea class="fi" id="co-addr">${co?.address||''}</textarea></div>
  <div class="fr">
    <div class="fg"><label class="fl">Phone</label>
      <input class="fi" type="tel" id="co-ph" value="${co?.phone||''}" placeholder="+254 700 000 000"></div>
    <div class="fg"><label class="fl">Email</label>
      <input class="fi" type="email" id="co-em" value="${co?.email||''}" placeholder="info@company.com"></div>
  </div>
  <div class="fr">
    <div class="fg"><label class="fl">Website</label>
      <input class="fi" id="co-web" value="${co?.website||''}" placeholder="www.company.com"></div>
    <div class="fg"><label class="fl">Tax PIN / KRA PIN</label>
      <input class="fi" id="co-pin" value="${co?.taxPin||''}" placeholder="P051234567A"></div>
  </div>

  <div style="height:1px;background:var(--ol2);margin:4px 0 14px"></div>
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
    <div class="st" style="padding:0">Payment Methods</div>
    <button class="btn btn-ton btn-sm" onclick="addPayMethod()">
      <span class="material-icons-round">add</span> Add Method
    </button>
  </div>
  <div id="pm-list">${pms.map((pm,i)=>pmCardHTML(pm,i)).join('')}</div>

  <div style="height:1px;background:var(--ol2);margin:4px 0 14px"></div>
  <div class="fg"><label class="fl">Default Payment Terms</label>
    <select class="fi" id="co-pterms">
      ${['Net 7','Net 14','Net 30','Net 60','Due on Receipt','50% Upfront','COD'].map(t=>`<option value="${t}"${t===(co?.paymentTerms||'Net 30')?' selected':''}>${t}</option>`).join('')}
    </select></div>

  <div style="height:1px;background:var(--ol2);margin:4px 0 14px"></div>
  <div class="st" style="padding:0 0 8px">Terms &amp; Conditions</div>
  <div class="fg"><textarea class="fi" id="co-tc" rows="6"
    placeholder="Enter your standard terms…">${co?.terms||''}</textarea></div>

  ${editCoId
    ?`<div style="margin-top:4px"><button class="btn bd2 btn-w"
      onclick="confirmAct('Delete company profile? This cannot be undone.',()=>{delItem('co','${editCoId}');closeDlg('dlg-co')})">
      <span class="material-icons-round">delete</span> Delete This Profile</button></div>`:''}
  <div style="height:20px"></div>`;
}

function pmCardHTML(pm, i) {
  const types = ['Bank','M-Pesa','Cash','Cheque','Other'];
  return `<div class="pmcard" id="pm-${i}">
    <div class="pmhead">
      <span class="pm-badge" id="pm-badge-${i}">${pm.type}</span>
      <select class="fi" style="flex:1;font-size:13px" id="pm-type-${i}"
        onchange="pmTypeChange(${i},this.value)">
        ${types.map(t=>`<option value="${t}"${t===pm.type?' selected':''}>${t}</option>`).join('')}
      </select>
      <button class="ib" style="width:30px;height:30px;color:var(--E)" onclick="removePM(${i})">
        <span class="material-icons-round" style="font-size:18px">delete</span>
      </button>
    </div>
    <div id="pm-fields-${i}">${pmFieldsHTML(pm,i)}</div>
  </div>`;
}

function pmFieldsHTML(pm, i) {
  if (pm.type==='Bank') return `
    <div class="fr"><div class="fg"><label class="fl">Bank Name</label>
        <input class="fi" id="pm-bank-${i}" value="${pm.bankName||''}" placeholder="Equity Bank Kenya"></div>
      <div class="fg"><label class="fl">Branch</label>
        <input class="fi" id="pm-branch-${i}" value="${pm.branch||''}" placeholder="Westlands"></div></div>
    <div class="fr"><div class="fg"><label class="fl">Account Name</label>
        <input class="fi" id="pm-accnm-${i}" value="${pm.accName||''}" placeholder="Company Ltd."></div>
      <div class="fg"><label class="fl">Account No.</label>
        <input class="fi" id="pm-accn-${i}" value="${pm.accNum||''}" placeholder="0123456789"></div></div>
    <div class="fg"><label class="fl">SWIFT / Sort Code</label>
      <input class="fi" id="pm-swift-${i}" value="${pm.swift||''}" placeholder="EQBLKENA"></div>`;
  if (pm.type==='M-Pesa') return `
    <div class="fr"><div class="fg"><label class="fl">Paybill No.</label>
        <input class="fi" id="pm-pb-${i}" value="${pm.paybillBusiness||''}" placeholder="123456"></div>
      <div class="fg"><label class="fl">Account Field</label>
        <input class="fi" id="pm-pba-${i}" value="${pm.paybillAccount||''}" placeholder="Invoice No."></div></div>
    <div class="fr"><div class="fg"><label class="fl">Buy Goods Till</label>
        <input class="fi" id="pm-till-${i}" value="${pm.tillNumber||''}" placeholder="Optional"></div>
      <div class="fg"><label class="fl">M-Pesa Name</label>
        <input class="fi" id="pm-mpnm-${i}" value="${pm.mpesaName||''}" placeholder="Company Name"></div></div>`;
  return `<div class="fg"><label class="fl">Details</label>
    <textarea class="fi" id="pm-det-${i}">${pm.details||''}</textarea></div>`;
}

function pmTypeChange(i, type) {
  document.getElementById('pm-badge-'+i).textContent = type;
  document.getElementById('pm-fields-'+i).innerHTML = pmFieldsHTML({type},i);
}
function addPayMethod() {
  const list = document.getElementById('pm-list');
  const idx  = list.querySelectorAll('.pmcard').length;
  const div  = document.createElement('div');
  div.innerHTML = pmCardHTML({type:'Bank'}, idx);
  list.appendChild(div.firstElementChild);
}
function removePM(i) { document.getElementById('pm-'+i)?.remove(); }

function collectPMs() {
  const cards = document.querySelectorAll('#pm-list .pmcard');
  return Array.from(cards).map((card,i) => {
    const type = document.getElementById('pm-type-'+i)?.value || 'Bank';
    const pm   = {type};
    if (type==='Bank') {
      pm.bankName = document.getElementById('pm-bank-'+i)?.value||'';
      pm.branch   = document.getElementById('pm-branch-'+i)?.value||'';
      pm.accName  = document.getElementById('pm-accnm-'+i)?.value||'';
      pm.accNum   = document.getElementById('pm-accn-'+i)?.value||'';
      pm.swift    = document.getElementById('pm-swift-'+i)?.value||'';
    } else if (type==='M-Pesa') {
      pm.paybillBusiness = document.getElementById('pm-pb-'+i)?.value||'';
      pm.paybillAccount  = document.getElementById('pm-pba-'+i)?.value||'';
      pm.tillNumber      = document.getElementById('pm-till-'+i)?.value||'';
      pm.mpesaName       = document.getElementById('pm-mpnm-'+i)?.value||'';
    } else {
      pm.details = document.getElementById('pm-det-'+i)?.value||'';
    }
    return pm;
  });
}

function previewLogo(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('co-img').value = e.target.result;
    document.getElementById('logo-prev').innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover">`;
  };
  reader.readAsDataURL(file);
}
function updLogoColor(v2) {
  document.getElementById('logo-prev').style.background = v2;
  document.getElementById('co-col-show').style.background = v2;
}
function updLogoText(t) {
  if (!document.getElementById('co-img')?.value) document.getElementById('logo-prev').textContent = t;
}

function saveCo() {
  const name = v('co-nm'); if (!name) { snack('Company name required'); return; }
  const id = editCoId || 'CO-'+uid().slice(0,6).toUpperCase();
  const co = {
    id, name, tagline:v('co-tag'), address:v('co-addr'),
    phone:v('co-ph'), email:v('co-em'), website:v('co-web'), taxPin:v('co-pin'),
    paymentMethods: collectPMs(),
    paymentTerms: v('co-pterms'),
    terms: v('co-tc'),
    logoText: v('co-lt')||'A',
    logoColor: document.getElementById('logo-col')?.value||'#1A73E8',
    logoImg: document.getElementById('co-img')?.value||null,
  };
  const idx = DB.companies.findIndex(c=>c.id===id);
  if (idx>=0) DB.companies[idx]=co;
  else {
    DB.companies.push(co);
    if (!DB.settings.activeCompanyId) DB.settings.activeCompanyId=id;
  }
  save(); closeDlg('dlg-co'); renderSettings(); snack('Company profile saved');
}

// ── SETTINGS SHEETS ────────────────────────────────────
function openSetSheet(type) {
  setType = type;
  const s = DB.settings;
  let title='', html='';
  if (type==='quote') {
    title='Quote Defaults';
    html=`
      <div class="fg"><label class="fl">Quote ID Prefix</label>
        <input class="fi" id="ss-pfx" value="${s.quotePrefix||'QMS-'}"></div>
      <div class="fr">
        <div class="fg"><label class="fl">Valid Days</label>
          <input class="fi" type="number" id="ss-vd" value="${s.quoteValidDays||30}"></div>
        <div class="fg"><label class="fl">Follow-up Days</label>
          <input class="fi" type="number" id="ss-fu" value="${s.followUpDays||7}"></div>
      </div>
      <div class="fr">
        <div class="fg"><label class="fl">Tax Rate %</label>
          <input class="fi" type="number" id="ss-tax" value="${Math.round((s.taxRate||.16)*100)}" step=".1"></div>
        <div class="fg"><label class="fl">Tax Label</label>
          <input class="fi" id="ss-taxlbl" value="${s.taxLabel||'VAT'}"></div>
      </div>
      <div class="fg"><label class="fl">Currency Symbol</label>
        <input class="fi" id="ss-curr" value="${s.currencySymbol||'KSh'}"></div>`;
  } else if (type==='margin') {
    title='Margin Thresholds';
    html=`
      <div class="fg"><label class="fl">Minimum Margin % (shows error ⚠)</label>
        <input class="fi" type="number" id="ss-mm" value="${Math.round((s.minMargin||.20)*100)}">
        <div style="font-size:12px;color:var(--E);margin-top:4px">Quotes below this show red warning</div></div>
      <div class="fg"><label class="fl">Warning Margin % (shows caution)</label>
        <input class="fi" type="number" id="ss-wm" value="${Math.round((s.warnMargin||.25)*100)}">
        <div style="font-size:12px;color:#E65100;margin-top:4px">Quotes below this show orange warning</div></div>`;
  } else if (type==='categories') {
    title = 'Product Categories';
    const cats = getCategories();
    html = `
      <div style="background:var(--su2);border-radius:8px;padding:11px;margin-bottom:14px;font-size:13px;color:var(--t2);line-height:1.6">
        Create custom categories for your products. These appear in the product editor and filter bar.
      </div>
      <div id="cat-list-ed">` + cats.map((c,i)=>`
        <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
          <input class="fi" style="flex:1" value="${c}" id="cat-item-${i}" placeholder="Category name">
          <button class="ib" style="color:var(--E);flex-shrink:0" onclick="removeCatItem(${i})">
            <span class="material-icons-round">delete</span>
          </button>
        </div>`).join('') + `
      </div>
      <button class="btn btn-ton btn-w" style="margin-top:4px" onclick="addCatItem()">
        <span class="material-icons-round">add</span> Add Category
      </button>`;
  } else if (type==='download') {
    title='Download Settings';
    html=`
      <div style="background:var(--su2);border-radius:8px;padding:12px;margin-bottom:14px;line-height:1.7;font-size:13px;color:var(--t2)">
        <strong style="color:var(--t1)">File Naming</strong><br>
        PDFs are saved as:<br>
        <code style="background:var(--su3);padding:2px 6px;border-radius:4px;font-size:12px">
          ClientName_QMS-2026-001_v1.pdf
        </code>
      </div>
      <div class="fg"><label class="fl" style="display:flex;justify-content:space-between;align-items:center">
        Include Version in Filename
        <button class="tog ${s.dlIncludeVersion!==false?'on':''}" id="ss-dlv"
          onclick="this.classList.toggle('on')"></button>
      </label></div>
      <div style="background:var(--su2);border-radius:8px;padding:12px;font-size:13px;color:var(--t2);line-height:1.6">
        <strong style="color:var(--t1)">Download Folder</strong><br>
        Browser security prevents setting a custom folder. Files save to your browser's default Downloads folder.
        To change this, update your browser download settings.
      </div>`;
  }
  document.getElementById('set-ttl').textContent = title;
  document.getElementById('set-body').innerHTML  = html;
  openDlg('dlg-set');
}

function saveSetSheet() {
  const s = DB.settings;
  if (setType==='quote') {
    s.quotePrefix   = v('ss-pfx')    || 'QMS-';
    s.quoteValidDays= parseInt(v('ss-vd'))  || 30;
    s.followUpDays  = parseInt(v('ss-fu'))  || 7;
    s.taxRate       = (parseFloat(v('ss-tax'))||16)/100;
    s.taxLabel      = v('ss-taxlbl') || 'VAT';
    s.currencySymbol= v('ss-curr')   || 'KSh';
  } else if (setType==='margin') {
    s.minMargin  = (parseFloat(v('ss-mm'))||20)/100;
    s.warnMargin = (parseFloat(v('ss-wm'))||25)/100;
  } else if (setType==='categories') {
    const inputs = document.querySelectorAll('[id^="cat-item-"]');
    const cats = Array.from(inputs).map(el=>el.value.trim()).filter(Boolean);
    if (cats.length === 0) { snack('Need at least one category'); return; }
    s.productCategories = cats;
  } else if (setType==='download') {
    s.dlIncludeVersion = document.getElementById('ss-dlv')?.classList.contains('on')??true;
  }
  save(); closeDlg('dlg-set'); renderSettings(); snack('Settings saved');
}

// ── SALES TEAM (fix #5 — full CRUD with all fields) ────
function openSalesTeam() { renderSPList(); openDlg('dlg-sp'); }

function renderSPList() {
  const list = acoSP();
  document.getElementById('sp-sub').textContent = list.length+' members';
  document.getElementById('sp-list').innerHTML = list.length ? list.map(sp=>`
    <div class="spc" onclick="openSpEd('${sp.id}')">
      <div class="av" style="width:42px;height:42px;font-size:16px;background:${avColor(sp.name)}">${avLetter(sp.name)}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:15px;font-weight:700">${sp.name}</div>
        <div style="font-size:12px;color:var(--t2)">${sp.title||'—'}</div>
        <div style="font-size:12px;color:var(--t2)">${sp.email||''}${sp.phone?' · '+sp.phone:''}</div>
      </div>
      <span class="material-icons-round" style="color:var(--t2)">chevron_right</span>
    </div>`).join('')
    : `<div class="empty"><span class="material-icons-round">badge</span>
       <div class="empty-t">No salespeople yet</div>
       <div class="empty-s">Add your first team member</div></div>`;
}

function openSpEd(id) {
  editSpId = id;
  const sp = id ? getSP(id) : null;
  document.getElementById('spe-ttl').textContent = id ? 'Edit Salesperson' : 'New Salesperson';
  const nid = 'SP-'+String(DB.salespeople.length+1).padStart(3,'0');
  document.getElementById('spe-body').innerHTML = `
    <div class="fg"><label class="fl">ID</label>
      <input class="fi" id="sp-id" value="${sp?.id||nid}" ${id?'readonly':''}></div>
    <div class="fg"><label class="fl">Full Name *</label>
      <input class="fi" id="sp-nm" value="${sp?.name||''}" placeholder="Full name"></div>
    <div class="fg"><label class="fl">Job Title</label>
      <input class="fi" id="sp-ttl2" value="${sp?.title||''}" placeholder="e.g. Senior Sales Executive"></div>
    <div class="fr">
      <div class="fg"><label class="fl">Email</label>
        <input class="fi" type="email" id="sp-em" value="${sp?.email||''}" placeholder="email@company.com"></div>
      <div class="fg"><label class="fl">Phone</label>
        <input class="fi" type="tel" id="sp-ph" value="${sp?.phone||''}" placeholder="+254 7xx xxx xxx"></div>
    </div>
    <div class="fg"><label class="fl">Company Profile</label>
      <select class="fi" id="sp-coid">
        ${DB.companies.map(co=>`<option value="${co.id}"${co.id===(sp?.companyId||DB.settings.activeCompanyId)?' selected':''}>${co.name}</option>`).join('')}
      </select></div>
    ${id?`<div style="margin-top:14px"><button class="btn bd2 btn-w"
      onclick="confirmAct('Remove this salesperson?',()=>delItem('sp','${id}'))">
      <span class="material-icons-round">delete</span> Remove</button></div>`:''}`;
  openDlg('dlg-spe');
}

function saveSp() {
  const id=v('sp-id'), name=v('sp-nm');
  if (!id||!name) { snack('ID and name required'); return; }
  const sp = {id, name, title:v('sp-ttl2'), email:v('sp-em'), phone:v('sp-ph'), companyId:v('sp-coid')};
  const idx = DB.salespeople.findIndex(s=>s.id===id);
  if (idx>=0) DB.salespeople[idx]=sp; else DB.salespeople.push(sp);
  save(); closeDlg('dlg-spe'); renderSPList(); renderSettings(); snack('Salesperson saved');
}

// ── THEME ──────────────────────────────────────────────
function applyTheme() {
  const dark = DB.settings.darkMode;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const acc   = ACCENTS.find(a=>a.name===DB.settings.accentName) || ACCENTS[0];
  const color = dark ? acc.dc : acc.lc;
  const statusColor = dark ? '#1E1E1E' : color;
  document.documentElement.style.setProperty('--P', color);
  document.documentElement.style.setProperty('--PC', dark ? '#1A3560' : color+'1A');
  document.getElementById('theme-meta').content = statusColor;
  const tog = document.getElementById('dark-tog');
  if (tog) tog.classList.toggle('on', dark);
}

function toggleTheme() {
  DB.settings.darkMode = !DB.settings.darkMode;
  save(); applyTheme();
}

function openAccentPicker() {
  document.getElementById('acc-body').innerHTML = ACCENTS.map(a=>`
    <div class="si" onclick="setAccent('${a.name}')">
      <div style="width:32px;height:32px;border-radius:50%;background:${a.lc};flex-shrink:0;
        box-shadow:0 2px 6px rgba(0,0,0,.2);
        border:${a.name===DB.settings.accentName?'3px solid var(--t1)':'3px solid transparent'}"></div>
      <div class="si-tx"><div class="si-m">${a.name}</div></div>
      ${a.name===DB.settings.accentName?'<span class="material-icons-round" style="color:var(--P)">check_circle</span>':''}
    </div>`).join('');
  openDlg('dlg-acc');
}

function setAccent(name) {
  DB.settings.accentName = name;
  save(); applyTheme();
  document.getElementById('acc-sub').textContent = name;
  closeDlg('dlg-acc'); snack('Accent updated');
}

// ── DELETE / CONFIRM ───────────────────────────────────
function delItem(type, id) {
  closeDlg('dlg-cfm');
  closeDlg('dlg-qact');
  if (type==='quote')  {
    DB.quotes    = DB.quotes.filter(q=>q.id!==id);
    closeDlg('dlg-qd');
  }
  if (type==='inv')    { DB.inventory = DB.inventory.filter(i=>i.id!==id); closeDlg('dlg-inv');  }
  if (type==='cust')   { DB.customers = DB.customers.filter(c=>c.id!==id); closeDlg('dlg-cust'); }
  if (type==='co')     {
    DB.companies = DB.companies.filter(c=>c.id!==id);
    closeDlg('dlg-co');
    // If we deleted the active company, switch to first available
    if (DB.settings.activeCompanyId === id) {
      DB.settings.activeCompanyId = DB.companies[0]?.id || null;
    }
  }
  if (type==='sp')     {
    DB.salespeople = DB.salespeople.filter(s=>s.id!==id);
    closeDlg('dlg-spe');
    renderSPList();
  }
  save();
  renderPage(curPage);
  snack('Deleted successfully');
}

function confirmAct(msg, fn) {
  document.getElementById('cfm-ttl').textContent = 'Confirm';
  document.getElementById('cfm-msg').textContent = msg;
  document.getElementById('cfm-ok').onclick = () => { fn(); closeDlg('dlg-cfm'); };
  openDlg('dlg-cfm');
}

// ── DATA EXPORT / IMPORT ───────────────────────────────
function exportData() {
  const b = new Blob([JSON.stringify(DB,null,2)],{type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = 'quotes-backup-'+new Date().toISOString().slice(0,10)+'.json';
  a.click(); snack('Data exported');
}
function importData() {
  const inp = document.createElement('input'); inp.type='file'; inp.accept='.json';
  inp.onchange = e => {
    const f=e.target.files[0]; if(!f) return;
    const r=new FileReader();
    r.onload = ev => {
      try {
        const d=JSON.parse(ev.target.result);
        if (d.companies&&d.quotes) { DB=d; save(); applyTheme(); renderPage(curPage); snack('Data imported'); }
        else snack('Invalid backup file');
      } catch { snack('Error reading file'); }
    };
    r.readAsText(f);
  };
  inp.click();
}

// ── MORE MENU ──────────────────────────────────────────
function openMore() {
  document.getElementById('more-body').innerHTML = `
    <div style="padding:12px 16px 6px;font-size:11px;color:var(--t2);font-weight:700;text-transform:uppercase;letter-spacing:.5px">Options</div>
    <div class="si" onclick="renderPage(curPage);closeDlg('dlg-more')">
      <div class="si-ic"><span class="material-icons-round">refresh</span></div>
      <div class="si-tx"><div class="si-m">Refresh</div></div>
    </div>
    ${curPage==='quotes'?`<div class="si" onclick="setQF('all');closeDlg('dlg-more')">
      <div class="si-ic"><span class="material-icons-round">filter_list_off</span></div>
      <div class="si-tx"><div class="si-m">Clear Filter</div></div>
    </div>`:''}
    <div class="sp-s"></div>`;
  openDlg('dlg-more');
}

// ── DIALOGS ────────────────────────────────────────────
function openDlg(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
  if (id==='dlg-prev') setTimeout(scalePreview, 80);
}
function closeDlg(id) {
  document.getElementById(id).classList.remove('open');
  if (!document.querySelector('.bd.open')) document.body.style.overflow = '';
}
// Tap backdrop to close (non-full sheets)
document.querySelectorAll('.bd:not(.ful)').forEach(bd => {
  bd.addEventListener('click', e => { if (e.target===bd) closeDlg(bd.id); });
});

// ── SNACKBAR ───────────────────────────────────────────
let _st;
function snack(msg, actLbl='', actFn=null) {
  const el = document.getElementById('snack');
  document.getElementById('snack-msg').textContent = msg;
  const act = document.getElementById('snack-act');
  act.textContent = actLbl; act.onclick = actFn;
  act.style.display = actLbl ? '' : 'none';
  el.classList.add('show');
  clearTimeout(_st);
  _st = setTimeout(() => el.classList.remove('show'), 3200);
}

// ── BOOT ───────────────────────────────────────────────
load();
applyTheme();
// Set initial FAB state before go() call
document.getElementById('fab-lbl').textContent = 'New Quote';
document.getElementById('fab').classList.remove('gone');
go('dashboard');

// Service Worker
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
