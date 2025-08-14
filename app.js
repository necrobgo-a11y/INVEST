
(function(){
'use strict';
function qs(s,r){return (r||document).querySelector(s)}
function qsa(s,r){return Array.from((r||document).querySelectorAll(s))}
function cur(n,c){try{return new Intl.NumberFormat('fr-FR',{style:'currency',currency:c||'EUR'}).format(+n||0)}catch(e){return '€'+(+n||0)}}
function esc(s){return String(s||'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}

const KEY='budget_step_app_v1';
let state={settings:{theme:'auto',currency:'EUR'},transactions:[],budgets:[],holds:[],dca:[],goals:[]};
function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}}
function load(){try{const j=localStorage.getItem(KEY);if(j){const o=JSON.parse(j);if(o&&typeof o==='object')state=o}}catch(e){}}
function applyTheme(){const t=state.settings.theme||'auto';document.body.classList.remove('theme-auto','theme-dark','theme-light');document.body.classList.add('theme-'+t);const sel=qs('#theme');if(sel)sel.value=t;}

// Router
const routes={};
function route(path,render){routes[path]=render;}
function nav(){const path=location.hash.replace('#','')||'#/dashboard';qsa('.navlink').forEach(a=>a.classList.toggle('active',a.getAttribute('href')===path));(routes[path]||routes['#/dashboard'])();}
window.addEventListener('hashchange',nav);

// Dashboard
function viewDashboard(){qs('#view').innerHTML=`
<section class="grid">
  <div class="card glass">
    <h3>Vue rapide</h3>
    <div class="grid">
      <div class="metric"><div class="label">Capital total</div><div class="val" id="k_total">€0</div></div>
      <div class="metric"><div class="label">Variation du mois</div><div class="val" id="k_var">€0</div></div>
      <div class="metric"><div class="label">Taux d’épargne</div><div class="val" id="k_save">0%</div></div>
    </div>
    <p class="muted">Ajoute 2–3 transactions pour voir les chiffres.</p>
  </div>
  <div class="card glass"><h3>Dépenses par catégorie (mois)</h3><canvas id="bar" width="700" height="260"></canvas></div>
  <div class="card glass"><h3>Flux 12 mois</h3><canvas id="line" width="900" height="260"></canvas></div>
</section>`;renderDashboard();}
function renderDashboard(){const now=new Date(),y=now.getFullYear(),m=now.getMonth();const month=state.transactions.filter(t=>{const d=new Date(t.date);return d.getFullYear()===y&&d.getMonth()===m;});let inc=0,exp=0,inv=0;month.forEach(t=>{if(t.type==='income')inc+=+t.amount;else if(t.type==='expense')exp+=Math.abs(+t.amount);else if(t.type==='invest')inv+=Math.abs(+t.amount);});let global=0;state.transactions.forEach(t=>{if(t.type==='income')global+=+t.amount;else if(t.type==='expense'||t.type==='invest')global-=Math.abs(+t.amount);});const k_total=qs('#k_total'),k_var=qs('#k_var'),k_save=qs('#k_save');if(k_total)k_total.textContent=cur(global,state.settings.currency);if(k_var)k_var.textContent=cur(inc-exp-inv,state.settings.currency);if(k_save)k_save.textContent=inc?(((inc-exp-inv)/Math.max(1,inc))*100).toFixed(1)+'%':'0%';const bar=qs('#bar');if(bar){const x=bar.getContext('2d');x.clearRect(0,0,bar.width,bar.height);x.fillStyle='#9aa3bb';x.fillText('Graph barres (placeholder)',10,20);}const line=qs('#line');if(line){const x=line.getContext('2d');x.clearRect(0,0,line.width,line.height);x.fillStyle='#9aa3bb';x.fillText('Courbe 12 mois (placeholder)',10,20);}}

// Transactions
function viewTx(){qs('#view').innerHTML=`
<section class="card glass">
  <h3>Transactions</h3>
  <form id="txf" class="form">
    <label>Type <select id="tt"><option value="income">Revenu</option><option value="expense">Dépense</option><option value="invest">Investissement</option></select></label>
    <label>Date <input type="date" id="td" /></label>
    <label>Compte <select id="ta"><option>Banque</option><option>PEA</option><option>CTO</option><option>Crypto</option></select></label>
    <label>Catégorie <input id="tc" placeholder="Courses, Logement..." /></label>
    <label>Description <input id="te" placeholder="Note" /></label>
    <label>Montant (€) <input id="tm" type="number" step="0.01" /></label>
    <button class="btn-primary">Ajouter</button>
  </form>
  <div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Type</th><th>Compte</th><th>Catégorie</th><th>Description</th><th>Montant</th></tr></thead><tbody id="tb"></tbody></table></div>
</section>`;try{qs('#td').valueAsDate=new Date();}catch(e){}qs('#txf').addEventListener('submit',e=>{e.preventDefault();const t={date:qs('#td').value,type:qs('#tt').value,account:qs('#ta').value,category:qs('#tc').value||'(NC)',desc:qs('#te').value||'',amount:+(qs('#tm').value||0)};if(!t.date||!t.amount){alert('Date et montant requis');return;}state.transactions.unshift(t);save();renderTx();});renderTx();}
function renderTx(){const tb=qs('#tb');if(!tb)return;tb.innerHTML='';state.transactions.forEach(t=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${t.date}</td><td>${t.type}</td><td>${t.account}</td><td>${t.category}</td><td>${esc(t.desc)}</td><td>${cur(t.amount,state.settings.currency)}</td>`;tb.appendChild(tr);});renderDashboard();}

// Budgets
function viewBdg(){qs('#view').innerHTML=`
<section class="card glass">
  <h3>Budgets</h3>
  <form id="bf" class="form">
    <label>Catégorie <input id="bc" /></label>
    <label>Montant (€) <input id="ba" type="number" step="0.01" /></label>
    <button class="btn-primary">Ajouter / MAJ</button>
  </form>
  <div class="table-wrap"><table class="table"><thead><tr><th>Catégorie</th><th>Budget</th></tr></thead><tbody id="bb"></tbody></table></div>
</section>`;qs('#bf').addEventListener('submit',e=>{e.preventDefault();const c=(qs('#bc').value||'').trim();const a=+(qs('#ba').value||0);if(!c){alert('Catégorie requise');return;}const idx=state.budgets.findIndex(x=>x.category.toLowerCase()===c.toLowerCase());if(idx>=0)state.budgets[idx].amount=a;else state.budgets.push({category:c,amount:a});save();renderBdg();});renderBdg();}
function renderBdg(){const tb=qs('#bb');if(!tb)return;tb.innerHTML='';state.budgets.forEach(b=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${b.category}</td><td>${cur(b.amount,state.settings.currency)}</td>`;tb.appendChild(tr);});}

// Invest (placeholder)
function viewInv(){qs('#view').innerHTML=`<section class="card glass"><h3>Invest</h3><p class="muted">Section simplifiée provisoire.</p></section>`;}

// Goals
function viewGoals(){qs('#view').innerHTML=`
<section class="card glass">
  <h3>Objectifs</h3>
  <form id="gf" class="form">
    <label>Nom <input id="gn" placeholder="Ex: Capital 50 000 €" /></label>
    <label>Type <select id="gt"><option value="networth">Capital total</option><option value="saving">Épargne mensuelle</option></select></label>
    <label>Cible (€) <input id="ga" type="number" step="0.01" /></label>
    <button class="btn-primary">Ajouter / MAJ</button>
  </form>
  <div class="table-wrap"><table class="table"><thead><tr><th>Nom</th><th>Type</th><th>Cible</th></tr></thead><tbody id="gb"></tbody></table></div>
</section>`;qs('#gf').addEventListener('submit',e=>{e.preventDefault();const n=(qs('#gn').value||'').trim(),t=qs('#gt').value,a=+(qs('#ga').value||0);if(!n||!a){alert('Nom et cible requis');return;}const idx=state.goals.findIndex(g=>g.name.toLowerCase()===n.toLowerCase());const g={name:n,type:t,target:a};if(idx>=0)state.goals[idx]=g;else state.goals.push(g);save();renderGoals();});renderGoals();}
function renderGoals(){const tb=qs('#gb');if(!tb)return;tb.innerHTML='';state.goals.forEach(g=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${esc(g.name)}</td><td>${g.type}</td><td>${cur(g.target,state.settings.currency)}</td>`;tb.appendChild(tr);});}

// Analysis
function viewAnalysis(){qs('#view').innerHTML=`<section class="card glass"><h3>Analyses</h3><p class="muted">Ajoute quelques transactions pour voir les métriques sur le Dashboard.</p></section>`;}

// IO
function viewIO(){qs('#view').innerHTML=`
<section class="card glass">
  <h3>Import / Export</h3>
  <div class="form">
    <button id="exj" class="btn-primary">Exporter JSON</button>
    <button id="exc">Exporter CSV (transactions)</button>
    <label class="glass" style="padding:10px;border-radius:12px">Import JSON<input id="imj" type="file" accept=".json" style="display:none"></label>
    <label class="glass" style="padding:10px;border-radius:12px">Importer CSV générique<input id="imc" type="file" accept=".csv" style="display:none"></label>
  </div>
  <p class="muted">Données locales (navigateur). Pense à sauvegarder.</p>
</section>`;
qs('#exj').onclick=function(){const data=JSON.stringify(state,null,2);dl('budget.json',data,'application/json');};
qs('#exc').onclick=function(){const header='date,type,account,category,desc,amount\n';const rows=state.transactions.map(t=>[t.date,t.type,t.account,t.category,esc(t.desc),t.amount].join(','));dl('transactions.csv',header+rows.join('\n'),'text/csv');};
qs('#imj').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const fr=new FileReader();fr.onload=()=>{try{const d=JSON.parse(fr.result);if(!d.transactions)throw new Error('Fichier invalide');state=d;save();nav();alert('Import JSON OK');}catch(err){alert('Import raté: '+err.message);} };fr.readAsText(f);});
qs('#imc').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const fr=new FileReader();fr.onload=()=>{try{const rows=parseCSV(fr.result);importGeneric(rows);save();nav();alert('Import CSV OK');}catch(err){alert('Import CSV raté: '+err.message);} };fr.readAsText(f);});
}
function dl(name,content,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type:type}));a.download=name;a.click();}
function parseCSV(txt){const lines=txt.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');const rows=[];for(let i=0;i<lines.length;i++){const line=lines[i];if(!line.trim())continue;const cells=[],re=/("([^"]|"")*"|[^,]+)/g;let m;while((m=re.exec(line))!==null){let cell=m[0];if(cell.startsWith('"')&&cell.endsWith('"'))cell=cell.slice(1,-1).replace(/""/g,'"');cells.push(cell);}rows.push(cells);}return rows;}
function importGeneric(rows){const h=rows[0].map(s=>String(s).trim().toLowerCase());const id=k=>h.indexOf(k);if(id('date')<0||id('type')<0||id('amount')<0)throw new Error('En-têtes requis: date,type,amount');for(let i=1;i<rows.length;i++){const r=rows[i];if(!r||!r.length)continue;const tx={date:r[id('date')],type:r[id('type')],account:r[id('account')]||'Banque',category:r[id('category')]||'(NC)',desc:r[id('desc')]||'',amount:+String(r[id('amount')]||'0').replace(',','.')};if(!tx.date)continue;state.transactions.unshift(tx);}}

// Settings
function viewSet(){qs('#view').innerHTML=`
<section class="card glass">
  <h3>Paramètres</h3>
  <div class="form">
    <label>Thème <select id="th"><option value="auto">Auto</option><option value="dark">Sombre</option><option value="light">Clair</option></select></label>
    <label>Devise <select id="cu"><option value="EUR">EUR (€)</option><option value="USD">USD ($)</option></select></label>
    <button id="sav" class="btn-primary">Enregistrer</button>
    <button id="rst" class="btn-danger">Réinitialiser</button>
  </div>
</section>`;const th=qs('#th'),cu=qs('#cu');th.value=state.settings.theme;cu.value=state.settings.currency;qs('#sav').onclick=function(){state.settings.theme=th.value;state.settings.currency=cu.value;save();applyTheme();alert('Paramètres enregistrés');};qs('#rst').onclick=function(){if(confirm('Supprimer TOUTES les données ?')){localStorage.removeItem(KEY);location.reload();}};}

// INIT
function init(){load();applyTheme();
  route('#/dashboard',viewDashboard);
  route('#/transactions',viewTx);
  route('#/budgets',viewBdg);
  route('#/invest',viewInv);
  route('#/goals',viewGoals);
  route('#/analysis',viewAnalysis);
  route('#/io',viewIO);
  route('#/settings',viewSet);
  if(!location.hash)location.hash='#/dashboard';
  nav();
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
