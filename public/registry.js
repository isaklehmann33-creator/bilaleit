/* Bílaleit – ökutækjaskrá Samgöngustofu (Power BI-gagnaveita, með leyfi Samgöngustofu).
   - Registry.stats(make, base): fjöldi í umferð, meðalaldur, hlutfall fluttra inn notaðra (úr data/registry.json, uppfært á nóttunni)
   - Registry.plate('ABC12'): opinberar upplýsingar um ökutæki eftir bílnúmeri, sótt í rauntíma (með skyndiminni)
   Persónuupplýsingar (kennitala eiganda, heimilisfang) eru aldrei sóttar. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var A = window.App;
  var PBI = {
    endpoint: 'https://wabi-europe-north-b-api.analysis.windows.net/public/reports/querydata?synchronous=true',
    key: '9fabaea5-cbe3-4fc1-a430-e86e05d50622', dataset: '7b026c30-f3e3-425e-b7dc-e27eeea9c7cf',
    report: '6016d9d4-3bf9-432c-8c0d-1406af49a04b', model: 6585848,
    table: 'Bifreiðatölur/lykiltölur (Vere_MV_1171)', measures: 'Key Measures - skráningar'
  };
  var PRIVATE = { 'Kennitala eiganda': 1, 'Heimilisfang': 1, 'Póstnúmer': 1, 'Sveitarfélag': 1, 'Tilkynnandi': 1 };
  var USED = { 'Notað': 1, 'Notað gvk.': 1, 'Notað skv. mæli': 1 };
  // innflutningsástand á mannamáli (gvk. = gerðarviðurkenndur)
  function impText(v) {
    if (USED[v]) return 'Fluttur inn notaður';
    if (v === 'Nýtt' || v === 'Nýtt gvk.') return 'Kom nýr til landsins';
    if (v === 'Búslóð') return 'Fluttur inn sem búslóð';
    if (v === 'Innlent') return 'Smíðaður á Íslandi';
    return v || 'Óþekkt';
  }

  // ---------- fyrirspurnasmiður ----------
  function col(name) { return { Column: { Expression: { SourceRef: { Source: 'v' } }, Property: name } }; }
  function lit(v) { return { Literal: { Value: typeof v === 'number' ? v + 'L' : "'" + String(v).replace(/'/g, "''") + "'" } }; }
  var where = {
    eq: function (c, v) { return { Condition: { Comparison: { ComparisonKind: 0, Left: col(c), Right: lit(v) } } }; },
    isin: function (c, vs) { return { Condition: { In: { Expressions: [col(c)], Values: vs.map(function (v) { return [lit(v)]; }) } } }; }
  };
  function build(columns, measures, conds, top) {
    columns.forEach(function (c) { if (PRIVATE[c]) throw new Error('Persónuupplýsingar eru ekki sóttar: ' + c); });
    var sel = columns.map(function (c) { var x = col(c); x.Name = 'v.' + c; return x; })
      .concat((measures || []).map(function (m) { return { Measure: { Expression: { SourceRef: { Source: 'k' } }, Property: m }, Name: 'k.' + m }; }));
    var q = { Version: 2, From: [{ Name: 'v', Entity: PBI.table, Type: 0 }, { Name: 'k', Entity: PBI.measures, Type: 0 }], Select: sel };
    if (conds && conds.length) q.Where = conds;
    return {
      version: '1.0.0',
      queries: [{ Query: { Commands: [{ SemanticQueryDataShapeCommand: { Query: q, Binding: {
        Primary: { Groupings: [{ Projections: sel.map(function (_, i) { return i; }) }] },
        DataReduction: { DataVolume: 4, Primary: { Top: { Count: top || 100 } } }, Version: 1 } } }] },
        QueryId: '', ApplicationContext: { DatasetId: PBI.dataset, Sources: [{ ReportId: PBI.report }] } }],
      cancelQueries: [], modelId: PBI.model
    };
  }

  // ---------- afkóðari: DSR-snið Power BI -> venjulegir hlutir ----------
  // R = bitamaski (dálkur endurtekinn úr fyrri röð), Ø = bitamaski (dálkur tómur), DN = vísir í ValueDicts
  function decode(resp, names) {
    var res = resp && resp.results && resp.results[0] && resp.results[0].result;
    if (!res || !res.data) throw new Error('Óvænt svar frá ökutækjaskrá');
    var ds = res.data.dsr.DS[0], vd = ds.ValueDicts || {}, rows = [], schema = null, prev = null;
    if (ds.Exceptions) throw new Error('Fyrirspurn mistókst');
    ((ds.PH || [{}])[0].DM0 || []).forEach(function (r) {
      if (r.S) schema = r.S;
      if (!schema) return;
      var rep = r.R || 0, nul = r['Ø'] || 0, vals = r.C || [], j = 0, out = {};
      schema.forEach(function (c, i) {
        var v;
        if (rep >> i & 1) v = prev[names[i]];
        else if (nul >> i & 1) v = null;
        else {
          v = vals[j++];
          if (c.DN != null && typeof v === 'number') v = vd[c.DN][v];
          else if (c.T === 7 && typeof v === 'number') v = new Date(v).toISOString().slice(0, 10);
        }
        out[names[i]] = v;
      });
      prev = out; rows.push(out);
    });
    return rows;
  }

  // ---------- fyrirspurn með tímamörkum, endurtilraun og skyndiminni ----------
  function cacheGet(k) { try { var x = JSON.parse(localStorage.getItem('reg:' + k)); return x && x.t > Date.now() - 7 * 864e5 ? x.v : null; } catch (e) { return null; } }
  function cacheSet(k, v) { try { localStorage.setItem('reg:' + k, JSON.stringify({ t: Date.now(), v: v })); } catch (e) {} }
  function query(columns, measures, conds, top, tries) {
    var body = JSON.stringify(build(columns, measures, conds, top)), names = columns.concat(measures || []);
    tries = tries || 2;
    var ctl = window.AbortController ? new AbortController() : null, timer = ctl && setTimeout(function () { ctl.abort(); }, 15000);
    return fetch(PBI.endpoint, { method: 'POST', body: body, signal: ctl && ctl.signal,
      headers: { 'Content-Type': 'application/json;charset=UTF-8', 'X-PowerBI-ResourceKey': PBI.key } })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) { clearTimeout(timer); return decode(j, names); })
      .catch(function (e) {
        clearTimeout(timer);
        if (tries > 1) return new Promise(function (ok) { setTimeout(ok, 1200); }).then(function () { return query(columns, measures, conds, top, tries - 1); });
        throw e;
      });
  }

  // ---------- uppfletting eftir bílnúmeri ----------
  var PLATE_COLS = ['Fastanúmer', 'Tegund', 'Undirtegund', 'Fyrsti skráningardagur', 'Nýskráningardagur', 'Innflutningsástand', 'Hestöfl', 'Slagrými',
    'Orkugjafi', 'Litur', 'Ökutækjaflokkur', 'Umferðaskráning', 'Staða skráningar', 'Ástæða afskráningar', 'Afskráningardagur', 'Útblástur g/km', 'Leyfð heildarþyngd'];
  function cleanPlate(p) { return String(p || '').toUpperCase().replace(/[\s-]/g, ''); }
  function plate(p) {
    p = cleanPlate(p);
    if (!/^[A-ZÁÐÉÍÓÚÝÞÆÖ0-9]{2,6}$/.test(p)) return Promise.reject(new Error('Ógilt bílnúmer'));
    var hit = cacheGet('p:' + p);
    if (hit) return Promise.resolve(hit);
    return query(PLATE_COLS, [], [where.eq('Fastanúmer', p)], 3).then(function (rows) {
      var r = rows[0] || null;
      if (r) cacheSet('p:' + p, r);
      return r;
    });
  }

  // ---------- tölfræði úr næturgögnum ----------
  var REG = null, regP = null;
  function load() {
    if (regP) return regP;
    function get(u) { return fetch(u).then(function (r) { if (!r.ok) throw 0; return r.json(); }).catch(function () { return null; }); }
    regP = Promise.all([get('https://raw.githubusercontent.com/isaklehmann33-creator/bilaleit/main/public/data/registry.json'), get('data/registry.json?t=' + Date.now())])
      .then(function (r) { REG = r[0] && (!r[1] || (r[0].updated || '') >= (r[1].updated || '')) ? r[0] : r[1]; return REG; });
    return regP;
  }
  // gerðir skrárinnar („E 220“, „E220 CDI“) sameinaðar með sömu reglum og leitin (A.baseModel)
  function stats(make, base) {
    if (!REG || !REG.makes || !REG.makes[make]) return null;
    var n = 0, ageSum = 0, ageN = 0, used = 0, ms = REG.makes[make];
    Object.keys(ms).forEach(function (u) {
      if (A.baseModel(u, make) !== base) return;
      var x = ms[u]; n += x[0]; used += x[2] || 0;
      if (x[1] != null) { ageSum += x[1] * x[0]; ageN += x[0]; }
    });
    return n ? { n: n, age: ageN ? ageSum / ageN : null, used: used / n } : null;
  }
  function plateOf(c) { return c.src === 'Brimborg' ? c.id.split('-')[1] : null; }

  // ---------- birting í bílaglugga ----------
  function fmtDate(s) { if (!s) return ''; var d = new Date(s); return A.dateIs(d, true); }
  function renderCar(c) {
    var el = $('carReg'); if (!el) return;
    load().then(function () {
      var st = stats(c.make, c.base), p = plateOf(c), info = p && REG && REG.plates && REG.plates[p], html = '';
      var forSale = A.cars().filter(function (o) { return o.make === c.make && o.base === c.base; }).length;
      if (info) {
        var usedImp = USED[info.imp], abroad = info.first && info.is && info.first < info.is;
        html += '<div class="reg-line ' + (usedImp ? 'warn' : 'ok') + '">' + ic(usedImp ? 'triangle-alert' : 'circle-check') + '<span>' +
          (usedImp ? '<b>Fluttur inn notaður.</b> ' + (abroad ? 'Fyrst skráður erlendis ' + fmtDate(info.first) + ', á Íslandi síðan ' + fmtDate(info.is) + '.' : '') :
            '<b>' + impText(info.imp) + '</b>, fyrst skráður ' + fmtDate(info.first) + '.') +
          ' <span class="note">Úr ökutækjaskrá Samgöngustofu (' + A.esc(p) + ').</span></span></div>';
      }
      if (st) {
        html += '<div class="reg-box"><div class="reg-head">' + ic('flag') + '<b>Á Íslandi</b><span class="note">Ökutækjaskrá Samgöngustofu</span></div><div class="reg-stats">' +
          '<div><b>' + st.n.toLocaleString('de-DE') + '</b><span>' + A.esc(A.cap(c.make) + ' ' + A.cap(c.base)) + ' í umferð</span></div>' +
          (st.age != null ? '<div><b>' + st.age.toFixed(1).replace('.', ',') + ' ár</b><span>meðalaldur</span></div>' : '') +
          '<div><b>' + Math.round(st.used * 100) + '%</b><span>fluttir inn notaðir</span></div>' +
          '<div><b>' + forSale + '</b><span>á sölu núna (' + (forSale / st.n * 100).toFixed(1).replace('.', ',') + '%)</span></div></div>' +
          (st.n < 150 ? '<p class="note">Sjaldgæf gerð á Íslandi, svo fáir eru á sölu hverju sinni.</p>' : '') + '</div>';
      }
      el.innerHTML = html;
    });
  }

  // ---------- „Fletta upp bílnúmeri“ ----------
  function openPlate(pre) {
    A.openModal('<div class="m narrow"><div class="m-head"><h2>Fletta upp bílnúmeri</h2><button class="x" data-close aria-label="Loka">×</button></div>' +
      '<p class="note">Opinberar upplýsingar úr ökutækjaskrá Samgöngustofu: skráning, innflutningur, afl og fleira. Engar upplýsingar um eigendur.</p>' +
      '<form id="plateForm" class="plate-form"><input id="plateIn" class="plate-in" maxlength="8" autocomplete="off" autocapitalize="characters" placeholder="AB123" value="' + A.esc(pre || '') + '">' +
      '<button type="submit" class="btn-cta">' + ic('search') + 'Fletta upp</button></form><div id="plateOut"></div></div>');
    $('plateForm').addEventListener('submit', function (e) { e.preventDefault(); show($('plateIn').value); });
    if (pre) show(pre); else setTimeout(function () { $('plateIn').focus(); }, 50);
  }
  function show(p) {
    var out = $('plateOut');
    out.innerHTML = '<div class="skel-line"></div><div class="skel-line short"></div>';
    plate(p).then(function (r) {
      if (!r) { out.innerHTML = '<p class="err">Ekkert ökutæki fannst með bílnúmerið ' + A.esc(cleanPlate(p)) + '.</p>'; return; }
      var usedImp = USED[r['Innflutningsástand']], gone = r['Staða skráningar'] === 'Afskráð';
      var yr = r['Fyrsti skráningardagur'] ? +r['Fyrsti skráningardagur'].slice(0, 4) : null;
      var make = A.makes().filter(function (m) { return m.replace(/[^A-Z]/g, '') === String(r.Tegund || '').split(',')[0].toUpperCase().replace(/[^A-Z]/g, ''); })[0] || '';
      var base = make ? A.baseModel(r.Undirtegund || '', make) : '';
      function row(k, v) { return v == null || v === '' ? '' : '<div class="spec"><span>' + k + '</span><b>' + A.esc(v) + '</b></div>'; }
      out.innerHTML = '<div class="plate-card"><div class="plate-tag">' + A.esc(r['Fastanúmer']) + '</div><div><h3>' + A.esc(A.cap(r.Tegund || '') + ' ' + A.cap(r.Undirtegund || '')) + '</h3>' +
        '<span class="note">' + A.esc([yr, r.Orkugjafi, r.Litur].filter(Boolean).join(' · ')) + '</span></div></div>' +
        (gone ? '<div class="reg-line warn">' + ic('triangle-alert') + '<span><b>Afskráður</b> ' + A.esc(fmtDate(r['Afskráningardagur'])) + (r['Ástæða afskráningar'] ? ' (' + A.esc(r['Ástæða afskráningar']) + ')' : '') + '.</span></div>' :
          r['Umferðaskráning'] === 'Out' ? '<div class="reg-line warn">' + ic('info') + '<span><b>Úr umferð</b> (númer lögð inn).</span></div>' : '') +
        '<div class="reg-line ' + (usedImp ? 'warn' : 'ok') + '">' + ic(usedImp ? 'triangle-alert' : 'circle-check') + '<span>' +
        (usedImp ? '<b>Fluttur inn notaður.</b> Fyrst skráður ' + A.esc(fmtDate(r['Fyrsti skráningardagur'])) + ', á Íslandi síðan ' + A.esc(fmtDate(r['Nýskráningardagur'])) + '.' :
          '<b>' + A.esc(impText(r['Innflutningsástand'])) + '</b>, fyrst skráður ' + A.esc(fmtDate(r['Fyrsti skráningardagur'])) + '.') + '</span></div>' +
        '<div class="specs">' + row('Hestöfl', r['Hestöfl'] ? Math.round(r['Hestöfl']) + ' hö' : '') + row('Slagrými', r['Slagrými'] ? r['Slagrými'] + ' cc' : '') +
        row('Útblástur', r['Útblástur g/km'] ? r['Útblástur g/km'] + ' g/km' : '') + row('Heildarþyngd', r['Leyfð heildarþyngd'] ? r['Leyfð heildarþyngd'] + ' kg' : '') +
        row('Flokkur', r['Ökutækjaflokkur']) + '</div>' +
        (make && base && yr ? '<div class="actions"><button type="button" class="primary" id="plateValue">' + ic('wallet') + 'Verðmeta þennan bíl</button>' +
          '<button type="button" class="sec" id="plateSearch">' + ic('search') + 'Sjá ' + A.esc(A.cap(make) + ' ' + A.cap(base)) + ' til sölu</button></div>' : '');
      var fuel = /raf\.tengill/i.test(r.Orkugjafi || '') ? 'Tengiltvinn' : /rafmagn/i.test(r.Orkugjafi || '') && !/bens|dís/i.test(r.Orkugjafi || '') ? 'Rafmagn' :
        /bens.*raf|raf.*bens|hybrid/i.test(r.Orkugjafi || '') ? 'Tvinn' : /dís/i.test(r.Orkugjafi || '') ? 'Dísel' : 'Bensín';
      if ($('plateValue')) $('plateValue').addEventListener('click', function () {
        window.Features.openValue({ make: make, model: base, year: yr, fuel: fuel, trans: 'sj', extra: String(r.Undirtegund || '').replace(base, '').trim() });
      });
      if ($('plateSearch')) $('plateSearch').addEventListener('click', function () {
        A.setFilters({ make: make, model: base }); A.closeModal(); A.render(); window.scrollTo(0, 0);
      });
    }).catch(function (e) {
      out.innerHTML = '<p class="err">Ekki náðist samband við ökutækjaskrána (' + A.esc(e.message || 'villa') + '). Reyndu aftur eftir smá stund.</p>';
    });
  }

  load();
  function plateInfo(c) { var p = plateOf(c); return p && REG && REG.plates ? REG.plates[p] || null : null; }
  window.Registry = { plateInfo: plateInfo, query: query, build: build, decode: decode, where: where, plate: plate, stats: stats, load: load, renderCar: renderCar, openPlate: openPlate };
})();
