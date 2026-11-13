#!/usr/bin/env node
/* Býr til síðu fyrir hverja gerð (public/verd/<tegund>/<gerð>/) með verði, verðþróun, endingu og þekktum veikleikum,
   ásamt yfirlitssíðum og sitemap.xml, svo leitarvélar finni „Land Cruiser verð“ o.s.frv.
   Keyrt í deploy.sh. Nýjustu gögnin eru sótt af GitHub (næturkeyrslan), annars notuð gögnin í public/data. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const M = require('./public/models.js');

const SITE = 'https://bilaleit.web.app';
const RAW = 'https://raw.githubusercontent.com/isaklehmann33-creator/bilaleit/main/public/data/';
const PUB = path.join(__dirname, 'public');
const OUT = path.join(PUB, 'verd');

// faults.js er skrifað fyrir vafra (window.Faults); keyrt hér í sandkassa
const sandbox = { window: {}, ic: () => '' };
vm.runInNewContext(fs.readFileSync(path.join(PUB, 'faults.js'), 'utf8'), sandbox);
const FAULTS = sandbox.window.Faults.list;

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kr = (n) => Math.round(n).toLocaleString('de-DE') + ' kr.';
const km = (n) => n == null ? '–' : Math.round(n).toLocaleString('de-DE') + ' km';
const name = (mk, b) => M.cap(mk) + ' ' + M.cap(b);

async function data(file) {
  try {
    const r = await fetch(RAW + file + '?t=' + Date.now());
    if (r.ok) {
      const remote = await r.json(), local = JSON.parse(fs.readFileSync(path.join(PUB, 'data', file), 'utf8'));
      return (remote.updated || "") > (local.updated || "") ? remote : local;
    }
  } catch (e) { /* netlaust: nota staðbundin gögn */ }
  return JSON.parse(fs.readFileSync(path.join(PUB, 'data', file), 'utf8'));
}

function page({ title, desc, canon, crumbs, body, ld }) {
  return `<!doctype html>
<html lang="is">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}${canon}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE}${canon}">
<meta property="og:type" content="website">
<meta name="theme-color" content="#0b0f0e">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/fonts/fonts.css">
<link rel="stylesheet" href="/page.css">
<script>try { var t = localStorage.getItem('theme'); if (t) document.documentElement.setAttribute('data-theme', t); } catch (e) {}</script>
${ld ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body>
<header class="top"><div class="wrap"><a class="brand" href="/"><img src="/icon.svg" alt=""><span>Bílaleit</span></a>
<a class="cta" href="/">Leita að bíl</a></div></header>
<main class="wrap">
<nav class="crumbs" aria-label="Brauðmolar">${crumbs.map((c, i) => i < crumbs.length - 1 ? `<a href="${c[1]}">${esc(c[0])}</a>` : `<span>${esc(c[0])}</span>`).join('<i>/</i>')}</nav>
${body}
</main>
<footer class="wrap foot"><p>Gögn frá bílasölum landsins og bland.is, uppfærð daglega. Ending og fjöldi úr ökutækjaskrá Samgöngustofu.
Verðmat og ending eru áætlanir, ekki ráðgjöf. <a href="/verd/">Allar gerðir</a> · <a href="/personuvernd.html">Persónuvernd og skilmálar</a></p></footer>
</body>
</html>
`;
}

function faultsFor(mk, b) {
  const out = [];
  FAULTS.forEach((e) => {
    if (e.mk !== mk || !e.b.test(b)) return;
    const when = [e.f, e.y ? `árg. ${e.y[0]}–${e.y[1]}` : ''].filter(Boolean).join(', ');
    e.t.forEach((t) => { if (!out.some((x) => x.t === t)) out.push({ t, when }); });
  });
  return out;
}

function modelPage(mk, b, list, ads, reg, hr) {
  const n = list.length, prices = list.map((c) => c.price);
  const med = M.median(prices), lo = Math.min(...prices), hi = Math.max(...prices);
  const kmMed = M.median(list.filter((c) => c.km != null).map((c) => c.km));
  const nm = name(mk, b), url = `/verd/${M.slug(mk)}/${M.slug(b)}/`;
  const years = {};
  list.forEach((c) => { if (c.year) (years[c.year] = years[c.year] || []).push(c); });
  const yrs = Object.keys(years).sort((a, b2) => b2 - a).slice(0, 18);
  const yMin = Math.min(...Object.keys(years).map(Number)), yMax = Math.max(...Object.keys(years).map(Number));
  const svg = M.trendSvg(M.trend(ads), 3);
  const st = M.saleStats(ads, hr.start, hr.today);
  const midYear = M.median(list.filter((c) => c.year).map((c) => c.year)) || 2010;
  const sv = M.survival(reg, mk, b, Math.round(midYear));
  let inTraffic = 0;
  const rm = reg.makes && reg.makes[mk];
  if (rm) Object.keys(rm).forEach((u) => { if (M.baseModel(u, mk) === b) inTraffic += rm[u][0]; });
  const faults = faultsFor(mk, b);
  const cheapest = list.slice().sort((a, b2) => a.price - b2.price).slice(0, 24);
  const desc = n ? `${n} ${nm} á sölu á Íslandi núna. Miðgildi verðs ${M.mkr(med)}, frá ${kr(lo)}. Verð eftir árgerð, verðþróun, ending og algengir veikleikar.`
    : `${nm}: verðsaga, ending og algengir veikleikar á Íslandi.`;
  const search = `/?t=${encodeURIComponent(mk)}&g=${encodeURIComponent(b)}`;

  let body = `<section class="hero"><h1>${esc(nm)} <span>verð á Íslandi</span></h1>
<p class="lead">${n ? `Núna eru <b>${n}</b> ${esc(nm)} til sölu hjá bílasölum og á bland.is. Dæmigert ásett verð er <b>${esc(M.mkr(med))}</b>, frá ${esc(kr(lo))} upp í ${esc(kr(hi))}` : `Enginn ${esc(nm)} er til sölu núna.`}
${inTraffic ? ` Í umferð á Íslandi eru ${inTraffic.toLocaleString('de-DE')} bílar af þessari gerð.` : ''}</p>
<div class="stats">
${n ? `<div><b>${n}</b><span>á sölu</span></div><div><b>${esc(M.mkr(med))}</b><span>miðgildi verðs</span></div>` : ''}
${kmMed != null ? `<div><b>${esc(km(kmMed))}</b><span>miðgildi aksturs</span></div>` : ''}
${n ? `<div><b>${yMin === yMax ? yMin : yMin + '–' + yMax}</b><span>árgerðir á sölu</span></div>` : ''}
${inTraffic ? `<div><b>${inTraffic.toLocaleString('de-DE')}</b><span>í umferð</span></div>` : ''}
</div>
<a class="btn" href="${esc(search)}">Skoða alla ${esc(nm)} og verðmat hvers bíls</a></section>`;

  if (yrs.length) {
    body += `<section><h2>Verð eftir árgerð</h2><div class="tbl"><table><thead><tr><th>Árgerð</th><th class="num">Á sölu</th><th class="num">Miðgildi verðs</th><th class="num">Miðgildi aksturs</th></tr></thead><tbody>
${yrs.map((y) => { const cs = years[y], k = M.median(cs.filter((c) => c.km != null).map((c) => c.km)); return `<tr><td>${y}</td><td class="num">${cs.length}</td><td class="num">${esc(kr(M.median(cs.map((c) => c.price))))}</td><td class="num">${esc(km(k))}</td></tr>`; }).join('\n')}
</tbody></table></div></section>`;
  }

  body += `<section><h2>Verðþróun</h2>${svg ? svg + '<p class="note">Miðgildi ásetts verðs allra auglýsinga sem voru á skrá í hverjum mánuði.</p>'
    : `<p class="note">Verðsaga hefur verið skráð frá ${esc(dayIs(hr.start))}. Línuritið birtist þegar a.m.k. tveir mánuðir eru komnir.</p>`}
${st.n >= 8 ? `<p>Auglýsingar fyrir ${esc(nm)} eru að jafnaði <b>${Math.round(st.days)} daga</b> á skrá${st.drop14 != null && st.obs >= 8 ? ` og ${Math.round(st.drop14 * 100)}% þeirra lækka verð innan tveggja vikna` : ''}.</p>` : ''}</section>`;

  if (sv) {
    const span = sv.c + '–' + String(sv.c + 4).slice(2), pc = (x) => Math.round(x * 100) + '%';
    body += `<section><h2>Ending á Íslandi</h2>
<p><b>${pc(sv.p)}</b> af ${esc(nm)} sem komu nýir til landsins ${span} eru enn á skrá, en <b>${pc(sv.avg)}</b> allra fólksbíla sömu árgerða. ${esc(sv.label)}.</p>
<div class="bars ${sv.cls}"><div><span>${esc(nm)}</span><i><em style="width:${pc(sv.p)}"></em></i><b>${pc(sv.p)}</b></div><div class="avg"><span>Allir fólksbílar</span><i><em style="width:${pc(sv.avg)}"></em></i><b>${pc(sv.avg)}</b></div></div>
<p class="note">Úr ökutækjaskrá Samgöngustofu (${sv.n.toLocaleString('de-DE')} bílar). Ódýrum smábílum er fargað fyrr af því viðgerð borgar sig síður, svo berðu helst saman við svipaða bíla.</p></section>`;
  }

  if (faults.length) {
    body += `<section><h2>Gott að athuga við kaup á ${esc(nm)}</h2><ul class="faults">
${faults.map((f) => `<li>${esc(f.t)}${f.when ? ` <span class="note">(${esc(f.when)})</span>` : ''}</li>`).join('\n')}
</ul><p class="note">Þekktir veikleikar gerðarinnar, ekki greining á tilteknum bíl. Ástandsskoðun á verkstæði fyrir kaup tekur af allan vafa.</p></section>`;
  }

  if (cheapest.length) {
    body += `<section><h2>${esc(nm)} til sölu</h2><div class="cars">
${cheapest.map((c) => `<a class="car" href="/#bill=${encodeURIComponent(c.id)}">${c.img ? `<img src="${esc(c.img)}" alt="${esc(name(c.make, c.model))}" loading="lazy">` : '<div class="noimg"></div>'}
<div><b>${esc(name(c.make, c.model))}</b><span>${[c.year, c.km != null ? km(c.km) : '', c.dealer].filter(Boolean).map(esc).join(' · ')}</span><strong>${esc(kr(c.price))}</strong></div></a>`).join('\n')}
</div>${n > cheapest.length ? `<p><a class="btn ghost" href="${esc(search)}">Sjá alla ${n}</a></p>` : ''}</section>`;
  }

  const ld = [{
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Verð', item: SITE + '/verd/' },
      { '@type': 'ListItem', position: 2, name: M.cap(mk), item: `${SITE}/verd/${M.slug(mk)}/` },
      { '@type': 'ListItem', position: 3, name: nm, item: SITE + url }]
  }];
  if (n) ld.push({ '@context': 'https://schema.org', '@type': 'Product', name: nm, brand: { '@type': 'Brand', name: M.cap(mk) },
    offers: { '@type': 'AggregateOffer', priceCurrency: 'ISK', lowPrice: lo, highPrice: hi, offerCount: n } });
  return { url, n, html: page({ title: `${nm} – verð á notuðum bílum á Íslandi | Bílaleit`, desc, canon: url, ld,
    crumbs: [['Bílaleit', '/'], ['Verð', '/verd/'], [M.cap(mk), `/verd/${M.slug(mk)}/`], [M.cap(b), url]], body }) };
}

const MON = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember'];
function dayIs(s) { return s ? `${+s.slice(6, 8)}. ${MON[+s.slice(4, 6) - 1]} ${s.slice(0, 4)}` : ''; }

(async () => {
  const [carsD, histD, reg] = await Promise.all([data('cars.json'), data('history.json'), data('registry.json')]);
  const cars = carsD.cars.filter((c) => c.price > 0);
  cars.forEach((c) => { c.base = M.baseModel(c.model, c.make); });
  const ads = Object.keys(histD.ads).map((id) => { const a = histD.ads[id]; a.id = id; a.base = M.baseModel(a.o, a.m); return a; });
  const hr = { start: null, today: null };
  ads.forEach((a) => { if (!hr.start || a.f < hr.start) hr.start = a.f; if (!hr.today || a.l > hr.today) hr.today = a.l; });

  const groups = {};
  const key = (mk, b) => mk + '|' + b;
  cars.forEach((c) => { if (c.base && c.base !== '?') (groups[key(c.make, c.base)] = groups[key(c.make, c.base)] || { mk: c.make, b: c.base, cars: [], ads: [] }).cars.push(c); });
  ads.forEach((a) => { const g = groups[key(a.m, a.base)]; if (g) g.ads.push(a); });

  fs.rmSync(OUT, { recursive: true, force: true });
  const pages = [], byMake = {};
  Object.values(groups).filter((g) => g.cars.length >= 3 && M.slug(g.b)).forEach((g) => {
    const p = modelPage(g.mk, g.b, g.cars, g.ads, reg, hr);
    const dir = path.join(PUB, p.url);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), p.html);
    pages.push(p.url);
    (byMake[g.mk] = byMake[g.mk] || []).push({ b: g.b, n: g.cars.length, url: p.url, med: M.median(g.cars.map((c) => c.price)) });
  });

  // tegundasíður og yfirlit
  const makes = Object.keys(byMake).sort();
  makes.forEach((mk) => {
    const ms = byMake[mk].sort((a, b) => b.n - a.n), url = `/verd/${M.slug(mk)}/`, total = ms.reduce((s, x) => s + x.n, 0);
    const body = `<section class="hero"><h1>${esc(M.cap(mk))} <span>verð á Íslandi</span></h1>
<p class="lead">${total} notaðir ${esc(M.cap(mk))} til sölu í ${ms.length} gerðum. Veldu gerð til að sjá verð eftir árgerð, verðþróun, endingu og algenga veikleika.</p></section>
<section><div class="models">${ms.map((x) => `<a href="${x.url}"><b>${esc(M.cap(x.b))}</b><span>${x.n} á sölu · miðgildi ${esc(M.mkr(x.med))}</span></a>`).join('\n')}</div></section>`;
    fs.mkdirSync(path.join(PUB, url), { recursive: true });
    fs.writeFileSync(path.join(PUB, url, 'index.html'), page({ title: `${M.cap(mk)} – verð á notuðum bílum á Íslandi | Bílaleit`,
      desc: `${total} notaðir ${M.cap(mk)} til sölu. Verð, verðþróun og ending eftir gerð.`, canon: url,
      crumbs: [['Bílaleit', '/'], ['Verð', '/verd/'], [M.cap(mk), url]], body }));
    pages.push(url);
  });
  const body = `<section class="hero"><h1>Verð á notuðum bílum <span>eftir gerð</span></h1>
<p class="lead">Hvað kostar notaður bíll á Íslandi? Veldu framleiðanda og gerð til að sjá verð eftir árgerð, verðþróun, endingu og algenga veikleika.</p></section>
${makes.map((mk) => `<section class="mk"><h2><a href="/verd/${M.slug(mk)}/">${esc(M.cap(mk))}</a></h2><div class="chips">${byMake[mk].slice(0, 30).map((x) => `<a href="${x.url}">${esc(M.cap(x.b))} <span>${x.n}</span></a>`).join('')}</div></section>`).join('\n')}`;
  fs.writeFileSync(path.join(OUT, 'index.html'), page({ title: 'Verð á notuðum bílum á Íslandi eftir gerð | Bílaleit',
    desc: 'Verð á notuðum bílum á Íslandi eftir framleiðanda og gerð: miðgildi verðs, verð eftir árgerð, verðþróun og ending.', canon: '/verd/',
    crumbs: [['Bílaleit', '/'], ['Verð', '/verd/']], body }));
  pages.unshift('/verd/');

  const today = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(PUB, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    ['/'].concat(pages).map((u) => `<url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod></url>`).join('\n') + '\n</urlset>\n');
  console.log(`Gerðarsíður: ${pages.length} síður (${makes.length} tegundir)`);
})();
