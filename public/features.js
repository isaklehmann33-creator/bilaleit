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
  function num(id) { var v = parseFloat(String($(id).value).replace(',', '.')); return isNaN(v) ? 0 : v; }
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
  function openValue() {
    var last = store('valuation') || {}, f = A.readFilters();
    var mk = last.make || f.make || 'TOYOTA';
    A.openModal('<div class="m"><div class="m-head"><h2>💰 Hvað er bíllinn minn virði?</h2><button class="x" data-close aria-label="Loka">×</button></div>' +
      '<p class="note">Sláðu inn bílinn þinn. Matið byggir á öllum auglýsingum á skrá núna, leiðrétt fyrir aldri, akstri, eldsneyti og útgáfu.</p>' +
      '<form id="valForm" class="val-form">' +
      '<label>Tegund<select id="vMake">' + A.makes().map(function (m) { return '<option value="' + esc(m) + '"' + (m === mk ? ' selected' : '') + '>' + esc(A.cap(m)) + '</option>'; }).join('') + '</select></label>' +
      '<label>Gerð<select id="vModel"></select></label>' +
      '<label>Árgerð<input id="vYear" type="number" inputmode="numeric" min="1970" max="' + (NOW + 1) + '" value="' + (last.year || NOW - 6) + '" required></label>' +
      '<label>Ekinn (km)<input id="vKm" type="number" inputmode="numeric" min="0" step="1000" value="' + (last.km != null ? last.km : 90000) + '" required></label>' +
      '<label>Eldsneyti<select id="vFuel">' + ['Bensín', 'Dísel', 'Tvinn', 'Tengiltvinn', 'Rafmagn'].map(function (x) { return '<option' + (x === last.fuel ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label>' +
      '<label>Skipting<select id="vTrans"><option value="sj"' + (last.trans !== 'bein' ? ' selected' : '') + '>Sjálfskipting</option><option value="bein"' + (last.trans === 'bein' ? ' selected' : '') + '>Beinskipting</option></select></label>' +
      '<label class="wide">Útgáfa / vél (valfrjálst)<input id="vExtra" type="text" placeholder="t.d. 330e, AMG 45, GTI, Performance, 4x4" value="' + esc(last.extra || '') + '"></label>' +
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
        return '<tr class="click" data-open="' + esc(o.id) + '"><td>' + esc(A.cap(o.make) + ' ' + A.cap(o.model)) + '<br><span class="note">' + esc(o.dealer) + '</span></td>' +
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
  // Sjálfgefnar forsendur: áætlanir sem notandinn getur breytt; þær vistast í vafranum
  var DEF = { down: 30, rate: 10.5, years: 5, kmYear: 15000, petrol: 310, diesel: 315, kwh: 22, kmFee: 7, insurance: 180000, tax: 30000, upkeep: 120000 };
  var CONS = { 'Bensín': [7.0, 0], 'Dísel': [6.0, 0], 'Tvinn': [5.0, 0], 'Tengiltvinn': [3.5, 9], 'Rafmagn': [0, 18] }; // [l/100km, kWh/100km]
  function carExtras(c) {
    var el = $('carExtras'); if (!el) return;
    var p = Object.assign({}, DEF, store('costs') || {});
    function inp(id, label, val, step, suffix) {
      return '<label>' + label + '<span class="inp-s"><input id="' + id + '" type="number" inputmode="decimal" step="' + step + '" value="' + val + '">' + (suffix ? '<i>' + suffix + '</i>' : '') + '</span></label>';
    }
    el.innerHTML = '<h4>Fjármögnun og rekstur</h4><div class="cost-grid">' +
      '<div class="cost-box"><div class="cost-inputs">' + inp('cDown', 'Útborgun', p.down, 5, '%') + inp('cRate', 'Vextir', p.rate, 0.1, '%') + inp('cYears', 'Lánstími', p.years, 1, 'ár') + '</div>' +
      '<div class="cost-out" id="cLoan"></div></div>' +
      '<div class="cost-box"><div class="cost-inputs">' + inp('cKm', 'Akstur á ári', p.kmYear, 1000, 'km') + '</div><div class="cost-out" id="cRun"></div>' +
      '<details class="cost-more"><summary>Forsendur (breyttu að vild)</summary><div class="cost-inputs">' +
      inp('cPetrol', 'Bensín', p.petrol, 1, 'kr/l') + inp('cDiesel', 'Dísel', p.diesel, 1, 'kr/l') + inp('cKwh', 'Rafmagn', p.kwh, 1, 'kr/kWh') +
      inp('cKmFee', 'Kílómetragjald', p.kmFee, 0.1, 'kr/km') + inp('cIns', 'Tryggingar', p.insurance, 5000, 'kr/ár') + inp('cTax', 'Bifreiðagjöld', p.tax, 1000, 'kr/ár') +
      inp('cUp', 'Viðhald og dekk', p.upkeep, 5000, 'kr/ár') + '</div><p class="note">Áætlanir. Vextir, eldsneytisverð og gjöld breytast, og tryggingar og bifreiðagjöld fara eftir bíl og ökumanni.</p></details></div></div>';
    function calc() {
      var q = { down: num('cDown'), rate: num('cRate'), years: num('cYears'), kmYear: num('cKm'), petrol: num('cPetrol'), diesel: num('cDiesel'), kwh: num('cKwh'),
        kmFee: num('cKmFee'), insurance: num('cIns'), tax: num('cTax'), upkeep: num('cUp') };
      store('costs', q);
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
      var b = A.model().beta, lossPct = 1 - Math.exp(b[0] + (c.perf.t ? b[9] : 0) + b[1] * q.kmYear / 1e4);
      var dep = c.price * Math.max(0, lossPct);
      var year = energy + fixed + kmFee + dep;
      $('cRun').innerHTML = '<div class="big">' + A.kr(year / 12) + ' <small>á mán.</small></div>' +
        '<div class="cost-rows"><span>⛽ ' + (c.fcat === 'Rafmagn' ? 'Rafmagn' : 'Eldsneyti/rafmagn') + '</span><b>' + A.kr(energy / 12) + '</b>' +
        '<span>🛣️ Kílómetragjald</span><b>' + A.kr(kmFee / 12) + '</b>' +
        '<span>🛡️ Tryggingar, gjöld, viðhald</span><b>' + A.kr(fixed / 12) + '</b>' +
        '<span>📉 Verðfall (~' + Math.round(lossPct * 100) + '%/ári)</span><b>' + A.kr(dep / 12) + '</b></div>' +
        '<span class="note">Með láni: ~' + A.kr(pay + year / 12 - dep / 12) + ' á mán. út úr veskinu (verðfall ekki talið með).</span>';
    }
    el.addEventListener('input', calc);
    calc();
  }

  // ---------- 📊 Markaðurinn ----------
  function tip(e) {
    var t = $('chartTip'), m = e.target.closest ? e.target.closest('[data-tip]') : null;
    if (!t) { t = document.createElement('div'); t.id = 'chartTip'; t.className = 'chart-tip'; document.body.appendChild(t); }
    if (!m) { t.hidden = true; return; }
    t.innerHTML = m.getAttribute('data-tip'); t.hidden = false;
    var x = Math.min(e.clientX + 14, window.innerWidth - t.offsetWidth - 8), y = e.clientY - t.offsetHeight - 10;
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
  $('openValue').addEventListener('click', openValue);
  $('openMarket').addEventListener('click', openMarket);
  $('openMap').addEventListener('click', openMap);

  window.Features = { carExtras: carExtras, historyReady: historyReady };
})();
