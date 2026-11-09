/* Bílaleit – leit, verðmat og samanburður. Allt keyrir í vafranum, engin greidd gervigreind. */
(function () {
  'use strict';

  var GITHUB_DATA = 'https://raw.githubusercontent.com/isaklehmann33-creator/bilaleit/main/public/data/cars.json';
  var NOW = new Date().getFullYear();
  var PAGE = 60;
  var $ = function (id) { return document.getElementById(id); };
  var cars = [], model = null, shown = PAGE, compare = [];

  // ---------- hjálparföll ----------
  function fold(s) {
    return String(s || '').toLowerCase()
      .replace(/[áà]/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i').replace(/[óö]/g, 'o')
      .replace(/ú/g, 'u').replace(/ý/g, 'y').replace(/þ/g, 'th').replace(/ð/g, 'd').replace(/æ/g, 'ae');
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function kr(n) { return n == null ? '–' : Math.round(n).toLocaleString('de-DE') + ' kr.'; }
  function mkr(n) { return (n / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 2 }) + ' m.kr.'; }
  function kmFmt(n) { return n == null ? '–' : n.toLocaleString('de-DE') + ' km'; }
  function pct(x) { return (x > 0 ? '+' : '') + Math.round(x * 100) + '%'; }
  // Hástafir eins og bílaframleiðendur skrifa: skammstafanir og gerðir með tölum (GLE, EQC, X5, ID.4) haldast, annars Sprinter, Kia
  var CAP_EXC = { KIA: 'Kia', RAM: 'Ram', UP: 'up!', NEW: 'New', VAN: 'Van' };
  function cap(s) {
    return String(s || '').split(/(\s+|-)/).map(function (w) {
      var u = w.toUpperCase();
      if (CAP_EXC[u]) return CAP_EXC[u];
      if (/\d/.test(w) || (u.length <= 3 && /^[A-Z.+]+$/.test(u))) return u;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join('');
  }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }

  // ---------- flokkun ----------
  var SUV = ('SPORTAGE SORENTO XCEED EV9 EV5 NIRO E-NIRO TUCSON SANTA KONA IONIQ5 RAV4 LAND C-HR YARIS-CROSS HIGHLANDER ' +
    'GLC GLE GLA GLB GLS EQA EQB EQC G Q2 Q3 Q4 Q5 Q7 Q8 E-TRON X1 X2 X3 X4 X5 X6 X7 IX IX1 IX3 XC40 XC60 XC90 EX30 EX40 EX90 C40 ' +
    'KODIAQ KAROQ KAMIQ ENYAQ ELROQ TIGUAN TOUAREG T-ROC T-CROSS TAIGO ID.4 ID.5 RANGE DISCOVERY DEFENDER OUTLANDER ECLIPSE ASX ' +
    'QASHQAI X-TRAIL JUKE ARIYA CX-3 CX-30 CX-5 CX-60 CX-80 MX-30 KUGA PUMA EXPLORER MUSTANG ECOSPORT EDGE 2008 3008 5008 E-2008 E-3008 ' +
    'C5 C3 MOKKA GRANDLAND CROSSLAND CR-V HR-V ZR-V MODEL ZS MARVEL EHS HS 3 4 WRANGLER COMPASS RENEGADE CHEROKEE GRAND VITARA ' +
    'S-CROSS JIMNY DUSTER CAPTUR KADJAR AUSTRAL ARKANA BZ4X UX NX RX MACAN CAYENNE ATTO SEAL-U TONGAN TOYOTA HILUX F-150 RANGER AMAROK').split(' ');

  // Sameinar mismunandi rithætti sömu gerðar: „V-KLASSE“, „V 250“, „V-250“ -> V; BMW „530E“ -> 5 SERIES o.s.frv.
  var MB_CLASSES = /^(A|B|C|E|S|G|V|T|X|CL|CLA|CLK|CLS|GL|GLA|GLB|GLC|GLE|GLK|GLS|ML|SL|SLC|SLK|R|EQA|EQB|EQC|EQE|EQS|EQV|EQT)$/;
  var TYPO = { SPORTAG: 'SPORTAGE', OPTIMALUXURI: 'OPTIMA', 'E-NIRO': 'NIRO', 'E-GOLF': 'GOLF', 'QASHQAI+2': 'QASHQAI', 'C-HR+': 'C-HR',
    'KA+': 'KA', 'TRANSIT/TOURNEO': 'TRANSIT', IONIQ5: 'IONIQ 5', IONIQ6: 'IONIQ 6', IONIQ9: 'IONIQ 9', 'SPRINTER-E': 'SPRINTER', ECITAN: 'CITAN' };
  function baseModel(m, make) {
    var w = String(m || '').toUpperCase().replace(/\b(KLASSE|KLASSI|CLASS)\b/g, ' ').replace(/-\s/g, ' ').split(/\s+/)
      .map(function (x) { return x.replace(/-$/, ''); }).filter(Boolean);
    var mk = String(make || '').toUpperCase();
    while (w.length > 1 && (w[0] === mk || w[0] === mk.split(/[\s-]/)[0] || w[0] === 'AMG' || w[0] === 'NEW' || w[0] === 'NYR')) w.shift();
    if (!w.length) return '';
    if (w[0] === 'RANGE' && w[1] === 'ROVER') return /^(SPORT|EVOQUE|VELAR)$/.test(w[2] || '') ? 'RANGE ROVER ' + w[2] : 'RANGE ROVER';
    if (w[0] === 'DISCOVERY' && w[1] === 'SPORT') return 'DISCOVERY SPORT';
    if (/^(MODEL|GRAND|SANTA|LAND|C3|C4|C5)$/.test(w[0]) && w[1]) return w[0] + ' ' + w[1];
    if (/^(IONIQ|ID\.?)$/.test(w[0]) && /^\d$/.test(w[1] || '')) w[0] = w[0].replace(/\.$/, '') + (w[0] === 'IONIQ' ? ' ' : '.') + w[1];
    var b = TYPO[w[0]] || w[0];
    b = b.replace(/^([A-Z])-(\d+)$/, '$1$2').replace(/(\D)\d+\.\d+$/, '$1');           // F-350 -> F350, MUSTANG2.3 -> MUSTANG
    if (mk === 'MERCEDES-BENZ') {
      var mm = b.match(/^([A-Z]+)-?\d{2,3}[A-Z]*$/) || b.match(/^\d{3}([A-Z]+)$/);       // GLE450, V-250, C200, 450SL
      if (mm) { var cl = /^SE[LC]?$/.test(mm[1]) ? 'S' : mm[1]; if (MB_CLASSES.test(cl)) b = cl; }
    }
    if (mk === 'BMW') {
      if (/^[XZIM]$/.test(b) && /^\d$/.test(w[1] || '')) b = b + w[1];                     // X 5 -> X5
      var bm = b.match(/^(\d)(\d\d)?[A-Z]*$/);                                          // 530E, 320D, 5 -> 5 SERIES
      if (bm) b = bm[1] + ' SERIES';
    }
    return b;
  }
  function fuelCat(c) {
    var f = fold(c.fuel), t = fold(c.title);
    var raf = /raf|electric/.test(f), ice = /bens|dis|petrol|diesel/.test(f);
    if (raf && ice) return /phev|plug|tengil|e-hybrid|phe\b|\bphe/.test(f + ' ' + t) || /raf\.tengill/.test(f) ? 'Tengiltvinn' : 'Tvinn';
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
    c.base = baseModel(c.model, c.make);
    c.key = c.make + '|' + c.base;
    c.fcat = fuelCat(c);
    c.awd = isAwd(c);
    c.suv = SUV.indexOf(c.base.split(' ')[0]) >= 0 || SUV.indexOf(c.base.replace(' ', '')) >= 0 || /\b(jeppi|jepplingur)\b/i.test(c.title);
    c.auto = /sjalf/.test(fold(c.trans)) ? true : /bein/.test(fold(c.trans)) ? false : (c.fcat === 'Rafmagn' ? true : null);
    c.age = Math.max(0, NOW - (c.year || NOW));
    c.ftitle = fold(c.make + ' ' + c.model);
    c.perf = perfTier(c);
    c.pwRaw = powerHint(c);
    c.priv = c.src === 'bland.is';  // einkasala (bland.is); allt annað er bílasala
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
    if (c.make === 'MERCEDES-BENZ' && (m = t.match(/ [A-Z]{0,3} ?([1-6]\d0)( ?[DECH]|CDI|CGI| BLUETEC)? /))) return +m[1] / 100;
    if (c.make === 'BMW' && ((m = t.match(/ [1-8](\d0)[IDE]? /)) || (m = t.match(/ (?:X?DRIVE|SDRIVE) ?(\d0)[IDE]? /)))) return +m[1] / 10;
    if (c.make === 'AUDI' && (m = t.match(/ ([3-6]\d) (TFSI|TDI|E TRON|TFSIE|QUATTRO)/))) return +m[1] / 10;
    if (c.make === 'VOLVO' && (m = t.match(/ [TDB]([2-8]) /))) return +m[1];
    return null;
  }

  // ---------- verðmatslíkan ----------
  // log(verð) = fasti gerðar + b·aldur + c·akstur + eldsneytisáhrif + kraftútgáfa + vélarafl.
  // Hallatölur eru metnar *innan* hverrar gerðar (sami bíll, mismikið ekinn), svo dýrar tegundir rugla þær ekki.
  var FUELS = ['Rafmagn', 'Tengiltvinn', 'Tvinn', 'Dísel'];
  function feats(c) {
    var km = c.km != null ? c.km : 15000 * c.age; // vantar akstur: gerum ráð fyrir meðalakstri
    var x = [c.age, km / 1e4];
    for (var i = 0; i < FUELS.length; i++) x.push(c.fcat === FUELS[i] ? 1 : 0);
    x.push(c.perf.t === 1 ? 1 : 0, c.perf.t === 2 ? 1 : 0, c.pw, c.perf.t ? c.age : 0);  // síðasta: sportbílar falla hægar í verði
    return x;
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
      var mx = new Array(d).fill(0), my = 0;
      g.forEach(function (c) { var x = feats(c); for (i = 0; i < d; i++) mx[i] += x[i] / g.length; my += Math.log(c.price) / g.length; });
      g.forEach(function (c) {
        var x = feats(c), y = Math.log(c.price) - my;
        for (i = 0; i < d; i++) {
          var xi = x[i] - mx[i];
          Xty[i] += xi * y;
          for (j = 0; j < d; j++) XtX[i][j] += xi * (x[j] - mx[j]);
        }
      });
    });
    for (i = 0; i < d; i++) XtX[i][i] += 0.5; // smá ridge svo fáir bílar valdi ekki rugli
    var beta = solve(XtX, Xty);
    function lin(c) { var x = feats(c), s = 0; for (var i = 0; i < d; i++) s += beta[i] * x[i]; return s; }

    var tot = 0, makes = {}, grp = {}, grpT = {};
    list.forEach(function (c) {
      c._r = Math.log(c.price) - lin(c);
      tot += c._r;
      var m = makes[c.make] = makes[c.make] || { s: 0, n: 0 }; m.s += c._r; m.n++;
      var g = grp[c.key] = grp[c.key] || { s: 0, n: 0 }; g.s += c._r; g.n++;
      var gt = grpT[c.key + '|' + c.perf.t] = grpT[c.key + '|' + c.perf.t] || { s: 0, n: 0 }; gt.s += c._r; gt.n++;
    });
    var glob = tot / list.length;
    // Mat fyrir hvern bíl án hans sjálfs (leave-one-out), svo bíllinn hafi ekki áhrif á eigið mat
    list.forEach(function (c) {
      var m = makes[c.make], g = grp[c.key];
      var mk = (m.s - c._r + 3 * glob) / (m.n - 1 + 3);
      var gi = (g.s - c._r + 1.5 * mk) / (g.n - 1 + 1.5);
      // kraftútgáfur: miðum fyrst við aðra í sömu útgáfu (Golf R við Golf R); almenna álagið gildir bara ef enginn er til
      if (c.perf.t) { var gt = grpT[c.key + '|' + c.perf.t]; gi = (gt.s - c._r + 1 * gi) / (gt.n - 1 + 1); }
      c.est = Math.round(Math.exp(gi + lin(c)) / 1e4) * 1e4;
      c.peers = g.n - 1;
      c.tierPeers = groups[c.key].filter(function (o) { return o !== c && o.perf.t === c.perf.t; }).length;
      c.dev = c.price / c.est - 1;
    });
    return { beta: beta, lin: lin, groups: groups };
  }
  function verdict(c) {
    if (c.peers < 2) return { cls: 'mid', txt: 'Fáir sambærilegir' };
    // meira en helmingi undir mati: oftast innsláttarvilla, varahlutabíll, tjónabíll eða svindl
    if (c.dev <= -0.5) return { cls: 'warn', txt: 'Athugaðu verðið' };
    // kraftútgáfa sem enginn annar sambærilegur er til af: matið byggir á almennu álagi, svo við fullyrðum ekki
    if (c.perf.t && !c.tierPeers) return { cls: 'mid', txt: 'Sjaldgæf útgáfa ' + pct(c.dev) };
    if (c.dev <= -0.12) return { cls: 'good', txt: 'Gott verð ' + pct(c.dev) };
    if (c.dev >= 0.12) return { cls: 'bad', txt: 'Hátt verð ' + pct(c.dev) };
    return { cls: 'mid', txt: 'Eðlilegt verð' };
  }
  function adjusted(other, target) {
    // verð hins bílsins ef hann væri jafn gamall og jafn mikið ekinn og target
    return other.price * Math.exp(model.lin(target) - model.lin(other));
  }
  function similar(c, n) {
    var g = model.groups[c.key] || [];
    return g.filter(function (o) { return o !== c; }).sort(function (a, b) {
      function d(o) { return Math.abs(o.age - c.age) + Math.abs((o.km || 0) - (c.km || 0)) / 30000 + (o.fcat === c.fcat ? 0 : 2) + 4 * Math.abs(o.perf.t - c.perf.t) + Math.abs(o.pw - c.pw); }
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
    var bases = uniq(cars.filter(function (c) { return !f.make || c.make === f.make; }).map(function (c) { return c.make + '|' + c.base; }));
    bases.sort(function (a, b) { return b.length - a.length; });
    bases.some(function (kb) {
      var b = kb.split('|')[1], fb = fold(b);
      if (!f.model && fb.length > 1 && new RegExp('(^|\\s)' + escRe(fb).replace(/\\\.|-/g, '[.\\- ]?') + '(?=\\s)').test(q)) {
        f.model = b; f.make = kb.split('|')[0];
        q = q.replace(new RegExp('(^|\\s)' + escRe(fb).replace(/\\\.|-/g, '[.\\- ]?') + '(?=\\s)'), ' ');
        return true;
      }
      return false;
    });

    // önnur orð sem koma fyrir í heitum bíla (t.d. "gt", "4matic") verða textasía
    var vocab = {};
    cars.forEach(function (c) { c.ftitle.split(/\s+/).forEach(function (w) { vocab[w] = 1; }); });
    var STOP = { og: 1, i: 1, a: 1, med: 1, sem: 1, er: 1, en: 1, um: 1, til: 1, ad: 1, bil: 1, bill: 1, eda: 1, fyrir: 1, ekki: 1 };
    var words = q.split(/\s+/).filter(function (w) { return w.length > 1 && vocab[w] && !STOP[w] && !/^\d+$/.test(w); });
    if (words.length) f.text = words.join(' ');

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
    if (f.deal) said.push('gott verð');
    if (f.text) said.push('„' + f.text + '“');
    if (f.sort && f.sort !== 'deal') said.push({ priceAsc: 'ódýrast fyrst', kmAsc: 'minnst ekinn fyrst', yearDesc: 'nýjast fyrst' }[f.sort]);
    return { f: f, said: said };
  }
  function uniq(a) { var s = {}; return a.filter(function (x) { return s[x] ? false : (s[x] = 1); }); }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // ---------- síur ----------
  var F = ['fMake', 'fModel', 'fPriceMin', 'fPriceMax', 'fYearMin', 'fYearMax', 'fKmMax', 'fFuel', 'fTrans', 'fBody', 'fDealer', 'fSeller', 'fText', 'fAwd', 'fDeal', 'fSort'];
  function readFilters() {
    var v = function (id) { return $(id).value; };
    var n = function (id) { var x = parseFloat(v(id)); return isNaN(x) ? null : x; };
    return {
      make: v('fMake'), model: v('fModel'), priceMin: n('fPriceMin'), priceMax: n('fPriceMax'), yearMin: n('fYearMin'),
      yearMax: n('fYearMax'), kmMax: n('fKmMax'), fuel: v('fFuel'), trans: v('fTrans'), body: v('fBody'),
      dealer: v('fDealer'), seller: v('fSeller'), text: fold(v('fText')).trim(), awd: $('fAwd').checked, deal: $('fDeal').checked, sort: v('fSort')
    };
  }
  function setFilters(f) {
    $('fMake').value = f.make || ''; fillModels();
    $('fModel').value = f.model || '';
    $('fPriceMin').value = f.priceMin ? +(f.priceMin / 1e6).toFixed(2) : '';
    $('fPriceMax').value = f.priceMax ? +(f.priceMax / 1e6).toFixed(2) : '';
    $('fYearMin').value = f.yearMin || ''; $('fYearMax').value = f.yearMax || '';
    $('fKmMax').value = f.kmMax || ''; $('fFuel').value = f.fuel || ''; $('fTrans').value = f.trans || '';
    $('fBody').value = f.body || ''; $('fDealer').value = f.dealer || ''; setSeller(f.seller || ''); $('fText').value = f.text || '';
    $('fAwd').checked = !!f.awd; $('fDeal').checked = !!f.deal; $('fSort').value = f.sort || 'deal';
  }
  function filtered(f0) {
    var f = f0 || readFilters(), words = f.text ? f.text.split(/\s+/) : [];
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
      if (f.deal && !(c.peers >= 2 && c.dev <= -0.12 && c.dev > -0.5)) return false;
      for (var i = 0; i < words.length; i++) if (c.ftitle.indexOf(words[i]) < 0) return false;
      return true;
    });
    var by = {
      deal: function (a, b) { return (a.peers < 2 || a.dev <= -0.5) - (b.peers < 2 || b.dev <= -0.5) || a.dev - b.dev; },
      priceAsc: function (a, b) { return a.price - b.price; },
      priceDesc: function (a, b) { return b.price - a.price; },
      kmAsc: function (a, b) { return (a.km || 0) - (b.km || 0); },
      yearDesc: function (a, b) { return (b.year || 0) - (a.year || 0) || a.price - b.price; }
    }[f.sort] || null;
    if (by) out.sort(by);
    return out;
  }

  // ---------- birting ----------
  function img(c) { return c.img && c.img.indexOf('/__thumb') < 0 ? c.img : ''; }
  function card(c) {
    var v = verdict(c), on = compare.indexOf(c.id) >= 0;
    return '<article class="car" data-id="' + esc(c.id) + '">' +
      '<div class="ph" style="' + (img(c) ? "background-image:url('" + esc(img(c)) + "')" : '') + '">' +
      '<span class="dealer">' + esc(c.dealer) + '</span>' +
      '<button type="button" class="cmp' + (on ? ' on' : '') + '" data-cmp="' + esc(c.id) + '">' + (on ? '✓ Í samanburði' : '+ Bera saman') + '</button>' +
      saveBtn(c.id) + '</div>' +
      '<div class="body"><h3>' + esc(cap(c.make) + ' ' + cap(c.model)) + '</h3>' +
      '<div class="meta">' + (c.perf.t ? '<span class="perf">' + (c.perf.t === 2 ? '🏁 ' : '⚡ ') + esc(c.perf.label) + '</span> ' : '') + (c.year || '–') + ' · ' + kmFmt(c.km) + ' · ' + esc(c.fcat) + (c.auto === true ? ' · ssk.' : c.auto === false ? ' · bsk.' : '') + '</div>' +
      '<div class="row"><span class="price">' + kr(c.price) + (c.oldPrice && c.oldPrice > c.price ? '<span class="old">' + kr(c.oldPrice) + '</span>' : '') + '</span>' +
      '<span class="badge ' + v.cls + '">' + v.txt + '</span></div></div></article>';
  }
  function isSaved(id) { return !!(window.Acct && Acct.isSaved(id)); }
  function saveBtn(id) {
    return '<button type="button" class="save' + (isSaved(id) ? ' on' : '') + '" data-save="' + esc(id) + '" aria-label="Vista bíl" title="Vista bíl">' +
      (isSaved(id) ? '♥' : '♡') + '</button>';
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
    renderPickers();
    $('count').textContent = list.length.toLocaleString('de-DE') + ' bílar';
    $('results').innerHTML = list.length ? list.slice(0, shown).map(card).join('') :
      '<div class="empty">Engir bílar fundust. Prófaðu að víkka leitina eða smelltu á „Hreinsa allt“.</div>';
    $('more').hidden = list.length <= shown;
    renderTray();
  }
  function renderTray() {
    $('tray').hidden = !compare.length;
    $('trayText').textContent = compare.length + ' í samanburði';
    $('trayOpen').disabled = compare.length < 2;
  }
  function byId(id) { for (var i = 0; i < cars.length; i++) if (cars[i].id === id) return cars[i]; return null; }
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
    if (d.showModal) { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
    d.scrollTop = 0;
  }
  function closeModal() { var d = $('modal'); if (d.close) d.close(); else d.removeAttribute('open'); }

  function describe(c) {
    return cap(c.make) + ' ' + cap(c.model) + ', árg. ' + (c.year || '?') + ', ' + kmFmt(c.km) + ', ' + c.fcat +
      (c.auto === true ? ', sjálfskiptur' : c.auto === false ? ', beinskiptur' : '') + (c.awd ? ', fjórhjóladrif' : '') +
      ', verð ' + kr(c.price) + ' hjá ' + c.dealer + ' (' + c.url + ')';
  }
  function claudeLink(prompt) { return 'https://claude.ai/new?q=' + encodeURIComponent(prompt.slice(0, 6000)); }

  function showCar(c) {
    var v = verdict(c), sim = similar(c, 8), b = model.beta;
    var kmEff = (1 - Math.exp(b[1])) * 100, yrEff = (1 - Math.exp(b[0])) * 100;
    var rows = sim.map(function (o) {
      return '<tr class="click" data-open="' + esc(o.id) + '"><td>' + esc(cap(o.model)) + '<br><span class="note">' + esc(o.dealer) + '</span></td>' +
        '<td class="num">' + (o.year || '–') + '</td><td class="num">' + kmFmt(o.km) + '</td><td>' + esc(o.fcat) + '</td>' +
        '<td class="num">' + kr(o.price) + '</td><td class="num"><b>' + kr(adjusted(o, c)) + '</b></td></tr>';
    }).join('');
    var prompt = 'Ég er að íhuga að kaupa notaðan bíl á Íslandi:\n' + describe(c) +
      '\n\nVerðmat út frá sambærilegum auglýsingum: ' + kr(c.est) + ' (' + pct(c.dev) + ' frá mati, ' + c.peers + ' sambærilegir).' +
      (sim.length ? '\n\nSambærilegir bílar til sölu núna:\n' + sim.map(function (o) { return '- ' + describe(o); }).join('\n') : '') +
      '\n\nEr þetta gott verð miðað við akstur og aldur? Hvað ætti ég að skoða sérstaklega á þessari tegund/árgerð (algengir gallar, viðhald), ' +
      'og hvaða spurningar ætti ég að spyrja seljandann? Svaraðu á íslensku.';
    openModal('<div class="m"><div class="m-head"><h2 class="with-logo">' + monoHtml(c.make, true) + esc(cap(c.make) + ' ' + cap(c.model)) + '</h2><button class="x" data-close aria-label="Loka">×</button></div>' +
      '<div class="m-top"><div>' + (img(c) ? '<img src="' + esc(img(c)) + '" alt="">' : '') + '</div><div>' +
      '<dl class="facts"><dt>Verð</dt><dd><b>' + kr(c.price) + '</b>' + (c.oldPrice && c.oldPrice > c.price ? ' <span class="old">' + kr(c.oldPrice) + '</span>' : '') + '</dd>' +
      '<dt>Árgerð</dt><dd>' + (c.year || '–') + '</dd><dt>Ekinn</dt><dd>' + kmFmt(c.km) + (c.age > 0 && c.km ? ' (≈' + Math.round(c.km / c.age).toLocaleString('de-DE') + ' km/ári)' : '') + '</dd>' +
      (c.perf.t ? '<dt>Útgáfa</dt><dd><span class="perf">' + (c.perf.t === 2 ? '🏁 ' : '⚡ ') + esc(c.perf.label) + '</span></dd>' : '') +
      '<dt>Eldsneyti</dt><dd>' + esc(c.fcat) + '</dd><dt>Skipting</dt><dd>' + (c.auto === true ? 'Sjálfskipting' : c.auto === false ? 'Beinskipting' : 'Óþekkt') + '</dd>' +
      (c.awd ? '<dt>Drif</dt><dd>Fjórhjóladrif</dd>' : '') + (c.color ? '<dt>Litur</dt><dd>' + esc(c.color) + '</dd>' : '') +
      '<dt>Bílasala</dt><dd>' + esc(c.dealer) + '</dd></dl>' +
      '<div class="est"><div>Áætlað markaðsverð</div><div class="big">' + kr(c.est) + '</div>' +
      '<div><span class="badge ' + v.cls + '">' + v.txt + '</span> ' +
      (c.peers >= 2 && c.dev <= -0.5 ? '<b>Verðið er meira en helmingi undir sambærilegum bílum.</b> Það getur verið innsláttarvilla, tjónabíll, bíll til niðurrifs eða jafnvel svindl. Lestu auglýsinguna vel og borgaðu aldrei fyrirfram. ' : '') +
      (c.peers < 2 ? 'Fáar sambærilegar auglýsingar, svo matið byggir að hluta á tegundinni í heild.' :
        'Byggt á ' + c.peers + ' öðrum ' + esc(cap(c.make) + ' ' + cap(c.base)) + ', leiðrétt fyrir aldri, akstri, eldsneyti' + (c.perf.t ? ', útgáfu' : '') + (c.pwRaw != null ? ', vélarstærð' : '') + '.') +
      (c.perf.t ? ' <br><span class="note">' + esc(c.perf.label) + ' er ' + (c.perf.t === 2 ? 'toppútgáfa' : 'sportútgáfa') + ': á markaðnum kosta slíkar útgáfur að jafnaði ~' +
        Math.round((Math.exp(model.beta[c.perf.t === 2 ? 7 : 6]) - 1) * 100) + '% meira en venjulega útgáfan. ' +
        (c.tierPeers ? c.tierPeers + ' aðrir ' + esc(cap(c.base)) + ' í sömu útgáfu eru á skrá.' : 'Enginn annar ' + esc(cap(c.base)) + ' í sömu útgáfu er á skrá, svo matið er óvissara.') + '</span>' : '') +
      '</div></div>' +
      '<div class="actions"><a class="primary" href="' + esc(c.url) + '" target="_blank" rel="noopener">Opna auglýsingu hjá ' + esc(c.dealer) + '</a>' +
      '<button type="button" class="sec" data-cmp="' + esc(c.id) + '">' + (compare.indexOf(c.id) >= 0 ? '✓ Í samanburði' : '+ Bera saman') + '</button>' +
      '<button type="button" class="sec" data-save="' + esc(c.id) + '">' + (isSaved(c.id) ? '♥ Vistaður' : '♡ Vista bíl') + '</button>' +
      '<a class="sec" href="' + claudeLink(prompt) + '" target="_blank" rel="noopener">Spyrja Claude um bílinn</a></div></div></div>' +
      (sim.length ? '<h4>Sambærilegir bílar</h4><p class="note">„Leiðrétt verð“ er hvað hinn bíllinn myndi kosta ef hann væri jafn gamall og jafn mikið ekinn og þessi. ' +
        'Á markaðnum lækkar verð að jafnaði um ~' + kmEff.toFixed(1) + '% fyrir hverja 10.000 km og ~' + yrEff.toFixed(0) + '% á ári.</p>' +
        '<div class="tbl-wrap"><table><thead><tr><th>Gerð</th><th class="num">Árg.</th><th class="num">Ekinn</th><th>Eldsn.</th><th class="num">Verð</th><th class="num">Leiðrétt verð</th></tr></thead><tbody>' +
        rows + '</tbody></table></div>' : '') +
      '<p class="note" style="margin-top:14px">Claude-hnappurinn opnar þinn eigin Claude-aðgang með upplýsingunum tilbúnum. Það kostar ekkert hér.</p></div>');
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
    $('pickModelText').textContent = md ? cap(md) : (mk ? 'Allar gerðir' : 'Veldu tegund fyrst');
    $('pickMake').classList.toggle('set', !!mk);
    $('pickModel').classList.toggle('set', !!md);
    var chips = $('modelChips');
    if (!mk) { chips.hidden = true; chips.innerHTML = ''; return; }
    var models = groupBy(function (c) { return c.base; }, ['model']).sort(function (a, b) { return b.n - a.n; });
    var total = models.reduce(function (s, x) { return s + x.n; }, 0);
    chips.hidden = false;
    chips.innerHTML = '<button type="button" class="chip' + (md ? '' : ' on') + '" data-chip="">' + monoHtml(mk) + 'Allar ' + esc(cap(mk)) + '<b>' + total + '</b></button>' +
      models.map(function (x) {
        return '<button type="button" class="chip' + (x.key === md ? ' on' : '') + '" data-chip="' + esc(x.key) + '">' + esc(cap(x.key)) + '<b>' + x.n + '</b></button>';
      }).join('');
  }
  function chooseMake(mk, thenModel) {
    $('fMake').value = mk; fillModels(); $('fModel').value = '';
    render();
    if (thenModel && mk) openModelPicker(); else closeModal();
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
    var models = groupBy(function (c) { return c.base; }, ['model']).sort(function (a, b) { return b.n - a.n; });
    var lo = Math.min.apply(null, models.map(function (x) { return x.min; })), hi = Math.max.apply(null, models.map(function (x) { return x.max; }));
    var span = Math.log(hi) - Math.log(lo) || 1;
    function pos(v) { return ((Math.log(v) - Math.log(lo)) / span * 100).toFixed(1); }
    openModal('<div class="m picker"><div class="m-head"><div class="pk-title">' + monoHtml(mk, true) + '<div><h2>' + esc(cap(mk)) + '</h2>' +
      '<span class="note">' + models.length + ' gerðir · ' + models.reduce(function (s, x) { return s + x.n; }, 0) + ' bílar</span></div></div>' +
      '<button class="x" data-close aria-label="Loka">×</button></div>' +
      '<div class="pk-bar"><input id="pickSearch" class="pk-search" type="search" placeholder="Leita að gerð…" autocomplete="off">' +
      '<button type="button" class="link" id="pkChangeMake">Skipta um tegund</button></div>' +
      '<button type="button" class="pk-all' + (cur ? '' : ' on') + '" data-pick-model="" data-name="allar">Allar gerðir</button>' +
      '<div class="pk-section"><div class="pk-models">' + models.map(function (x) {
        return '<button type="button" class="pk-model' + (x.key === cur ? ' on' : '') + '" data-pick-model="' + esc(x.key) + '" data-name="' + esc(fold(x.key)) + '">' +
          '<span class="pm-top"><span class="pm-name">' + esc(cap(x.key)) + '</span><span class="pm-n">' + x.n + '</span></span>' +
          '<span class="pm-meta">' + (x.ymax ? (x.ymin === x.ymax ? x.ymin : x.ymin + '–' + x.ymax) : '') + (x.ev ? ' · ⚡ ' + Math.round(x.ev / x.n * 100) + '%' : '') + '</span>' +
          '<span class="pm-range" title="Verðbil"><span style="left:' + pos(x.min) + '%;right:' + (100 - pos(x.max)) + '%"></span><i style="left:' + pos(x.med) + '%"></i></span>' +
          '<span class="pm-price">' + (x.min === x.max ? mkrShort(x.min) : mkrShort(x.min) + '–' + mkrShort(x.max)) + ' m.kr. <small>miðgildi ' + mkrShort(x.med) + '</small></span></button>';
      }).join('') + '</div></div></div>', 'sheet');
    $('pkChangeMake').addEventListener('click', function () { openMakePicker(true); });
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
    sel.innerHTML = '<option value="">Allar</option>' + Object.keys(cnt).sort().map(function (b) {
      return '<option value="' + esc(b) + '">' + esc(cap(b)) + ' (' + cnt[b] + ')</option>';
    }).join('');
    sel.value = cnt[cur] ? cur : '';
  }

  function bind() {
    $('searchForm').addEventListener('submit', function (e) { e.preventDefault(); $('q').blur(); runSearch($('q').value); });
    $('examples').addEventListener('click', function (e) {
      if (e.target.tagName !== 'BUTTON') return;
      $('q').value = e.target.textContent; runSearch(e.target.textContent);
    });
    F.forEach(function (id) {
      $(id).addEventListener(/fText|fPrice|fYear|fKm/.test(id) ? 'input' : 'change', function () {
        if (id === 'fMake') fillModels();
        render();
      });
    });
    $('reset').addEventListener('click', function () { $('q').value = ''; $('understood').hidden = true; setFilters({}); render(); });
    $('filtersToggle').addEventListener('click', function () {
      var open = $('filters').classList.toggle('open');
      this.setAttribute('aria-expanded', open);
    });
    $('more').addEventListener('click', function () { shown += PAGE; render(true); });
    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-save],[data-cmp],[data-open],[data-close],.car') : null;
      if (!t) return;
      if (t.hasAttribute('data-save')) {
        e.stopPropagation();
        if (window.Acct) Acct.toggleSave(t.getAttribute('data-save'));
      } else if (t.hasAttribute('data-cmp')) {
        e.stopPropagation(); toggleCompare(t.getAttribute('data-cmp'));
        var on = compare.indexOf(t.getAttribute('data-cmp')) >= 0;
        document.querySelectorAll('[data-cmp="' + t.getAttribute('data-cmp') + '"]').forEach(function (b) {
          b.classList.toggle('on', on); b.textContent = on ? '✓ Í samanburði' : '+ Bera saman';
        });
        renderTray();
      } else if (t.hasAttribute('data-close')) closeModal();
      else if (t.hasAttribute('data-open')) { e.preventDefault(); var c = byId(t.getAttribute('data-open')); if (c) showCar(c); }
      else if (t.classList.contains('car')) { var c2 = byId(t.getAttribute('data-id')); if (c2) showCar(c2); }
    });
    $('modal').addEventListener('click', function (e) { if (e.target === this) closeModal(); });
    $('trayOpen').addEventListener('click', showCompare);
    $('pickMake').addEventListener('click', openMakePicker);
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
    Promise.all([get(GITHUB_DATA), get('data/cars.json?t=' + Date.now())]).then(function (res) {
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
      model = fit(cars);
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
      $('updated').textContent = 'Uppfært ' + u.toLocaleDateString('is-IS', { day: 'numeric', month: 'long' }) + ' kl. ' +
        ('0' + u.getHours()).slice(-2) + ':' + ('0' + u.getMinutes()).slice(-2);
      $('sources').textContent = 'Heimildir: ' + Object.keys(d.sources).map(function (k) { return k + ' (' + d.sources[k] + ')'; }).join(' · ');
      var q = new URLSearchParams(location.search).get('q');
      if (q) { $('q').value = q; runSearch(q); } else render();
      if (window.Acct) Acct.dataReady();
    }).catch(function (e) {
      $('count').textContent = 'Tókst ekki að sækja gögn.';
      console.error(e);
    });
  }


  function refreshSaved() {
    document.querySelectorAll('[data-save]').forEach(function (b) {
      var on = isSaved(b.getAttribute('data-save'));
      b.classList.toggle('on', on);
      b.textContent = b.classList.contains('sec') ? (on ? '♥ Vistaður' : '♡ Vista bíl') : (on ? '♥' : '♡');
    });
  }

  // aðgangur að gögnum og birtingu fyrir account.js
  window.App = {
    cars: function () { return cars; }, byId: byId, filtered: filtered, readFilters: readFilters, setFilters: setFilters,
    render: render, refreshSaved: refreshSaved, openModal: openModal, closeModal: closeModal, showCar: showCar,
    query: function () { return $('q').value; }, setQuery: function (t) { $('q').value = t || ''; $('understood').hidden = true; },
    esc: esc, kr: kr, kmFmt: kmFmt, cap: cap, img: img
  };
  bind();
  load();
})();
