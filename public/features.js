/* Bílaleit – viðbætur: „Hvað er bíllinn minn virði?“, lán og rekstrarkostnaður, markaðsyfirlit og kort.
   Byggir á window.App (app.js). */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var A = window.App;
  var NOW = new Date().getFullYear();
  var H = null, HSTART = '';
  function esc(s) { return A.esc(s); }
  function mkr(n) { return A.mkrShort(n) + ' m.kr.'; }
  function median(a) { a = a.slice().sort(function (x, y) { return x - y; }); return a.length ? a[a.length >> 1] : 0; }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function num(id) {
    var el = $(id), raw = String(el.value);
    if (el.hasAttribute('data-fmt')) raw = raw.replace(/\./g, '');  // 20.000 -> 20000
    var v = parseFloat(raw.replace(',', '.')); return isNaN(v) ? 0 : v;
  }
  // verðreitir sýna þúsundaskil (20.000) meðan skrifað er
  function fmtThousands(v) { var d = String(v).replace(/[^\d]/g, ''); return d ? (+d).toLocaleString('de-DE') : ''; }
  document.addEventListener('input', function (e) {
    var el = e.target; if (!el.hasAttribute || !el.hasAttribute('data-fmt')) return;
    var fromEnd = el.value.length - (el.selectionEnd || el.value.length);
    el.value = fmtThousands(el.value);
    var pos = Math.max(0, el.value.length - fromEnd); try { el.setSelectionRange(pos, pos); } catch (er) {}
  }, true);
  function today() { var d = new Date(); return '' + d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2); }

  // ---------- 🆕 Nýtt / 📉 Lækkað í verði ----------
  $('views').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-view]') : null;
    if (b) A.setView(b.getAttribute('data-view'));
  });
  function historyReady(hist, start) {
    H = hist; HSTART = start;
    var cs = A.cars();
    var nNew = cs.filter(function (c) { return c.isNew; }).length, nDrop = cs.filter(function (c) { return c.drop; }).length;
    $('nNew').textContent = nNew || '';
    $('nDrop').textContent = nDrop || '';
    heroStats();
    if (!nNew && !nDrop) $('views').title = 'Sagan byrjaði ' + A.dayFmt(start) + '. Nýir bílar og verðlækkanir birtast hér eftir næstu uppfærslur (á hverri nóttu).';
  }

  // ---------- 💰 Hvað er bíllinn minn virði? ----------
  var FUEL_TXT = { 'Bensín': 'Bensín', 'Dísel': 'Dísel', 'Rafmagn': 'Rafmagn', 'Tvinn': 'Bensín / Rafmagn', 'Tengiltvinn': 'Bensín / Rafmagn' };
  function modelsFor(mk) {
    var cnt = {};
    A.cars().forEach(function (c) { if (c.make === mk) cnt[c.base] = (cnt[c.base] || 0) + 1; });
    A.catalogBases(mk).forEach(function (b) { if (!cnt[b]) cnt[b] = 0; });
    return Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a] || (a < b ? -1 : 1); }).map(function (b) { return { b: b, n: cnt[b] }; });
  }
  function openValue(prefill) {
    if (prefill && prefill.make) store('valuation', Object.assign({ km: 150000 }, store('valuation') || {}, prefill));
    var last = store('valuation') || {}, f = A.readFilters();
    var mk = last.make || f.make || 'TOYOTA';
    A.openModal('<div class="m"><div class="m-head"><h2>💰 Hvað er bíllinn minn virði?</h2><button class="x" data-close aria-label="Loka">×</button></div>' +
      '<p class="note">Sláðu inn bílinn þinn. Matið byggir á öllum auglýsingum á skrá núna, leiðrétt fyrir aldri, akstri, eldsneyti og útgáfu.</p>' +
      '<form id="valForm" class="val-form">' +
      '<label>Tegund<select id="vMake">' + A.makes().map(function (m) { return '<option value="' + esc(m) + '"' + (m === mk ? ' selected' : '') + '>' + esc(A.cap(m)) + '</option>'; }).join('') + '</select></label>' +
      '<label>Gerð<select id="vModel"></select></label>' +
      '<label>Árgerð<input id="vYear" type="number" inputmode="numeric" min="1970" max="' + (NOW + 1) + '" value="' + (last.year || NOW - 6) + '" required></label>' +
      '<label>Ekinn (km)<input id="vKm" type="text" inputmode="numeric" data-fmt value="' + fmtThousands(last.km != null ? last.km : 90000) + '" required></label>' +
      '<label>Eldsneyti<select id="vFuel">' + ['Bensín', 'Dísel', 'Tvinn', 'Tengiltvinn', 'Rafmagn'].map(function (x) { return '<option' + (x === last.fuel ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label>' +
      '<label>Skipting<select id="vTrans"><option value="sj"' + (last.trans !== 'bein' ? ' selected' : '') + '>Sjálfskipting</option><option value="bein"' + (last.trans === 'bein' ? ' selected' : '') + '>Beinskipting</option></select></label>' +
      '<label class="wide">Útgáfa / vél (valfrjálst)<input id="vExtra" type="text" placeholder="t.d. 500, 220 CDI, 330e, AMG 45, GTI, Performance" value="' + esc(last.extra || '') + '"></label>' +
      '<button type="submit" class="btn-cta wide">Meta bílinn</button></form><div id="valOut"></div></div>');
    function fillM() {
      var ms = modelsFor($('vMake').value), want = last.model;
      $('vModel').innerHTML = ms.map(function (x) {
        return '<option value="' + esc(x.b) + '"' + (x.b === want ? ' selected' : '') + '>' + esc(A.cap(x.b)) + (x.n ? ' (' + x.n + ' á sölu)' : '') + '</option>';
      }).join('');
    }
    fillM();
    $('vMake').addEventListener('change', function () { last.model = ''; fillM(); });
    $('valForm').addEventListener('submit', function (e) { e.preventDefault(); runValue(); });
    if (last.make) runValue();
  }
  function estimateMine(v) {
    var full = (v.model + ' ' + (v.extra || '')).toUpperCase();
    var c = A.prep({ id: 'val', make: v.make, model: full, title: v.make + ' ' + full, year: v.year, km: v.km, fuel: FUEL_TXT[v.fuel],
      trans: v.trans === 'sj' ? 'Sjálfskipting' : 'Beinskipting', drive: /4X4|AWD|4MATIC|QUATTRO|XDRIVE/.test(full) ? 'Fjórhjóladrif' : '', price: 1, src: 'val' });
    c.base = v.model; c.key = c.make + '|' + c.base; c.fcat = v.fuel;
    return { c: c, r: A.model().estimate(c) };
  }
  function runValue() {
    var v = { make: $('vMake').value, model: $('vModel').value, year: num('vYear'), km: num('vKm'), fuel: $('vFuel').value, trans: $('vTrans').value, extra: $('vExtra').value.trim() };
    store('valuation', v);
    var full = (v.model + ' ' + v.extra).toUpperCase();
    var c = A.prep({ id: 'val', make: v.make, model: full, title: v.make + ' ' + full, year: v.year, km: v.km, fuel: FUEL_TXT[v.fuel],
      trans: v.trans === 'sj' ? 'Sjálfskipting' : 'Beinskipting', drive: /4X4|AWD|4MATIC|QUATTRO|XDRIVE/.test(full) ? 'Fjórhjóladrif' : '', price: 1, src: 'val' });
    c.base = v.model; c.key = c.make + '|' + c.base; c.fcat = v.fuel;
    var r = A.model().estimate(c);
    var sim = A.similar(c, 6), trade = r.est * 0.85;
    var html = '<div class="val-result"><div class="val-main"><span class="note">Áætlað markaðsverð</span><div class="val-big">' + A.kr(Math.round(r.est / 1e4) * 1e4) + '</div>' +
      '<div class="val-range"><span>' + mkr(r.lo) + '</span><div class="vr-bar"><i></i></div><span>' + mkr(r.hi) + '</span></div>' +
      '<p class="note">Líklegt bil fyrir ásett verð. ' + (r.peers >= 5 ? 'Byggt á ' + r.peers + ' ' + esc(A.cap(c.make) + ' ' + A.cap(c.base)) + ' á skrá.' :
        r.peers ? 'Aðeins ' + r.peers + ' sambærilegir á skrá, svo bilið er breitt.' : 'Enginn ' + esc(A.cap(c.base)) + ' á skrá núna, svo matið byggir á tegundinni í heild og er óvissara.') +
      (c.perf.t ? ' Útgáfan „' + esc(c.perf.label) + '“ er tekin með í reikninginn.' : '') + '</p></div>' +
      '<div class="val-side"><div class="val-tile"><span class="note">Ef þú selur sjálf/ur</span><b>' + mkr(r.est * 0.95) + ' – ' + mkr(r.est) + '</b><span class="note">t.d. á bland.is, oft aðeins undir ásettu verði bílasala</span></div>' +
      '<div class="val-tile"><span class="note">Uppítaka hjá bílasölu</span><b>~' + mkr(trade) + '</b><span class="note">bílasölur greiða oft 10–20% undir söluverði</span></div></div></div>';
    if (sim.length) html += '<h4>Sambærilegir á sölu núna</h4><p class="note">„Leiðrétt“ = verð hins bílsins ef hann væri jafn gamall og jafn mikið ekinn og þinn.</p>' +
      '<div class="tbl-wrap"><table><thead><tr><th>Bíll</th><th class="num">Árg.</th><th class="num">Ekinn</th><th class="num">Verð</th><th class="num">Leiðrétt</th></tr></thead><tbody>' +
      sim.map(function (o) {
        return '<tr' + (o.sold ? ' class="sold-row"' : ' class="click" data-open="' + esc(o.id) + '"') + '><td>' + esc(A.cap(o.make) + ' ' + A.cap(o.model)) + '<br><span class="note">' + (o.sold ? 'Seldur / af skrá ' + A.dayFmt(o.goneAt) : esc(o.dealer)) + '</span></td>' +
          '<td class="num">' + (o.year || '–') + '</td><td class="num">' + A.kmFmt(o.km) + '</td><td class="num">' + A.kr(o.price) + '</td><td class="num"><b>' + A.kr(A.adjusted(o, c)) + '</b></td></tr>';
      }).join('') + '</tbody></table></div>';
    html += '<div id="valPast"></div>';
    $('valOut').innerHTML = html;
    A.loadHistory().then(function (hist) {
      var gone = hist.filter(function (a) { return a.g && a.m === c.make && a.base === c.base; }).slice(0, 6);
      if (gone.length && $('valPast')) $('valPast').innerHTML = '<h4>Nýlega seldir / teknir af skrá</h4><div class="past">' + gone.map(A.pastRow).join('') + '</div>';
    });
  }

  // ---------- lán og rekstrarkostnaður (í bílaglugga) ----------
  // ---------- bifreiðagjald (Skatturinn): 21.260 kr. á hálfu ári + 154 kr./g yfir 204 g/km (WLTP) eða 188 kr./g yfir 168 g/km (NEDC) ----------
  var BG = { base: 21260, wltp: [204, 154], nedc: [168, 188] };
  // CO2: úr ökutækjaskrá ef bílnúmer er þekkt, annars gróf áætlun eftir eldsneyti, afli og aldri
  function co2Of(c) {
    var reg = window.Registry && Registry.plateInfo && Registry.plateInfo(c);
    if (reg && reg.co2 != null) return { g: Math.round(reg.co2), src: 'ökutækjaskrá' };
    var g;
    if (c.fcat === 'Rafmagn') g = 0;
    else if (c.fcat === 'Tengiltvinn') g = 35;
    else if (c.fcat === 'Tvinn') g = 105;
    else {
      var hp = c.hp || (c.pwRaw ? c.pwRaw * (c.pwRaw < 10 ? 70 : 1) : null) || 150;
      g = 110 + 0.35 * (hp - 120) + (c.fcat === 'Dísel' ? -10 : 0) + Math.max(0, 2015 - (c.year || 2015)) * 1.5;
      if (c.suv) g += 20;
      g = Math.max(95, Math.min(350, Math.round(g)));
    }
    return { g: g, src: 'áætlað' };
  }
  function bifreidagjald(c) {
    var co = co2Of(c), wltp = (c.year || 2020) >= 2019, t = wltp ? BG.wltp : BG.nedc;
    var half = BG.base + (co.g > t[0] ? (co.g - t[0]) * t[1] : 0);
    return { year: half * 2, co2: co.g, src: co.src, std: wltp ? 'WLTP' : 'NEDC' };
  }

  // Sjálfgefnar forsendur: áætlanir sem notandinn getur breytt; þær vistast í vafranum
  var DEF = { down: 30, rate: 10.5, years: 5, kmYear: 15000, petrol: 310, diesel: 315, kwh: 22, kmFee: 7, insurance: 180000, tax: 30000, upkeep: 120000 };
  var CONS = { 'Bensín': [7.0, 0], 'Dísel': [6.0, 0], 'Tvinn': [5.0, 0], 'Tengiltvinn': [3.5, 9], 'Rafmagn': [0, 18] }; // [l/100km, kWh/100km]
  function carExtras(c) {
    var el = $('carExtras'); if (!el) return;
    var p = Object.assign({}, DEF, store('costs') || {}), bg = bifreidagjald(c);
    p.tax = bg.year;  // reiknað fyrir hvern bíl, ekki vistað
    function inp(id, label, val, step, suffix) {
      var big = step >= 1000;  // krónu- og km-reitir með þúsundaskilum
      return '<label>' + label + '<span class="inp-s"><input id="' + id + '" ' + (big ? 'type="text" inputmode="numeric" data-fmt value="' + fmtThousands(Math.round(val)) + '"' :
        'type="number" inputmode="decimal" step="' + step + '" value="' + val + '"') + '>' + (suffix ? '<i>' + suffix + '</i>' : '') + '</span></label>';
    }
    el.innerHTML = '<div class="cost-grid">' +
      '<div class="cost-box"><div class="cost-inputs">' + inp('cDown', 'Útborgun', p.down, 5, '%') + inp('cRate', 'Vextir', p.rate, 0.1, '%') + inp('cYears', 'Lánstími', p.years, 1, 'ár') + '</div>' +
      '<div class="cost-out" id="cLoan"></div></div>' +
      '<div class="cost-box"><div class="cost-inputs">' + inp('cKm', 'Akstur á ári', p.kmYear, 1000, 'km') + '</div><div class="cost-out" id="cRun"></div>' +
      '<details class="cost-more"><summary>Forsendur (breyttu að vild)</summary><div class="cost-inputs">' +
      inp('cPetrol', 'Bensín', p.petrol, 1, 'kr/l') + inp('cDiesel', 'Dísel', p.diesel, 1, 'kr/l') + inp('cKwh', 'Rafmagn', p.kwh, 1, 'kr/kWh') +
      inp('cKmFee', 'Kílómetragjald', p.kmFee, 0.1, 'kr/km') + inp('cIns', 'Tryggingar', p.insurance, 5000, 'kr/ár') + inp('cTax', 'Bifreiðagjald', p.tax, 1000, 'kr/ár') +
      inp('cUp', 'Viðhald og dekk', p.upkeep, 5000, 'kr/ár') + '</div><p class="note">Bifreiðagjald reiknað út frá ' + bg.co2 + ' g/km CO2 (' + bg.src + ', ' + bg.std + ') samkvæmt <a href="https://www.skatturinn.is/einstaklingar/skattar-og-gjold/bifreidagjald/" target="_blank" rel="noopener">reglum Skattsins</a>. Kílómetragjald 6,95 kr/km frá 2026. Vextir, eldsneytisverð og tryggingar eru áætlanir.</p></details></div></div>' +
      '<h4>Bílaskipti</h4><div class="cost-box" id="cTrade"></div>';
    function calc() {
      var q = { down: num('cDown'), rate: num('cRate'), years: num('cYears'), kmYear: num('cKm'), petrol: num('cPetrol'), diesel: num('cDiesel'), kwh: num('cKwh'),
        kmFee: num('cKmFee'), insurance: num('cIns'), tax: num('cTax'), upkeep: num('cUp') };
      var keep = Object.assign({}, q); delete keep.tax; store('costs', keep);
      var loan = c.price * (1 - q.down / 100), n = Math.max(1, q.years * 12), r = q.rate / 100 / 12;
      var pay = r ? loan * r / (1 - Math.pow(1 + r, -n)) : loan / n;
      var interest = pay * n - loan;
      $('cLoan').innerHTML = '<div class="big">' + A.kr(pay) + ' <small>á mán.</small></div><span class="note">Útborgun ' + A.kr(c.price * q.down / 100) + ' · lán ' + A.kr(loan) +
        ' · vextir alls ~' + A.kr(interest) + '</span>';
      var cons = CONS[c.fcat] || CONS['Bensín'];
      var fuelPrice = c.fcat === 'Dísel' ? q.diesel : q.petrol;
      var energy = q.kmYear / 100 * (cons[0] * fuelPrice + cons[1] * q.kwh);
      var fixed = q.insurance + q.tax + (c.fcat === 'Rafmagn' ? q.upkeep * 0.7 : q.upkeep);
      var kmFee = q.kmYear * q.kmFee;
      // verðfall út frá markaðnum: hvað bíllinn lækkar á ári með aldri og akstri (sama líkan og verðmatið)
      var lossPct = 1 - Math.exp(Math.min(0, A.ageSlope(c.age, c.perf.t)) + Math.min(0, A.kmSlope(c.km || 0)) * q.kmYear / 1e4);
      var dep = c.price * Math.max(0, lossPct);
      var year = energy + fixed + kmFee + dep;
      $('cRun').innerHTML = '<div class="big">' + A.kr(year / 12) + ' <small>á mán.</small></div>' +
        '<div class="cost-rows"><span>⛽ ' + (c.fcat === 'Rafmagn' ? 'Rafmagn' : 'Eldsneyti/rafmagn') + '</span><b>' + A.kr(energy / 12) + '</b>' +
        '<span>🛣️ Kílómetragjald</span><b>' + A.kr(kmFee / 12) + '</b>' +
        '<span>🛡️ Tryggingar, bifreiðagjald, viðhald</span><b>' + A.kr(fixed / 12) + '</b>' +
        '<span>📉 Verðfall (~' + Math.round(lossPct * 100) + '%/ári)</span><b>' + A.kr(dep / 12) + '</b></div>' +
        '<span class="note">Með láni: ~' + A.kr(pay + year / 12 - dep / 12) + ' á mán. út úr veskinu (verðfall ekki talið með).</span>';
    }
    el.addEventListener('input', calc);
    calc();
    trade(c);
    alternatives(c);
    offer(c);
  }

  // ---------- tilboðsráðgjafi: hvað er sanngjarnt að bjóða ----------
  function offer(c) {
    var el = $('carOffer'); if (!el || !c.est || c.special) return;
    A.loadHistory().then(function (hist) {
      var a = (hist || []).filter(function (x) { return x.id === c.id; })[0];
      var today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      var days = a ? A.daysBetween(a.f, today) : null, drops = a ? a.p.filter(function (x, i) { return i && x[1] < a.p[i - 1][1]; }).length : 0;
      var room = c.priv ? 0.06 : 0.04, why = [];
      why.push(c.priv ? 'Einstaklingur: oft meira svigrúm en hjá bílasölu' : 'Bílasala: yfirleitt 3–5% svigrúm');
      if (c.dev <= -0.12) { room -= 0.02; why.push('Verðið er þegar undir mati, svo lítið svigrúm'); }
      else if (c.dev >= 0.12) { room += Math.min(0.08, c.dev * 0.5); why.push('Verðið er ' + A.pct(c.dev) + ' yfir mati: rök til að prútta'); }
      if (days != null && days > 90) { room += 0.03; why.push('Hefur verið ' + days + ' daga á skrá'); }
      else if (days != null && days > 45) { room += 0.015; why.push('Hefur verið ' + days + ' daga á skrá'); }
      if (drops) { room += Math.min(0.03, drops * 0.01); why.push('Seljandinn hefur lækkað verðið ' + drops + (drops === 1 ? ' sinni' : ' sinnum')); }
      if (c.fl && c.fl.some(function (f) { return /tjon|ryd|laga|skodun/.test(f); })) { room += 0.03; why.push('Lýsingin nefnir galla: nefndu þá'); }
      room = Math.max(0.01, Math.min(0.15, room));
      var r10 = function (x) { return Math.round(x / 1e4) * 1e4; };
      var rc = A.repairCost(c), fix = rc ? rc.mid : 0;
      if (rc) why.push('Áætluð viðgerð ~' + A.kr(fix) + ': dregin frá hámarkinu');
      var likely = r10(c.price * (1 - room)), start = r10(c.price * (1 - room * 1.8)), max = r10(Math.min(c.price, Math.max(c.est * 1.03 - fix, likely - fix)));
      if (rc) { likely = r10(Math.min(likely, max)); start = r10(Math.min(start, max * 0.92)); }
      el.innerHTML = '<h4>Hvað á ég að bjóða?</h4><div class="offer"><div><span>Byrjunartilboð</span><b>' + A.kr(start) + '</b></div>' +
        '<div class="mid"><span>Líklegt kaupverð</span><b>' + A.kr(likely) + '</b></div><div><span>Ekki borga meira en</span><b>' + A.kr(max) + '</b></div></div>' +
        '<ul class="tc-list offer-why">' + why.map(function (t) { return '<li>' + ic('check') + '<span>' + A.esc(t) + '</span></li>'; }).join('') + '</ul>' +
        '<p class="note">Gróf ráðgjöf út frá matinu, tíma á skrá og verðsögu. Ástand, þjónustusaga og hvort þú setur bíl upp í skipta líka máli.</p>';
    });
  }

  // ---------- innflutningsreiknir: hvað kostar sambærilegur bíll fluttur inn ----------
  // Vörugjald 2026 (lög 29/1993 m.br.): 0,34% á hvert g/km CO2 yfir 30, minnst 10% fyrir bíla með brunavél, mest 70%; rafbílar 0%.
  function vorugjald(co2, ev) { return ev ? 0 : Math.max(10, Math.min(70, 0.34 * Math.max(0, co2 - 30))); }
  var rateP = null;
  // gengi dagsins: ECB birtir ekki ISK, svo notuð er opin gengisskrá (uppfærð daglega), önnur til vara
  function eurRate() {
    if (!rateP) rateP = fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json')
      .then(function (r) { return r.json(); }).then(function (j) { if (!j.eur || !j.eur.isk) throw 0; return { rate: j.eur.isk, date: j.date }; })
      .catch(function () {
        return fetch('https://open.er-api.com/v6/latest/EUR').then(function (r) { return r.json(); })
          .then(function (j) { if (!j.rates || !j.rates.ISK) throw 0; return { rate: j.rates.ISK, date: (j.time_last_update_utc || '').slice(5, 16) }; });
      }).catch(function () { return { rate: 150, date: null }; });
    return rateP;
  }
  function openImport(c) {
    var co = c ? co2Of(c) : { g: 140 }, ev = c ? c.fcat === 'Rafmagn' : false;
    var q = encodeURIComponent(c ? A.cap(c.make) + ' ' + A.cap(c.base) : '');
    A.openModal('<div class="m"><div class="m-head"><h2>Innflutningsreiknir</h2><button class="x" data-close aria-label="Loka">×</button></div>' +
      '<p class="note">Hvað kostar að kaupa ' + (c ? 'svona bíl' : 'bíl') + ' í Evrópu og flytja hann heim? Sláðu inn verðið úti.</p>' +
      '<div class="val-form"><label>Verð úti (EUR)<input id="iEur" type="text" inputmode="numeric" data-fmt value="' + fmtThousands(c ? Math.round(c.price / 137 * 0.75 / 500) * 500 : 20000) + '"><small class="hint" id="iEurKr"></small></label>' +
      '<label>Gengi EUR<input id="iRate" type="text" inputmode="decimal" value=""><small class="hint" id="iRateNote">Sæki gengi dagsins…</small></label>' +
      '<label>Flutningur til Íslands (kr.)<input id="iShip" type="text" inputmode="numeric" data-fmt value="350.000"></label>' +
      '<label>CO2 (g/km, WLTP)<input id="iCo2" type="number" inputmode="numeric" value="' + co.g + '"></label>' +
      '<label>Orkugjafi<select id="iEv"><option value="0"' + (ev ? '' : ' selected') + '>Brunavél / tvinn / tengiltvinn</option><option value="1"' + (ev ? ' selected' : '') + '>Rafmagn</option></select></label>' +
      '<label>Skráning, skoðun, númer (kr.)<input id="iFees" type="text" inputmode="numeric" data-fmt value="45.000"></label></div>' +
      '<div id="iOut"></div>' +
      '<div class="actions"><a class="sec" target="_blank" rel="noopener" href="https://suchen.mobile.de/fahrzeuge/search.html?isSearchRequest=true&s=Car&vc=Car&q=' + q + '">' + ic('external-link') + 'Leita á mobile.de</a>' +
      '<a class="sec" target="_blank" rel="noopener" href="https://www.autoscout24.com/lst?atype=C&search_id=&q=' + q + '">' + ic('external-link') + 'Leita á AutoScout24</a></div>' +
      '<p class="note">Vörugjald 2026: 0,34% á hvert g/km CO2 yfir 30 (minnst 10% fyrir bíla með brunavél, mest 70%, rafbílar 0%), reiknað af tollverði (verð + flutningur). VSK 24% ofan á. ' +
      'Heimildir: <a href="https://fibfrettir.is/frettir/kilometragjald-a-alla-bila-og-breyting-vorugjalda/" target="_blank" rel="noopener">FÍB</a>, <a href="https://www.stjornarradid.is/efst-a-baugi/frettir/stok-frett/2025/10/17/Vorugjald-af-nyjum-rafmagnsbilum-fellt-nidur/" target="_blank" rel="noopener">Stjórnarráðið</a>. ' +
      'Þetta er áætlun: staðfestu hjá tollmiðlara eða í reiknivél Skattsins áður en þú kaupir.</p></div>');
    function calc() {
      var eur = num('iEur'), rate = num('iRate'), ship = num('iShip'), co2 = num('iCo2'), isEv = $('iEv').value === '1', fees = num('iFees');
      var toll = eur * rate + ship, pct = vorugjald(co2, isEv), vg = toll * pct / 100, vsk = (toll + vg) * 0.24, total = toll + vg + vsk + fees;
      $('iEurKr').textContent = eur ? '≈ ' + A.kr(eur * rate) : '';
      var cmp = c ? '<div class="imp-cmp ' + (total < c.price ? 'good' : 'bad') + '">' + ic(total < c.price ? 'circle-check' : 'triangle-alert') + '<span>' +
        (total < c.price ? 'Um <b>' + A.kr(c.price - total) + ' ódýrara</b> en þessi bíll hér heima' : 'Um <b>' + A.kr(total - c.price) + ' dýrara</b> en þessi bíll hér heima') +
        ' (' + A.kr(c.price) + '). Mundu: engin ábyrgð frá umboði, áhætta í flutningi og tími.</span></div>' : '';
      $('iOut').innerHTML = '<div class="imp-rows"><span>Verð úti</span><b>' + A.kr(eur * rate) + '</b><span>Flutningur</span><b>' + A.kr(ship) + '</b>' +
        '<span>Vörugjald (' + pct.toFixed(1).replace('.', ',') + '%)</span><b>' + A.kr(vg) + '</b><span>VSK (24%)</span><b>' + A.kr(vsk) + '</b>' +
        '<span>Skráning og fleira</span><b>' + A.kr(fees) + '</b><span class="tot">Samtals á götuna</span><b class="tot">' + A.kr(total) + '</b></div>' + cmp;
    }
    eurRate().then(function (r) {
      if (!$('iRate')) return;
      $('iRate').value = r.rate.toFixed(2).replace('.', ',');
      var dd = r.date && !isNaN(new Date(r.date)) ? A.dateIs(new Date(r.date)) : r.date;
      $('iRateNote').textContent = r.date ? 'Gengi ' + dd + ', uppfært sjálfkrafa' : 'Náði ekki í gengi: áætlað 150';
      calc();
    });
    $('modalBody').addEventListener('input', function (e) { if (/^i(Eur|Rate|Ship|Co2|Fees)$/.test(e.target.id)) calc(); });
    $('modalBody').addEventListener('change', function (e) { if (e.target.id === 'iEv') calc(); });
    calc();
  }

  // ---------- vikan á markaðnum ----------
  function openWeek() {
    A.loadHistory().then(function (hist) {
      var cs = A.cars(), today = new Date(), wk = new Date(today - 7 * 864e5).toISOString().slice(0, 10).replace(/-/g, '');
      var drops = cs.filter(function (c) { return c.drop && c.dropAt >= wk; }).sort(function (a, b) { return b.drop / b.price - a.drop / a.price; }).slice(0, 8);
      var deals = cs.filter(function (c) { return c.isNew && A.verdict(c).cls === 'good' && c.dev > -0.4 && !(c.fl && c.fl.length && c.fl.some(function (f) { return /tjon|ryd|laga|serut/.test(f); })); }).sort(function (a, b) { return a.dev - b.dev; }).slice(0, 8);
      var rare = cs.filter(function (c) { var st = c.isNew && window.Registry && Registry.stats(c.make, c.base); return st && st.n < 150; })
        .sort(function (a, b) { return Registry.stats(a.make, a.base).n - Registry.stats(b.make, b.base).n; }).slice(0, 8);
      var gone = (hist || []).filter(function (a) { return a.g && a.g >= wk; }), fast = {};
      gone.forEach(function (a) { var k = A.cap(a.m) + ' ' + A.cap(a.base); (fast[k] = fast[k] || []).push(A.daysBetween(a.f, a.g)); });
      var fastList = Object.keys(fast).filter(function (k) { return fast[k].length >= 2; }).map(function (k) { var v = fast[k].sort(function (a, b) { return a - b; }); return { k: k, n: v.length, d: v[v.length >> 1] }; })
        .sort(function (a, b) { return a.d - b.d; }).slice(0, 8);
      function row(c, extra) {
        return '<button type="button" class="wk-row" data-open="' + A.esc(c.id) + '">' + (A.img(c) ? '<img src="' + A.esc(A.img(c)) + '" alt="" loading="lazy">' : '<span class="noimg"></span>') +
          '<span class="wk-t"><b>' + A.esc(A.cap(c.make) + ' ' + A.cap(c.model)) + '</b><span>' + (c.year || '') + ' · ' + A.kmFmt(c.km) + ' · ' + A.kr(c.price) + '</span></span>' + extra + '</button>';
      }
      function sec(title, icon, body, empty) { return '<section class="wk"><h4>' + ic(icon) + title + '</h4>' + (body || '<p class="note">' + empty + '</p>') + '</section>'; }
      A.openModal('<div class="m"><div class="m-head"><h2>Vikan á markaðnum</h2><button class="x" data-close aria-label="Loka">×</button></div>' +
        '<p class="note">Síðustu 7 dagar · ' + gone.length + ' bílar fóru af skrá · ' + cs.filter(function (c) { return c.isNew; }).length + ' nýir á skrá</p>' +
        sec('Mestu verðlækkanirnar', 'trending-down', drops.map(function (c) { return row(c, '<em class="wk-x good">−' + A.mkrShort(c.drop) + ' m.kr.</em>'); }).join(''), 'Engar verðlækkanir enn. Sagan byrjaði 9. nóv.') +
        sec('Ný góð kaup', 'sparkles', deals.map(function (c) { return row(c, '<em class="wk-x good">' + A.pct(c.dev) + '</em>'); }).join(''), 'Engir nýir bílar á góðu verði enn.') +
        sec('Sjaldgæfir nýir á skrá', 'flag', rare.map(function (c) { return row(c, '<em class="wk-x">' + Registry.stats(c.make, c.base).n + ' á landinu</em>'); }).join(''), 'Engir sjaldgæfir nýir bílar þessa vikuna.') +
        sec('Seldust hraðast', 'flame', fastList.length ? '<div class="tbl-wrap"><table><thead><tr><th>Gerð</th><th class="num">Dagar á skrá</th><th class="num">Fóru af skrá</th></tr></thead><tbody>' +
          fastList.map(function (x) { return '<tr><td>' + A.esc(x.k) + '</td><td class="num">' + x.d + '</td><td class="num">' + x.n + '</td></tr>'; }).join('') + '</tbody></table></div>' : '', 'Kemur þegar fleiri bílar hafa farið af skrá.') +
        '</div>', 'sheet');
    });
  }

  // bílaskipti: bíllinn þinn (úr „Hvað er bíllinn minn virði?“) upp í þennan
  function trade(c) {
    var el = $('cTrade'), v = store('valuation');
    if (!v || !v.make) {
      el.innerHTML = '<p class="note" style="margin:0">Viltu setja bílinn þinn upp í? Verðmettu hann fyrst, þá reiknast milligjöfin hér.</p>' +
        '<div class="actions"><button type="button" class="sec" id="tValue">💰 Verðmeta bílinn minn</button></div>';
      $('tValue').addEventListener('click', function () { openValue(); });
      return;
    }
    var m = estimateMine(v), tradeIn = m.r.est * 0.85, diff = c.price - tradeIn;
    var q = Object.assign({}, DEF, store('costs') || {}), r = q.rate / 100 / 12, n = Math.max(1, q.years * 12);
    var pay = diff > 0 ? (r ? diff * r / (1 - Math.pow(1 + r, -n)) : diff / n) : 0;
    el.innerHTML = '<div class="trade-row"><span>Bíllinn þinn: <b>' + esc(A.cap(v.make) + ' ' + A.cap(v.model)) + '</b> ' + v.year + ', ' + A.kmFmt(v.km) + '</span>' +
      '<span>metinn ~' + mkr(m.r.est) + ', uppítaka ~<b>' + mkr(tradeIn) + '</b></span></div>' +
      '<div class="trade-sum"><div><span class="note">Milligjöf</span><b>' + (diff > 0 ? A.kr(diff) : 'Þú færð ~' + A.kr(-diff) + ' til baka') + '</b></div>' +
      (diff > 0 ? '<div><span class="note">Ef milligjöfin er öll tekin að láni (' + q.rate + '%, ' + q.years + ' ár)</span><b>' + A.kr(pay) + ' á mán.</b></div>' : '') + '</div>' +
      '<p class="note">Uppítökuverð er áætlað 15% undir markaðsverði; bílasölur meta bílinn sjálfar. <button type="button" class="link" id="tEdit">Breyta bílnum mínum</button></p>';
    $('tEdit').addEventListener('click', function () { openValue(); });
  }

  // valkostir: aðrar gerðir í sama verð- og stærðarflokki, besti bíllinn af hverri
  function alternatives(c) {
    var ev = c.fcat === 'Rafmagn';
    var pool = A.cars().filter(function (o) {
      return o.base !== c.base && o.suv === c.suv && (o.fcat === 'Rafmagn') === ev && o.price >= c.price * 0.8 && o.price <= c.price * 1.2 &&
        Math.abs((o.year || 0) - (c.year || 0)) <= 2 && o.peers >= 2 && o.dev > -0.5 && !(o.fl && o.fl.some(function (x) { return /tjon|ryd|laga/.test(x); }));
    });
    var best = {};
    pool.forEach(function (o) { var k = o.make + '|' + o.base; if (!best[k] || o.dev < best[k].dev) best[k] = o; });
    var list = Object.keys(best).map(function (k) { return best[k]; }).sort(function (a, b) { return a.dev - b.dev; }).slice(0, 6);
    if (!list.length) return;
    var target = $('carAlt') || $('cAlt'); if (!target) return;
    target.innerHTML = '<h4>Valkostir á svipuðu verði</h4><p class="note">Aðrar ' + (c.suv ? 'jepplinga/jeppa' : 'gerðir') + (ev ? ' (rafmagn)' : '') +
      ' á ' + mkr(c.price * 0.8) + '–' + mkr(c.price * 1.2) + ', árgerð ' + ((c.year || 0) - 2) + '–' + ((c.year || 0) + 2) + '. Besta verðið af hverri gerð.</p>' +
      '<div class="alt-grid">' + list.map(function (o) {
        var vd = A.verdict(o);
        return '<button type="button" class="alt" data-open="' + esc(o.id) + '">' + (A.img(o) ? '<img src="' + esc(A.img(o)) + '" alt="" loading="lazy">' : '<span class="noimg"></span>') +
          '<b>' + esc(A.cap(o.make) + ' ' + A.cap(o.base)) + '</b><span>' + (o.year || '') + ' · ' + A.kmFmt(o.km) + '</span><span class="price">' + A.kr(o.price) + '</span>' +
          '<span class="badge ' + vd.cls + '">' + vd.txt + '</span></button>';
      }).join('') + '</div>';
  }

  // ---------- 📊 Markaðurinn ----------
  function tip(e) {
    var t = $('chartTip'), m = e.target.closest ? e.target.closest('[data-tip]') : null;
    if (!t) { t = document.createElement('div'); t.id = 'chartTip'; t.className = 'chart-tip'; document.body.appendChild(t); }
    if (!m) { t.hidden = true; return; }
    t.innerHTML = m.getAttribute('data-tip'); t.hidden = false;
    t.classList.toggle('card', !!t.querySelector('.tc'));  // verðkort fær annað útlit en gröf
    var x = Math.max(8, Math.min(e.clientX + 14, window.innerWidth - t.offsetWidth - 8)), y = e.clientY - t.offsetHeight - 10;
    t.style.left = x + 'px'; t.style.top = (y < 8 ? e.clientY + 16 : y) + 'px';
  }
  document.addEventListener('mousemove', tip);
  document.addEventListener('touchstart', function (e) { tip(e.touches ? { target: e.target, clientX: e.touches[0].clientX, clientY: e.touches[0].clientY } : e); }, { passive: true });
  document.addEventListener('scroll', function () { var t = $('chartTip'); if (t) t.hidden = true; }, true);

  // súlurit: ein röð (miðgildi eftir árgerð), einn litur, grunnlína, ávalir endar, gildi í tooltip
  function barChart(rows, label) {
    var W = 640, Hh = 220, L = 46, B = 24, T = 10, max = Math.max.apply(null, rows.map(function (r) { return r.y; })) * 1.1;
    var bw = (W - L - 8) / rows.length, ticks = [0, max / 3, 2 * max / 3, max];
    var y = function (v) { return T + (Hh - T - B) * (1 - v / max); };
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-label="' + esc(label) + '">' +
      ticks.map(function (t) { return '<line class="grid" x1="' + L + '" x2="' + W + '" y1="' + y(t) + '" y2="' + y(t) + '"/><text class="ax" x="' + (L - 6) + '" y="' + (y(t) + 4) + '" text-anchor="end">' + A.mkrShort(t) + '</text>'; }).join('') +
      rows.map(function (r, i) {
        var x = L + i * bw + 2, w = Math.max(2, bw - 4), h = Hh - B - y(r.y), top = y(r.y), rr = Math.min(4, w / 2, h);
        var path = 'M' + x + ',' + (Hh - B) + 'V' + (top + rr) + 'Q' + x + ',' + top + ' ' + (x + rr) + ',' + top + 'H' + (x + w - rr) + 'Q' + (x + w) + ',' + top + ' ' + (x + w) + ',' + (top + rr) + 'V' + (Hh - B) + 'Z';
        return '<g data-tip="<b>' + r.x + '</b><br>Miðgildi ' + esc(mkr(r.y)) + '<br>' + r.n + ' bílar"><rect class="hit" x="' + (L + i * bw) + '" y="' + T + '" width="' + bw + '" height="' + (Hh - B - T) + '"/><path class="bar" d="' + path + '"/></g>' +
          (rows.length <= 16 || i % Math.ceil(rows.length / 12) === 0 ? '<text class="ax" x="' + (x + w / 2) + '" y="' + (Hh - 6) + '" text-anchor="middle">' + r.x + '</text>' : '');
      }).join('') + '<line class="base" x1="' + L + '" x2="' + W + '" y1="' + (Hh - B) + '" y2="' + (Hh - B) + '"/></svg>';
  }
  // punktarit: verð á móti akstri, smellt opnar bílinn
  function scatter(list) {
    var W = 640, Hh = 240, L = 46, B = 26, T = 10, R = 10;
    var pts = list.filter(function (c) { return c.km != null; }).slice(0, 700);
    if (pts.length < 5) return '';
    var maxP = median(pts.map(function (c) { return c.price; })) * 3, maxK = Math.max.apply(null, pts.map(function (c) { return c.km; })) * 1.05 || 1;
    pts = pts.filter(function (c) { return c.price <= maxP; });
    maxP = Math.max.apply(null, pts.map(function (c) { return c.price; })) * 1.08;
    var x = function (k) { return L + (W - L - R) * k / maxK; }, y = function (p) { return T + (Hh - T - B) * (1 - p / maxP); };
    var yt = [0, maxP / 2, maxP], xt = [0, maxK / 2, maxK];
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-label="Verð á móti akstri">' +
      yt.map(function (t) { return '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(t) + '" y2="' + y(t) + '"/><text class="ax" x="' + (L - 6) + '" y="' + (y(t) + 4) + '" text-anchor="end">' + A.mkrShort(t) + '</text>'; }).join('') +
      xt.map(function (t) { return '<text class="ax" x="' + x(t) + '" y="' + (Hh - 8) + '" text-anchor="middle">' + Math.round(t / 1000) + ' þ. km</text>'; }).join('') +
      '<line class="base" x1="' + L + '" x2="' + (W - R) + '" y1="' + (Hh - B) + '" y2="' + (Hh - B) + '"/>' +
      pts.map(function (c) {
        return '<g class="dot" data-open="' + esc(c.id) + '" data-tip="<b>' + esc(A.cap(c.make) + ' ' + A.cap(c.model)) + '</b><br>' + (c.year || '') + ' · ' + esc(A.kmFmt(c.km)) + '<br>' + esc(A.kr(c.price)) + '">' +
          '<circle class="hit" cx="' + x(c.km) + '" cy="' + y(c.price) + '" r="9"/><circle class="pt" cx="' + x(c.km) + '" cy="' + y(c.price) + '" r="4"/></g>';
      }).join('') + '</svg>';
  }
  function openMarket() {
    var f = A.readFilters(), scope = Object.assign({}, f, { view: '' });
    var list = A.filtered(scope);
    var title = f.make ? A.cap(f.make) + (f.model ? ' ' + A.cap(f.model) : '') : 'Allur markaðurinn';
    var prices = list.map(function (c) { return c.price; }), kms = list.filter(function (c) { return c.km != null; }).map(function (c) { return c.km; });
    var ages = list.filter(function (c) { return c.year; }).map(function (c) { return NOW - c.year; });
    var byYear = {};
    list.forEach(function (c) { if (c.year) (byYear[c.year] = byYear[c.year] || []).push(c.price); });
    var rows = Object.keys(byYear).filter(function (y) { return byYear[y].length >= 2; }).sort().map(function (y) { return { x: y, y: median(byYear[y]), n: byYear[y].length }; });
    // undirflokkar: gerðir (ef tegund valin) eða tegundir
    var keyFn = f.make ? function (c) { return c.base; } : function (c) { return c.make; }, groups = {};
    list.forEach(function (c) { var k = keyFn(c); (groups[k] = groups[k] || []).push(c); });
    var sub = Object.keys(groups).map(function (k) { var g = groups[k]; return { k: k, n: g.length, med: median(g.map(function (c) { return c.price; })), km: median(g.map(function (c) { return c.km || 0; })), ev: g.filter(function (c) { return c.fcat === 'Rafmagn' || c.fcat === 'Tengiltvinn'; }).length }; })
      .sort(function (a, b) { return b.n - a.n; }).slice(0, 25);
    A.openModal('<div class="m market"><div class="m-head"><h2 class="with-logo">' + (f.make ? A.monoHtml(f.make, true) : '📊') + ' ' + esc(title) + '</h2><button class="x" data-close aria-label="Loka">×</button></div>' +
      '<p class="note">Miðað við núverandi síur' + (list.length !== A.cars().length ? ' (' + list.length.toLocaleString('de-DE') + ' bílar)' : '') + '.</p>' +
      '<div class="stats"><div><b>' + list.length.toLocaleString('de-DE') + '</b><span>bílar á skrá</span></div><div><b>' + (prices.length ? mkr(median(prices)) : '–') + '</b><span>miðgildisverð</span></div>' +
      '<div><b>' + (kms.length ? Math.round(median(kms) / 1000) + ' þ. km' : '–') + '</b><span>miðgildi akstur</span></div><div><b>' + (ages.length ? median(ages) + ' ár' : '–') + '</b><span>miðgildi aldur</span></div></div>' +
      '<div id="mkHist"></div>' +
      (rows.length >= 2 ? '<h4>Miðgildisverð eftir árgerð</h4><div class="chart-wrap">' + barChart(rows, 'Miðgildisverð eftir árgerð') + '</div>' +
        '<details class="cost-more"><summary>Sýna sem töflu</summary><div class="tbl-wrap"><table><thead><tr><th>Árgerð</th><th class="num">Miðgildi</th><th class="num">Fjöldi</th></tr></thead><tbody>' +
        rows.map(function (r) { return '<tr><td>' + r.x + '</td><td class="num">' + mkr(r.y) + '</td><td class="num">' + r.n + '</td></tr>'; }).join('') + '</tbody></table></div></details>' : '') +
      (list.length >= 5 ? '<h4>Verð á móti akstri</h4><p class="note">Hver punktur er bíll. Smelltu til að opna hann. Bílar langt undir hinum eru oft bestu kaupin (eða með galla).</p><div class="chart-wrap">' + scatter(list) + '</div>' : '') +
      (sub.length > 1 ? '<h4>' + (f.make ? 'Gerðir' : 'Tegundir') + '</h4><div class="tbl-wrap"><table><thead><tr><th>' + (f.make ? 'Gerð' : 'Tegund') + '</th><th class="num">Fjöldi</th><th class="num">Miðgildisverð</th><th class="num">Miðgildi akstur</th><th class="num">Raf/tengiltvinn</th></tr></thead><tbody>' +
        sub.map(function (x) {
          return '<tr><td>' + esc(A.cap(x.k)) + '</td><td class="num">' + x.n + '</td><td class="num">' + mkr(x.med) + '</td><td class="num">' + Math.round(x.km / 1000) + ' þ.</td><td class="num">' + Math.round(x.ev / x.n * 100) + '%</td></tr>';
        }).join('') + '</tbody></table></div>' : '') + '</div>', 'sheet');
    // saga: dagar á skrá og hraðast seldu gerðirnar
    A.loadHistory().then(function (hist) {
      var el = $('mkHist'); if (!el) return;
      var match = function (a) { return (!f.make || a.m === f.make) && (!f.model || a.base === f.model); };
      var gone = hist.filter(function (a) { return a.g && match(a); });
      var live = hist.filter(function (a) { return !a.g && match(a); });
      var days = live.map(function (a) { return A.daysBetween(a.f, a.l); });
      var html = '';
      if (gone.length >= 3) {
        var sold = gone.map(function (a) { return A.daysBetween(a.f, a.g); });
        html += '<div class="stats"><div><b>' + gone.length + '</b><span>seldir / teknir af skrá</span></div><div><b>' + median(sold) + ' dagar</b><span>miðgildi tími á skrá áður en seldist</span></div>' +
          '<div><b>' + median(days) + ' dagar</b><span>hafa verið á skrá (núverandi)</span></div><div><b>' + Math.round(gone.length / Math.max(1, live.length + gone.length) * 100) + '%</b><span>hlutfall sem hefur selst</span></div></div>';
        var fast = {};
        gone.forEach(function (a) { var k = f.make ? a.base : a.m; (fast[k] = fast[k] || []).push(A.daysBetween(a.f, a.g)); });
        var top = Object.keys(fast).filter(function (k) { return fast[k].length >= 3; }).map(function (k) { return { k: k, d: median(fast[k]), n: fast[k].length }; }).sort(function (a, b) { return a.d - b.d; }).slice(0, 8);
        if (top.length) html += '<h4>Seljast hraðast</h4><div class="tbl-wrap"><table><thead><tr><th>' + (f.make ? 'Gerð' : 'Tegund') + '</th><th class="num">Dagar á skrá (miðgildi)</th><th class="num">Seldir</th></tr></thead><tbody>' +
          top.map(function (x) { return '<tr><td>' + esc(A.cap(x.k)) + '</td><td class="num">' + x.d + '</td><td class="num">' + x.n + '</td></tr>'; }).join('') + '</tbody></table></div>';
      } else {
        html += '<p class="hist-line">📅 Saga auglýsinga byrjaði ' + A.dayFmt(HSTART || today()) + '. Eftir nokkra daga birtist hér hve hratt bílar seljast og hvernig verð þróast.</p>';
      }
      el.innerHTML = html;
    });
  }

  // ---------- 🗺️ Kort ----------
  var leafletP = null, places = null;
  function loadLeaflet() {
    if (leafletP) return leafletP;
    leafletP = new Promise(function (ok, fail) {
      var css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
      document.head.appendChild(css);
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
      s.onload = function () { ok(window.L); }; s.onerror = fail;
      document.head.appendChild(s);
    });
    return leafletP;
  }
  function loadPlaces() {
    if (places) return Promise.resolve(places);
    function get(u) { return fetch(u).then(function (r) { if (!r.ok) throw 0; return r.json(); }).catch(function () { return null; }); }
    var gh = 'https://raw.githubusercontent.com/isaklehmann33-creator/bilaleit/main/public/data/places.json';
    return Promise.all([get(gh), get('data/places.json?t=' + Date.now())]).then(function (r) {
      places = r[0] && (!r[1] || (r[0].updated || '') >= (r[1].updated || '')) ? r[0] : r[1];  // nýrra afritið
      return places;
    });
  }
  function dist(a, b) {
    var R = 6371, dLat = (b[0] - a[0]) * Math.PI / 180, dLon = (b[1] - a[1]) * Math.PI / 180;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function openMap() {
    A.openModal('<div class="m map-m"><div class="m-head"><h2>🗺️ Bílasölur á korti</h2><button class="x" data-close aria-label="Loka">×</button></div>' +
      '<p class="note">Talan = fjöldi bíla sem passa við síurnar þínar. <span class="lg d">Bílasölur</span> <span class="lg t">Einstaklingar (bland.is)</span> Staðir nálægt hver öðrum sameinast; smelltu til að sjá þá.</p>' +
      '<div class="actions" style="margin:0 0 10px"><button type="button" class="sec" id="nearMe">📍 Sýna næst mér</button></div>' +
      '<div id="mapBox" class="map-box"><p class="note" style="padding:16px">Hleð korti…</p></div><div id="nearList"></div></div>', 'sheet');
    Promise.all([loadLeaflet(), loadPlaces()]).then(function (r) {
      var L = r[0], P = r[1], box = $('mapBox'); if (!box) return;
      box.innerHTML = '';
      var f = A.readFilters(); f.dealer = ''; f.loc = '';
      var list = A.filtered(f), byDealer = {}, byTown = {};
      list.forEach(function (c) {
        if (c.priv) { if (c.loc) byTown[c.loc] = (byTown[c.loc] || 0) + 1; }
        else byDealer[c.dealer] = (byDealer[c.dealer] || 0) + 1;
      });
      var map = L.map(box, { scrollWheelZoom: true }).setView([64.6, -19.0], 6);
      setTimeout(function () { map.invalidateSize(); }, 300);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map);
      var accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#0f6b5c';
      var pts = [];
      Object.keys(byDealer).forEach(function (name) {
        var p = P.dealers[name]; if (!p) return;
        pts.push({ name: name, ll: [p[0], p[1]], addr: p[2], n: byDealer[name], kind: 'dealer' });
      });
      // einkasala: margir bílar á sama póstnúmeri, svo einn hringur á hvern stað
      Object.keys(byTown).forEach(function (t) {
        var p = P.towns[t]; if (!p) return;
        pts.push({ name: 'Einstaklingar · ' + t, ll: p, addr: 'bland.is', n: byTown[t], kind: 'town', loc: t });
      });
      // Merki með fjölda bíla. Staðir sem eru nær hvor öðrum en ~40 px sameinast í eitt merki (smelltu til að þysja inn),
      // svo margar bílasölur á sömu lóð (t.d. Krókhálsi 7) breytist ekki í hrúgu af hringjum.
      var layer = L.layerGroup().addTo(map);
      function popupHtml(p) {
        return '<b>' + esc(p.name) + '</b><br>' + esc(p.addr) + '<br>' + p.n + ' bílar<br><button type="button" class="map-go" data-map-' +
          (p.kind === 'town' ? 'loc' : 'dealer') + '="' + esc(p.kind === 'town' ? p.loc : p.name) + '">Sýna bílana</button>';
      }
      function icon(n, kind, many) {
        var label = n >= 1000 ? (n / 1000).toFixed(1).replace('.', ',') + 'þ' : n;
        return L.divIcon({ className: '', html: '<div class="mk ' + kind + (many ? ' many' : '') + '">' + label + '</div>', iconSize: null });
      }
      function draw() {
        layer.clearLayers();
        var groups = [];
        pts.slice().sort(function (a, b) { return b.n - a.n; }).forEach(function (p) {
          var px = map.latLngToLayerPoint(p.ll), g = null;
          for (var i = 0; i < groups.length; i++) if (groups[i].px.distanceTo(px) < 40) { g = groups[i]; break; }
          if (g) g.items.push(p); else groups.push({ px: px, items: [p] });
        });
        groups.forEach(function (g) {
          var top = g.items[0], n = g.items.reduce(function (s, p) { return s + p.n; }, 0);
          var kind = g.items.every(function (p) { return p.kind === 'town'; }) ? 'town' : 'dealer';
          var m = L.marker(top.ll, { icon: icon(n, kind, g.items.length > 1), riseOnHover: true }).addTo(layer);
          if (g.items.length === 1) m.bindPopup(popupHtml(top));
          else {
            var b = L.latLngBounds(g.items.map(function (p) { return p.ll; }));
            m.bindPopup('<b>' + g.items.length + ' staðir · ' + n + ' bílar</b><div class="map-list">' + g.items.slice(0, 12).map(function (p) {
              return '<div><span>' + esc(p.name) + '</span> <button type="button" class="map-link" data-map-' + (p.kind === 'town' ? 'loc' : 'dealer') + '="' +
                esc(p.kind === 'town' ? p.loc : p.name) + '">' + p.n + ' →</button></div>';
            }).join('') + '</div>' + (map.getZoom() < 16 ? '<button type="button" class="map-zoom">Þysja inn</button>' : ''));
            m.on('popupopen', function (e) {
              var z = e.popup.getElement().querySelector('.map-zoom');
              if (z) z.addEventListener('click', function () { map.fitBounds(b.pad(0.4), { maxZoom: 16 }); });
            });
          }
        });
      }
      map.on('zoomend', draw);
      // sýna allt sem passar, og endurreikna stærð þegar glugginn hefur náð endanlegri stærð (t.d. á síma)
      if (pts.length) map.fitBounds(L.latLngBounds(pts.map(function (p) { return p.ll; })).pad(0.1), { maxZoom: 12 });
      draw();
      if (window.ResizeObserver) new ResizeObserver(function () { map.invalidateSize(); }).observe(box);
      setTimeout(function () { map.invalidateSize(); }, 50);
      $('nearMe').addEventListener('click', function () {
        if (!navigator.geolocation) return;
        this.textContent = 'Finn staðsetningu…';
        var btn = this;
        navigator.geolocation.getCurrentPosition(function (pos) {
          var me = [pos.coords.latitude, pos.coords.longitude];
          btn.textContent = '📍 Næst mér';
          L.circleMarker(me, { radius: 8, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }).addTo(map).bindTooltip('Þú');
          map.setView(me, 10);
          var near = pts.map(function (p) { return Object.assign({ d: dist(me, p.ll) }, p); }).sort(function (a, b) { return a.d - b.d; }).slice(0, 10);
          $('nearList').innerHTML = '<h4>Næst þér</h4><div class="past">' + near.map(function (p) {
            return '<div class="past-row"><div><b>' + esc(p.name) + '</b><span>' + esc(p.addr) + '</span></div><div class="past-r"><b>' + (p.d < 10 ? p.d.toFixed(1) : Math.round(p.d)) + ' km</b>' +
              '<button type="button" class="link" data-map-' + (p.kind === 'town' ? 'loc' : 'dealer') + '="' + esc(p.kind === 'town' ? p.loc : p.name) + '">' + p.n + ' bílar →</button></div></div>';
          }).join('') + '</div>';
        }, function () { btn.textContent = '📍 Leyfðu staðsetningu í vafranum og reyndu aftur'; }, { timeout: 10000 });
      });
    }).catch(function () { var b = $('mapBox'); if (b) b.innerHTML = '<p class="err" style="padding:16px">Gat ekki hlaðið korti.</p>'; });
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-map-dealer],[data-map-loc]') : null;
    if (!t) return;
    var f = A.readFilters(), x = {};
    for (var k in f) x[k] = f[k];
    if (x.priceMin != null) x.priceMin *= 1e6;
    if (x.priceMax != null) x.priceMax *= 1e6;
    if (t.hasAttribute('data-map-dealer')) { x.dealer = t.getAttribute('data-map-dealer'); x.loc = ''; x.seller = ''; }
    else { x.loc = t.getAttribute('data-map-loc'); x.dealer = ''; x.seller = 'private'; }
    A.setFilters(x); A.closeModal(); A.render(); window.scrollTo(0, 0);
  });

  $('locPill').addEventListener('click', function () {
    var f = A.readFilters(), x = {}; for (var k in f) x[k] = f[k];
    if (x.priceMin != null) x.priceMin *= 1e6;
    if (x.priceMax != null) x.priceMax *= 1e6;
    x.loc = ''; A.setFilters(x); A.render();
  });
  $('openValue').addEventListener('click', function () { openValue(); });
  $('openImport').addEventListener('click', function () { openImport(); });
  $('openWeek').addEventListener('click', openWeek);
  $('openPlate').addEventListener('click', function () { if (window.Registry) Registry.openPlate(); });
  $('openMarket').addEventListener('click', openMarket);
  $('openMap').addEventListener('click', openMap);

  // ---------- ljóst / dökkt útlit ----------
  $('themeBtn').addEventListener('click', function () {
    var cur = document.documentElement.getAttribute('data-theme') || 'dark';  // dökkt er sjálfgefið („sýningarsalur“)
    var next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
  });

  // ---------- setja á heimaskjá ----------
  var deferred = null, standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; $('installBtn').hidden = false; });
  if (ios && !standalone) $('installBtn').hidden = false;
  $('installBtn').addEventListener('click', function () {
    if (deferred) { deferred.prompt(); deferred.userChoice.then(function () { deferred = null; $('installBtn').hidden = true; }); return; }
    A.openModal('<div class="m narrow"><div class="m-head"><h2>📲 Setja á heimaskjá</h2><button class="x" data-close aria-label="Loka">×</button></div>' +
      '<ol class="install-steps"><li>Ýttu á <b>Deila</b>-takkann neðst í Safari (ferningur með ör upp ⬆️)</li><li>Skrunaðu niður og veldu <b>„Add to Home Screen“ / „Setja á heimaskjá“</b></li>' +
      '<li>Ýttu á <b>Bæta við</b>. Bílaleit opnast þá eins og app.</li></ol></div>');
  });
  window.addEventListener('appinstalled', function () { $('installBtn').hidden = true; });

  // ---------- forsíða: tölur sem telja upp og dæmi sem skrifa sig sjálf ----------
  function countUp(el, to) {
    var t0 = performance.now(), dur = 1100;
    (function step(t) {
      var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(to * e).toLocaleString('de-DE');
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  function heroStats() {
    var cs = A.cars(); if (!cs.length) return;
    var dealers = {}; cs.forEach(function (c) { if (!c.priv) dealers[c.dealer] = 1; });
    countUp($('hsCars'), cs.length); countUp($('hsDealers'), Object.keys(dealers).length);
    $('hsUpdated').textContent = ($('updated').textContent || '').replace('Uppfært ', '') || '–';
  }
  var TYPE = ['sjálfskiptur jepplingur undir 4 milljónum', 'rafbíll með 400 km drægni', 'land cruiser með dráttarkrók', 'tesla model y frá einstaklingi',
    'ódýrasti bíllinn ekinn minna en 60 þús km', 'bmw 5 series dísel 2019 eða nýrri', 'clk500'];
  (function typewriter() {
    var q = $('q'), i = 0, j = 0, del = false;
    function tick() {
      if (document.activeElement === q || q.value) { q.placeholder = 'Leitaðu eins og þú talar…'; return setTimeout(tick, 1500); }
      var w = TYPE[i];
      j += del ? -1 : 1;
      q.placeholder = w.slice(0, j) + (del ? '' : '▏');
      if (!del && j >= w.length) { del = true; return setTimeout(tick, 1600); }
      if (del && j <= 0) { del = false; i = (i + 1) % TYPE.length; return setTimeout(tick, 300); }
      setTimeout(tick, del ? 25 : 55);
    }
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) setTimeout(tick, 800);
  })();

  // ---------- myndir fletta á spjaldi þegar músin er yfir því ----------
  var hoverT = null;
  document.addEventListener('mouseover', function (e) {
    var ph = e.target.closest ? e.target.closest('.car .ph') : null;
    if (!ph || ph._cyc) return;
    ph._cyc = true;
    var card = ph.closest('.car'), id = card.getAttribute('data-id'), first = ph.style.backgroundImage;
    A.details(id).then(function (d) {
      if (!d || !d.i || d.i.length < 2 || !ph._cyc) return;
      var k = 0, dots = ph.querySelector('.ph-dots');
      dots.innerHTML = d.i.slice(0, 6).map(function () { return '<i></i>'; }).join('');
      d.i.slice(1, 6).forEach(function (u) { var im = new Image(); im.src = u; });
      function show() { ph.style.backgroundImage = "url('" + d.i[k].replace(/'/g, '%27') + "')"; [].forEach.call(dots.children, function (x, n) { x.classList.toggle('on', n === k); }); }
      show();
      ph._timer = setInterval(function () { k = (k + 1) % Math.min(6, d.i.length); show(); }, 1100);
    });
    ph.addEventListener('mouseleave', function out() {
      ph.removeEventListener('mouseleave', out);
      clearInterval(ph._timer); ph._cyc = false; ph.style.backgroundImage = first;
      var dots = ph.querySelector('.ph-dots'); if (dots) dots.innerHTML = '';
    });
  });

  // ---------- síma-valmynd neðst og síuspjald ----------
  function openFilters(open) {
    $('filters').classList.toggle('open', open);
    document.body.classList.toggle('sheet-open', open);
    $('filtersToggle').setAttribute('aria-expanded', open);
  }
  $('filtersToggle').addEventListener('click', function () { openFilters(!$('filters').classList.contains('open')); });
  $('filtersClose').addEventListener('click', function () { openFilters(false); });
  $('filtersDone').addEventListener('click', function () { openFilters(false); window.scrollTo({ top: $('views').offsetTop - 80, behavior: 'smooth' }); });
  $('bnav').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-nav]') : null; if (!b) return;
    var n = b.getAttribute('data-nav');
    function acct(a) { var t = document.querySelector('[data-acct="' + a + '"]') || document.querySelector('[data-acct="login"]'); if (t) t.click(); }
    if (n === 'search') { A.closeModal(); openFilters(false); window.scrollTo({ top: 0, behavior: 'smooth' }); setTimeout(function () { $('q').focus(); }, 350); }
    else if (n === 'saved') acct('saved');
    else if (n === 'map') openMap();
    else if (n === 'market') openMarket();
    else if (n === 'me') acct('me');
  });

  // ---------- fyrirvari: þarf að samþykkja að tölur eru ágiskanir (munað í vafranum; nýtt útgáfunúmer = spurt aftur) ----------
  var CONSENT_V = '1';
  function consent(force) {
    var d = $('consent'), ok = false;
    try { ok = localStorage.getItem('consent') === CONSENT_V; } catch (e) {}
    if (ok && !force) return;
    $('consentCheck').checked = ok;
    $('consentOk').disabled = !ok;
    $('consentOk').textContent = ok ? 'Loka' : 'Samþykkja og halda áfram';
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  }
  $('consentCheck').addEventListener('change', function () { $('consentOk').disabled = !this.checked; });
  $('consentOk').addEventListener('click', function () {
    try { localStorage.setItem('consent', CONSENT_V); } catch (e) {}
    var d = $('consent'); if (d.close) d.close(); else d.removeAttribute('open');
  });
  $('consent').addEventListener('cancel', function (e) {  // Esc lokar ekki fyrr en samþykkt
    var ok = false; try { ok = localStorage.getItem('consent') === CONSENT_V; } catch (er) {}
    if (!ok) e.preventDefault();
  });
  $('showConsent').addEventListener('click', function () { consent(true); });
  consent(false);

  window.Features = { carExtras: carExtras, historyReady: historyReady, heroStats: heroStats, openValue: openValue, openImport: openImport, openWeek: openWeek, bifreidagjald: bifreidagjald };
})();
