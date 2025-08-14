/* v4 - ES5 compatible with themes, charts, CSV import, PIN, presets */
(function(){
  'use strict';

  function uuidv4(){ try{
    if (window.crypto && window.crypto.getRandomValues) {
      var buf = new Uint8Array(16);
      window.crypto.getRandomValues(buf);
      buf[6] = (buf[6] & 0x0f) | 0x40; buf[8] = (buf[8] & 0x3f) | 0x80;
      function hex(n){ return ('0'+n.toString(16)).slice(-2); }
      var b = []; for(var i=0;i<buf.length;i++) b.push(hex(buf[i]));
      return b[0]+b[1]+b[2]+b[3]+b[4]+b[5]+'-'+b[6]+b[7]+'-'+b[8]+b[9]+'-'+b[10]+b[11]+'-'+b[12]+b[13]+b[14]+b[15];
    }}catch(e){} return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0,v=c==='x'?r:(r&0x3|0x8);return v.toString(16);}); }

  function qs(sel, root){ return (root||document).querySelector(sel); }
  function qsa(sel, root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }

  var state = {
    settings: { currency:'EUR', categories:['Logement','Courses','Transport','Santé','Divertissement','Épargne','Voyage','Abonnements','Impôts','Frais bancaires','ESE','Air Liquide','CNDX','BTC','LINK','RNDR','NEAR'], theme:'auto', pinHash:null, pinHint:'' },
    transactions: [], budgets: [], holds: [], dca: []
  };

  /* Storage */
  function save(){ try{ localStorage.setItem('mbi_data', JSON.stringify(state)); }catch(e){} }
  function load(){
    try{ var raw = localStorage.getItem('mbi_data'); if(raw){ var obj = JSON.parse(raw); if(obj && typeof obj==='object'){ state = obj; } } }catch(e){}
  }

  /* Theme */
  function applyTheme(){
    var b=document.body; b.classList.remove('theme-auto','theme-dark','theme-light');
    var t = (state.settings && state.settings.theme) || 'auto';
    b.classList.add('theme-'+t);
    var selects=[qs('#theme-select'), qs('#theme-select-dup')];
    for(var i=0;i<selects.length;i++){ if(selects[i]) selects[i].value=t; }
  }

  /* PIN */
  function simpleHash(s){
    // very simple hash for local use; not cryptographically secure
    var h=0,i,chr; if(!s) return '0';
    for(i=0;i<s.length;i++){ chr=s.charCodeAt(i); h=((h<<5)-h)+chr; h|=0; }
    return String(h);
  }
  function checkLock(){
    var overlay = qs('#lock-overlay'); if(!overlay) return;
    if(state.settings && state.settings.pinHash){
      overlay.classList.remove('hidden');
      var hint = qs('#pin-hint'); if(hint) hint.textContent = state.settings.pinHint ? ('Indice: '+state.settings.pinHint) : '';
      var input = qs('#pin-input');
      var unlock = qs('#pin-unlock');
      var forget = qs('#pin-forget');
      if(unlock) unlock.onclick = function(){ var v = (input.value||'').trim(); if(simpleHash(v)===state.settings.pinHash){ overlay.classList.add('hidden'); input.value=''; } else { alert('PIN incorrect'); } };
      if(forget) forget.onclick = function(){ if(confirm('Désactiver le PIN et réinitialiser ?')){ state.settings.pinHash=null; save(); overlay.classList.add('hidden'); } };
    }else{
      overlay.classList.add('hidden');
    }
  }

  /* Currency & helpers */
  function formatCurrency(n){ try{ return new Intl.NumberFormat('fr-FR',{style:'currency',currency: state.settings.currency||'EUR'}).format(n||0); }catch(e){ return '€'+(n||0); } }
  function labelType(t){ var m={income:'Revenu',expense:'Dépense',invest:'Investissement',transfer:'Virement'}; return m[t]||t; }
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g,function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]; }); }

  /* Category datalist */
  function refreshCategoryDatalist(){ var dl = qs('#category-list'); if(!dl) return; dl.innerHTML=''; for(var i=0;i<state.settings.categories.length;i++){ var o=document.createElement('option');o.value=state.settings.categories[i];dl.appendChild(o);} }

  /* Transactions table */
  function renderTransactions(){
    var tb = qs('#tx-table tbody'); if(!tb) return;
    var term = (qs('#tx-search')?qs('#tx-search').value.toLowerCase():'') || '';
    tb.innerHTML='';
    for(var i=0;i<state.transactions.length;i++){
      var t = state.transactions[i];
      if(JSON.stringify(t).toLowerCase().indexOf(term)===-1) continue;
      var tr = document.createElement('tr');
      tr.innerHTML = '<td>'+t.date+'</td><td>'+labelType(t.type)+'</td><td>'+t.account+'</td><td>'+t.category+'</td><td>'+escapeHtml(t.desc)+'</td><td>'+formatCurrency(t.amount)+'</td><td><button class="del" data-id="'+t.id+'">✕</button></td>';
      tb.appendChild(tr);
    }
    qsa('button.del', tb).forEach(function(b){
      b.addEventListener('click', function(){
        var id = b.getAttribute('data-id');
        state.transactions = state.transactions.filter(function(x){ return x.id!==id; });
        save(); renderTransactions(); renderDashboard(); renderBudgets();
      });
    });
  }

  /* Budgets */
  function renderBudgets(){
    var tb = qs('#budget-table tbody'); if(!tb) return;
    tb.innerHTML='';
    var now = new Date(); var y=now.getFullYear(), m=now.getMonth();
    var monthTx = state.transactions.filter(function(t){ var d=new Date(t.date); return d.getFullYear()===y && d.getMonth()===m && t.type==='expense'; });
    for(var i=0;i<state.budgets.length;i++){
      var b=state.budgets[i]; var spent=0;
      for(var j=0;j<monthTx.length;j++){ var t=monthTx[j]; if((t.category||'').toLowerCase()===(b.category||'').toLowerCase()) spent += Math.abs(Number(t.amount)||0); }
      var left=(Number(b.amount)||0)-spent;
      var tr=document.createElement('tr');
      tr.innerHTML='<td>'+b.category+'</td><td>'+formatCurrency(b.amount)+'</td><td>'+formatCurrency(spent)+'</td><td>'+formatCurrency(left)+'</td><td><button class="del" data-cat="'+b.category+'">✕</button></td>';
      tb.appendChild(tr);
    }
    qsa('button.del', tb).forEach(function(b){
      b.addEventListener('click', function(){ var c=b.getAttribute('data-cat'); state.budgets=state.budgets.filter(function(x){return x.category!==c;}); save(); renderBudgets(); });
    });
  }

  /* Holds & DCA */
  function renderHolds(){
    var tb = qs('#hold-table tbody'); if(!tb) return;
    tb.innerHTML='';
    var total = state.holds.reduce(function(s,h){ return s + (Number(h.value)||0); }, 0);
    for(var i=0;i<state.holds.length;i++){
      var h = state.holds[i]; var want = total * ((Number(h.target)||0)/100); var diff = want - (Number(h.value)||0);
      var tr = document.createElement('tr');
      tr.innerHTML = '<td>'+h.account+'</td><td>'+h.asset+'</td><td>'+formatCurrency(h.value)+'</td><td>'+Number(h.target||0).toFixed(1)+'%</td><td>'+formatCurrency(diff)+'</td><td><button class="del" data-key="'+h.account+'|'+h.asset+'">✕</button></td>';
      tb.appendChild(tr);
    }
    qsa('button.del', tb).forEach(function(b){
      b.addEventListener('click', function(){ var parts=b.getAttribute('data-key').split('|'); state.holds=state.holds.filter(function(x){return !(x.account===parts[0] && x.asset===parts[1]);}); save(); renderHolds(); });
    });
  }
  function renderDCA(){
    var tb = qs('#dca-table tbody'); if(!tb) return;
    tb.innerHTML='';
    var now = new Date(); var today = now.getDate();
    for(var i=0;i<state.dca.length;i++){
      var d = state.dca[i]; var next;
      if(today > Number(d.day)){ next = new Date(now.getFullYear(), now.getMonth()+1, Number(d.day)); } else { next = new Date(now.getFullYear(), now.getMonth(), Number(d.day)); }
      var tr=document.createElement('tr');
      tr.innerHTML='<td>'+d.asset+'</td><td>'+formatCurrency(d.amount)+'</td><td>'+d.day+'</td><td>'+next.toISOString().slice(0,10)+'</td><td><button class="del" data-asset="'+d.asset+'">✕</button></td>';
      tb.appendChild(tr);
    }
    qsa('button.del', tb).forEach(function(b){
      b.addEventListener('click', function(){ var asset=b.getAttribute('data-asset'); state.dca=state.dca.filter(function(x){return x.asset!==asset;}); save(); renderDCA(); });
    });
  }

  /* Charts */
  function drawBars(canvasId, entries){
    var canvas = qs('#'+canvasId); if(!canvas) return;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    var max = 1; for(var i=0;i<entries.length;i++) if(entries[i][1]>max) max=entries[i][1];
    var pad=20, barH=24, gap=10, left=160;
    ctx.fillStyle='#a9b1c7'; ctx.font='12px system-ui, -apple-system, Segoe UI';
    for(i=0;i<entries.length;i++){
      var e=entries[i]; var y=pad + 10 + i*(barH+gap);
      ctx.fillStyle='#a9b1c7'; ctx.fillText(e[0], 10, y+16);
      var w=(canvas.width - left - pad)*(e[1]/max);
      ctx.fillStyle='#6ea8fe'; ctx.fillRect(left, y, w, barH);
      ctx.fillStyle='#eef2ff'; ctx.fillText(formatCurrency(e[1]), left+w+6, y+16);
    }
    if(entries.length===0){ ctx.fillStyle='#a9b1c7'; ctx.fillText('Aucune donnée.', 10, 60); }
  }
  function drawCatChart(monthTx){
    var byCat={}; for(var i=0;i<monthTx.length;i++){ var t=monthTx[i]; if(t.type==='expense'){ byCat[t.category]=(byCat[t.category]||0)+Math.abs(Number(t.amount)||0); } }
    var entries=[],k; for(k in byCat){ if(byCat.hasOwnProperty(k)) entries.push([k,byCat[k]]); }
    entries.sort(function(a,b){return b[1]-a[1];}); entries = entries.slice(0,8);
    drawBars('catChart', entries);
  }
  function drawLineChart(months, incomes, expenses, savings){
    var canvas = qs('#lineChart'); if(!canvas) return;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    var W=canvas.width, H=canvas.height, pad=36;
    function maxArr(a){ var m=0; for(var i=0;i<a.length;i++) if(a[i]>m) m=a[i]; return m; }
    function minArr(a){ var m=0; for(var i=0;i<a.length;i++) if(a[i]<m) m=a[i]; return m; }
    var all = incomes.concat(expenses).concat(savings);
    var max = maxArr(all); var min=minArr(all);
    if(max===min){ max = min+1; }
    function yScale(v){ return pad + (H-2*pad) * (1 - (v - min)/(max-min)); }
    function xScale(i){ return pad + i*((W-2*pad)/(months.length-1||1)); }
    ctx.strokeStyle='#2a3770'; ctx.lineWidth=1; ctx.beginPath();
    for(var i=0;i<5;i++){ var y = pad + i*((H-2*pad)/4); ctx.moveTo(pad,y); ctx.lineTo(W-pad,y); }
    ctx.stroke();
    function drawLine(arr){
      ctx.beginPath();
      for(var i=0;i<arr.length;i++){ var x=xScale(i), y=yScale(arr[i]); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }
      ctx.stroke();
    }
    ctx.strokeStyle='#95f7c2'; drawLine(incomes);
    ctx.strokeStyle='#ef6b6b'; drawLine(expenses);
    ctx.strokeStyle='#6ea8fe'; drawLine(savings);
    ctx.fillStyle='#a9b1c7'; ctx.font='11px system-ui';
    for(i=0;i<months.length;i++){ var x=xScale(i); ctx.fillText(months[i], x-12, H-pad+14); }
  }

  /* Dashboard */
  function renderDashboard(){
    var now = new Date(); var y=now.getFullYear(), m=now.getMonth();
    var monthTx = state.transactions.filter(function(t){ var d=new Date(t.date); return d.getFullYear()===y && d.getMonth()===m; });
    var income = monthTx.filter(function(t){return t.type==='income';}).reduce(function(s,t){return s+(Number(t.amount)||0);},0);
    var expense = monthTx.filter(function(t){return t.type==='expense';}).reduce(function(s,t){return s+Math.abs(Number(t.amount)||0);},0);
    var invest = monthTx.filter(function(t){return t.type==='invest';}).reduce(function(s,t){return s+Math.abs(Number(t.amount)||0);},0);
    var cm = qs('#current-month-name'); if(cm) cm.textContent = now.toLocaleString('fr-FR',{month:'long',year:'numeric'});
    var mi = qs('#month-income'); if(mi) mi.textContent = formatCurrency(income);
    var me = qs('#month-expense'); if(me) me.textContent = formatCurrency(expense);
    var ms = qs('#month-saving'); if(ms) ms.textContent = formatCurrency(income - expense - invest);

    var global = state.transactions.reduce(function(s,t){ if(t.type==='income') return s + (Number(t.amount)||0); if(t.type==='expense'||t.type==='invest') return s - Math.abs(Number(t.amount)||0); return s; }, 0);
    var gb = qs('#global-balance'); if(gb) gb.textContent = formatCurrency(global);
    var gi = qs('#global-invest'); if(gi) gi.textContent = 'Dont investissement: ' + formatCurrency(invest);

    drawCatChart(monthTx);

    // build last 12 months series
    var months=[], incomes=[], expenses=[], savings=[];
    for(var i=11;i>=0;i--){
      var d = new Date(y, m-i, 1);
      var keyM = d.getMonth(), keyY = d.getFullYear();
      var tx = state.transactions.filter(function(t){ var dt=new Date(t.date); return dt.getFullYear()===keyY && dt.getMonth()===keyM; });
      var inc = tx.filter(function(t){return t.type==='income';}).reduce(function(s,t){return s+(Number(t.amount)||0);},0);
      var exp = tx.filter(function(t){return t.type==='expense';}).reduce(function(s,t){return s+Math.abs(Number(t.amount)||0);},0);
      var inv = tx.filter(function(t){return t.type==='invest';}).reduce(function(s,t){return s+Math.abs(Number(t.amount)||0);},0);
      months.push(d.toLocaleString('fr-FR',{month:'short'})); incomes.push(inc); expenses.push(exp); savings.push(inc-exp-inv);
    }
    drawLineChart(months, incomes, expenses, savings);
  }

  /* CSV import */
  function parseCSV(text){
    var lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
    var rows=[]; for(var i=0;i<lines.length;i++){ var line=lines[i]; if(!line.trim()) continue;
      var cells = []; var cur=''; var inQ=false;
      for(var j=0;j<line.length;j++){ var ch=line[j];
        if(ch==='"'){ if(inQ && line[j+1]==='"'){ cur+='"'; j++; } else { inQ=!inQ; } }
        else if(ch===',' && !inQ){ cells.push(cur); cur=''; }
        else { cur+=ch; }
      }
      cells.push(cur); rows.push(cells);
    }
    return rows;
  }
  function importGeneric(rows){
    // header: date,type,account,category,desc,amount
    var h = rows[0].map(function(s){return s.trim().toLowerCase();});
    if(h.indexOf('date')===-1 || h.indexOf('type')===-1 || h.indexOf('amount')===-1) throw new Error('En-têtes manquants');
    for(var i=1;i<rows.length;i++){
      var r=rows[i]; if(!r || r.length<6) continue;
      var tx = { id: uuidv4(), date:r[h.indexOf('date')], type:r[h.indexOf('type')], account:r[h.indexOf('account')]||'Banque', category:r[h.indexOf('category')]||'(Non classé)', desc:r[h.indexOf('desc')]||'', amount: Number((r[h.indexOf('amount')]||'0').replace(',','.')) };
      if(!tx.date) continue; state.transactions.unshift(tx);
    }
  }
  function importBoursorama(rows){
    // Heuristic: headers like "Date; Libellé; Catégorie; Montant"
    var header = rows[0].map(function(s){return s.trim().toLowerCase();});
    function idx(name){ var i=header.indexOf(name); return i<0? -1 : i; }
    var iDate = header.indexOf('date'); var iLib = header.indexOf('libellé'); if(iLib<0) iLib=header.indexOf('libelle');
    var iCat = header.indexOf('catégorie'); if(iCat<0) iCat=header.indexOf('categorie');
    var iAmt = header.indexOf('montant');
    if(iDate<0 || iAmt<0) throw new Error('Format Boursorama non reconnu');
    for(var i=1;i<rows.length;i++){
      var r=rows[i]; if(!r) continue;
      var amt = String(r[iAmt]||'0').replace('€','').replace('\u202f','').replace(' ','').replace(',','.');
      var tx = { id: uuidv4(), date: r[iDate], type: (Number(amt)>=0?'income':'expense'), account:'Banque', category: iCat>=0?(r[iCat]||''):'', desc: iLib>=0?(r[iLib]||''):'', amount: Math.abs(Number(amt)||0) };
      state.transactions.unshift(tx);
    }
  }
  function importTradeRepublic(rows){
    // Heuristic for TR CSV (simplified): headers include "Date","Type","Currency","Amount" etc.
    var h = rows[0].map(function(s){return s.trim().toLowerCase();});
    var iDate=h.indexOf('date'), iType=h.indexOf('type'), iCur=h.indexOf('currency'), iAmt=h.indexOf('amount'), iNotes=h.indexOf('notes');
    if(iDate<0 or iAmt<0){ iDate=0; iAmt=rows[0].length-1; }
    for(var i=1;i<rows.length;i++){
      var r=rows[i]; if(!r) continue;
      var amt = Number(String(r[iAmt]||'0').replace(',','.'));
      // Treat positive as expense (buy) or income (sell)? We'll classify: negative = expense, positive = income
      var txType = amt<0 ? 'expense' : 'income';
      var tx = { id: uuidv4(), date:r[iDate], type: txType, account:'CTO', category: (r[iType]||'TR'), desc: (iNotes>=0?(r[iNotes]||''):''), amount: Math.abs(amt) };
      state.transactions.unshift(tx);
    }
  }

  /* Export */
  function exportJSON(){
    var data = JSON.stringify(state, null, 2);
    download('mon_budget_invest_v4.json', data, 'application/json');
  }
  function exportCSV(){
    var header = 'date,type,account,category,desc,amount\n';
    var rows = state.transactions.map(function(t){ return [t.date,t.type,t.account,escapeCsv(t.category),escapeCsv(t.desc),t.amount].join(','); });
    download('transactions_v4.csv', header + rows.join('\n'), 'text/csv');
  }
  function escapeCsv(s){ return '"' + String(s||'').replace(/"/g,'""') + '"'; }
  function download(name, content, type){
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], {type:type})); a.download = name; a.click();
  }

  /* Presets based on user's portfolio */
  function applyPresets(){
    // Holdings presets (values can be edited)
    var presetsH = [
      {account:'PEA', asset:'ESE (BNP Easy S&P 500 EURH C)', target:50, value:3520.73},
      {account:'PEA', asset:'Air Liquide', target:20, value:695.12},
      {account:'PEA', asset:'Amundi MSCI Emerging Markets (PEA)', target:10, value:517.00},
      {account:'CTO', asset:'CNDX (iShares Nasdaq 100 Acc)', target:10, value:0},
      {account:'Crypto', asset:'BTC', target:4.5, value:296.95},
      {account:'Crypto', asset:'LINK', target:2.6, value:169.67},
      {account:'Crypto', asset:'RNDR', target:1.5, value:47.19},
      {account:'Crypto', asset:'NEAR', target:1.7, value:101.85}
    ];
    for(var i=0;i<presetsH.length;i++){
      var ph=presetsH[i]; var idx=-1; for(var j=0;j<state.holds.length;j++){ var h=state.holds[j]; if((h.account+'|'+h.asset).toLowerCase()===(ph.account+'|'+ph.asset).toLowerCase()){ idx=j; break; } }
      if(idx>=0){ state.holds[idx].target=ph.target; if(ph.value) state.holds[idx].value=ph.value; } else { state.holds.push(ph); }
    }
    // DCA presets
    var presetsD = [
      {asset:'ESE (BNP Easy S&P 500 EURH C)', amount:300, day:5},
      {asset:'Air Liquide', amount:100, day:6},
      {asset:'CNDX (iShares Nasdaq 100 Acc)', amount:250, day:10},
      {asset:'BTC', amount:45, day:3},
      {asset:'LINK', amount:45, day:3},
      {asset:'RNDR', amount:37.5, day:3},
      {asset:'NEAR', amount:22.5, day:3}
    ];
    for(i=0;i<presetsD.length;i++){
      var pd=presetsD[i]; var id=-1; for(j=0;j<state.dca.length;j++){ if((state.dca[j].asset||'').toLowerCase()===(pd.asset||'').toLowerCase()){ id=j; break; } }
      if(id>=0){ state.dca[id].amount=pd.amount; state.dca[id].day=pd.day; } else { state.dca.push(pd); }
    }
    save(); renderHolds(); renderDCA(); alert('Presets appliqués ✅');
  }

  /* Event bindings */
  function bindTabs(){
    var buttons = qsa('.tab-button');
    for(var i=0;i<buttons.length;i++){
      (function(btn){
        btn.addEventListener('click', function(){
          qsa('.tab-button').forEach(function(b){ b.classList.remove('active'); });
          qsa('.tab').forEach(function(t){ t.classList.remove('active'); });
          btn.classList.add('active');
          var id = btn.getAttribute('data-tab');
          var sec = qs('#'+id); if(sec) sec.classList.add('active');
          if(id==='dashboard') renderDashboard();
          if(id==='budgets') renderBudgets();
          if(id==='transactions') renderTransactions();
          if(id==='invest'){ renderHolds(); renderDCA(); }
        });
      })(buttons[i]);
    }
  }
  function bindForms(){
    var themeSel1 = qs('#theme-select'), themeSel2 = qs('#theme-select-dup');
    function setThemeFrom(sel){ state.settings.theme = sel.value; save(); applyTheme(); }
    if(themeSel1) themeSel1.onchange = function(){ setThemeFrom(themeSel1); };
    if(themeSel2) themeSel2.onchange = function(){ setThemeFrom(themeSel2); };

    var txDate = qs('#tx-date'); if(txDate) try{ txDate.valueAsDate = new Date(); }catch(e){}
    var txForm = qs('#tx-form');
    if(txForm) txForm.addEventListener('submit', function(e){
      e.preventDefault();
      var amt = Number(qs('#tx-amount').value||0); if(!qs('#tx-date').value || !amt){ alert('Date et montant requis.'); return; }
      var tx = { id: uuidv4(), type: qs('#tx-type').value, date: qs('#tx-date').value, account: qs('#tx-account').value, category: qs('#tx-category').value || '(Non classé)', desc: qs('#tx-desc').value || '', amount: amt };
      state.transactions.unshift(tx); save(); txForm.reset(); try{ qs('#tx-date').valueAsDate = new Date(); }catch(e){}
      renderTransactions(); renderDashboard(); renderBudgets();
    });
    var txClear = qs('#tx-clear'); if(txClear) txClear.addEventListener('click', function(){ if(confirm('Supprimer toutes les transactions ?')){ state.transactions=[]; save(); renderTransactions(); renderDashboard(); renderBudgets(); } });
    var txSearch = qs('#tx-search'); if(txSearch) txSearch.addEventListener('input', renderTransactions);

    var budgetForm = qs('#budget-form'); if(budgetForm) budgetForm.addEventListener('submit', function(e){
      e.preventDefault(); var cat=(qs('#budget-category').value||'').trim(); var amt=Number(qs('#budget-amount').value||0); if(!cat){ alert('Catégorie requise.'); return; }
      var i, idx=-1; for(i=0;i<state.budgets.length;i++){ if((state.budgets[i].category||'').toLowerCase()===(cat||'').toLowerCase()){ idx=i; break; } }
      if(idx>=0) state.budgets[idx].amount=amt; else state.budgets.push({category:cat, amount:amt}); save(); budgetForm.reset(); renderBudgets();
    });
    var budgetClear = qs('#budget-clear'); if(budgetClear) budgetClear.addEventListener('click', function(){ if(confirm('Effacer tous les budgets ?')){ state.budgets=[]; save(); renderBudgets(); } });

    var holdForm = qs('#hold-form'); if(holdForm) holdForm.addEventListener('submit', function(e){
      e.preventDefault(); var account=qs('#hold-account').value; var asset=(qs('#hold-asset').value||'').trim(); var target=Number(qs('#hold-target').value||0); var value=Number(qs('#hold-value').value||0);
      if(!asset){ alert('Actif requis.'); return; } var i, idx=-1; for(i=0;i<state.holds.length;i++){ var h=state.holds[i]; if((h.account+'|'+h.asset).toLowerCase()===(account+'|'+asset).toLowerCase()){ idx=i; break; } }
      if(idx>=0){ state.holds[idx].target=target; state.holds[idx].value=value; } else { state.holds.push({account:account, asset:asset, target:target, value:value}); } save(); holdForm.reset(); renderHolds();
    });

    var dcaForm = qs('#dca-form'); if(dcaForm) dcaForm.addEventListener('submit', function(e){
      e.preventDefault(); var asset=(qs('#dca-asset').value||'').trim(); var amount=Number(qs('#dca-amount').value||0); var day=Number(qs('#dca-day').value||1);
      if(!asset){ alert('Actif requis.'); return; } var i, idx=-1; for(i=0;i<state.dca.length;i++){ if((state.dca[i].asset||'').toLowerCase()===(asset||'').toLowerCase()){ idx=i; break; } }
      if(idx>=0){ state.dca[idx].amount=amount; state.dca[idx].day=day; } else { state.dca.push({asset:asset, amount:amount, day:day}); } save(); dcaForm.reset(); renderDCA();
    });

    var saveSettings = qs('#save-settings'); if(saveSettings) saveSettings.addEventListener('click', function(){
      state.settings.currency = qs('#currency').value;
      var cats = (qs('#suggested-cats').value||'').split(','); var out=[]; for(var i=0;i<cats.length;i++){ var s=(cats[i]||'').trim(); if(s) out.push(s); }
      if(out.length) state.settings.categories = out;
      var pin = (qs('#pin-set').value||'').trim(); var hint = (qs('#pin-hint-input').value||'').trim();
      state.settings.pinHash = pin? simpleHash(pin) : null; state.settings.pinHint = hint;
      var tsel = qs('#theme-select-dup'); if(tsel) state.settings.theme = tsel.value;
      save(); applyTheme(); refreshCategoryDatalist(); checkLock(); alert('Paramètres enregistrés.');
    });

    var resetAll = qs('#reset-all'); if(resetAll) resetAll.addEventListener('click', function(){ if(confirm('Supprimer TOUTES les données ?')){ localStorage.removeItem('mbi_data'); location.reload(); } });

    var presetBtn = qs('#preset-btn'); if(presetBtn) presetBtn.addEventListener('click', applyPresets);

    var exJson = qs('#export-json'); if(exJson) exJson.addEventListener('click', exportJSON);
    var exCsv = qs('#export-csv'); if(exCsv) exCsv.addEventListener('click', exportCSV);

    var impJson = qs('#import-json'); if(impJson) impJson.addEventListener('change', function(e){
      var file = e.target.files[0]; if(!file) return;
      var fr = new FileReader(); fr.onload = function(){ try{ var data=JSON.parse(fr.result); if(!data.transactions){ throw new Error('Fichier invalide'); } state=data; save(); applyTheme(); refreshCategoryDatalist(); renderAll(); checkLock(); alert('Import réussi.'); }catch(err){ alert('Échec import: '+err.message); } }; fr.readAsText(file);
    });

    var impCsv = qs('#import-csv'); if(impCsv) impCsv.addEventListener('change', function(e){
      var file=e.target.files[0]; if(!file) return; var srcSel=qs('#csv-source'); var src=srcSel?srcSel.value:'generic';
      var fr=new FileReader(); fr.onload=function(){ try{ var rows=parseCSV(fr.result); if(!rows.length) throw new Error('Vide');
        if(src==='generic') importGeneric(rows); else if(src==='boursorama') importBoursorama(rows); else if(src==='traderepublic') importTradeRepublic(rows);
        save(); renderTransactions(); renderDashboard(); renderBudgets(); alert('Import CSV réussi.'); }catch(err){ alert('Échec import CSV: '+err.message); } };
      fr.readAsText(file);
    });
  }

  function renderAll(){ refreshCategoryDatalist(); renderDashboard(); renderTransactions(); renderBudgets(); renderHolds(); renderDCA(); }

  function init(){
    load(); applyTheme(); bindTabs(); bindForms(); renderAll(); checkLock();
  }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();