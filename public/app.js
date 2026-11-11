/* Bílaleit – leit, verðmat og samanburður. Allt keyrir í vafranum, engin greidd gervigreind. */
(function () {
  'use strict';

  var GITHUB_DATA = 'https://raw.githubusercontent.com/isaklehmann33-creator/bilaleit/main/public/data/cars.json';
  var NOW = new Date().getFullYear();
  var PAGE = 60;
  var $ = function (id) { return document.getElementById(id); };
  var cars = [], model = null, shown = PAGE, compare = [];

  // ---------- hjálparföll ----------
  // gerðaföllin eru í models.js svo síðusmiðurinn (pages.js) noti sömu reglur
  var fold = Models.fold, cap = Models.cap, baseModel = Models.baseModel;
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function kr(n) { return n == null ? '–' : Math.round(n).toLocaleString('de-DE') + ' kr.'; }
  function mkr(n) { return (n / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 2 }) + ' m.kr.'; }
  function kmFmt(n) { return n == null ? '–' : n.toLocaleString('de-DE') + ' km'; }
  function pct(x) { return (x > 0 ? '+' : '') + Math.round(x * 100) + '%'; }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }

  // ---------- flokkun ----------
  var SUV = ('SPORTAGE SORENTO XCEED EV9 EV5 NIRO E-NIRO TUCSON SANTA KONA IONIQ5 RAV4 LAND C-HR YARIS-CROSS HIGHLANDER ' +
    'GLC GLE GLA GLB GLS EQA EQB EQC G Q2 Q3 Q4 Q5 Q7 Q8 E-TRON X1 X2 X3 X4 X5 X6 X7 IX IX1 IX3 XC40 XC60 XC90 EX30 EX40 EX90 C40 ' +
    'KODIAQ KAROQ KAMIQ ENYAQ ELROQ TIGUAN TOUAREG T-ROC T-CROSS TAIGO ID.4 ID.5 RANGE DISCOVERY DEFENDER OUTLANDER ECLIPSE ASX ' +
    'QASHQAI X-TRAIL JUKE ARIYA CX-3 CX-30 CX-5 CX-60 CX-80 MX-30 KUGA PUMA EXPLORER MUSTANG ECOSPORT EDGE 2008 3008 5008 E-2008 E-3008 ' +
    'C5 C3 MOKKA GRANDLAND CROSSLAND CR-V HR-V ZR-V MODEL ZS MARVEL EHS HS 3 4 WRANGLER COMPASS RENEGADE CHEROKEE GRAND VITARA ' +
    'S-CROSS JIMNY DUSTER CAPTUR KADJAR AUSTRAL ARKANA BZ4X UX NX RX MACAN CAYENNE ATTO SEAL-U TONGAN TOYOTA HILUX F-150 RANGER AMAROK').split(' ');

  function fuelCat(c) {
    var f = fold(c.fuel), t = fold(c.title);
    var raf = /raf|electric/.test(f), ice = /bens|dis|petrol|diesel/.test(f);
    if (raf && ice) {
      if (/phev|plug|tengil|e-hybrid|phe\b|\bphe/.test(f + ' ' + t) || /raf\.tengill/.test(f)) return 'Tengiltvinn';
      // BMW 530e, Mercedes E 300 e/de, Volvo T6/T8 Recharge, Audi TFSI e: tengiltvinn þótt það standi ekki
      if (/\b\d{2,3} ?e\b|\b\d{3} ?de\b|recharge|tfsie?\b ?e\b|\bt8\b|\bgte\b|e-tron\b.*hybrid/.test(t)) return 'Tengiltvinn';
      if (/hybrid|tvinn|\bhev\b|e:hev|full hybrid/.test(t) || /^(TOYOTA|LEXUS|HONDA|HYUNDAI|KIA|FORD|RENAULT|SUZUKI|NISSAN|MITSUBISHI|DACIA|MG)$/.test(c.make)) return 'Tvinn';
      // evrópskir „Bensín/Rafmagn“-bílar án hybrid-merkingar eru mild-hybrid (48V): í raun bensín/dísel
      return /dis|diesel/.test(f) ? 'Dísel' : 'Bensín';
    }
    if (raf) return 'Rafmagn';
    if (/hybrid|tvinn/.test(f + ' ' + t)) return /phev|plug|e-hybrid/.test(t) ? 'Tengiltvinn' : 'Tvinn';
    if (/dis|diesel/.test(f)) return 'Dísel';
    if (/bens|petrol/.test(f)) return 'Bensín';
    if (/\b(tdi|cdi|crdi|dci|hdi|bluehdi|d4|d5)\b/.test(t)) return 'Dísel';
    return 'Bensín';
  }
  function isAwd(c) {
    return /fjorhjol|aldrif/.test(fold(c.drive)) || /\b(awd|4wd|4x4|4matic|quattro|xdrive|4motion|allrad|e-four|all4)\b/i.test(c.title);
  }

  function prep(c) {
    // Brimborg skráir stundum afl með aukastaf án kommu („1836“ = 183,6 hö); undir 40 hö er villa (t.d. kWh)
    if (c.hp > 1000) c.hp = Math.round(c.hp / 10);
    if (c.hp && (c.hp < 40 || c.hp > 1000)) c.hp = null;
    c.base = baseModel(c.model, c.make);
    c.key = c.make + '|' + c.base;
    c.fcat = fuelCat(c);
    c.awd = isAwd(c);
    c.suv = SUV.indexOf(c.base.split(' ')[0]) >= 0 || SUV.indexOf(c.base.replace(' ', '')) >= 0 || /\b(jeppi|jepplingur)\b/i.test(c.title);
    c.auto = /sjalf/.test(fold(c.trans)) ? true : /bein/.test(fold(c.trans)) ? false : (c.fcat === 'Rafmagn' ? true : null);
    c.age = Math.max(0, NOW - (c.year || NOW));
    c.ftitle = fold(c.make + ' ' + c.model);
    c.perf = perfTier(c);
    c.pwRaw = c.hp ? c.hp / 100 : powerHint(c);  // hestöfl af auglýsingunni ef til, annars giskað út frá heitinu
    c.priv = c.src === 'bland.is';
    c.vis = VISION[c.id] || null;
    // sérútbúnir bílar og verkefni: ekki sambærilegir við venjulega bíla af sömu gerð
    c.classic = !!c.year && c.year <= NOW - 40;  // fornbíll: verð fer eftir ástandi og sögu, ekki aldri
    c.special = c.classic || /rall[yi]|rallykross|rallycross|kvartm|drift|keppnis|sandspyrn|torfaer|track ?car|race ?car|project|verkefni|varahlut|nidurrif|\bparts\b|tjonabil|ogangfaer|ookufaer|uppgerdar|crash/
      .test(fold(c.title + ' ' + c.model)) || (c.fl || []).indexOf('serut') >= 0 ||
      !!(c.vis && (c.vis[0] === 'keppni' || c.vis[0] === 'verkefni') && c.vis[1] >= 0.8);  // einkasala (bland.is); allt annað er bílasala
    return c;
  }

  // ---------- kraftútgáfur og vélarstærð ----------
  // tier 1 = sportútgáfa (AMG 43, M340i, S4, GTI …), tier 2 = toppútgáfa (AMG 45/63, M3, RS6, Golf R, Turbo S …).
  // „AMG Line“ / „AMG pakki“ / „S line“ / „M sport“ eru bara útlitspakkar og telja ekki.
  function perfTier(c) {
    var t = ' ' + String(c.model || '').toUpperCase().replace(/[-_]/g, ' ') + ' ', mk = c.make, m;
    // útlitspakkar sem líkjast kraftútgáfum: R-Line, GT-Line, ST-Line, N Line, S line, AMG Line/pakki, M Sport, R-Design, S tronic
    t = t.replace(/ (R|GT|ST|N|S|M|AMG|RS) ?LINE/g, ' ').replace(/ AMG ?(PAKKI|PACK\w*|ÚTLIT\w*|STYLING|EDITION|SPORT)/g, ' ')
      .replace(/ M ?(SPORT|PAKKI|PACK\w*)/g, ' ').replace(/ R ?DESIGN/g, ' ').replace(/ S ?TRONIC/g, ' ');
    function r(tier, label) { return { t: tier, label: label }; }
    if (mk === 'MERCEDES-BENZ') {
      if (/ AMG GT /.test(t) || / (63|65) /.test(t) || / (45|63) S /.test(t) || / SL 6\d/.test(t)) return r(2, 'AMG');
      if (/ 45 /.test(t)) return r(2, 'AMG 45');
      if ((m = t.match(/ (35|43|53|55) /))) return r(1, 'AMG ' + m[1]);
      if (/ (?:[A-Z]{1,3} ?)?(500|550|560|420|430) /.test(t) || / [A-Z]{1,3}(500|550) /.test(t)) return r(1, 'V8');
      if (/ (?:[A-Z]{1,3} ?)?600 /.test(t)) return r(2, 'V12');
    }
    if (mk === 'BMW') {
      if (/ (M[2-8]|X[3-7] M|XM) /.test(t) || / M COMPETITION /.test(t)) return r(2, 'M');
      if (/ M\d{2,3}[IDE]? /.test(t) || / M50[ID]? /.test(t) || / M60I? /.test(t)) return r(1, 'M Performance');
    }
    if (mk === 'AUDI') {
      if (/ RS ?Q?\d /.test(t) || / RS E ?TRON/.test(t) || / R8 /.test(t)) return r(2, 'RS');
      if (/ S\d /.test(t) || / SQ\d /.test(t)) return r(1, 'S');
    }
    if (mk === 'VOLKSWAGEN') {
      if (/ (GOLF|TIGUAN|ARTEON|TOUAREG|T ROC) R /.test(t) || / R 20 /.test(t)) return r(2, 'R');
      if (/ (GTI|GTX|GTS) /.test(t)) return r(1, 'GTI/GTX');
    }
    if (mk === 'PORSCHE') {
      if (/ (TURBO S|GT2|GT3|GT4|TURBO GT) /.test(t)) return r(2, 'Turbo S/GT');
      if (/ (TURBO|GTS) /.test(t)) return r(1, 'Turbo/GTS');
    }
    if (mk === 'TESLA') {
      if (/ PLAID /.test(t)) return r(2, 'Plaid');
      if (/ PERFORMANCE /.test(t)) return r(1, 'Performance');
    }
    if (mk === 'FORD') {
      if (/ (RAPTOR|SHELBY|GT500|GT 500|RS) /.test(t)) return r(2, 'Raptor/Shelby/RS');
      if (/ (ST|MACH 1|GT) /.test(t)) return r(1, 'ST/GT');
    }
    if (mk === 'LAND ROVER') {
      if (/ (SVR|SV|SVAUTOBIOGRAPHY|SV AUTOBIOGRAPHY|V8 SUPERCHARGED) /.test(t)) return r(2, 'SVR/SV');
      if (/ (P530|P510E|P550E|V8|P575|D350|P400E) /.test(t)) return r(1, 'V8/öflug vél');
    }
    if ((mk === 'JEEP' || mk === 'DODGE' || mk === 'CHRYSLER') && (/ (SRT|HELLCAT|TRX|392) /.test(t) || / GRAND CHEROKEE TRACKHAWK /.test(t))) return r(2, 'SRT');
    if (mk === 'HONDA' && / TYPE R /.test(t)) return r(2, 'Type R');
    if (mk === 'TOYOTA' && / (GR|GR86|GRMN) /.test(t) && !/ GR SPORT /.test(t)) return r(2, 'GR');
    if ((mk === 'HYUNDAI' || mk === 'KIA') && / (N|GT) /.test(t)) return r(1, mk === 'KIA' ? 'GT' : 'N');
    if (mk === 'VOLVO' && / POLESTAR /.test(t)) return r(1, 'Polestar Engineered');
    if (mk === 'CUPRA' && / VZ\d?/.test(t)) return r(1, 'VZ');
    if (/ V12 /.test(t)) return r(2, 'V12');
    if (/ V8 /.test(t)) return r(1, 'V8');
    return r(0, '');
  }
  // Talan í heitinu sem vísbending um vélarafl, á svipuðum kvarða milli tegunda (~1–6)
  function powerHint(c) {
    var t = ' ' + String(c.model || '').toUpperCase().replace(/-/g, ' ') + ' ', m;
    if (c.perf.t) return null;
    if (c.fcat === 'Rafmagn') return null;  // „EQE 350“, „i4 40“ o.s.frv. segja ekkert um vélarstærð
    if (c.make === 'MERCEDES-BENZ' && (m = t.match(/ [A-Z]{0,3} ?([1-6]\d0)( ?[DECH]|CDI|CGI| BLUETEC)? /))) return +m[1] / 100;
    if (c.make === 'BMW' && ((m = t.match(/ [1-8](\d\d)[IDE]? /)) || (m = t.match(/ (?:X?DRIVE|SDRIVE) ?(\d\d)[IDE]? /)))) return +m[1] / 10;  // 520i -> 2,0; 545e -> 4,5
    if (c.make === 'AUDI' && (m = t.match(/ ([3-6]\d) (TFSI|TDI|E TRON|TFSIE|QUATTRO)/))) return +m[1] / 10;
    if (c.make === 'VOLVO' && (m = t.match(/ [TDB]([2-8]) /))) return +m[1];
    return null;
  }

  // ---------- verðmatslíkan ----------
  // log(verð) = fasti gerðar + b·aldur + c·akstur + eldsneytisáhrif + kraftútgáfa + vélarafl.
  // Hallatölur eru metnar *innan* hverrar gerðar (sami bíll, mismikið ekinn), svo dýrar tegundir rugla þær ekki.
  var FUELS = ['Rafmagn', 'Tengiltvinn', 'Tvinn', 'Dísel'];
  // Aldur og akstur sem „brotnar línur“: verðfallið má hægja á sér (eða snúast við) fyrir gamla og mikið ekna bíla.
  // Án þess féllu 20 ára bílar endalaust ~7% á ári og voru metnir allt of lágt.
  var AGE_KNOTS = [4, 9, 14, 19], KM_KNOTS = [100000, 200000];
  var FI = { age: 0, km: AGE_KNOTS.length + 1 };  // stöður í feats(): aldur, aldurshnútar, akstur, aksturshnútar, eldsneyti, útgáfa, afl, útgáfa×aldur
  FI.fuel = FI.km + 1 + KM_KNOTS.length; FI.perf1 = FI.fuel + FUELS.length; FI.perf2 = FI.perf1 + 1; FI.pw = FI.perf2 + 1; FI.perfAge = FI.pw + 1; FI.mo = FI.perfAge + 1;
  function feats(c) {
    var km = c.km != null ? c.km : 15000 * c.age; // vantar akstur: gerum ráð fyrir meðalakstri
    var x = [c.age];
    AGE_KNOTS.forEach(function (k) { x.push(Math.max(0, c.age - k)); });
    x.push(km / 1e4);
    KM_KNOTS.forEach(function (k) { x.push(Math.max(0, km - k) / 1e4); });
    for (var i = 0; i < FUELS.length; i++) x.push(c.fcat === FUELS[i] ? 1 : 0);
    x.push(c.perf.t === 1 ? 1 : 0, c.perf.t === 2 ? 1 : 0, c.pw, c.perf.t ? c.age : 0);  // sportbílar falla hægar í verði
    x.push(c.mo || 0);  // mánuðir síðan bíllinn seldist (0 = á skrá núna): líkanið lærir markaðsþróun
    return x;
  }
  // verðfall á ári við tiltekinn aldur (halli brotnu línunnar þar)
  function ageSlope(age, perf) {
    var b = model.beta, s = b[FI.age];
    AGE_KNOTS.forEach(function (k, i) { if (age > k) s += b[FI.age + 1 + i]; });
    return s + (perf ? b[FI.perfAge] : 0);
  }
  function kmSlope(km) {
    var b = model.beta, s = b[FI.km];
    KM_KNOTS.forEach(function (k, i) { if (km > k) s += b[FI.km + 1 + i]; });
    return s;
  }
  function solve(A, b) {
    var n = b.length, M = A.map(function (r, i) { return r.concat([b[i]]); });
    for (var i = 0; i < n; i++) {
      var p = i;
      for (var r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
      var t = M[i]; M[i] = M[p]; M[p] = t;
      if (Math.abs(M[i][i]) < 1e-12) continue;
      for (r = 0; r < n; r++) {
        if (r === i) continue;
        var f = M[r][i] / M[i][i];
        for (var k = i; k <= n; k++) M[r][k] -= f * M[i][k];
      }
    }
    return M.map(function (r, i) { return Math.abs(r[i]) < 1e-12 ? 0 : r[n] / r[i]; });
  }
  function fit(list) {
    var groups = {};
    list.forEach(function (c) { (groups[c.key] = groups[c.key] || []).push(c); });
    // vantar vélarafl: notum meðaltal gerðarinnar, svo það hafi engin áhrif innan hennar
    Object.keys(groups).forEach(function (k) {
      var known = groups[k].filter(function (c) { return c.pwRaw != null; });
      var mean = known.length ? known.reduce(function (s, c) { return s + c.pwRaw; }, 0) / known.length : 0;
      groups[k].forEach(function (c) { c.pw = c.pwRaw != null ? c.pwRaw : mean; });
    });
    var d = feats(list[0]).length, XtX = [], Xty = [], i, j;
    for (i = 0; i < d; i++) { XtX.push(new Array(d).fill(0)); Xty.push(0); }
    Object.keys(groups).forEach(function (k) {
      var g = groups[k];
      if (g.length < 2) return;
      var mx = new Array(d).fill(0), my = 0, W = 0;
      g.forEach(function (c) { W += c.w; });
      g.forEach(function (c) { var x = feats(c); for (i = 0; i < d; i++) mx[i] += c.w * x[i] / W; my += c.w * Math.log(c.price) / W; });
      g.forEach(function (c) {
        var x = feats(c), y = Math.log(c.price) - my;
        for (i = 0; i < d; i++) {
          var xi = x[i] - mx[i];
          Xty[i] += c.w * xi * y;
          for (j = 0; j < d; j++) XtX[i][j] += c.w * xi * (x[j] - mx[j]);
        }
      });
    });
    for (i = 0; i < d; i++) XtX[i][i] += 0.5; // smá ridge svo fáir bílar valdi ekki rugli
    // Forsenda um vélarafl: ~11% hærra verð á hverja einingu (100 hö eða 1 lítra) innan sömu gerðar.
    // Fá og sundurleit gögn um afl gáfu annars ~0 („520i jafn dýr og 545e“); gögnin mega hnika forsendunni.
    var PW_PRIOR = 0.11, PW_STRENGTH = 400;
    XtX[FI.pw][FI.pw] += PW_STRENGTH; Xty[FI.pw] += PW_STRENGTH * PW_PRIOR;
    var beta = solve(XtX, Xty);
    if (beta[FI.pw] < 0.03) beta[FI.pw] = 0.03;  // stærri vél lækkar aldrei verð
    function lin(c) { var x = feats(c), s = 0; for (var i = 0; i < d; i++) s += beta[i] * x[i]; return s; }

    var tot = 0, totW = 0, makes = {}, grp = {}, grpT = {};
    list.forEach(function (c) {
      c._r = Math.log(c.price) - lin(c);
      var w = c.w; tot += w * c._r; totW += w;
      var m = makes[c.make] = makes[c.make] || { s: 0, n: 0 }; m.s += w * c._r; m.n += w;
      var g = grp[c.key] = grp[c.key] || { s: 0, n: 0, ss: 0, cnt: 0 }; g.s += w * c._r; g.n += w; g.ss += w * c._r * c._r; g.cnt++;
      var tk = c.key + '|' + c.perf.label, gt = grpT[tk] = grpT[tk] || { s: 0, n: 0 }; gt.s += w * c._r; gt.n += w;  // sama útgáfa (AMG 55 ≠ V8)
    });
    var glob = tot / totW;
    // Mat fyrir hvern bíl án hans sjálfs (leave-one-out), svo bíllinn hafi ekki áhrif á eigið mat
    list.forEach(function (c) {
      if (c.sold) return;  // seldir bílar eru bara viðmið, ekki metnir sjálfir
      var m = makes[c.make], g = grp[c.key], w = c.w;
      var mk = (m.s - w * c._r + 3 * glob) / (m.n - w + 3);
      var gi = (g.s - w * c._r + 1.5 * mk) / (g.n - w + 1.5);
      // kraftútgáfur: miðum fyrst við aðra í sömu útgáfu (Golf R við Golf R); almenna álagið gildir bara ef enginn er til
      if (c.perf.t) { var gt = grpT[c.key + '|' + c.perf.label]; gi = (gt.s - w * c._r + 1 * gi) / (gt.n - w + 1); }
      c.est = Math.round(Math.exp(gi + lin(c)) / 1e4) * 1e4;
      c.peers = g.cnt - 1;
      c.tierPeers = groups[c.key].filter(function (o) { return o !== c && o.perf.label === c.perf.label; }).length;
      // sambærilegir með sömu vél og eldsneyti (t.d. 520i ber sig ekki saman við 530e/545e)
      c.enginePeers = c.pwRaw == null ? null : groups[c.key].filter(function (o) {
        return o !== c && o.pwRaw != null && Math.abs(o.pwRaw - c.pwRaw) <= 0.35 && o.fcat === c.fcat;
      }).length;
      // sambærilegir á svipuðum aldri: annars byggir matið á framreiknuðu verðfalli (2016 bíll „leiðréttur“ í 2023)
      c.agePeers = groups[c.key].filter(function (o) { return o !== c && Math.abs(o.age - c.age) <= 4; }).length;
      c.dev = c.price / c.est - 1;
    });
    // mat fyrir bíl sem er ekki í gögnunum (t.d. „hvað er bíllinn minn virði?“), með líklegu bili
    var gss = list.reduce(function (s, c) { return s + c.w * (c._r - glob) * (c._r - glob); }, 0) / totW;
    function estimate(c) {
      var grpCars = groups[c.key] || [];
      if (c.pwRaw == null) {
        var known = grpCars.filter(function (o) { return o.pwRaw != null; });
        c.pw = known.length ? known.reduce(function (s, o) { return s + o.pwRaw; }, 0) / known.length : 0;
      } else c.pw = c.pwRaw;
      var m = makes[c.make], g = grp[c.key];
      var mk = m ? (m.s + 3 * glob) / (m.n + 3) : glob;
      var gi = g ? (g.s + 1.5 * mk) / (g.n + 1.5) : mk;
      var gt = grpT[c.key + '|' + c.perf.label];
      if (c.perf.t && gt) gi = (gt.s + gi) / (gt.n + 1);
      // dreifing: innan gerðar ef nóg er af bílum, annars markaðurinn í heild
      var sd = g && g.cnt >= 5 ? Math.sqrt(Math.max(g.ss / g.n - Math.pow(g.s / g.n, 2), 0.004)) : Math.sqrt(gss);
      var est = Math.exp(gi + lin(c));
      return { est: est, lo: est * Math.exp(-1.0 * sd), hi: est * Math.exp(1.0 * sd), peers: g ? g.cnt : 0, sd: sd };
    }
    return { beta: beta, lin: lin, groups: groups, estimate: estimate };
  }
  function verdict(c) {
    if (c.classic) return { cls: 'mid', txt: 'Fornbíll', unsure: true };
    if (c.special) return { cls: 'warn', txt: 'Sérútbúinn / verkefni', unsure: true };
    if (c.peers < 2) return { cls: 'mid', txt: 'Fáir sambærilegir', unsure: true };
    // meira en helmingi undir mati: oftast innsláttarvilla, varahlutabíll, tjónabíll eða svindl
    if (c.dev <= -0.5) return { cls: 'warn', txt: 'Athugaðu verðið', unsure: true };
    // kraftútgáfa sem enginn annar sambærilegur er til af: matið byggir á almennu álagi, svo við fullyrðum ekki
    if (c.perf.t && !c.tierPeers) return { cls: 'mid', txt: 'Sjaldgæf útgáfa', unsure: true };
    if (c.enginePeers != null && c.enginePeers < 2 && Math.abs(c.dev) >= 0.12) return { cls: 'mid', txt: 'Fáir með sömu vél', unsure: true };
    if (!c.agePeers && Math.abs(c.dev) >= 0.12) return { cls: 'mid', txt: 'Fáir á svipuðum aldri', unsure: true };
    if (c.km == null && c.age > 3) return { cls: 'mid', txt: 'Akstur óþekktur', unsure: true };
    // þekktur viðgerðarkostnaður: er bíllinn enn ódýr þegar viðgerðin er lögð við?
    var rc = repairCost(c);
    if (rc && c.est) {
      var after = (c.price + rc.mid) / c.est - 1;
      if (after <= -0.12) return { cls: 'good', txt: 'Gott verð þrátt fyrir viðgerð ' + pct(after) };
      if (c.dev <= -0.12) return { cls: 'warn', txt: 'Ódýr en þarf viðgerð', unsure: true };
    }
    // matið miðast við gallalausan bíl: ódýr bíll sem lýsingin segir gallaðan er ekki „gott verð“
    if (c.dev <= -0.12 && c.fl && c.fl.some(function (f) { return f === 'tjon' || f === 'laga' || f === 'ryd'; })) return { cls: 'warn', txt: 'Ódýr en nefnir galla ' + pct(c.dev) };
    if (c.dev <= -0.12) return { cls: 'good', txt: 'Gott verð ' + pct(c.dev) };
    if (c.dev >= 0.12) return { cls: 'bad', txt: 'Hátt verð ' + pct(c.dev) };
    return { cls: 'mid', txt: 'Eðlilegt verð ' + pct(c.dev) };
  }
  function adjusted(other, target) {
    // verð hins bílsins ef hann væri jafn gamall og jafn mikið ekinn og target
    return other.price * Math.exp(model.lin(target) - model.lin(other));
  }
  function similar(c, n) {
    var g = model.groups[c.key] || [];
    return g.filter(function (o) { return o !== c && Math.abs(o.age - c.age) <= 12; }).sort(function (a, b) {
      function d(o) { return Math.abs(o.age - c.age) + Math.abs((o.km || 0) - (c.km || 0)) / 30000 + (o.fcat === c.fcat ? 0 : 2) + 4 * Math.abs(o.perf.t - c.perf.t) + 3 * Math.abs(o.pw - c.pw); }
      return d(a) - d(b);
    }).slice(0, n || 8);
  }

  // ---------- snjöll leit (íslenskt mál -> síur) ----------
  var MAKE_ALIAS = { benz: 'MERCEDES-BENZ', bens: 'MERCEDES-BENZ', mercedes: 'MERCEDES-BENZ', merc: 'MERCEDES-BENZ', vw: 'VOLKSWAGEN',
    volkswagen: 'VOLKSWAGEN', volksvagen: 'VOLKSWAGEN', landrover: 'LAND ROVER', citroen: 'CITROEN', skoda: 'SKODA' };
  var UNIT = '(m\\.?\\s?kr\\.?|millj\\w*|milljon\\w*|m\\b|thus\\w*|th\\b|k\\b|kr\\.?)?';
  var NUM = '(\\d+(?:[.,]\\d+)*)';

  function toNum(s) {
    s = String(s);
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) return +s.replace(/\./g, '');
    return parseFloat(s.replace(',', '.'));
  }
  function money(n, unit) {
    n = toNum(n); unit = unit || '';
    if (/^(m|millj|milljon)/.test(unit)) return n * 1e6;
    if (/^(thus|th|k)/.test(unit)) return n * 1e3;
    return n < 200 ? n * 1e6 : n;
  }
  function kmVal(n, unit) {
    n = toNum(n);
    return /^(thus|th|k)/.test(unit || '') || n < 1000 ? n * 1000 : n;
  }

  function parseQuery(raw) {
    var q = ' ' + fold(raw).replace(/[„“"!?]/g, ' ') + ' ', f = {}, said = [];
    function take(re, fn) { q = q.replace(re, function () { fn.apply(null, arguments); return ' '; }); }

    // akstur
    take(new RegExp('(?:ekinn?|ekid|akstur|keyrd\\w*)?\\s*(?:undir|minna en|innan vid|max|mest|ekki meira en|<)\\s*' + NUM + '\\s*(thus\\w*|th\\b|k\\b)?\\s*(?:km|kilometr\\w*)', 'g'),
      function (m, n, u) { f.kmMax = kmVal(n, u); });
    take(new RegExp('(?:ekinn?|ekid|keyrd\\w*)\\s*(?:undir|minna en|innan vid|max|mest|ekki meira en)\\s*' + NUM + '\\s*(thus\\w*|th\\b|k\\b)?', 'g'),
      function (m, n, u) { f.kmMax = kmVal(n, u); });
    take(/litid ekinn\w*|lítid ekinn/g, function () { f.kmMax = f.kmMax || 60000; });

    // árgerð
    take(/((?:19|20)\d\d)\s*(?:-|–|til)\s*((?:19|20)\d\d)/g, function (m, a, b) { f.yearMin = +a; f.yearMax = +b; });
    take(/(?:argerd\w*\s*)?((?:19|20)\d\d)\s*(?:eda|og)?\s*(?:nyrri|yngri|\+)/g, function (m, y) { f.yearMin = +y; });
    take(/(?:nyrri|yngri) en\s*((?:19|20)\d\d)/g, function (m, y) { f.yearMin = +y + 1; });
    take(/(?:eldri en|fyrir)\s*((?:19|20)\d\d)/g, function (m, y) { f.yearMax = +y - 1; });
    take(/(?:fra|eftir|argerd|argerdar?)\s*((?:19|20)\d\d)/g, function (m, y) { f.yearMin = +y; });
    take(/(?:ekki eldri en|yngri en|mest)\s*(\d{1,2})\s*ara/g, function (m, n) { f.yearMin = NOW - +n; });
    take(/(?:^|\s)((?:19|20)\d\d)(?=\s)/g, function (m, y) { f.yearMin = +y; f.yearMax = +y; });

    // verð
    take(new RegExp(NUM + '\\s*' + UNIT + '\\s*(?:-|–|til)\\s*' + NUM + '\\s*' + UNIT, 'g'), function (m, a, ua, b, ub) {
      f.priceMin = money(a, ua || ub); f.priceMax = money(b, ub);
    });
    take(new RegExp('(?:undir|minna en|innan vid|max|hamark|upp ad|upp i|ekki meira en|ekki yfir|i mesta lagi|<|fyrir)\\s*' + NUM + '\\s*' + UNIT, 'g'),
      function (m, n, u) { f.priceMax = money(n, u); });
    take(new RegExp('(?:yfir|meira en|minnst|fra|>)\\s*' + NUM + '\\s*' + UNIT, 'g'), function (m, n, u) { f.priceMin = money(n, u); });
    take(new RegExp('(?:um|ca\\.?|sirka|c\\.a\\.?)\\s*' + NUM + '\\s*' + UNIT, 'g'), function (m, n, u) {
      var v = money(n, u); f.priceMin = v * 0.85; f.priceMax = v * 1.15;
    });
    take(new RegExp(NUM + '\\s*(m\\.?\\s?kr\\.?|millj\\w*|milljon\\w*)', 'g'), function (m, n, u) { f.priceMax = money(n, u); });

    // eldsneyti, skipting, gerð
    take(/tengiltvinn\w*|plug.?in|phev|hledslu\w*/g, function () { f.fuel = 'Tengiltvinn'; });
    take(/rafmagns\w*|rafbil\w*|rafknu\w*|\bev\b|rafdrif\w*|\braf\b/g, function () { f.fuel = 'Rafmagn'; });
    take(/hybrid|tvinn\w*|blendings\w*/g, function () { f.fuel = f.fuel || 'Tvinn'; });
    take(/dis[ie]l\w*/g, function () { f.fuel = 'Dísel'; });
    take(/bensin\w*/g, function () { f.fuel = 'Bensín'; });
    take(/sjalfskipt\w*|sjalfsk\w*|automat\w*|\bssk\b/g, function () { f.trans = 'sj'; });
    take(/beinskipt\w*|\bbsk\b|manual/g, function () { f.trans = 'bein'; });
    take(/jeppling\w*|jepp\w*|suv|sportjepp\w*|crossover/g, function () { f.body = 'suv'; });
    take(/folksbil\w*|smabil\w*|skutbil\w*|stationbil\w*/g, function () { f.body = 'car'; });
    take(/einstakling\w*|einkasal\w*|einkaadil\w*|\bbland(\.is)?\b|beint fra eiganda/g, function () { f.seller = 'private'; });
    take(/fra bilasol\w*|hja bilasol\w*|bilasolu\w*/g, function () { f.seller = 'dealer'; });
    var FT_WORDS = [['krokur', /drattarkrok\w*|drattarbeisli\w*|med krok\w*|krok\b/g], ['sjo', /7 sae?ta|7 manna|sjo sae?ta/g],
      ['carplay', /carplay|android auto/g], ['hitistyri', /hita? i styri/g], ['hitisaeti', /hita? i saetum|saetahit\w*/g], ['ledur', /ledur\w*/g],
      ['topplug', /topplug\w*|glerthak\w*|panorama/g], ['myndavel', /bakkmyndavel\w*/g], ['varmadaela', /varmadael\w*/g]];
    FT_WORDS.forEach(function (w) { take(w[1], function () { f.ft = (f.ft ? f.ft + ',' : '') + w[0]; }); });
    take(/(?:draegni|drifur|kemst)\s*(?:yfir|minnst|amk\.?|a\.?m\.?k\.?)?\s*(\d{2,3})\s*km/g, function (m, n) { f.rangeMin = +n; });
    take(/an (?:galla|tjons?|ryds?)|engir gallar|gallalaus\w*|tjonlaus\w*/g, function () { f.clean = true; });
    take(/mest afl|kraftmest\w*|hestofl fyrir/g, function () { f.sort = 'hpPerKr'; });
    take(/fjorhjoladrif\w*|aldrif\w*|4x4|\bawd\b|\b4wd\b|fjordrif\w*/g, function () { f.awd = true; });

    // röðun
    take(/odyr(ast|asti|astan|ustu)\w*/g, function () { f.sort = 'priceAsc'; });
    take(/minnst ekin\w*/g, function () { f.sort = 'kmAsc'; });
    take(/nyjast\w*|nyjust\w*|yngst\w*/g, function () { f.sort = 'yearDesc'; });
    take(/gott verd|godu verdi|besta verd\w*|godum kaup\w*|kjarakaup|tilbod\w*/g, function () { f.deal = true; f.sort = 'deal'; });

    // „v-klasse“, „c class“ -> Mercedes-gerð; „5 series“, „3 línan“ -> BMW-sería
    take(/(?:^|\s)([a-z]{1,3})[- ]?(?:klasse|class|klassi)(?=\s)/g, function (m, l) { f.make = 'MERCEDES-BENZ'; f.model = l.toUpperCase(); });
    take(/(?:^|\s)(\d)[- ]?(?:series|seria|serian|lina|linan|linu)(?=\s)/g, function (m, d) { f.make = 'BMW'; f.model = d + ' SERIES'; });

    // tegund og gerð
    Object.keys(MAKE_ALIAS).sort(function (a, b) { return b.length - a.length; }).forEach(function (a) {
      take(new RegExp('(^|\\s)' + a + '(?=\\s)', 'g'), function () { f.make = MAKE_ALIAS[a]; });
    });
    var makes = uniq(cars.map(function (c) { return c.make; })).sort(function (a, b) { return b.length - a.length; });
    makes.forEach(function (mk) {
      take(new RegExp('(^|\\s)' + escRe(fold(mk)) + '(?=\\s)', 'g'), function () { f.make = mk; });
    });
    var bases = uniq(cars.filter(function (c) { return !f.make || c.make === f.make; }).map(function (c) { return c.make + '|' + c.base; })
      .concat(Object.keys(CATALOG).filter(function (mk) { return !f.make || mk === f.make; }).reduce(function (a, mk) {
        return a.concat(catalogBases(mk).map(function (b) { return mk + '|' + b; }));
      }, [])));
    bases.sort(function (a, b) { return b.length - a.length; });
    bases.some(function (kb) {
      var b = kb.split('|')[1], fb = fold(b);
      // „clk500“ / „clk 500“: gerð + vélartala, talan verður textasía svo leitin finni bara 500-bílana
      var re = new RegExp('(^|\\s)' + escRe(fb).replace(/\\\.|-/g, '[.\\- ]?') + '(?:[ -]?(\\d{2,3}[a-z]?))?(?=\\s)');
      var mm = !f.model && fb.length > 1 ? q.match(re) : null;
      if (mm) {
        f.model = b; f.make = kb.split('|')[0];
        if (mm[2] && !/^(19|20)\d\d$/.test(mm[2])) f.text = mm[2];
        q = q.replace(re, ' ');
        return true;
      }
      return false;
    });

    // önnur orð sem koma fyrir í heitum bíla (t.d. "gt", "4matic") verða textasía
    var vocab = {};
    cars.forEach(function (c) { c.ftitle.split(/\s+/).forEach(function (w) { vocab[w] = 1; }); });
    var STOP = { og: 1, i: 1, a: 1, med: 1, sem: 1, er: 1, en: 1, um: 1, til: 1, ad: 1, bil: 1, bill: 1, eda: 1, fyrir: 1, ekki: 1 };
    var words = q.split(/\s+/).filter(function (w) { return w.length > 1 && vocab[w] && !STOP[w] && !/^\d+$/.test(w); });
    if (words.length) f.text = (f.text ? f.text + ' ' : '') + words.join(' ');

    if (f.make) said.push(cap(f.make) + (f.model ? ' ' + cap(f.model) : ''));
    if (f.fuel) said.push(f.fuel.toLowerCase());
    if (f.body) said.push(f.body === 'suv' ? 'jeppi/jepplingur' : 'fólksbíll');
    if (f.trans) said.push(f.trans === 'sj' ? 'sjálfskiptur' : 'beinskiptur');
    if (f.awd) said.push('fjórhjóladrif');
    if (f.priceMin && f.priceMax) said.push(mkr(f.priceMin) + '–' + mkr(f.priceMax));
    else if (f.priceMax) said.push('undir ' + mkr(f.priceMax));
    else if (f.priceMin) said.push('yfir ' + mkr(f.priceMin));
    if (f.yearMin && f.yearMin === f.yearMax) said.push('árgerð ' + f.yearMin);
    else { if (f.yearMin) said.push('árgerð ' + f.yearMin + '+'); if (f.yearMax) said.push('árgerð til ' + f.yearMax); }
    if (f.kmMax) said.push('ekinn undir ' + kmFmt(f.kmMax));
    if (f.seller) said.push(f.seller === 'private' ? 'einstaklingar (bland.is)' : 'bílasölur');
    if (f.ft) said.push(f.ft.split(',').map(function (k) { return FEAT_TXT[k].toLowerCase(); }).join(', '));
    if (f.rangeMin) said.push('drægni ' + f.rangeMin + '+ km');
    if (f.clean) said.push('án viðvarana');
    if (f.deal) said.push('gott verð');
    if (f.text) said.push('„' + f.text + '“');
    if (f.sort && f.sort !== 'deal') said.push({ priceAsc: 'ódýrast fyrst', kmAsc: 'minnst ekinn fyrst', yearDesc: 'nýjast fyrst', hpPerKr: 'mest afl fyrir peninginn' }[f.sort]);
    return { f: f, said: said };
  }
  function uniq(a) { var s = {}; return a.filter(function (x) { return s[x] ? false : (s[x] = 1); }); }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // ---------- síur ----------
  var F = ['fMake', 'fModel', 'fPriceMin', 'fPriceMax', 'fYearMin', 'fYearMax', 'fKmMax', 'fFuel', 'fTrans', 'fBody', 'fDealer', 'fSeller', 'fRange', 'fClean', 'fText', 'fAwd', 'fDeal', 'fSort'];
  function readFilters() {
    var v = function (id) { return $(id).value; };
    var n = function (id) { var x = parseFloat(v(id)); return isNaN(x) ? null : x; };
    return {
      make: v('fMake'), model: v('fModel'), priceMin: n('fPriceMin'), priceMax: n('fPriceMax'), yearMin: n('fYearMin'),
      yearMax: n('fYearMax'), kmMax: n('fKmMax'), fuel: v('fFuel'), trans: v('fTrans'), body: v('fBody'),
      dealer: v('fDealer'), seller: v('fSeller'), view: v('fView'), loc: v('fLoc'), ft: v('fFt'), rangeMin: n('fRange'), clean: $('fClean').checked, text: fold(v('fText')).trim(), awd: $('fAwd').checked, deal: $('fDeal').checked, sort: v('fSort')
    };
  }
  function setFilters(f) {
    $('fMake').value = f.make || ''; fillModels();
    $('fModel').value = f.model || '';
    $('fPriceMin').value = f.priceMin ? +(f.priceMin / 1e6).toFixed(2) : '';
    $('fPriceMax').value = f.priceMax ? +(f.priceMax / 1e6).toFixed(2) : '';
    $('fYearMin').value = f.yearMin || ''; $('fYearMax').value = f.yearMax || '';
    $('fKmMax').value = f.kmMax || ''; $('fFuel').value = f.fuel || ''; $('fTrans').value = f.trans || '';
    $('fBody').value = f.body || ''; $('fDealer').value = f.dealer || ''; setSeller(f.seller || ''); $('fView').value = f.view || ''; $('fLoc').value = f.loc || ''; setFeatures(f.ft || ''); $('fRange').value = f.rangeMin || ''; $('fClean').checked = !!f.clean; $('fText').value = f.text || '';
    $('fAwd').checked = !!f.awd; $('fDeal').checked = !!f.deal; $('fSort').value = f.sort || 'deal';
    syncPrice();
  }
  // verðsleði undir „Verð frá/til“: ferningskvarði (þéttara neðst), efsti endinn = ekkert hámark
  var PR_MAX = 30;
  function prVal(v) { var x = PR_MAX * Math.pow(v / 1000, 2); return x < 5 ? Math.round(x * 10) / 10 : x < 15 ? Math.round(x * 2) / 2 : Math.round(x); }
  function prPos(m) { return Math.round(1000 * Math.sqrt(Math.min(Math.max(m, 0), PR_MAX) / PR_MAX)); }
  function paintPrice() {
    var lo = +$('prLo').value, hi = +$('prHi').value;
    $('prFill').style.left = lo / 10 + '%'; $('prFill').style.right = (100 - hi / 10) + '%';
  }
  function syncPrice() {
    var a = $('fPriceMin').value, b = $('fPriceMax').value;
    $('prLo').value = a !== '' ? prPos(+a) : 0; $('prHi').value = b !== '' ? prPos(+b) : 1000;
    paintPrice();
  }
  function bindPrice() {
    ['prLo', 'prHi'].forEach(function (id) {
      $(id).addEventListener('input', function () {
        var lo = $('prLo'), hi = $('prHi');
        if (+lo.value > +hi.value - 20) { if (id === 'prLo') lo.value = +hi.value - 20; else hi.value = +lo.value + 20; }
        $('fPriceMin').value = +lo.value > 0 ? prVal(+lo.value) : '';
        $('fPriceMax').value = +hi.value < 1000 ? prVal(+hi.value) : '';
        paintPrice(); render();
      });
    });
    ['fPriceMin', 'fPriceMax'].forEach(function (id) { $(id).addEventListener('input', syncPrice); });
    syncPrice();
  }
  function filtered(f0) {
    var f = f0 || readFilters(), words = f.text ? f.text.split(/\s+/) : [], fts = f.ft ? f.ft.split(',') : [];
    var out = cars.filter(function (c) {
      if (f.make && c.make !== f.make) return false;
      if (f.model && c.base !== f.model) return false;
      if (f.priceMin != null && c.price < f.priceMin * 1e6) return false;
      if (f.priceMax != null && c.price > f.priceMax * 1e6) return false;
      if (f.yearMin != null && (c.year || 0) < f.yearMin) return false;
      if (f.yearMax != null && (c.year || 9999) > f.yearMax) return false;
      if (f.kmMax != null && (c.km || 0) > f.kmMax) return false;
      if (f.fuel && c.fcat !== f.fuel) return false;
      if (f.trans === 'sj' && c.auto === false) return false;
      if (f.trans === 'bein' && c.auto !== false) return false;
      if (f.body === 'suv' && !c.suv) return false;
      if (f.body === 'car' && c.suv) return false;
      if (f.dealer && c.dealer !== f.dealer) return false;
      if (f.seller === 'private' && !c.priv) return false;
      if (f.seller === 'dealer' && c.priv) return false;
      if (f.awd && !c.awd) return false;
      if (f.deal && !(verdict(c).cls === 'good')) return false;
      for (var i = 0; i < words.length; i++) if (c.ftitle.indexOf(words[i]) < 0) return false;
      if (f.loc && c.loc !== f.loc) return false;
      if (fts.length && !fts.every(function (x) { return c.ft && c.ft.indexOf(x) >= 0; })) return false;
      if (f.rangeMin != null && !(c.rng >= f.rangeMin)) return false;
      if (f.clean && c.fl && c.fl.some(function (x) { return BAD_FLAGS[x]; })) return false;
      if (f.view === 'new' && !c.isNew) return false;
      if (f.view === 'drop' && !c.drop) return false;
      return true;
    });
    var by = {
      deal: function (a, b) { return (verdict(a).unsure ? 1 : 0) - (verdict(b).unsure ? 1 : 0) || a.dev - b.dev; },
      priceAsc: function (a, b) { return a.price - b.price; },
      priceDesc: function (a, b) { return b.price - a.price; },
      kmAsc: function (a, b) { return (a.km || 0) - (b.km || 0); },
      yearDesc: function (a, b) { return (b.year || 0) - (a.year || 0) || a.price - b.price; },
      // mest afl fyrir peninginn: hestöfl á hverja milljón (bílar án hestafla aftast)
      hpPerKr: function (a, b) { return (b.hp ? b.hp / b.price : -1) - (a.hp ? a.hp / a.price : -1); },
      kmPerKr: function (a, b) { return (b.rng ? b.rng / b.price : -1) - (a.rng ? a.rng / a.price : -1); }
    }[f.sort] || null;
    if (f.view === 'new') by = function (a, b) { return a.firstSeen < b.firstSeen ? 1 : a.firstSeen > b.firstSeen ? -1 : 0; };
    if (f.view === 'drop') by = function (a, b) { return (a.dropAt < b.dropAt ? 1 : a.dropAt > b.dropAt ? -1 : 0) || b.drop / b.price - a.drop / a.price; };
    if (by) out.sort(by);
    return out;
  }

  // ---------- viðvaranir, plúsar og búnaður (úr lýsingu seljanda, reiknað í söfnuninni) ----------
  var FLAG_TXT = { tjon: '⚠️ Nefnir tjón', ryd: '⚠️ Ryð', laga: '⚠️ Þarfnast viðgerðar', skodun: '⚠️ Endurskoðun',
    timareim: '✅ Ný tímareim', skodadur: '✅ Nýskoðaður', smurbok: '✅ Smurbók', eigandi: '✅ Einn eigandi', reyklaus: '✅ Reyklaus',
    abyrgd: '✅ Í ábyrgð', dekk: '✅ Aukadekk', serut: '⚠️ Sérútbúinn / verkefni' };
  var BAD_FLAGS = { tjon: 1, ryd: 1, laga: 1, skodun: 1, serut: 1 };
  var FEAT_TXT = { krokur: 'Dráttarkrókur', sjo: '7 sæta', carplay: 'CarPlay / Android Auto', hitistyri: 'Hiti í stýri', hitisaeti: 'Hiti í sætum',
    ledur: 'Leður', topplug: 'Topplúga / glerþak', myndavel: 'Bakkmyndavél', acc: 'Skynvæddur hraðastillir', varmadaela: 'Varmadæla',
    lykill: 'Lyklalaust aðgengi', sjonlina: 'Sjónlínuskjár' };
  function flagChips(c, max) {
    var fl = (c.fl || []).slice().sort(function (a, b) { return (BAD_FLAGS[b] ? 1 : 0) - (BAD_FLAGS[a] ? 1 : 0); });
    if (c.relist) fl.unshift('relist');
    if (c.also) fl.unshift('also');
    if (c.kmBack) fl.unshift('kmback');
    if (c.rep && c.rep.length) fl.unshift('rep');
    if (c.vis) fl.unshift('vis');
    return fl.slice(0, max || 99).map(function (f) {
      if (f === 'relist') return '<span class="flag relist">🔁 Endurskráður</span>';
      if (f === 'also') return '<span class="flag relist" title="Sami bíll er líka auglýstur annars staðar">📋 Á ' + (c.also.length + 1) + ' stöðum</span>';
      if (f === 'kmback') return '<span class="flag bad">⚠️ Akstur lækkaði</span>';
      if (f === 'rep') { var rc = repairCost(c); return '<span class="flag bad" title="' + esc(rc.names.join(', ')) + '">🔧 Viðgerð ~' + kRange(rc.lo, rc.hi) + '</span>'; }
      if (f === 'vis') return '<span class="flag bad" title="Sjálfvirkt mat út frá fyrstu mynd (' + Math.round(c.vis[1] * 100) + '% líkur). Getur skjátlast.">📷 ' +
        ({ tjon: 'Mynd: tjón?', keppni: 'Mynd: keppnisbíll?', verkefni: 'Mynd: í viðgerð?', ryd: 'Mynd: ryð?' }[c.vis[0]] || c.vis[0]) + '</span>';
      return '<span class="flag ' + (BAD_FLAGS[f] ? 'bad' : 'plus') + '">' + esc(FLAG_TXT[f] || f) + '</span>';
    }).join('');
  }

  // áætlaður viðgerðarkostnaður úr lýsingu (scrape.py repairs): [[kóði, heiti, lægst, hæst], ...]
  function repairCost(c) {
    if (!c.rep || !c.rep.length) return null;
    var lo = 0, hi = 0;
    c.rep.forEach(function (r) { lo += r[2]; hi += r[3]; });
    return { lo: lo, hi: hi, mid: (lo + hi) / 2, names: c.rep.map(function (r) { return r[1]; }) };
  }
  function kRange(lo, hi) { return thous(lo) + '–' + thous(hi); }

  // ---------- birting ----------
  function img(c) { return c.img && c.img.indexOf('/__thumb') < 0 ? c.img : ''; }
  // stærri útgáfa sömu myndar fyrir bílagluggann
  function bigImg(c) {
    var u = img(c);
    return u.replace('_thumb.jpg', '_full.jpg').replace(/(CarImage\/\d+\/\d+\/\d+\/)\d+/, '$1784').replace('w=400', 'w=800');
  }
  function card(c, i) {
    var on = compare.indexOf(c.id) >= 0;
    return '<article class="car" data-id="' + esc(c.id) + '"' + (i < 0 ? ' data-still' : ' style="--i:' + Math.min(i || 0, 15) + '"') + '>' +
      '<div class="ph" style="' + (img(c) ? "background-image:url('" + esc(img(c)) + "')" : '') + '">' +
      '<span class="dealer">' + (c.priv ? ic('user') : ic('store')) + esc(c.dealer.replace(' (einstaklingur)', '')) + '</span>' +
      '<div class="ph-act"><button type="button" class="cmp' + (on ? ' on' : '') + '" data-cmp="' + esc(c.id) + '" title="Bera saman" aria-label="Bera saman">' + ic(on ? 'check' : 'git-compare-arrows') + '</button>' +
      saveBtn(c.id) + '</div>' +
      (c.isNew || c.drop ? '<div class="ph-tags">' + (c.isNew ? '<span class="flag new">' + ic('sparkles') + 'Nýtt</span>' : '') +
        (c.drop ? '<span class="flag drop">' + ic('trending-down') + mkrShort(c.drop) + ' m.kr.</span>' : '') + '</div>' : '') +
      '<div class="ph-dots"></div></div>' +
      '<div class="body"><div class="c-title">' + monoHtml(c.make) + '<h3>' + esc(cap(c.make) + ' ' + cap(c.model)) + '</h3></div>' +
      '<div class="meta">' + (c.perf.t ? '<span class="perf">' + ic(c.perf.t === 2 ? 'flag' : 'zap') + esc(c.perf.label) + '</span>' : '') +
        '<span>' + (c.year || '–') + '</span><span>' + kmFmt(c.km) + '</span><span>' + esc(c.fcat) + '</span>' +
        (c.auto === true ? '<span>Sjálfsk.</span>' : c.auto === false ? '<span>Beinsk.</span>' : '') + (c.hp ? '<span>' + c.hp + ' hö</span>' : '') + (c.rng ? '<span>' + c.rng + ' km</span>' : '') + '</div>' +
      (c.fl || c.relist || c.also ? '<div class="flags">' + flagChips(c, 2) + '</div>' : '') +
      '<div class="row"><span class="price">' + kr(c.price) + (c.oldPrice && c.oldPrice > c.price ? '<span class="old">' + kr(c.oldPrice) + '</span>' : '') + '</span></div>' +
      meter(c) + '<p class="why">' + esc(why(c)) + '</p></div></article>';
  }
  function isSaved(id) { return !!(window.Acct && Acct.isSaved(id)); }
  function saveBtn(id) {
    return '<button type="button" class="save' + (isSaved(id) ? ' on' : '') + '" data-save="' + esc(id) + '" aria-label="Vista bíl" title="Vista bíl">' + ic('heart') + '</button>';
  }
  function fbLink(f) {
    // Facebook leyfir ekki söfnun, en við getum opnað sömu leit þar fyrir notandann
    var q = [f.make && cap(f.make), f.model && cap(f.model), f.text].filter(Boolean).join(' ');
    var p = [];
    if (f.priceMin) p.push('minPrice=' + Math.round(f.priceMin * 1e6));
    if (f.priceMax) p.push('maxPrice=' + Math.round(f.priceMax * 1e6));
    if (q) return 'https://www.facebook.com/marketplace/reykjavik/search?query=' + encodeURIComponent(q) + (p.length ? '&' + p.join('&') : '');
    if (f.yearMin) p.push('minYear=' + f.yearMin);
    if (f.yearMax) p.push('maxYear=' + f.yearMax);
    return 'https://www.facebook.com/marketplace/reykjavik/vehicles' + (p.length ? '?' + p.join('&') : '');
  }
  function render(keepShown) {
    if (!keepShown) shown = PAGE;
    var list = filtered();
    $('fbLink').href = fbLink(readFilters());
    syncUrl();
    if (window.Nice) Nice.refresh();
    if (window.Acct && Acct.refreshButtons) Acct.refreshButtons();
    var view = $('fView').value, loc = $('fLoc').value;
    $('locPill').hidden = !loc; $('locPill').textContent = '📍 ' + loc + ' ✕';
    document.querySelectorAll('#views [data-view]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-view') === view); });
    renderPickers();
    $('count').textContent = list.length.toLocaleString('de-DE') + ' bílar';
    var off = keepShown ? shown - PAGE : 0;  // bara nýju spjöldin „renna inn“
    $('results').innerHTML = list.length ? list.slice(0, shown).map(function (c, i) { return card(c, i < off ? -99 : i - off); }).join('') : emptyState();
    if (!list.length) fillPast();
    $('more').hidden = list.length <= shown;
    renderTray();
  }
  function renderTray() {
    $('tray').hidden = !compare.length;
    $('trayText').textContent = compare.length + ' í samanburði';
    $('trayOpen').disabled = compare.length < 2;
  }
  var DUPOF = {};  // falin tvítekning -> auglýsingin sem birtist
  function byId(id) { id = DUPOF[id] || id; for (var i = 0; i < cars.length; i++) if (cars[i].id === id) return cars[i]; return null; }
  function toggleCompare(id) {
    var i = compare.indexOf(id);
    if (i >= 0) compare.splice(i, 1);
    else { if (compare.length >= 4) compare.shift(); compare.push(id); }
    store('compare', compare);
  }

  function openModal(html, cls) {
    $('modalBody').innerHTML = html;
    var d = $('modal');
    d.className = cls || '';
    if (window.Nice) setTimeout(function () { Nice.enhance($('modalBody')); }, 0);
    if (d.showModal) { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
    d.scrollTop = 0;
  }
  function closeModal() { var d = $('modal'); if (d.close) d.close(); else d.removeAttribute('open'); openCarId = ''; syncUrl(); }

  function describe(c) {
    return cap(c.make) + ' ' + cap(c.model) + ', árg. ' + (c.year || '?') + ', ' + kmFmt(c.km) + ', ' + c.fcat +
      (c.auto === true ? ', sjálfskiptur' : c.auto === false ? ', beinskiptur' : '') + (c.awd ? ', fjórhjóladrif' : '') +
      ', verð ' + kr(c.price) + ' hjá ' + c.dealer + ' (' + c.url + ')';
  }
  function claudeLink(prompt) { return 'https://claude.ai/new?q=' + encodeURIComponent(prompt.slice(0, 6000)); }

  // verðmælir: hvar verðið lendir miðað við mat (vinstri = ódýrt, hægri = dýrt)
  function meter(c, big) {
    var v = verdict(c), p = Math.max(0, Math.min(1, (c.dev + 0.3) / 0.6));
    if (v.unsure) p = null;  // óvisst mat: enginn punktur á mælinum
    return '<div class="meter' + (big ? ' big' : '') + '" title="' + esc(v.txt + (c.est ? ' · mat ' + kr(c.est) : '')) + '">' +
      '<div class="mt-track">' + (p == null ? '' : '<i style="left:' + (p * 100).toFixed(1) + '%"></i>') + '</div>' +
      '<span class="mt-lab ' + v.cls + '" data-tip="' + esc(tipHtml(c, v)) + '">' + esc(v.txt) + '</span></div>';
  }
  // stutt skýring á matinu: miðað við sambærilega bíla (leiðrétt fyrir aldri og akstri)
  function thous(n) { n = Math.abs(n); return n >= 1e6 ? mkrShort(n) + ' m.kr.' : Math.round(n / 1e4) * 10 + ' þús.'; }
  function med(a) { a = a.slice().sort(function (x, y) { return x - y; }); return a.length ? a[a.length >> 1] : 0; }
  function why(c, long) {
    var v = verdict(c), name = cap(c.base);
    if (c.classic) return 'Fornbíll: verðið fer eftir ástandi, uppgerð og sögu, ekki aldri og akstri, svo hann er ekki metinn út frá yngri ' + name + '.';
    if (c.special) return 'Sérútbúinn eða verkefni, ekki sambærilegur við venjulega ' + name + '.';
    if (c.peers < 2) return 'Fáir ' + name + ' á skrá, svo matið byggir á tegundinni í heild.';
    if (c.dev <= -0.5) return 'Meira en helmingi ódýrari en sambærilegir. Oft villa, tjón eða varahlutabíll.';
    if (c.perf.t && !c.tierPeers) return 'Enginn annar ' + name + ' ' + c.perf.label + ' á skrá til að bera saman við.';
    if (!c.agePeers && Math.abs(c.dev) >= 0.12) {
      var ys = similar(c, 8).map(function (o) { return o.year; }).filter(Boolean);
      return 'Enginn ' + name + ' innan 4 ára frá árgerð ' + c.year + ' á skrá' + (ys.length ? ' (næstu eru ' + Math.min.apply(null, ys) + '–' + Math.max.apply(null, ys) + ')' : '') +
        ', svo matið (' + pct(c.dev) + ') byggir á framreiknuðu verðfalli og er óvisst.';
    }
    if (c.km == null && c.age > 3) return 'Akstur kemur ekki fram í auglýsingunni, svo ekki er hægt að meta verðið vel.';
    if (c.enginePeers != null && c.enginePeers < 2 && Math.abs(c.dev) >= 0.12) {
      var other = uniq(similar(c, 6).map(function (o) { return cap(o.model.split(' ').slice(0, 2).join(' ')); })).slice(0, 3).join(', ');
      return 'Nær engir ' + cap(c.model) + ' með sömu vél (' + c.fcat.toLowerCase() + ') á skrá. Borið saman við aðrar útgáfur' + (other ? ' (' + other + ')' : '') +
        ', svo matið (' + pct(c.dev) + ') er óvisst.';
    }
    var sim = similar(c, 8), adj = sim.map(function (o) { return adjusted(o, c); });
    var n = sim.length, cheaper = adj.filter(function (p) { return p > c.price; }).length;
    var diff = c.est - c.price, extras = [];
    var kms = sim.filter(function (o) { return o.km != null; }).map(function (o) { return o.km; });
    if (c.km != null && kms.length >= 3) {
      var mk = med(kms);
      if (c.km < mk * 0.75) extras.push('minna ekinn en flestir');
      else if (c.km > mk * 1.35) extras.push('meira ekinn en flestir');
    }
    var yrs = sim.map(function (o) { return o.year || 0; });
    if (c.year && yrs.length >= 3) { var my = med(yrs); if (c.year > my) extras.push('nýrri en flestir'); }
    if (c.drop) extras.push('lækkaði nýlega um ' + thous(c.drop));
    if (c.fl && c.fl.some(function (f) { return BAD_FLAGS[f]; })) extras.push('en lýsingin nefnir galla');
    var base;
    if (v.cls === 'good') base = '~' + thous(diff) + ' undir mati' + (n ? ' · ódýrari en ' + cheaper + ' af ' + n + ' sambærilegum' : '');
    else if (v.cls === 'bad') base = '~' + thous(diff) + ' yfir mati' + (n ? ' · dýrari en ' + (n - cheaper) + ' af ' + n + ' sambærilegum' : '');
    else base = 'Nálægt mati (' + pct(c.dev) + ')' + (n ? ' miðað við ' + n + ' sambærilega' : '');
    var out = base + (extras.length ? ' · ' + extras.slice(0, long ? 4 : 1).join(' · ') : '');
    if (long) out += '. Borið saman við ' + c.peers + ' ' + cap(c.make) + ' ' + name + ' á skrá, leiðrétt fyrir aldri, akstri, eldsneyti' + (c.perf.t ? ' og útgáfu' : '') + '.';
    return out;
  }
  var LEGEND_TXT = { good: 'Gott verð: a.m.k. 12% undir mati', mid: 'Eðlilegt verð: innan við 12% frá mati', bad: 'Hátt verð: a.m.k. 12% yfir mati', warn: 'Athugaðu: óvenjulegt verð, gallar eða sérútbúinn bíll. Matið miðast við gallalausan bíl.' };
  function showLegend() {
    openModal('<div class="m narrow"><div class="m-head"><h2>Hvernig er verðið metið?</h2><button class="x" data-close aria-label="Loka">×</button></div>' +
      '<p>Hver bíll er borinn saman við alla aðra bíla af <b>sömu gerð</b> á skrá. Verð þeirra er leiðrétt fyrir aldri, akstri, eldsneyti, útgáfu og vélarafli, og úr því fæst <b>áætlað markaðsverð</b>.</p>' +
      '<div class="legend"><div><span class="mt-lab good">Gott verð</span><span>a.m.k. 12% undir mati</span></div>' +
      '<div><span class="mt-lab mid">Eðlilegt verð</span><span>innan við 12% frá mati</span></div>' +
      '<div><span class="mt-lab bad">Hátt verð</span><span>a.m.k. 12% yfir mati</span></div>' +
      '<div><span class="mt-lab warn">Ódýr en nefnir galla</span><span>undir mati, en lýsingin nefnir tjón, ryð eða bilun: matið miðast við gallalausan bíl</span></div>' +
      '<div><span class="mt-lab warn">Athugaðu verðið</span><span>meira en helmingi undir mati: oft villa, tjón eða varahlutabíll</span></div>' +
      '<div><span class="mt-lab mid">Fáir sambærilegir / Sjaldgæf útgáfa</span><span>of fáir sambærilegir bílar til að meta vel</span></div>' +
      '<div><span class="mt-lab warn">Sérútbúinn / verkefni</span><span>rallý-, keppnis-, tjóna- eða varahlutabíll: ekki borinn saman</span></div></div>' +
      '<p class="note">Mælirinn sýnir hvar verðið lendir: grænt = ódýrara en sambærilegir, rautt = dýrara. Matið er vísbending, ekki ástandsskoðun: ástand, búnaður og þjónustusaga skipta líka máli.</p></div>');
  }
  // sveimgluggi á verðmerkinu: lítið kort með ástæðum fyrir þennan tiltekna bíl
  function reasons(c) {
    var v = verdict(c), out = [];
    if (v.unsure) return [{ ic: 'info', t: why(c) }];
    var sim = similar(c, 8), adj = sim.map(function (o) { return adjusted(o, c); }), n = sim.length;
    var cheaper = adj.filter(function (p) { return p > c.price; }).length;
    if (c.est) out.push({ ic: v.cls === 'bad' ? 'triangle-alert' : 'wallet', t: '~' + thous(c.est - c.price) + (c.price <= c.est ? ' undir' : ' yfir') + ' áætluðu markaðsverði', warn: v.cls === 'bad' });
    if (n) out.push({ ic: v.cls === 'bad' ? 'trending-down' : 'check', t: v.cls === 'bad' ? 'Dýrari en ' + (n - cheaper) + ' af ' + n + ' líkustu bílunum' : 'Ódýrari en ' + cheaper + ' af ' + n + ' líkustu bílunum' });
    var kms = sim.filter(function (o) { return o.km != null; }).map(function (o) { return o.km; });
    if (c.km != null && kms.length >= 3) {
      var mk = med(kms);
      if (c.km < mk * 0.75) out.push({ ic: 'route', t: 'Minna ekinn: ' + kmFmt(c.km) + ' en flestir ~' + Math.round(mk / 1000) + ' þ. km' });
      else if (c.km > mk * 1.35) out.push({ ic: 'route', t: 'Meira ekinn: ' + kmFmt(c.km) + ' en flestir ~' + Math.round(mk / 1000) + ' þ. km' });
    }
    var yrs = sim.map(function (o) { return o.year || 0; });
    if (c.year && yrs.length >= 3 && c.year > med(yrs)) out.push({ ic: 'calendar', t: 'Nýrri en flestir sambærilegir (' + c.year + ')' });
    if (c.drop) out.push({ ic: 'trending-down', t: 'Lækkaði nýlega um ' + thous(c.drop) });
    if (c.perf.t) out.push({ ic: 'zap', t: c.perf.label + ': borinn saman með tilliti til útgáfu' });
    if (c.fl && c.fl.some(function (f) { return BAD_FLAGS[f]; })) out.push({ ic: 'triangle-alert', t: 'Lýsingin nefnir galla: ' + c.fl.filter(function (f) { return BAD_FLAGS[f]; }).map(function (f) { return FLAG_TXT[f].replace('⚠️ ', ''); }).join(', '), warn: true });
    var rcx = repairCost(c);
    if (rcx) out.push({ ic: 'triangle-alert', t: 'Viðgerð ~' + kRange(rcx.lo, rcx.hi) + ' (' + rcx.names.join(', ').toLowerCase() + ')', warn: true });
    if (c.vis) out.push({ ic: 'triangle-alert', t: 'Myndin bendir til ' + ({ tjon: 'tjóns', keppni: 'keppnisbíls', verkefni: 'viðgerðar', ryd: 'ryðs' }[c.vis[0]] || c.vis[0]), warn: true });
    return out;
  }
  function tipHtml(c, v) {
    var p = v.unsure ? null : Math.max(0, Math.min(1, (c.dev + 0.3) / 0.6));
    return '<div class="tc"><div class="tc-head"><span class="tc-badge ' + v.cls + '">' + esc(v.txt) + '</span></div>' +
      (c.est && !c.special ? '<div class="tc-prices"><div><span>Ásett verð</span><b>' + esc(kr(c.price)) + '</b></div><div><span>Áætlað mat</span><b>' + esc(kr(c.est)) + '</b></div></div>' +
        (p == null ? '' : '<div class="tc-meter"><i style="left:' + (p * 100).toFixed(1) + '%"></i></div><div class="tc-scale"><span>Ódýrt</span><span>Dýrt</span></div>') : '') +
      '<ul class="tc-list">' + reasons(c).map(function (r) { return '<li' + (r.warn ? ' class="w"' : '') + '>' + ic(r.ic) + '<span>' + esc(r.t) + '</span></li>'; }).join('') + '</ul>' +
      (c.peers >= 2 && !c.special ? '<div class="tc-foot">Borið saman við ' + c.peers + ' ' + esc(cap(c.make) + ' ' + cap(c.base)) + ' á skrá, leiðrétt fyrir aldri, akstri og eldsneyti.</div>' : '') + '</div>';
  }
  function repairHtml(c) {
    var rc = repairCost(c); if (!rc) return '';
    var lo = c.price + rc.lo, hi = c.price + rc.hi;
    return '<h4>Áætlaður viðgerðarkostnaður</h4><div class="repair"><ul>' + c.rep.map(function (r) {
      return '<li>' + ic('cog') + '<span>' + esc(r[1]) + '</span><b>' + kRange(r[2], r[3]) + '</b></li>';
    }).join('') + '</ul>' +
      '<div class="rp-sum"><div><span>Verð + viðgerð</span><b>' + mkrShort(lo) + '–' + mkrShort(hi) + ' m.kr.</b></div><div><span>Mat (gallalaus)</span><b>' + mkrShort(c.est) + ' m.kr.</b></div>' +
      '<div class="' + (hi < c.est ? 'g' : lo > c.est ? 'b' : '') + '"><span>Niðurstaða</span><b>' + (hi < c.est ? 'Borgar sig líklega' : lo > c.est ? 'Borgar sig ekki' : 'Tæpt') + '</b></div></div>' +
      '<p class="note">Greint úr lýsingu seljanda. Gróf verðbil fyrir dæmigerðan fólksbíl á íslensku verkstæði (varahlutir + vinna); raunverð fer eftir tegund og ástandi. Fáðu tilboð frá verkstæði áður en þú kaupir.</p></div>';
  }
  function spec(icon, label, val) { return val ? '<div class="spec">' + ic(icon) + '<span>' + label + '</span><b>' + val + '</b></div>' : ''; }

  function showCar(c) {
    openCarId = c.id; syncUrl();
    var v = verdict(c), sim = similar(c, 8), b = model.beta;
    var kmEff = (1 - Math.exp(kmSlope(c.km || 0))) * 100, yrEff = (1 - Math.exp(ageSlope(c.age, c.perf.t))) * 100;
    var rows = sim.map(function (o) {
      if (o.sold) return '<tr class="sold-row"><td>' + esc(cap(o.model)) + '<br><span class="note">Seldur / af skrá ' + dayFmt(o.goneAt) + '</span></td>' +
        '<td class="num">' + (o.year || '–') + '</td><td class="num">' + kmFmt(o.km) + '</td><td>' + esc(o.fcat) + '</td>' +
        '<td class="num">' + kr(o.price) + '</td><td class="num"><b>' + kr(adjusted(o, c)) + '</b></td></tr>';
      return '<tr class="click" data-open="' + esc(o.id) + '"><td>' + esc(cap(o.model)) + '<br><span class="note">' + esc(o.dealer) + '</span></td>' +
        '<td class="num">' + (o.year || '–') + '</td><td class="num">' + kmFmt(o.km) + '</td><td>' + esc(o.fcat) + '</td>' +
        '<td class="num">' + kr(o.price) + '</td><td class="num"><b>' + kr(adjusted(o, c)) + '</b></td></tr>';
    }).join('');
    var prompt = 'Ég er að íhuga að kaupa notaðan bíl á Íslandi:\n' + describe(c) +
      '\n\nVerðmat út frá sambærilegum auglýsingum: ' + kr(c.est) + ' (' + pct(c.dev) + ' frá mati, ' + c.peers + ' sambærilegir).' +
      (sim.length ? '\n\nSambærilegir bílar til sölu núna:\n' + sim.map(function (o) { return '- ' + describe(o); }).join('\n') : '') +
      '\n\nEr þetta gott verð miðað við akstur og aldur? Hvað ætti ég að skoða sérstaklega á þessari tegund/árgerð (algengir gallar, viðhald), ' +
      'og hvaða spurningar ætti ég að spyrja seljandann? Svaraðu á íslensku.';
    var saved = isSaved(c.id), inCmp = compare.indexOf(c.id) >= 0;
    var estText = c.classic ? '' : (c.peers >= 2 && c.dev <= -0.5 ? '<p class="warn-box">' + ic('triangle-alert') + '<span><b>Verðið er meira en helmingi undir sambærilegum bílum.</b> Það getur verið innsláttarvilla, tjónabíll, bíll til niðurrifs eða jafnvel svindl. Lestu auglýsinguna vel og borgaðu aldrei fyrirfram.</span></p>' : '') +
      '<p class="note">' + (c.peers < 2 ? 'Fáar sambærilegar auglýsingar, svo matið byggir að hluta á tegundinni í heild.' :
        'Byggt á ' + c.peers + ' öðrum ' + esc(cap(c.make) + ' ' + cap(c.base)) + ', leiðrétt fyrir aldri, akstri, eldsneyti' + (c.perf.t ? ', útgáfu' : '') + (c.pwRaw != null ? ', vélarafli' : '') + '.') +
      (c.perf.t ? ' ' + esc(c.perf.label) + ' er ' + (c.perf.t === 2 ? 'toppútgáfa' : 'sportútgáfa') + ': slíkar útgáfur kosta að jafnaði ~' +
        Math.round((Math.exp(model.beta[c.perf.t === 2 ? FI.perf2 : FI.perf1]) - 1) * 100) + '% meira. ' +
        (c.tierPeers ? c.tierPeers + ' aðrir í sömu útgáfu eru á skrá.' : 'Enginn annar í sömu útgáfu er á skrá, svo matið er óvissara.') : '') + '</p>';
    openModal(
      '<div class="car-m">' +
      // myndhaus: myndasafn yfir allan gluggann með titli og verði ofan á
      '<div class="car-hero"><div class="gallery" id="gallery">' + (img(c) ? '<img src="' + esc(bigImg(c)) + '" alt="" onerror="this.onerror=null;this.src=\'' + esc(img(c)) + '\'">' : '<div class="noimg"></div>') + '</div>' +
      '<button type="button" class="gal-btn prev" data-gal="-1" aria-label="Fyrri mynd" hidden>' + ic('chevron-left') + '</button>' +
      '<button type="button" class="gal-btn next" data-gal="1" aria-label="Næsta mynd" hidden>' + ic('chevron-right') + '</button>' +
      '<span class="gal-pos" id="galPos" hidden></span>' +
      '<button class="x float" data-close aria-label="Loka">' + ic('x') + '</button>' +
      '<div class="ch-over"><div class="ch-title">' + monoHtml(c.make) + '<div><h2>' + esc(cap(c.make) + ' ' + cap(c.model)) + '</h2>' +
      '<span>' + [c.year, kmFmt(c.km), c.fcat, c.hp ? c.hp + ' hö' : '', c.dealer].filter(Boolean).map(esc).join(' · ') + '</span></div></div></div></div>' +
      // flipar
      '<div class="ctabs" role="tablist"><button type="button" class="on" data-ctab="overview">Yfirlit</button><button type="button" data-ctab="price">Verð</button>' +
      '<button type="button" data-ctab="cost">Kostnaður</button><button type="button" data-ctab="hist">Saga</button></div>' +
      '<div class="cbody">' +
      '<section data-cpanel="overview">' +
      (c.fl || c.relist || c.also || c.perf.t ? '<div class="flags big">' + (c.perf.t ? '<span class="perf">' + ic(c.perf.t === 2 ? 'flag' : 'zap') + esc(c.perf.label) + '</span>' : '') + flagChips(c) + '</div>' : '') +
      '<div class="specs">' + spec('calendar', 'Árgerð', c.year) + spec('route', 'Ekinn', c.km != null ? kmFmt(c.km) + (c.age > 0 && c.km ? '<small>≈' + Math.round(c.km / c.age / 1000) + ' þ./ári</small>' : '') : '') +
      spec('fuel', 'Eldsneyti', esc(c.fcat)) + spec('cog', 'Skipting', c.auto === true ? 'Sjálfskipt' : c.auto === false ? 'Beinskipt' : '') +
      spec('zap', 'Afl', c.hp ? c.hp + ' hö' : '') + spec('gauge', 'Drægni', c.rng ? c.rng + ' km' : '') + spec('car', 'Drif', c.awd ? 'Fjórhjóladrif' : '') +
      spec('store', 'Seljandi', esc(c.dealer)) + '</div>' +
      (c.also ? '<div class="also">' + ic('copy') + '<div><b>Sami bíll er auglýstur á ' + (c.also.length + 1) + ' stöðum</b>' +
        '<div class="also-row"><span>' + esc(c.dealer) + ' (þessi)</span><b>' + kr(c.price) + '</b></div>' +
        c.also.map(function (o) { return '<a class="also-row" href="' + esc(o.url) + '" target="_blank" rel="noopener"><span>' + esc(o.dealer) + '</span><b>' + kr(o.price) + '</b>' + ic('external-link') + '</a>'; }).join('') +
        '<p class="note">Fundið út frá mynd, árgerð og akstri. ' + (c.also.some(function (o) { return o.price > c.price; }) ? 'Sami bíll er dýrari annars staðar, svo hér er ódýrasta verðið.' : '') + '</p></div></div>' : '') +
      '<div id="carReg"></div>' +
      (c.kmBack ? '<p class="warn-box">' + ic('triangle-alert') + '<span><b>Akstur lækkaði um ' + kmFmt(c.kmBack.from - c.kmBack.to) + '.</b> ' +
        (c.kmBack.same ? 'Í þessari auglýsingu stóð ' + kmFmt(c.kmBack.from) + ' en nú ' + kmFmt(c.kmBack.to) + ' (' + dayFmt(c.kmBack.at) + ').' :
          'Svipaður bíll hjá sömu sölu var auglýstur með ' + kmFmt(c.kmBack.from) + ' og fór af skrá ' + dayFmt(c.kmBack.at) + '.') +
        ' Getur verið leiðrétting á innsláttarvillu, en biddu um þjónustusögu og athugaðu kílómetrastöðu í skoðunarferli.</span></p>' : '') +
      (c.relist ? '<p class="info-box">' + ic('refresh-cw') + '<span>Þessi bíll var áður á skrá hjá <b>' + esc(c.relist.d || '?') + '</b> á <b>' + kr(c.relist.price) + '</b> (tekinn af skrá ' + dayFmt(c.relist.g) + ').' +
        (c.relist.price > c.price ? ' Hann er nú ' + kr(c.relist.price - c.price) + ' ódýrari.' : c.relist.price < c.price ? ' Hann er nú ' + kr(c.price - c.relist.price) + ' dýrari.' : '') + '</span></p>' : '') +
      '<div id="carDetails"><div class="skel-line"></div><div class="skel-line short"></div></div>' +
      (window.Faults ? Faults.html(c) : '') +
      '<div class="actions">' +
      '<button type="button" class="sec' + (inCmp ? ' on' : '') + '" data-cmp="' + esc(c.id) + '">' + ic('git-compare-arrows') + (inCmp ? 'Í samanburði' : 'Bera saman') + '</button>' +
      '<button type="button" class="sec" data-watch="' + esc(c.id) + '">' + ic('bell') + 'Verðvakt</button>' +
      '<button type="button" class="sec" data-similar="' + esc(c.id) + '">' + ic('badge-percent') + 'Láttu mig vita af svipuðum ódýrari</button>' +
      '<button type="button" class="sec" data-check="' + esc(c.id) + '">' + ic('list-checks') + 'Skoðunarlisti</button>' +
      '<button type="button" class="sec" data-share="' + esc(c.id) + '">' + ic('share-2') + 'Deila</button>' +
      '<a class="sec" href="' + claudeLink(prompt) + '" target="_blank" rel="noopener">' + ic('message-circle') + 'Spyrja Claude</a></div>' +
      '</section>' +
      '<section data-cpanel="price" hidden>' +
      '<div class="est"><div class="est-top"><div><span class="note">Áætlað markaðsverð</span><div class="big">' + (c.classic ? '–' : kr(c.est)) + '</div></div>' +
      '<div class="est-ask"><span class="note">Ásett verð</span><div class="big">' + kr(c.price) + '</div>' + (c.oldPrice && c.oldPrice > c.price ? '<span class="old">' + kr(c.oldPrice) + '</span>' : '') + '</div></div>' +
      meter(c, true) + '<p class="why big">' + esc(why(c, true)) + '</p>' + estText + '</div>' +
      '<div id="carSale"></div>' +
      (sim.length ? '<h4>Sambærilegir bílar</h4><p class="note">„Leiðrétt verð“ = hvað hinn bíllinn myndi kosta ef hann væri jafn gamall og jafn mikið ekinn og þessi. ' +
        'Fyrir bíl á þessum aldri og akstri lækkar verð að jafnaði um ~' + Math.max(0, kmEff).toFixed(1) + '% fyrir hverja 10.000 km og ~' + Math.max(0, yrEff).toFixed(0) + '% á ári.</p>' +
        '<div class="tbl-wrap"><table><thead><tr><th>Gerð</th><th class="num">Árg.</th><th class="num">Ekinn</th><th>Eldsn.</th><th class="num">Verð</th><th class="num">Leiðrétt</th></tr></thead><tbody>' +
        rows + '</tbody></table></div>' : '') +
      repairHtml(c) +
      '<div id="carOffer"></div><div id="carAlt"></div>' +
      '</section>' +
      '<section data-cpanel="cost" hidden><div id="carExtras"></div>' +
      '<div class="actions"><button type="button" class="sec" data-import="' + esc(c.id) + '">' + ic('car') + 'Hvað kostar að flytja svona bíl inn?</button></div></section>' +
      '<section data-cpanel="hist" hidden><div id="carHistory"><div class="skel-line"></div></div></section>' +
      '</div>' +
      // föst stika neðst
      '<div class="car-bar"><div class="cb-price"><b>' + kr(c.price) + '</b><span class="mt-lab ' + v.cls + '">' + esc(v.txt) + '</span></div>' +
      '<button type="button" class="cb-save' + (saved ? ' on' : '') + '" data-save="' + esc(c.id) + '" aria-label="Vista bíl">' + ic('heart') + '</button>' +
      '<a class="cb-go" href="' + esc(c.url) + '" target="_blank" rel="noopener">Opna auglýsingu' + ic('external-link') + '</a></div>' +
      '</div>', 'car-dlg');
    document.querySelectorAll('[data-ctab]').forEach(function (t) {
      t.addEventListener('click', function () {
        document.querySelectorAll('[data-ctab]').forEach(function (x) { x.classList.toggle('on', x === t); });
        document.querySelectorAll('[data-cpanel]').forEach(function (p) { p.hidden = p.getAttribute('data-cpanel') !== t.getAttribute('data-ctab'); });
      });
    });
    if (window.Features) Features.carExtras(c);
    if (window.Registry) Registry.renderCar(c);
    if (window.Acct && Acct.refreshButtons) Acct.refreshButtons();
    // lýsing seljanda, búnaður og myndir (sótt eftir þörfum, eitt brot af 64)
    loadDetails(c.id).then(function (d) {
      var el = $('carDetails'); if (!el) return;
      var html = '';
      if (d && d.d) html += '<h4>Lýsing frá seljanda</h4><div class="desc" id="descText">' + esc(d.d).replace(/\n+/g, '<br>') + '</div>' +
        (foreign(d.d) ? '<button type="button" class="sec tr-btn" id="descTr">' + ic('message-circle') + 'Þýða á íslensku</button>' : '');
      if (d && d.e && d.e.length) html += '<h4>Búnaður</h4><div class="equip">' + d.e.map(function (x) { return '<span>' + ic('check') + esc(x) + '</span>'; }).join('') + '</div>';
      el.innerHTML = html;
      if ($('descTr')) $('descTr').addEventListener('click', function () { translate(d.d, this); });
      if (d && d.i && d.i.length > 1) {
        var g = $('gallery'); if (!g) return;
        g.innerHTML = d.i.map(function (u, i) { return '<img src="' + esc(u) + '" alt="" loading="' + (i ? 'lazy' : 'eager') + '">'; }).join('');
        document.querySelectorAll('.gal-btn, #galPos').forEach(function (x) { x.hidden = false; });
        var pos = function () { var i = Math.round(g.scrollLeft / g.clientWidth); $('galPos').textContent = (i + 1) + ' / ' + d.i.length; };
        g.addEventListener('scroll', pos); pos();
        document.querySelectorAll('.gal-btn').forEach(function (bt) {
          bt.addEventListener('click', function () { g.scrollBy({ left: +bt.getAttribute('data-gal') * g.clientWidth, behavior: 'smooth' }); });
        });
      }
    });
    // saga: hve lengi bíllinn hefur verið á skrá, verðbreytingar og sambærilegir bílar sem hafa selst
    loadHistory().then(function () {
      var el = $('carHistory'); if (!el) return;
      var me = HIST.filter(function (a) { return a.id === c.id; })[0], html = '';
      if (me) {
        var days = daysBetween(me.f, me.l);
        html += '<div class="specs">' + spec('calendar', 'Á skrá síðan', dayFmt(me.f)) + spec('flame', 'Dagar á skrá', days) +
          spec('trending-down', 'Verðbreytingar', me.p.length - 1 || 'Engar') + '</div>';
        if (me.p.length > 1) html += '<h4>Verðsaga</h4><div class="past">' + me.p.map(function (x) { return '<div class="past-row"><span>' + dayFmt(x[0]) + '</span><b>' + kr(x[1]) + '</b></div>'; }).join('') + '</div>';
      }
      var gone = HIST.filter(function (a) { return a.g && a.m === c.make && a.base === c.base; }).sort(function (a, b) {
        function d(o) { return Math.abs((o.y || 0) - (c.year || 0)) + Math.abs((o.k || 0) - (c.km || 0)) / 30000; }
        return d(a) - d(b);
      }).slice(0, 6);
      if (gone.length) html += '<h4>Sambærilegir sem hafa selst eða verið teknir af skrá</h4><div class="past">' + gone.map(pastRow).join('') + '</div>';
      if (!html) html = '<p class="note">Saga auglýsinga byrjaði 9. nóv. Hér birtist verðsaga og sambærilegir seldir bílar þegar hún safnast upp.</p>';
      el.innerHTML = trendHtml(c) + html;
      var sl = $('carSale'); if (sl) sl.innerHTML = saleHtml(c, me);
    });
  }

  // ---------- þýðing lýsinga á erlendu máli ----------
  // erlend ef engir íslenskir stafir og algeng ensk/þýsk/pólsk orð
  function foreign(t) {
    if (!t || t.length < 40 || /[þðæÞÐÆ]/.test(t)) return false;
    return (t.toLowerCase().match(/\b(the|and|with|is|for|car|new|und|mit|der|die|ist|nie|jest|oraz)\b/g) || []).length >= 3;
  }
  function translate(text, btn) {
    var en = (text.toLowerCase().match(/\b(the|and|with|is)\b/g) || []).length >= 3;
    function google() {
      window.open('https://translate.google.com/?sl=auto&tl=is&op=translate&text=' + encodeURIComponent(text.slice(0, 4500)), '_blank', 'noopener');
    }
    // innbyggð þýðing í Chrome (keyrir í tækinu, ókeypis); annars Google Translate í nýjum flipa
    if (!en || !window.Translator) return google();
    btn.disabled = true; btn.lastChild.textContent = 'Þýði…';
    Translator.availability({ sourceLanguage: 'en', targetLanguage: 'is' }).then(function (av) {
      if (av === 'unavailable') throw 0;
      return Translator.create({ sourceLanguage: 'en', targetLanguage: 'is' });
    }).then(function (t) { return t.translate(text); }).then(function (out) {
      $('descText').innerHTML = esc(out).replace(/\n+/g, '<br>') + '<p class="note">Vélþýtt úr ensku.</p>';
      btn.hidden = true;
    }).catch(function () {  // sprettigluggar eru bannaðir eftir bið, svo takkinn verður að tengli
      btn.outerHTML = '<a class="sec tr-btn" target="_blank" rel="noopener" href="https://translate.google.com/?sl=auto&tl=is&op=translate&text=' +
        encodeURIComponent(text.slice(0, 4500)) + '">' + ic('external-link') + 'Opna þýðingu í Google Translate</a>';
    });
  }

  // ---------- verðþróun gerðar og sölutími (úr sögu auglýsinga) ----------
  function histRange() {
    var f = null, l = null;
    HIST.forEach(function (a) { if (!f || a.f < f) f = a.f; if (!l || a.l > l) l = a.l; });
    return { start: f, today: l };
  }
  function modelPage(c) { return '/verd/' + Models.slug(c.make) + '/' + Models.slug(c.base) + '/'; }
  function trendHtml(c) {
    var ads = HIST.filter(function (a) { return a.m === c.make && a.base === c.base; });
    var svg = Models.trendSvg(Models.trend(ads), 3);
    return '<div class="trend-box"><div class="trend-head"><h4>' + ic('chart-line') + 'Verðþróun ' + esc(cap(c.make) + ' ' + cap(c.base)) + '</h4>' +
      '<a href="' + modelPage(c) + '" target="_blank" rel="noopener">Allt um gerðina' + ic('arrow-up-right') + '</a></div>' +
      (svg ? svg + '<p class="note">Miðgildi ásetts verðs allra auglýsinga sem voru á skrá í hverjum mánuði (allar árgerðir).</p>' :
        '<p class="note">Línuritið birtist þegar a.m.k. tveir mánuðir af sögu eru komnir (sagan hófst ' + dayFmt(histRange().start) + ').</p>') + '</div>';
  }
  function saleHtml(c, me) {
    var r = histRange(), groups = [
      { t: cap(c.make) + ' ' + cap(c.base), ads: HIST.filter(function (a) { return a.m === c.make && a.base === c.base; }) },
      { t: cap(c.make), ads: HIST.filter(function (a) { return a.m === c.make; }) },
      { t: 'bílar á svipuðu verði', ads: HIST.filter(function (a) { return a.price > c.price * 0.65 && a.price < c.price * 1.5; }) }];
    var g = null, st = null;
    for (var i = 0; i < groups.length && !g; i++) { st = Models.saleStats(groups[i].ads, r.start, r.today); if (st.n >= 8) g = groups[i]; }
    if (!g) return '<div class="sale-box">' + ic('clock') + '<span><b>Sölutími.</b> Spá um hve fljótt svona bílar seljast og hvort verð lækki birtist þegar nokkrar vikur af sögu eru komnar (hófst ' + dayFmt(r.start) + ').</span></div>';
    var mine = me ? Models.days(me.f, r.today) : null, known = me && me.f > r.start;
    var tip = mine != null && st.days ? (mine > st.days * 1.5 ? 'Hefur verið lengur á skrá en flestir: líklega svigrúm til að semja.' :
      mine < st.days * 0.5 ? 'Nýlega kominn á skrá: seljandi gefur síður eftir strax.' : '') : '';
    return '<div class="sale-box">' + ic('clock') + '<div><b>Sölutími</b> <span class="note">(' + esc(g.t) + ', ' + st.n + ' horfnar auglýsingar)</span>' +
      '<div class="sale-stats"><div><b>~' + Math.round(st.days) + ' dagar</b><span>á skrá að jafnaði</span></div>' +
      (st.drop14 != null && st.obs >= 8 ? '<div><b>' + Math.round(st.drop14 * 100) + '%</b><span>lækka verð innan 2 vikna</span></div>' : '') +
      (st.cut ? '<div><b>−' + Math.round(st.cut * 100) + '%</b><span>dæmigerð lækkun</span></div>' : '') +
      (mine != null ? '<div><b>' + (known ? '' : '≥ ') + mine + ' dagar</b><span>þessi á skrá</span></div>' : '') + '</div>' +
      (tip ? '<p class="note">' + tip + '</p>' : '') + '</div></div>';
  }

  function showCompare() {
    var list = compare.map(byId).filter(Boolean);
    if (list.length < 2) return;
    function best(vals, low) {
      var ok = vals.filter(function (x) { return x != null; });
      var t = low ? Math.min.apply(null, ok) : Math.max.apply(null, ok);
      return function (x) { return x === t && ok.length > 1; };
    }
    function row(label, fn, raw, low) {
      var vals = raw ? list.map(raw) : null, isBest = vals ? best(vals, low) : function () { return false; };
      return '<tr><th>' + label + '</th>' + list.map(function (c, i) {
        return '<td' + (vals && isBest(vals[i]) ? ' class="best"' : '') + '>' + fn(c) + '</td>';
      }).join('') + '</tr>';
    }
    var prompt = 'Ég er að velja á milli þessara notuðu bíla á Íslandi:\n' + list.map(function (c, i) {
      return (i + 1) + '. ' + describe(c) + ' – áætlað markaðsverð ' + kr(c.est) + ' (' + pct(c.dev) + ')';
    }).join('\n') + '\n\nBerðu þá saman: verð miðað við akstur og aldur, áreiðanleika tegundanna, rekstrarkostnað, endursöluverð og algenga galla. ' +
      'Hvern myndirðu velja og af hverju? Svaraðu á íslensku.';
    openModal('<div class="m"><div class="m-head"><h2>Samanburður</h2><button class="x" data-close aria-label="Loka">×</button></div>' +
      '<div class="tbl-wrap" style="margin-top:12px"><table class="cmp-table"><tbody>' +
      '<tr><th></th>' + list.map(function (c) { return '<td>' + (img(c) ? '<img src="' + esc(img(c)) + '" alt="">' : '') + '<b>' + esc(cap(c.make) + ' ' + cap(c.model)) + '</b></td>'; }).join('') + '</tr>' +
      row('Verð', function (c) { return kr(c.price); }, function (c) { return c.price; }, true) +
      row('Áætlað verð', function (c) { return kr(c.est); }) +
      row('Frávik frá mati', function (c) { var v = verdict(c); return '<span class="badge ' + v.cls + '">' + pct(c.dev) + '</span>'; }, function (c) { return c.dev; }, true) +
      row('Árgerð', function (c) { return c.year || '–'; }, function (c) { return c.year; }, false) +
      row('Ekinn', function (c) { return kmFmt(c.km); }, function (c) { return c.km; }, true) +
      row('Km á ári', function (c) { return c.age > 0 && c.km ? Math.round(c.km / c.age).toLocaleString('de-DE') : '–'; }) +
      row('Eldsneyti', function (c) { return esc(c.fcat); }) +
      row('Skipting', function (c) { return c.auto === true ? 'Sjálfsk.' : c.auto === false ? 'Beinsk.' : '–'; }) +
      row('Fjórhjóladrif', function (c) { return c.awd ? 'Já' : '–'; }) +
      row('Bílasala', function (c) { return esc(c.dealer); }) +
      row('', function (c) { return '<a href="' + esc(c.url) + '" target="_blank" rel="noopener">Auglýsing ↗</a> · <a href="#" data-open="' + esc(c.id) + '">Nánar</a>'; }) +
      '</tbody></table></div>' +
      '<p class="note" style="margin-top:10px">Grænt = best í línunni. Frávik frá mati sýnir hve mikið bíllinn er dýrari eða ódýrari en sambærilegir bílar með sama akstur og aldur.</p>' +
      '<div class="actions"><a class="primary" href="' + claudeLink(prompt) + '" target="_blank" rel="noopener">Spyrja Claude hvern ég ætti að velja</a></div></div>');
  }

  // ---------- gerðaskrá og saga auglýsinga ----------
  var CATALOG = {};   // tegund -> { gerð: 1 }, líka gerðir sem eru ekki á sölu núna (data/catalog.json)
  function setCatalog(cat, reg) {
    CATALOG = {};
    var regModels = {};
    Object.keys((reg && reg.makes) || {}).forEach(function (mk) { regModels[mk] = Object.keys(reg.makes[mk]); });
    [cat.nhtsa || {}, cat.extra || {}, regModels].forEach(function (src) {
      Object.keys(src).forEach(function (mk) {
        var o = CATALOG[mk] = CATALOG[mk] || {};
        src[mk].forEach(function (m) { var b = baseModel(m, mk); if (b && b.length > 1 && !/^\d+$/.test(b) && /[A-Z]/.test(b)) o[b] = 1; });
      });
    });
  }
  // Gerð úr frjálsum titli (oft bland.is: „Benz - svartur“, „Mercedes Panorama“): ef hún er ekki raunveruleg gerð
  // (gerðaskrá NHTSA/ESB eða ökutækjaskrá, eða minnst 2 auglýsingar hjá bílasölum) leitum við að alvöru gerð í titlinum.
  function cleanBases(all) {
    all = all || cars;
    var dealerCnt = {};
    cars.forEach(function (c) { if (!c.priv) dealerCnt[c.key] = (dealerCnt[c.key] || 0) + 1; });
    var known = {};
    cars.forEach(function (c) { if (dealerCnt[c.key] >= 2) (known[c.make] = known[c.make] || {})[c.base] = 1; });
    Object.keys(CATALOG).forEach(function (mk) { var o = known[mk] = known[mk] || {}; Object.keys(CATALOG[mk]).forEach(function (b) { o[b] = 1; }); });
    var sorted = {};
    all.forEach(function (c) {
      var k = known[c.make] || {};
      if (c.base && (k[c.base] || !c.priv)) return;  // bílasölur skrifa heitin rétt; bara frjálsir titlar á bland.is hreinsaðir
      var list = sorted[c.make] = sorted[c.make] || Object.keys(k).filter(function (b) { return b.length > 1; }).sort(function (a, b) { return b.length - a.length; });
      var t = ' ' + fold(c.model + ' ' + c.title).replace(/[^a-z0-9.+ ]/g, ' ') + ' ', hit = null;
      for (var i = 0; i < list.length && !hit; i++) {
        var fb = fold(list[i]).replace(/[^a-z0-9.+ ]/g, ' ');
        if (t.indexOf(' ' + fb + ' ') >= 0 || t.indexOf(' ' + fb.replace(/ /g, '') + ' ') >= 0) hit = list[i];
      }
      c.base = hit || '?';  // „?“ = ótilgreind gerð (síanleg sér, ekki blandað saman við „allar“)
      c.key = c.make + '|' + c.base;
    });
  }
  function baseName(b) { return b && b !== '?' ? cap(b) : 'Ótilgreind gerð'; }
  function catalogBases(mk) { return Object.keys(CATALOG[mk] || {}); }

  var detailP = {};
  function shardOf(id) { var h = 5381; for (var i = 0; i < id.length; i++) h = (Math.imul(h, 33) + id.charCodeAt(i)) >>> 0; return h % 64; }
  function loadDetails(id) {
    var n = ('0' + shardOf(id)).slice(-2);
    if (!detailP[n]) {
      var gh = GITHUB_DATA.replace('cars.json', 'details/' + n + '.json');
      detailP[n] = fetch(gh).then(function (r) { if (!r.ok) throw 0; return r.json(); })
        .catch(function () { return fetch('data/details/' + n + '.json').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }); });
    }
    return detailP[n].then(function (s) { return s[id]; });
  }

  var SOLD = [];   // seldir / teknir af skrá síðustu 12 mán. (data/sold.json): viðmið í verðlíkaninu
  // vægi: nýlegar sölur vega mikið, gamlar minna; auglýsingar sem standa lengi á skrá eru oft of dýrar og vega minna
  function weigh(c) {
    var today = Date.now();
    if (c.sold) {
      var mo = Math.max(0, (today - day(c.goneAt)) / (30 * 864e5)), dom = daysBetween(c.firstAt, c.goneAt);
      c.mo = mo;
      c.w = 1.2 * Math.exp(-mo / 8) * (dom <= 45 ? 1.2 : dom > 150 ? 0.6 : 1);
    } else {
      var dl = c.fs ? daysBetween(c.fs, new Date().toISOString().slice(0, 10).replace(/-/g, '')) : 0;
      c.w = dl <= 60 ? 1 : Math.max(0.35, 1 - (dl - 60) / 240);
    }
    if (c.fl && c.fl.some(function (f) { return f === 'tjon' || f === 'laga' || f === 'ryd'; })) c.w *= 0.25;  // gallaðir draga matið síður niður
  }
  var VISION = {};  // ástandsmat út frá mynd (vision.py): id -> [flokkur, líkur]
  var HIST = null, histP = null;  // saga: allar auglýsingar sem við höfum séð (data/history.json), sótt þegar þarf
  function loadHistory() {
    if (histP) return histP;
    function get(u) { return fetch(u).then(function (r) { if (!r.ok) throw r.status; return r.json(); }).catch(function () { return null; }); }
    histP = Promise.all([get(GITHUB_DATA.replace('cars.json', 'history.json')), get('data/history.json?t=' + Date.now())]).then(function (r) {
      var h = r[0] && (!r[1] || r[0].updated >= r[1].updated) ? r[0] : r[1];
      HIST = [];
      if (h) Object.keys(h.ads).forEach(function (id) {
        var a = h.ads[id];
        a.id = id; a.base = baseModel(a.o, a.m); a.ft = fold(a.m + ' ' + a.o);
        a.price = a.p.length ? a.p[a.p.length - 1][1] : 0;
        HIST.push(a);
      });
      return HIST;
    });
    return histP;
  }
  function day(s) { return s ? new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)) : null; }
  var MON = ['jan.', 'feb.', 'mars', 'apr.', 'maí', 'júní', 'júlí', 'ág.', 'sept.', 'okt.', 'nóv.', 'des.'];  // vafrar kunna ekki allir íslensku
  function dateIs(d, withYear) { return d.getDate() + '. ' + MON[d.getMonth()] + (withYear ? ' ' + d.getFullYear() : ''); }
  function dayFmt(s) { var d = day(s); return d ? dateIs(d, d.getFullYear() !== NOW) : ''; }
  function daysBetween(a, b) { return Math.max(1, Math.round((day(b) - day(a)) / 864e5) + 1); }
  function pastCount(mk, b) { return HIST ? HIST.filter(function (a) { return a.g && a.m === mk && a.base === b; }).length : 0; }
  function pastMatches(f) {
    var words = f.text ? f.text.split(/\s+/) : [];
    return (HIST || []).filter(function (a) {
      if (!a.g) return false;
      if (f.make && a.m !== f.make) return false;
      if (f.model && a.base !== f.model) return false;
      if (f.yearMin != null && (a.y || 0) < f.yearMin) return false;
      if (f.yearMax != null && (a.y || 9999) > f.yearMax) return false;
      for (var i = 0; i < words.length; i++) if (a.ft.indexOf(words[i]) < 0) return false;
      return true;
    }).sort(function (a, b) { return a.g < b.g ? 1 : -1; });
  }
  function pastRow(a) {
    var drop = a.p.length > 1 ? ' <span class="note">(byrjaði í ' + kr(a.p[0][1]) + ')</span>' : '';
    return '<div class="past-row"><div><b>' + esc(cap(a.m) + ' ' + cap(a.o)) + '</b><span>' + (a.y || '–') + ' · ' + kmFmt(a.k) + ' · ' + esc(a.d || '') + '</span></div>' +
      '<div class="past-r"><b>' + kr(a.price) + '</b>' + drop + '<span>' + dayFmt(a.f) + ' – ' + dayFmt(a.g) + ' · ' + daysBetween(a.f, a.g) + ' dagar á skrá</span></div></div>';
  }
  function emptyState() {
    var f = readFilters();
    var what = [f.make && cap(f.make), f.model && cap(f.model), f.text].filter(Boolean).join(' ');
    return '<div class="empty big-empty">' +
      (what ? '<h3>Enginn ' + esc(what) + ' á sölu núna</h3><p>Vistaðu leitina og þú færð tilkynningu um leið og einn kemur á skrá, hjá bílasölu eða á bland.is.</p>' +
        '<button type="button" class="btn-cta" id="emptySave">🔔 Láttu mig vita þegar ' + esc(what) + ' kemur á sölu</button>'
        : '<p>Engir bílar fundust. Prófaðu að víkka leitina eða smelltu á „Hreinsa allt“.</p>') +
      '<div id="pastAds"></div></div>';
  }
  function fillPast() {
    var b = $('emptySave');
    if (b) b.addEventListener('click', function () { $('saveSearch').click(); });
    loadHistory().then(function () {
      var el = $('pastAds'); if (!el) return;
      var past = pastMatches(readFilters());
      el.innerHTML = past.length ? '<h4>Áður á sölu (' + past.length + ')</h4><div class="past">' + past.slice(0, 12).map(pastRow).join('') + '</div>' : '';
    });
  }

  // ---------- val á tegund og gerð ----------
  function hue(str) { var h = 0; for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360; return h; }
  function mono(make) {
    var w = cap(make).split(/[\s-]+/);
    return (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).toUpperCase();
  }
  var LOGOS = {};  // tegund -> logos/<slug>.png (logos/index.json), annars upphafsstafir
  function monoHtml(make, big) {
    if (LOGOS[make]) return '<span class="logo' + (big ? ' big' : '') + '"><img src="' + esc(LOGOS[make]) + '" alt="" loading="lazy"></span>';
    return '<span class="mono' + (big ? ' big' : '') + '" style="--h:' + hue(make) + '">' + esc(mono(make)) + '</span>';
  }
  function mkrShort(n) { return (n / 1e6).toLocaleString('de-DE', { maximumFractionDigits: n < 1e7 ? 1 : 0 }); }
  function median(a) { a = a.slice().sort(function (x, y) { return x - y; }); return a.length ? a[a.length >> 1] : 0; }
  // talið út frá öllum hinum síunum (verði, eldsneyti …), svo fjöldinn passi við það sem birtist
  function groupBy(keyFn, clear) {
    var f = readFilters(), g = {};
    clear.forEach(function (k) { f[k] = ''; });
    filtered(f).forEach(function (c) {
      var k = keyFn(c), x = g[k] = g[k] || { key: k, n: 0, prices: [], ymin: 9999, ymax: 0, ev: 0 };
      x.n++; x.prices.push(c.price);
      if (c.year) { x.ymin = Math.min(x.ymin, c.year); x.ymax = Math.max(x.ymax, c.year); }
      if (c.fcat === 'Rafmagn' || c.fcat === 'Tengiltvinn') x.ev++;
    });
    return Object.keys(g).map(function (k) { var x = g[k]; x.med = median(x.prices); x.min = Math.min.apply(null, x.prices); x.max = Math.max.apply(null, x.prices); return x; });
  }
  function renderPickers() {
    var mk = $('fMake').value, md = $('fModel').value;
    $('pickMakeText').textContent = mk ? cap(mk) : 'Allar tegundir';
    $('pickMakeMono').outerHTML = mk ? monoHtml(mk).replace(/^<span class="(mono|logo)/, '<span id="pickMakeMono" class="pb-mono $1') : '<span class="pb-mono" id="pickMakeMono">∗</span>';
    $('pickModelText').textContent = md ? baseName(md) : (mk ? 'Allar gerðir' : 'Veldu tegund fyrst');
    $('pickMake').classList.toggle('set', !!mk);
    $('pickModel').classList.toggle('set', !!md);
    var chips = $('modelChips');
    if (!mk) { chips.hidden = true; chips.innerHTML = ''; return; }
    var models = groupBy(function (c) { return c.base; }, ['model']).sort(function (a, b) { return b.n - a.n; });
    var total = models.reduce(function (s, x) { return s + x.n; }, 0);
    chips.hidden = false;
    chips.innerHTML = '<button type="button" class="chip' + (md ? '' : ' on') + '" data-chip="">' + monoHtml(mk) + 'Allar ' + esc(cap(mk)) + '<b>' + total + '</b></button>' +
      models.map(function (x) {
        return '<button type="button" class="chip' + (x.key === md ? ' on' : '') + '" data-chip="' + esc(x.key) + '">' + esc(baseName(x.key)) + '<b>' + x.n + '</b></button>';
      }).join('');
  }
  function chooseMake(mk, thenModel) {
    $('fMake').value = mk; fillModels(); $('fModel').value = '';
    render();
    if (thenModel && mk) openModelPicker(); else closeModal();
  }
  function setFeatures(v) {
    $('fFt').value = v;
    var on = v ? v.split(',') : [];
    document.querySelectorAll('#ftChips [data-ft]').forEach(function (b) { b.classList.toggle('on', on.indexOf(b.getAttribute('data-ft')) >= 0); });
  }
  function setSeller(v) {
    $('fSeller').value = v;
    document.querySelectorAll('#fSellerSeg button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-seller') === v); });
  }
  function chooseModel(md) { $('fModel').value = md; render(); }

  function openMakePicker(thenModel) {
    var then = thenModel === true ? ' data-then="model"' : '';
    var makes = groupBy(function (c) { return c.make; }, ['make', 'model']);
    var cur = $('fMake').value;
    var popular = makes.slice().sort(function (a, b) { return b.n - a.n; }).slice(0, 12);
    var all = makes.slice().sort(function (a, b) { return a.key < b.key ? -1 : 1; });
    // sjaldgæfar tegundir án merkis (oft hjólhýsi, bátar eða innsláttarvillur) fara í samanbrjótanlegan lista
    function major(x) { return LOGOS[x.key] || x.n >= 3; }
    var minor = all.filter(function (x) { return !major(x); });
    function row(x) {
      return '<button type="button" class="pk-row' + (x.key === cur ? ' on' : '') + '" data-pick-make="' + esc(x.key) + '"' + then + ' data-name="' + esc(fold(x.key)) + '">' +
        monoHtml(x.key) + '<span class="pr-name">' + esc(cap(x.key)) + '</span><b>' + x.n + '</b></button>';
    }
    function tile(x) {
      return '<button type="button" class="pk-tile' + (x.key === cur ? ' on' : '') + '" data-pick-make="' + esc(x.key) + '"' + then + ' data-name="' + esc(fold(x.key)) + '">' +
        monoHtml(x.key, true) + '<span class="pk-name">' + esc(cap(x.key)) + '</span>' +
        '<span class="pk-meta">' + x.n.toLocaleString('de-DE') + ' bílar · miðgildi ' + mkrShort(x.med) + ' m.kr.</span></button>';
    }
    openModal('<div class="m picker"><div class="m-head"><h2>Veldu tegund</h2><button class="x" data-close aria-label="Loka">×</button></div>' +
      '<input id="pickSearch" class="pk-search" type="search" placeholder="Leita að tegund…" autocomplete="off">' +
      '<button type="button" class="pk-all' + (cur ? '' : ' on') + '" data-pick-make=""' + ' data-name="allar">Allar tegundir <b>' + makes.reduce(function (s, x) { return s + x.n; }, 0).toLocaleString('de-DE') + '</b></button>' +
      '<div class="pk-section"><h4>Vinsælastar</h4><div class="pk-grid">' + popular.map(tile).join('') + '</div></div>' +
      '<div class="pk-section"><h4>Allar tegundir A–Ö</h4><div class="pk-list">' + all.filter(major).map(row).join('') + '</div>' +
      (minor.length ? '<details class="pk-more"><summary>Aðrar tegundir og tæki (' + minor.length + ')</summary><div class="pk-list">' + minor.map(row).join('') + '</div></details>' : '') +
      '</div></div>', 'sheet');
  }

  function openModelPicker() {
    var mk = $('fMake').value, cur = $('fModel').value;
    var models = groupBy(function (c) { return c.base; }, ['model']).sort(function (a, b) { return (a.key === '?') - (b.key === '?') || b.n - a.n; });
    var onSale = {}; cars.forEach(function (c) { if (c.make === mk) onSale[c.base] = 1; });
    var others = catalogBases(mk).filter(function (b) { return !onSale[b]; }).sort();
    loadHistory();
    var lo = models.length ? Math.min.apply(null, models.map(function (x) { return x.min; })) : 1, hi = models.length ? Math.max.apply(null, models.map(function (x) { return x.max; })) : 2;
    var span = Math.log(hi) - Math.log(lo) || 1;
    function pos(v) { return ((Math.log(v) - Math.log(lo)) / span * 100).toFixed(1); }
    openModal('<div class="m picker"><div class="m-head"><div class="pk-title">' + monoHtml(mk, true) + '<div><h2>' + esc(cap(mk)) + '</h2>' +
      '<span class="note">' + models.length + ' gerðir · ' + models.reduce(function (s, x) { return s + x.n; }, 0) + ' bílar</span></div></div>' +
      '<button class="x" data-close aria-label="Loka">×</button></div>' +
      '<div class="pk-bar"><input id="pickSearch" class="pk-search" type="search" placeholder="Leita að gerð…" autocomplete="off">' +
      '<button type="button" class="link" id="pkChangeMake">Skipta um tegund</button></div>' +
      '<div class="tabs pk-tabs"><button type="button" class="on" data-pk-tab="now">Á sölu núna (' + models.length + ')</button>' +
      '<button type="button" data-pk-tab="other">Aðrar gerðir (' + others.length + ')</button></div>' +
      '<div data-pk-pane="now"><button type="button" class="pk-all' + (cur ? '' : ' on') + '" data-pick-model="" data-name="allar">Allar gerðir</button>' +
      '<div class="pk-section"><div class="pk-models">' + models.map(function (x) {
        return '<button type="button" class="pk-model' + (x.key === cur ? ' on' : '') + '" data-pick-model="' + esc(x.key) + '" data-name="' + esc(fold(x.key)) + '">' +
          '<span class="pm-top"><span class="pm-name">' + esc(baseName(x.key)) + '</span><span class="pm-n">' + x.n + '</span></span>' +
          '<span class="pm-meta">' + (x.ymax ? (x.ymin === x.ymax ? x.ymin : x.ymin + '–' + x.ymax) : '') + (x.ev ? ' · ⚡ ' + Math.round(x.ev / x.n * 100) + '%' : '') + '</span>' +
          '<span class="pm-range" title="Verðbil"><span style="left:' + pos(x.min) + '%;right:' + (100 - pos(x.max)) + '%"></span><i style="left:' + pos(x.med) + '%"></i></span>' +
          '<span class="pm-price">' + (x.min === x.max ? mkrShort(x.min) : mkrShort(x.min) + '–' + mkrShort(x.max)) + ' m.kr. <small>miðgildi ' + mkrShort(x.med) + '</small></span></button>';
      }).join('') + '</div></div></div>' +
      '<div data-pk-pane="other" hidden><p class="note">Gerðir sem eru ekki á sölu núna. Veldu gerð og smelltu á „🔔 Láttu mig vita“, þá færðu tilkynningu um leið og ein kemur á skrá.</p>' +
      '<div class="pk-section"><div class="pk-list">' + others.map(function (b) {
        return '<button type="button" class="pk-row' + (b === cur ? ' on' : '') + '" data-pick-model="' + esc(b) + '" data-name="' + esc(fold(b)) + '">' +
          '<span class="pr-name">' + esc(cap(b)) + '</span><b>' + (pastCount(mk, b) ? pastCount(mk, b) + ' áður' : '🔔') + '</b></button>';
      }).join('') + '</div></div></div></div>', 'sheet');
    document.querySelectorAll('[data-pk-tab]').forEach(function (t) {
      t.addEventListener('click', function () {
        document.querySelectorAll('[data-pk-tab]').forEach(function (x) { x.classList.toggle('on', x === t); });
        document.querySelectorAll('[data-pk-pane]').forEach(function (p) { p.hidden = p.getAttribute('data-pk-pane') !== t.getAttribute('data-pk-tab'); });
      });
    });
    if (cur && models.every(function (x) { return x.key !== cur; })) document.querySelector('[data-pk-tab="other"]').click();
    $('pkChangeMake').addEventListener('click', function () { openMakePicker(true); });
  }

  // ---------- deilanlegir tenglar: síurnar og opni bíllinn eru í slóðinni ----------
  var URLKEYS = { make: 't', model: 'g', priceMin: 'vf', priceMax: 'vt', yearMin: 'af', yearMax: 'at', kmMax: 'km', fuel: 'e', trans: 's', body: 'y',
    dealer: 'b', seller: 'sl', text: 'o', awd: '4', deal: 'gv', sort: 'r', view: 'v', loc: 'st', ft: 'bn', rangeMin: 'dr', clean: 'an' };
  var urlTimer = null, openCarId = '';
  function syncUrl() {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(function () {
      var f = readFilters(), p = [];
      Object.keys(URLKEYS).forEach(function (k) {
        var v = f[k];
        if (v === true) v = '1';
        if (v == null || v === '' || v === false || (k === 'sort' && v === 'deal')) return;
        p.push(URLKEYS[k] + '=' + encodeURIComponent(v));
      });
      var url = location.pathname + (p.length ? '?' + p.join('&') : '') + (openCarId ? '#bill=' + encodeURIComponent(openCarId) : '');
      try { history.replaceState(null, '', url); } catch (e) { /* sumir vafrar banna þetta í iframe */ }
    }, 250);
  }
  function filtersFromUrl() {
    var q = new URLSearchParams(location.search), f = {}, any = false;
    Object.keys(URLKEYS).forEach(function (k) {
      var v = q.get(URLKEYS[k]); if (v == null) return;
      any = true;
      f[k] = /^(awd|deal|clean)$/.test(k) ? v === '1' : /^(priceMin|priceMax)$/.test(k) ? +v * 1e6 : /^(yearMin|yearMax|kmMax|rangeMin)$/.test(k) ? +v : v;
    });
    return any ? f : null;
  }
  function shareLink(id) {
    var url = location.origin + location.pathname + location.search + '#bill=' + encodeURIComponent(id);
    return url;
  }

  // ---------- atburðir ----------
  function runSearch(text) {
    var r = parseQuery(text);
    setFilters(r.f);
    $('understood').hidden = !text.trim();
    $('understood').innerHTML = r.said.length ? 'Skildi leitina svona: <b>' + r.said.map(esc).join(' · ') + '</b> (hægt að breyta í síunum)' :
      'Fann engin leitarskilyrði – sýni alla bíla.';
    render();
  }

  function fillModels() {
    var mk = $('fMake').value, sel = $('fModel'), cur = sel.value;
    var cnt = {};
    cars.forEach(function (c) { if (!mk || c.make === mk) cnt[c.base] = (cnt[c.base] || 0) + 1; });
    if (mk) catalogBases(mk).forEach(function (b) { if (!cnt[b]) cnt[b] = 0; });  // gerðir sem eru ekki á sölu núna
    sel.innerHTML = '<option value="">Allar</option>' + Object.keys(cnt).sort().map(function (b) {
      return '<option value="' + esc(b) + '">' + esc(baseName(b)) + ' (' + cnt[b] + ')</option>';
    }).join('');
    sel.value = cur in cnt ? cur : '';
  }

  function bind() {
    $('searchForm').addEventListener('submit', function (e) {
      e.preventDefault(); $('q').blur();
      var v = $('q').value.trim().toUpperCase().replace(/[\s-]/g, '');
      // íslenskt bílnúmer (t.d. AB123, ABC12): fletta upp í ökutækjaskrá í stað þess að leita
      if (/^[A-ZÞÆÖÐ]{2}[A-Z0-9]\d{2}$/.test(v) && window.Registry) { Registry.openPlate(v); return; }
      runSearch($('q').value);
    });
    $('examples').addEventListener('click', function (e) {
      if (e.target.tagName !== 'BUTTON') return;
      $('q').value = e.target.textContent; runSearch(e.target.textContent);
    });
    F.forEach(function (id) {
      $(id).addEventListener(/fText|fPrice|fYear|fKm|fRange/.test(id) ? 'input' : 'change', function () {
        if (id === 'fMake') fillModels();
        render();
      });
    });
    bindPrice();
    $('reset').addEventListener('click', function () { $('q').value = ''; $('understood').hidden = true; setFilters({}); render(); });
    $('filtersToggle').addEventListener('click', function () {
      var open = $('filters').classList.toggle('open');
      this.setAttribute('aria-expanded', open);
    });
    $('more').addEventListener('click', function () { shown += PAGE; render(true); });
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.mt-lab[data-tip]')) { e.stopPropagation(); return; }
      var ti = e.target.closest ? e.target.closest('[data-import],[data-similar]') : null;
      if (ti) {
        e.stopPropagation();
        if (ti.hasAttribute('data-import')) { if (window.Features) Features.openImport(byId(ti.getAttribute('data-import'))); }
        else if (window.Acct) Acct.saveSimilar(ti.getAttribute('data-similar'), ti);
        return;
      }
      var t = e.target.closest ? e.target.closest('[data-legend],[data-share],[data-watch],[data-save],[data-cmp],[data-open],[data-close],.car') : null;
      if (!t) return;
      if (t.hasAttribute('data-legend')) { e.stopPropagation(); showLegend(); return; }
      if (t.hasAttribute('data-share')) {
        var sc = byId(t.getAttribute('data-share')), link = shareLink(sc.id);
        if (navigator.share) navigator.share({ title: cap(sc.make) + ' ' + cap(sc.model), text: kr(sc.price), url: link }).catch(function () {});
        else if (navigator.clipboard) navigator.clipboard.writeText(link).then(function () { t.textContent = '✓ Tengill afritaður'; });
        else window.prompt('Afritaðu tengilinn:', link);
      } else if (t.hasAttribute('data-watch')) {
        if (window.Acct) Acct.openWatch(t.getAttribute('data-watch'), t);
      } else if (t.hasAttribute('data-save')) {
        e.stopPropagation();
        if (window.Acct) Acct.toggleSave(t.getAttribute('data-save'));
      } else if (t.hasAttribute('data-cmp')) {
        e.stopPropagation(); toggleCompare(t.getAttribute('data-cmp'));
        var on = compare.indexOf(t.getAttribute('data-cmp')) >= 0;
        document.querySelectorAll('[data-cmp="' + t.getAttribute('data-cmp') + '"]').forEach(function (b) {
          b.classList.toggle('on', on);
          b.innerHTML = b.classList.contains('sec') ? ic('git-compare-arrows') + (on ? 'Í samanburði' : 'Bera saman') : ic(on ? 'check' : 'git-compare-arrows');
        });
        renderTray();
      } else if (t.hasAttribute('data-close')) closeModal();
      else if (t.hasAttribute('data-open')) { e.preventDefault(); var c = byId(t.getAttribute('data-open')); if (c) showCar(c); }
      else if (t.classList.contains('car')) { var c2 = byId(t.getAttribute('data-id')); if (c2) showCar(c2); }
    });
    $('modal').addEventListener('click', function (e) { if (e.target === this) closeModal(); });
    $('trayOpen').addEventListener('click', showCompare);
    $('pickMake').addEventListener('click', openMakePicker);
    $('ftChips').innerHTML = Object.keys(FEAT_TXT).map(function (k) { return '<button type="button" data-ft="' + k + '">' + esc(FEAT_TXT[k]) + '</button>'; }).join('');
    $('ftChips').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-ft]') : null; if (!b) return;
      var on = $('fFt').value ? $('fFt').value.split(',') : [], k = b.getAttribute('data-ft'), i = on.indexOf(k);
      if (i >= 0) on.splice(i, 1); else on.push(k);
      setFeatures(on.join(',')); render();
    });
    $('fSellerSeg').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-seller]') : null;
      if (b) { setSeller(b.getAttribute('data-seller')); render(); }
    });
    $('pickModel').addEventListener('click', function () { if ($('fMake').value) openModelPicker(); else openMakePicker(true); });
    $('modelChips').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-chip]') : null;
      if (b) chooseModel(b.getAttribute('data-chip'));
    });
    $('modalBody').addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-pick-make],[data-pick-model]') : null;
      if (!t) return;
      if (t.hasAttribute('data-pick-make')) chooseMake(t.getAttribute('data-pick-make'), t.getAttribute('data-then') === 'model');
      else { chooseModel(t.getAttribute('data-pick-model')); closeModal(); }
    });
    $('modalBody').addEventListener('input', function (e) {
      if (e.target.id !== 'pickSearch') return;
      var q = fold(e.target.value).trim();
      document.querySelectorAll('#modalBody [data-name]').forEach(function (el) {
        el.hidden = q && el.getAttribute('data-name').indexOf(q) < 0;
      });
      document.querySelectorAll('#modalBody .pk-section').forEach(function (sec) {
        sec.hidden = !sec.querySelector('[data-name]:not([hidden])');
      });
    });
    $('trayClear').addEventListener('click', function () { compare = []; store('compare', compare); render(true); });
  }

  function load() {
    // Nýjustu gögnin koma af GitHub (uppfærð á hverri nóttu); afritið á síðunni sjálfri er varaleið.
    function get(url) { return fetch(url).then(function (r) { if (!r.ok) throw r.status; return r.json(); }).catch(function () { return null; }); }
    get('logos/index.json').then(function (l) { if (l) { LOGOS = l; if (cars.length) render(true); } });
    var catP = get(GITHUB_DATA.replace('cars.json', 'catalog.json')).then(function (c) { return c || get('data/catalog.json'); });
    var visP = Promise.all([get(GITHUB_DATA.replace('cars.json', 'vision.json')), get('data/vision.json?t=' + Date.now())]).then(function (r) {
      return r[0] && (!r[1] || (r[0].updated || '') >= (r[1].updated || '')) ? r[0] : r[1];
    });
    var regP = Promise.all([get(GITHUB_DATA.replace('cars.json', 'registry.json')), get('data/registry.json?t=' + Date.now())]).then(function (r) {
      return r[0] && (!r[1] || (r[0].updated || '') >= (r[1].updated || '')) ? r[0] : r[1];
    });
    var dupP = Promise.all([get(GITHUB_DATA.replace('cars.json', 'dupes.json')), get('data/dupes.json?t=' + Date.now())]).then(function (r) {
      return r[0] && (!r[1] || (r[0].updated || '') >= (r[1].updated || '')) ? r[0] : r[1];
    });
    var soldP = Promise.all([get(GITHUB_DATA.replace('cars.json', 'sold.json')), get('data/sold.json?t=' + Date.now())]).then(function (r) {
      return r[0] && (!r[1] || (r[0].updated || '') >= (r[1].updated || '')) ? r[0] : r[1];
    });
    var CAT = null, REGD = null, SOLDD = null, DUPD = null;
    Promise.all([get(GITHUB_DATA), get('data/cars.json?t=' + Date.now()), visP, catP, regP, soldP, dupP]).then(function (res) {
      SOLDD = res[5]; DUPD = res[6];
      VISION = (res[2] && res[2].flags) || {};
      CAT = res[3]; REGD = res[4];
      var d = res[0] && (!res[1] || res[0].updated >= res[1].updated) ? res[0] : res[1];
      if (!d) throw new Error('engin gögn');
      return d;
    }).then(function (d) {
      var dup = {};
      cars = d.cars.filter(function (c) {
        // sami bíll auglýstur af tveimur bílasölum: sýna hann bara einu sinni
        var k = [c.make, c.model, c.year, c.km, c.price].join('|');
        if (!c.price || !c.make || dup[k]) return false;
        return (dup[k] = true);
      }).map(prep);
      // sami bíll á fleiri stöðum (fundinn út frá mynd, dupes.py): ódýrasta auglýsingin birtist, hinar fylgja henni
      var ids = {}; cars.forEach(function (c) { ids[c.id] = c; });
      ((DUPD && DUPD.groups) || []).forEach(function (g) {
        var cs = g.map(function (id) { return ids[id]; }).filter(Boolean).sort(function (a, b) { return a.price - b.price; });
        if (cs.length < 2) return;
        cs[0].also = cs.slice(1).map(function (o) { return { id: o.id, dealer: o.dealer, price: o.price, url: o.url, src: o.src }; });
        cs.slice(1).forEach(function (o) { DUPOF[o.id] = cs[0].id; });
      });
      cars = cars.filter(function (c) { return !DUPOF[c.id]; });
      var live = {}; cars.forEach(function (c) { live[c.id] = 1; });
      SOLD = ((SOLDD && SOLDD.rows) || []).filter(function (r) { return !live[r[0]] && r[5] > 100000; }).map(function (r) {
        return prep({ id: 'sold:' + r[0], make: r[1], model: r[2], year: r[3], km: r[4], price: r[5], goneAt: r[6], firstAt: r[7], fuel: r[8], title: r[9] || (r[1] + ' ' + r[2]),
          src: r[10], trans: r[11], drive: r[12], dealer: '', sold: true });
      });
      setCatalog(CAT || {}, REGD);
      cleanBases(cars.concat(SOLD));
      cars.concat(SOLD).forEach(weigh);
      model = fit(cars.concat(SOLD).filter(function (c) { return !c.special; }));
      cars.forEach(function (c) {  // sérútbúnir: mat út frá líkaninu án þeirra (bara til upplýsinga)
        if (!c.special) return;
        var r = model.estimate(c); c.est = Math.round(r.est / 1e4) * 1e4; c.peers = r.peers; c.tierPeers = 0; c.dev = c.price / c.est - 1;
      });
      compare = (store('compare') || []).filter(byId);
      var makes = {}, dealers = {};
      cars.forEach(function (c) { makes[c.make] = (makes[c.make] || 0) + 1; dealers[c.dealer] = 1; });
      $('fMake').innerHTML = '<option value="">Allar</option>' + Object.keys(makes).sort().map(function (m) {
        return '<option value="' + esc(m) + '">' + esc(cap(m)) + ' (' + makes[m] + ')</option>';
      }).join('');
      $('fDealer').innerHTML = '<option value="">Allar</option>' + Object.keys(dealers).sort().map(function (m) {
        return '<option>' + esc(m) + '</option>';
      }).join('');
      fillModels();
      var u = new Date(d.updated);
      $('updated').textContent = 'Uppfært ' + dateIs(u) + ' kl. ' +
        ('0' + u.getHours()).slice(-2) + ':' + ('0' + u.getMinutes()).slice(-2);
      $('sources').textContent = 'Heimildir: ' + Object.keys(d.sources).map(function (k) { return k + ' (' + d.sources[k] + ')'; }).join(' · ');
      // saga: merkja nýja bíla og verðlækkanir (sótt í bakgrunni, svo síðan bíður ekki eftir henni)
      loadHistory().then(function (H) {
        var byId2 = {}, start = '99999999';
        H.forEach(function (a) { byId2[a.id] = a; if (a.f < start) start = a.f; });
        var latest = H.reduce(function (m, a) { return a.l > m ? a.l : m; }, '');
        cars.forEach(function (c) {
          var a = byId2[c.id]; if (!a) return;
          c.firstSeen = a.f;
          c.isNew = a.f > start && daysBetween(a.f, latest) <= 3;   // fyrsti dagurinn er upphaf sögunnar, ekki „nýtt“
          for (var i = a.p.length - 1; i > 0; i--) if (a.p[i][1] < a.p[i - 1][1]) { c.drop = a.p[i - 1][1] - a.p[i][1]; c.dropAt = a.p[i][0]; break; }
        });
        // endurskráðir: bíll sem hvarf og birtist aftur (oft hjá annarri sölu eða á öðru verði)
        var gone = {};
        H.forEach(function (a) { if (a.g) { var k = a.m + '|' + a.base + '|' + a.y; (gone[k] = gone[k] || []).push(a); } });
        cars.forEach(function (c) {
          if (!c.firstSeen || c.firstSeen <= start) return;
          var cand = (gone[c.make + '|' + c.base + '|' + c.year] || []).filter(function (a) {
            return a.id !== c.id && a.g <= c.firstSeen && c.km != null && a.k != null && Math.abs(a.k - c.km) <= Math.max(3000, c.km * 0.03);
          });
          if (cand.length) c.relist = cand.sort(function (a, b) { return a.g < b.g ? 1 : -1; })[0];
        });
        // akstursvörn: akstur lækkaði í sömu auglýsingu, eða bíll birtist aftur hjá sömu sölu með mun lægri akstur
        H.forEach(function (a) {
          if (!a.kh || a.g) return;
          for (var i = 1; i < a.kh.length; i++) if (a.kh[i][1] < a.kh[i - 1][1] - 1000) {
            var cc = byId2[a.id] && byId(a.id); if (cc) cc.kmBack = { from: a.kh[i - 1][1], to: a.kh[i][1], at: a.kh[i][0], same: true };
          }
        });
        cars.forEach(function (c) {
          if (c.kmBack || !c.firstSeen || c.firstSeen <= start || c.km == null) return;
          var cand = (gone[c.make + '|' + c.base + '|' + c.year] || []).filter(function (a) {
            return a.d && a.d === c.dealer && a.k != null && a.k - c.km >= 5000 && a.g <= c.firstSeen && daysBetween(a.g, c.firstSeen) <= 45 && Math.abs(a.price - c.price) / c.price < 0.25;
          });
          if (cand.length) c.kmBack = { from: cand[0].k, to: c.km, at: cand[0].g, same: false };
        });
        if (window.Features) Features.historyReady(H, start);
        render(true);
      });
      // bíðum eftir gerðaskránni svo leit að gerð sem er ekki á sölu (t.d. „clk500“) skiljist strax
      return Promise.resolve().then(function () {
        fillModels();
        var q = new URLSearchParams(location.search).get('q'), uf = filtersFromUrl();
        if (uf) { setFilters(uf); render(); } else if (q) { $('q').value = q; runSearch(q); } else render();
        var hb = (location.hash.match(/bill=([^&]+)/) || [])[1];
        if (hb) { var hc = byId(decodeURIComponent(hb)); if (hc) showCar(hc); }
        if (window.Acct) Acct.dataReady();
        if (window.Features) Features.heroStats();
      });
    }).catch(function (e) {
      $('count').textContent = 'Tókst ekki að sækja gögn.';
      console.error(e);
    });
  }


  function refreshSaved() {
    document.querySelectorAll('[data-save]').forEach(function (b) {
      var on = isSaved(b.getAttribute('data-save'));
      b.classList.toggle('on', on);
      if (on && !b.classList.contains('on-was')) { b.classList.add('pop'); setTimeout(function () { b.classList.remove('pop'); }, 400); }
      b.classList.toggle('on-was', on);
    });
  }

  // aðgangur að gögnum og birtingu fyrir account.js
  window.App = {
    cars: function () { return cars; }, byId: byId, filtered: filtered, readFilters: readFilters, setFilters: setFilters,
    render: render, refreshSaved: refreshSaved, openModal: openModal, closeModal: closeModal, showCar: showCar,
    query: function () { return $('q').value; }, setQuery: function (t) { $('q').value = t || ''; $('understood').hidden = true; },
    esc: esc, kr: kr, kmFmt: kmFmt, cap: cap, img: img, fold: fold, pct: pct, mkrShort: mkrShort, monoHtml: monoHtml,
    prep: prep, baseModel: baseModel, model: function () { return model; }, ageSlope: ageSlope, kmSlope: kmSlope, similar: similar, adjusted: adjusted, verdict: verdict,
    catalogBases: catalogBases, loadHistory: loadHistory, hist: function () { return HIST; }, dayFmt: dayFmt, daysBetween: daysBetween,
    pastRow: pastRow, dateIs: dateIs, details: loadDetails, repairCost: repairCost, makes: function () { return uniq(cars.map(function (c) { return c.make; })).sort(); },
    setView: function (v) { $('fView').value = v; render(); }
  };
  bind();
  load();
})();
