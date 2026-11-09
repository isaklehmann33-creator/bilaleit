/* Gerðaföll og markaðsgreining sem vafrinn (app.js) og síðusmiðurinn (pages.js, Node) nota bæði,
   svo „E 220“, „E220 CDI“ og „E-KLASSE“ lendi alltaf í sömu gerð. */
(function (root) {
  'use strict';

  function fold(s) {
    return String(s || '').toLowerCase()
      .replace(/[áà]/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i').replace(/[óö]/g, 'o')
      .replace(/ú/g, 'u').replace(/ý/g, 'y').replace(/þ/g, 'th').replace(/ð/g, 'd').replace(/æ/g, 'ae');
  }

  // Hástafir eins og bílaframleiðendur skrifa: skammstafanir og gerðir með tölum (GLE, EQC, X5, ID.4) haldast, annars Sprinter, Kia
  var CAP_EXC = { KIA: 'Kia', RAM: 'Ram', UP: 'up!', NEW: 'New', VAN: 'Van', PHEV: 'PHEV', MHEV: 'MHEV', BEV: 'BEV', HSE: 'HSE', AMG: 'AMG', GTI: 'GTI', TDI: 'TDI', TSI: 'TSI', CDI: 'CDI', GTE: 'GTE', GTX: 'GTX', SUV: 'SUV' };
  function cap(s) {
    return String(s || '').split(/(\s+|-)/).map(function (w) {
      var u = w.toUpperCase();
      if (CAP_EXC[u]) return CAP_EXC[u];
      if (/\d/.test(w) || (u.length <= 3 && /^[A-Z.+]+$/.test(u))) return u;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join('');
  }

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

  function slug(s) { return fold(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  // ---------- markaðsgreining úr sögu auglýsinga (history.json: {f, l, g, p: [[dags, verð]]}) ----------
  function day(s) { return Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)); }
  function days(a, b) { return Math.round((day(b) - day(a)) / 864e5); }
  function median(xs) {
    if (!xs.length) return null;
    var s = xs.slice().sort(function (a, b) { return a - b; }), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function nextMonth(m) { var y = +m.slice(0, 4), mo = +m.slice(4, 6) + 1; if (mo > 12) { y++; mo = 1; } return y + (mo < 10 ? '0' : '') + mo; }

  // Verðþróun: miðgildi ásetts verðs í hverjum mánuði, af öllum auglýsingum sem voru á skrá þann mánuð
  function trend(ads) {
    var by = {};
    ads.forEach(function (a) {
      if (!a.p || !a.p.length) return;
      var end = (a.g || a.l || a.f).slice(0, 6);
      for (var m = a.f.slice(0, 6); m <= end; m = nextMonth(m)) {
        var pr = a.p[0][1];
        a.p.forEach(function (x) { if (x[0].slice(0, 6) <= m) pr = x[1]; });
        (by[m] = by[m] || []).push(pr);
      }
    });
    return Object.keys(by).sort().map(function (m) { return { m: m, med: median(by[m]), n: by[m].length }; });
  }

  // Sölutími og verðlækkanir. Bara auglýsingar sem birtust eftir að sagan hófst (start), annars er upphafið óþekkt.
  function saleStats(ads, start, today) {
    var known = ads.filter(function (a) { return a.f > start && a.p && a.p.length; });
    var gone = known.filter(function (a) { return a.g; });
    var obs = known.filter(function (a) { return a.g || days(a.f, today) >= 14; });
    var dropped14 = obs.filter(function (a) { return a.p.some(function (x) { return x[1] < a.p[0][1] && days(a.f, x[0]) <= 14; }); });
    var cuts = known.filter(function (a) { return a.p.some(function (x) { return x[1] < a.p[0][1]; }); })
      .map(function (a) { return 1 - Math.min.apply(null, a.p.map(function (x) { return x[1]; })) / a.p[0][1]; });
    return {
      n: gone.length, days: median(gone.map(function (a) { return Math.max(1, days(a.f, a.g)); })),
      obs: obs.length, drop14: obs.length ? dropped14.length / obs.length : null, cut: median(cuts)
    };
  }

  // Línurit verðþróunar sem SVG-strengur (notað í bílglugga og á gerðarsíðum). Bara mánuðir með ≥ minN auglýsingum.
  var MON = ['jan', 'feb', 'mar', 'apr', 'maí', 'jún', 'júl', 'ágú', 'sep', 'okt', 'nóv', 'des'];
  function mkr(n) { return (n / 1e6).toFixed(n < 1e7 ? 2 : 1).replace('.', ',') + ' m.kr.'; }
  function trendSvg(series, minN) {
    var pts = series.filter(function (x) { return x.n >= (minN || 3); });
    if (pts.length < 2) return '';
    var W = 600, H = 170, L = 8, R = 8, T = 18, B = 26;
    var lo = Math.min.apply(null, pts.map(function (x) { return x.med; })), hi = Math.max.apply(null, pts.map(function (x) { return x.med; }));
    var pad = Math.max((hi - lo) * 0.25, hi * 0.04); lo -= pad; hi += pad;
    var X = function (i) { return L + (W - L - R) * (pts.length === 1 ? 0.5 : i / (pts.length - 1)); };
    var Y = function (v) { return T + (H - T - B) * (1 - (v - lo) / (hi - lo)); };
    var lab = function (m) { return MON[+m.slice(4, 6) - 1] + (m.slice(4, 6) === '01' || m === pts[0].m ? ' ' + m.slice(2, 4) : ''); };
    var path = pts.map(function (x, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(x.med).toFixed(1); }).join(' ');
    var step = Math.ceil(pts.length / 8);
    return '<svg class="trend" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Verðþróun: miðgildi ásetts verðs eftir mánuðum">' +
      [0.25, 0.5, 0.75].map(function (f) { var y = T + (H - T - B) * f; return '<line class="tg" x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '"/>'; }).join('') +
      '<path class="tl" d="' + path + '"/>' +
      pts.map(function (x, i) {
        return '<g class="tp"><circle cx="' + X(i).toFixed(1) + '" cy="' + Y(x.med).toFixed(1) + '" r="4"/><circle class="hit" cx="' + X(i).toFixed(1) + '" cy="' + Y(x.med).toFixed(1) + '" r="14"/>' +
          '<title>' + lab(x.m) + ': ' + mkr(x.med) + ' (' + x.n + ' augl.)</title></g>' +
          (i % step === 0 || i === pts.length - 1 ? '<text class="tx" x="' + X(i).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="' + (i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle') + '">' + lab(x.m) + '</text>' : '');
      }).join('') +
      '<text class="tv" x="' + X(0).toFixed(1) + '" y="' + (Y(pts[0].med) - 10).toFixed(1) + '">' + mkr(pts[0].med) + '</text>' +
      '<text class="tv" text-anchor="end" x="' + X(pts.length - 1).toFixed(1) + '" y="' + (Y(pts[pts.length - 1].med) - 10).toFixed(1) + '">' + mkr(pts[pts.length - 1].med) + '</text>' +
      '</svg>';
  }

  function survival(REG, make, base, year) {
    var S = REG && REG.surv, ms = S && S.m[make];
    if (!ms) return null;
    var by = {};
    Object.keys(ms).forEach(function (u) {
      if (baseModel(u, make) !== base) return;
      Object.keys(ms[u]).forEach(function (c) { var x = by[c] = by[c] || [0, 0]; x[0] += ms[u][c][0]; x[1] += ms[u][c][1]; });
    });
    var own = Math.min(2010, S.c.filter(function (c) { return c <= (year || 2010); }).pop() || S.c[0]);
    var yc = Math.floor((year || 2010) / 5) * 5;  // vísbending bara úr árgerðum innan 10 ára (nýr Defender ≠ gamall)
    var order = [own].concat(S.c.filter(function (c) { return c !== own && c <= 2010 && Math.abs(c - yc) <= 10; })
      .sort(function (a, b) { return Math.abs(a - own) - Math.abs(b - own); })).filter(function (c) { return Math.abs(c - yc) <= 10; });
    for (var i = 0; i < order.length; i++) {
      var x = by[order[i]], avg = S.avg[order[i]];
      if (!x || x[0] + x[1] < 40 || !avg) continue;
      var p = x[0] / (x[0] + x[1]), pa = avg[0] / (avg[0] + avg[1]), d = p - pa;
      return { c: order[i], own: year >= order[i] && year < order[i] + 5, p: p, avg: pa, n: x[0] + x[1],
        label: d >= 0.1 ? 'Óvenju margir enn á skrá' : d >= 0.03 ? 'Fleiri enn á skrá en almennt' : d > -0.03 ? 'Svipað hlutfall enn á skrá og almennt' :
          d > -0.1 ? 'Færri enn á skrá en almennt' : 'Mun færri enn á skrá en almennt',
        cls: d >= 0.03 ? 'good' : d > -0.1 ? 'mid' : 'bad' };
    }
    return null;
  }

  var M = { survival: survival, trendSvg: trendSvg, mkr: mkr, fold: fold, cap: cap, baseModel: baseModel, slug: slug, trend: trend, saleStats: saleStats, median: median, days: days };
  root.Models = M;
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
})(typeof window !== 'undefined' ? window : globalThis);
