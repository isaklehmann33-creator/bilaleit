/* Bílaleit – aðgangur: innskráning, vistaðir bílar, vistaðar leitir, tilkynningar og stjórnandasíða.
   Gögn hvers notanda eru í einu skjali: users/{uid}. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var A = window.App;
  var auth, db, user = null, doc = null, dataLoaded = false, checked = false, saveTimer = null;
  var MAX_SEARCHES = 10, MAX_NOTES = 100, MAX_SEEN = 4000;

  function isAdmin() { return !!(user && window.ADMIN_UID && user.uid === window.ADMIN_UID); }
  function now() { return Date.now(); }
  function when(t) {
    var d = new Date(t);
    return A.dateIs(d) + ' kl. ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }
  function snap(c) { return { title: A.cap(c.make) + ' ' + A.cap(c.model), price: c.price, year: c.year || null, km: c.km == null ? null : c.km, img: c.img || '', url: c.url, dealer: c.dealer, t: now() }; }

  // ---------- geymsla ----------
  function empty() { return { saved: {}, searches: [], notes: [], watch: {} }; }
  function persist() {
    if (!user || !doc) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      doc.email = user.email; doc.lastSeen = now();
      db.collection('users').doc(user.uid).set(doc).catch(function (e) { console.error('Vistun mistókst', e); });
    }, 400);
  }

  // ---------- haus ----------
  function unread() { return doc ? doc.notes.filter(function (n) { return !n.read; }).length : 0; }
  function renderHeader() {
    var el = $('acct'), dot = $('bnavDot');
    if (!user) { el.innerHTML = '<button type="button" class="pill-btn" data-acct="login">' + ic('user-round') + '<span>Innskrá</span></button>'; if (dot) dot.hidden = true; return; }
    var n = unread(), saved = doc ? Object.keys(doc.saved).length : 0;
    el.innerHTML =
      '<button type="button" class="icon-btn" data-acct="saved" title="Vistað" aria-label="Vistað">' + ic('heart') + (saved ? '<em class="cnt">' + saved + '</em>' : '') + '</button>' +
      '<button type="button" class="icon-btn bell" data-acct="notes" title="Tilkynningar" aria-label="Tilkynningar">' + ic('bell') + (n ? '<em class="dot">' + n + '</em>' : '') + '</button>' +
      (isAdmin() ? '<button type="button" class="icon-btn" data-acct="admin" title="Stjórnandi" aria-label="Stjórnandi">' + ic('gauge') + '</button>' : '') +
      '<button type="button" class="avatar" data-acct="me" title="' + A.esc(user.email) + '">' + A.esc((user.email || '?')[0].toUpperCase()) + '</button>';
    if (dot) { dot.hidden = !n; dot.textContent = n; }
  }

  // ---------- innskráning ----------
  var ERR = {
    'auth/invalid-email': 'Netfangið er ekki gilt.',
    'auth/missing-password': 'Sláðu inn lykilorð.',
    'auth/weak-password': 'Lykilorðið þarf að vera a.m.k. 6 stafir.',
    'auth/email-already-in-use': 'Það er þegar til aðgangur með þessu netfangi. Prófaðu að skrá þig inn.',
    'auth/invalid-credential': 'Rangt netfang eða lykilorð.',
    'auth/wrong-password': 'Rangt netfang eða lykilorð.',
    'auth/user-not-found': 'Enginn aðgangur með þessu netfangi.',
    'auth/too-many-requests': 'Of margar tilraunir. Bíddu aðeins og reyndu aftur.',
    'auth/operation-not-allowed': 'Innskráning er ekki virk enn í Firebase.',
    'auth/network-request-failed': 'Engin nettenging.'
  };
  function showLogin(msg) {
    A.openModal('<div class="m narrow"><div class="m-head"><h2>Innskráning</h2><button class="x" data-close aria-label="Loka">×</button></div>' +
      (msg ? '<p class="note">' + A.esc(msg) + '</p>' : '<p class="note">Með aðgangi geturðu vistað bíla og leitir og fengið tilkynningu þegar nýr bíll bætist við.</p>') +
      '<form id="loginForm" class="form"><label>Netfang<input id="lEmail" type="email" autocomplete="email" required></label>' +
      '<label>Lykilorð<input id="lPass" type="password" autocomplete="current-password" minlength="6" required></label>' +
      '<p id="lErr" class="err" hidden></p>' +
      '<div class="actions"><button type="submit" class="primary">Skrá inn</button>' +
      '<button type="button" class="sec" data-acct="register">Stofna aðgang</button>' +
      '<button type="button" class="link" data-acct="reset">Gleymt lykilorð?</button></div></form></div>');
    $('loginForm').addEventListener('submit', function (e) { e.preventDefault(); doAuth('login'); });
    setTimeout(function () { $('lEmail').focus(); }, 50);
  }
  function doAuth(kind) {
    var email = $('lEmail').value.trim(), pass = $('lPass').value, err = $('lErr');
    err.hidden = true;
    function fail(e) { err.textContent = ERR[e.code] || ('Villa: ' + (e.message || e.code)); err.hidden = false; }
    if (kind === 'reset') {
      if (!email) return fail({ code: 'auth/invalid-email' });
      auth.sendPasswordResetEmail(email).then(function () {
        err.textContent = 'Sendi póst á ' + email + ' til að endurstilla lykilorðið.'; err.hidden = false;
      }).catch(fail);
      return;
    }
    var p = kind === 'register' ? auth.createUserWithEmailAndPassword(email, pass) : auth.signInWithEmailAndPassword(email, pass);
    p.then(function () { A.closeModal(); }).catch(fail);
  }

  // ---------- vistaðir bílar ----------
  function isSaved(id) { return !!(doc && doc.saved[id]); }
  function toggleSave(id) {
    if (!user) return showLogin('Skráðu þig inn til að vista bíla.');
    var c = A.byId(id);
    if (doc.saved[id]) delete doc.saved[id];
    else if (c) doc.saved[id] = snap(c);
    persist(); renderHeader(); A.refreshSaved();
  }

  // ---------- verðvakt á einum bíl ----------
  function openWatch(id, btn) {
    if (!user) return showLogin('Skráðu þig inn til að fá tilkynningu þegar verðið lækkar.');
    var c = A.byId(id), w = doc.watch[id];
    var box = document.createElement('div');
    box.className = 'watch-box';
    box.innerHTML = '<label>Láttu mig vita ef verðið fer niður í<span class="inp-s"><input id="wTarget" type="number" inputmode="numeric" step="50000" value="' +
      (w ? w.target : Math.round(c.price * 0.9 / 5e4) * 5e4) + '"><i>kr.</i></span></label>' +
      '<button type="button" class="primary" id="wSave">Vista verðvakt</button>' + (w ? '<button type="button" class="link" id="wDel">Hætta að vakta</button>' : '');
    btn.parentNode.parentNode.insertBefore(box, btn.parentNode.nextSibling);
    btn.disabled = true;
    $('wSave').addEventListener('click', function () {
      var target = +$('wTarget').value;
      if (!(target > 0)) return;
      doc.watch[id] = { target: target, title: A.cap(c.make) + ' ' + A.cap(c.model), price: c.price, t: now(), hit: c.price <= target };
      if (!doc.saved[id]) doc.saved[id] = snap(c);
      persist(); renderHeader(); A.refreshSaved();
      box.innerHTML = '<p class="note">✓ Þú færð tilkynningu ef verðið fer niður í ' + A.kr(target) + ' eða lægra. Bíllinn er líka vistaður.</p>';
    });
    if ($('wDel')) $('wDel').addEventListener('click', function () { delete doc.watch[id]; persist(); box.innerHTML = '<p class="note">Verðvakt fjarlægð.</p>'; });
  }

  // ---------- vistaðar leitir ----------
  function describeF(f) {
    var p = [];
    if (f.make) p.push(A.cap(f.make) + (f.model ? ' ' + A.cap(f.model) : ''));
    if (f.fuel) p.push(f.fuel.toLowerCase());
    if (f.body) p.push(f.body === 'suv' ? 'jeppi/jepplingur' : 'fólksbíll');
    if (f.trans) p.push(f.trans === 'sj' ? 'sjálfskiptur' : 'beinskiptur');
    if (f.awd) p.push('fjórhjóladrif');
    if (f.priceMin != null) p.push('frá ' + f.priceMin + ' m.kr.');
    if (f.priceMax != null) p.push('undir ' + f.priceMax + ' m.kr.');
    if (f.yearMin != null) p.push('árg. ' + f.yearMin + '+');
    if (f.yearMax != null) p.push('árg. til ' + f.yearMax);
    if (f.kmMax != null) p.push('undir ' + A.kmFmt(f.kmMax));
    if (f.dealer) p.push(f.dealer);
    if (f.seller) p.push(f.seller === 'private' ? 'einstaklingar' : 'bílasölur');
    if (f.text) p.push('„' + f.text + '“');
    if (f.deal) p.push('gott verð');
    return p.join(' · ') || 'Allir bílar';
  }
  function saveSearch() {
    if (!user) return showLogin('Skráðu þig inn til að vista leitir og fá tilkynningar um nýja bíla.');
    var f = A.readFilters(), key = JSON.stringify(f);
    if (doc.searches.some(function (s) { return JSON.stringify(s.f) === key; })) return toast('Þessi leit er þegar vistuð.');
    if (doc.searches.length >= MAX_SEARCHES) return toast('Hámark ' + MAX_SEARCHES + ' vistaðar leitir. Eyddu einni fyrst.');
    var ids = A.filtered(f).map(function (c) { return c.id; });
    doc.searches.unshift({ id: 's' + now(), name: A.query().trim() || describeF(f), f: f, q: A.query(), seen: ids.slice(0, MAX_SEEN), created: now() });
    persist(); renderHeader();
    toast('Leit vistuð. Þú færð tilkynningu þegar nýr bíll bætist við (' + ids.length + ' bílar núna).');
  }
  function openSearch(s) {
    // síurnar geyma verð í m.kr. en setFilters tekur krónur
    var f = {}; for (var k in s.f) f[k] = s.f[k];
    if (f.priceMin != null) f.priceMin *= 1e6;
    if (f.priceMax != null) f.priceMax *= 1e6;
    A.setFilters(f); A.setQuery(s.q); A.closeModal(); A.render();
    window.scrollTo(0, 0);
  }

  // ---------- tilkynningar: bornar saman við nýjustu gögnin í hvert sinn sem síðan opnast ----------
  function checkUpdates() {
    if (checked || !doc || !dataLoaded) return;
    checked = true;
    var notes = [];
    doc.searches.forEach(function (s) {
      var ids = A.filtered(s.f).map(function (c) { return c.id; });
      var seen = {}; (s.seen || []).forEach(function (id) { seen[id] = 1; });
      var fresh = ids.filter(function (id) { return !seen[id]; });
      if (fresh.length && s.seen) {
        notes.push({ t: now(), kind: 'search', sid: s.id, title: fresh.length + (fresh.length === 1 ? ' nýr bíll' : ' nýir bílar') + ' í „' + s.name + '“', cars: fresh.slice(0, 20), read: false });
      }
      s.seen = ids.slice(0, MAX_SEEN);
    });
    Object.keys(doc.saved).forEach(function (id) {
      var old = doc.saved[id], c = A.byId(id);
      if (!c && !old.gone) {
        old.gone = now();
        notes.push({ t: now(), kind: 'gone', title: old.title + ' er ekki lengur á skrá (líklega seldur).', cars: [], read: false });
      } else if (c && old.price && c.price < old.price) {
        notes.push({ t: now(), kind: 'drop', title: 'Verð lækkaði á ' + old.title + ': ' + A.kr(old.price) + ' → ' + A.kr(c.price), cars: [id], read: false });
        old.price = c.price;
      } else if (c && old.gone) delete old.gone;
    });
    // verðvakt: tilkynning þegar bíll fer niður fyrir markverð notandans
    Object.keys(doc.watch).forEach(function (id) {
      var w = doc.watch[id], c = A.byId(id);
      if (!c) { notes.push({ t: now(), kind: 'gone', title: w.title + ' er ekki lengur á skrá. Verðvaktin hefur verið fjarlægð.', cars: [], read: false }); delete doc.watch[id]; return; }
      if (c.price <= w.target && !w.hit) {
        notes.push({ t: now(), kind: 'watch', title: '🔔 ' + w.title + ' er komin(n) í ' + A.kr(c.price) + ' (markverð þitt var ' + A.kr(w.target) + ')', cars: [id], read: false });
        w.hit = true;
      } else if (c.price > w.target && w.hit) w.hit = false;
    });
    if (notes.length) doc.notes = notes.concat(doc.notes).slice(0, MAX_NOTES);
    persist(); renderHeader();
    if (notes.length) toast(notes.length === 1 ? notes[0].title : notes.length + ' nýjar tilkynningar 🔔');
  }

  // ---------- gluggar ----------
  function carRow(c, extra) {
    var im = A.img(c);
    return '<div class="row-car" data-open="' + A.esc(c.id) + '">' +
      (im ? '<img src="' + A.esc(im) + '" alt="" loading="lazy">' : '<div class="noimg"></div>') +
      '<div class="rc-body"><b>' + A.esc(A.cap(c.make) + ' ' + A.cap(c.model)) + '</b>' +
      '<span>' + (c.year || '–') + ' · ' + A.kmFmt(c.km) + ' · ' + A.esc(c.dealer) + '</span>' +
      '<span class="price">' + A.kr(c.price) + '</span>' + (extra || '') + '</div></div>';
  }
  function showSaved(tab) {
    tab = tab || 'cars';
    var body;
    if (tab === 'cars') {
      var ids = Object.keys(doc.saved).sort(function (a, b) { return doc.saved[b].t - doc.saved[a].t; });
      body = ids.length ? ids.map(function (id) {
        var c = A.byId(id), s = doc.saved[id];
        if (c) {
          var diff = (s.price && c.price !== s.price ? '<span class="note">Var ' + A.kr(s.price) + ' þegar þú vistaðir</span>' : '') +
            (doc.watch[id] ? '<span class="note">🔔 Verðvakt: ' + A.kr(doc.watch[id].target) + '</span>' : '');
          return carRow(c, diff + '<button type="button" class="link" data-save="' + A.esc(id) + '">Fjarlægja</button>');
        }
        return '<div class="row-car gone"><div class="noimg"></div><div class="rc-body"><b>' + A.esc(s.title) + '</b><span>Ekki lengur á skrá</span>' +
          '<button type="button" class="link" data-save="' + A.esc(id) + '">Fjarlægja</button></div></div>';
      }).join('') : '<p class="note">Engir vistaðir bílar. Smelltu á ♡ á bíl til að vista hann.</p>';
    } else {
      body = doc.searches.length ? doc.searches.map(function (s) {
        var n = A.filtered(s.f).length;
        return '<div class="row-search"><div><b>' + A.esc(s.name) + '</b><span class="note">' + A.esc(describeF(s.f)) + ' · ' + n + ' bílar núna</span></div>' +
          '<div class="rs-act"><button type="button" class="sec" data-acct="open-search" data-sid="' + s.id + '">Opna</button>' +
          '<button type="button" class="link" data-acct="del-search" data-sid="' + s.id + '">Eyða</button></div></div>';
      }).join('') : '<p class="note">Engar vistaðar leitir. Leitaðu og smelltu á „🔔 Vista leit“, þá færðu tilkynningu þegar nýr bíll bætist við.</p>';
    }
    A.openModal('<div class="m"><div class="m-head"><h2>Vistað</h2><button class="x" data-close aria-label="Loka">×</button></div>' +
      '<div class="tabs"><button type="button" class="' + (tab === 'cars' ? 'on' : '') + '" data-acct="tab-cars">Bílar (' + Object.keys(doc.saved).length + ')</button>' +
      '<button type="button" class="' + (tab === 'searches' ? 'on' : '') + '" data-acct="tab-searches">Leitir (' + doc.searches.length + ')</button></div>' +
      '<div class="list">' + body + '</div></div>');
  }
  function showNotes() {
    var html = doc.notes.length ? doc.notes.map(function (n, i) {
      var cs = (n.cars || []).map(A.byId).filter(Boolean);
      return '<div class="note-item' + (n.read ? '' : ' unread') + '"><div class="ni-head"><b>' + A.esc(n.title) + '</b><span class="note">' + when(n.t) + '</span></div>' +
        (cs.length ? '<div class="list">' + cs.slice(0, 5).map(function (c) { return carRow(c); }).join('') + '</div>' : '') +
        (cs.length > 5 || n.sid ? '<button type="button" class="link" data-acct="open-search" data-sid="' + A.esc(n.sid || '') + '">Sjá alla í leitinni</button>' : '') + '</div>';
    }).join('') : '<p class="note">Engar tilkynningar enn. Vistaðu leit og síðan lætur þig vita þegar nýr bíll bætist við. Þú færð líka að vita ef vistaður bíll lækkar í verði eða selst.</p>';
    A.openModal('<div class="m"><div class="m-head"><h2>Tilkynningar</h2><button class="x" data-close aria-label="Loka">×</button></div>' +
      (doc.notes.length ? '<div class="actions" style="margin-top:0"><button type="button" class="link" data-acct="clear-notes">Hreinsa allar</button></div>' : '') +
      '<p class="note">Bílagögnin uppfærast á hverri nóttu og tilkynningar birtast hér þegar þú opnar síðuna.</p>' + html + '</div>');
    doc.notes.forEach(function (n) { n.read = true; });
    persist(); renderHeader();
  }
  function showMe() {
    var n = unread();
    A.openModal('<div class="m narrow"><div class="m-head"><h2>Aðgangur</h2><button class="x" data-close aria-label="Loka">×</button></div>' +
      '<div class="me-card"><span class="avatar big">' + A.esc((user.email || '?')[0].toUpperCase()) + '</span><div><b>' + A.esc(user.email) + '</b>' +
      '<span class="note">' + (isAdmin() ? 'Stjórnandi' : 'Notandi') + '</span></div></div>' +
      '<div class="me-list"><button type="button" data-acct="notes">' + ic('bell') + 'Tilkynningar' + (n ? '<em class="dot">' + n + '</em>' : '') + '</button>' +
      '<button type="button" data-acct="saved">' + ic('heart') + 'Vistaðir bílar og leitir</button>' +
      (isAdmin() ? '<button type="button" data-acct="admin">' + ic('gauge') + 'Stjórnborð</button>' : '') +
      '<button type="button" data-acct="logout">' + ic('x') + 'Skrá út</button></div></div>');
  }

  // ---------- stjórnandi ----------
  function showAdmin() {
    A.openModal('<div class="m"><div class="m-head"><h2>Stjórnandi</h2><button class="x" data-close aria-label="Loka">×</button></div><p class="note">Sæki notendur…</p></div>');
    db.collection('users').get().then(function (qs) {
      var rows = [], tot = { saved: 0, searches: 0 };
      qs.forEach(function (d) {
        var u = d.data(), ns = Object.keys(u.saved || {}).length, nq = (u.searches || []).length;
        tot.saved += ns; tot.searches += nq;
        rows.push({ id: d.id, email: u.email || '?', created: u.created, last: u.lastSeen, ns: ns, nq: nq });
      });
      rows.sort(function (a, b) { return (b.last || 0) - (a.last || 0); });
      var cars = A.cars(), bySrc = {};
      cars.forEach(function (c) { bySrc[c.src || c.dealer] = (bySrc[c.src || c.dealer] || 0) + 1; });
      $('modalBody').innerHTML = '<div class="m"><div class="m-head"><h2>Stjórnandi</h2><button class="x" data-close aria-label="Loka">×</button></div>' +
        '<div class="stats"><div><b>' + rows.length + '</b><span>notendur</span></div><div><b>' + tot.saved + '</b><span>vistaðir bílar</span></div>' +
        '<div><b>' + tot.searches + '</b><span>vistaðar leitir</span></div><div><b>' + cars.length.toLocaleString('de-DE') + '</b><span>bílar á skrá</span></div></div>' +
        '<div class="actions" style="margin:0 0 10px"><button type="button" class="sec" data-acct="force-reload">🔄 Uppfæra allar opnar síður</button></div>' +
        '<div id="visitDash"><div class="skel-line"></div><div class="skel-line short"></div></div>' +
        '<p class="note">Heimildir: ' + Object.keys(bySrc).map(function (k) { return A.esc(k) + ' ' + bySrc[k]; }).join(' · ') + '</p>' +
        '<div class="tbl-wrap"><table><thead><tr><th>Netfang</th><th>Stofnaður</th><th>Síðast</th><th class="num">Bílar</th><th class="num">Leitir</th><th></th></tr></thead><tbody>' +
        rows.map(function (r) {
          return '<tr><td>' + A.esc(r.email) + '</td><td>' + (r.created ? when(r.created) : '–') + '</td><td>' + (r.last ? when(r.last) : '–') + '</td>' +
            '<td class="num">' + r.ns + '</td><td class="num">' + r.nq + '</td><td>' +
            (r.id === user.uid ? '' : '<button type="button" class="link danger" data-acct="admin-del" data-uid="' + A.esc(r.id) + '">Eyða gögnum</button>') + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<p class="note">„Eyða gögnum“ eyðir vistuðum bílum, leitum og tilkynningum notandans (ekki innskráningunni sjálfri).</p></div>';
      visitDashboard();
    }).catch(function (e) {
      $('modalBody').innerHTML = '<div class="m"><div class="m-head"><h2>Stjórnandi</h2><button class="x" data-close aria-label="Loka">×</button></div><p class="err">Aðgangi hafnað: ' + A.esc(e.message) + '</p></div>';
    });
  }

  // ---------- heimsóknamælaborð (bara stjórnandi) ----------
  function visitDashboard() {
    var from = new Date(Date.now() - 59 * 864e5).toISOString().slice(0, 10);
    db.collection('stats').where(firebase.firestore.FieldPath.documentId(), '>=', from).get().then(function (qs) {
      var by = {};
      qs.forEach(function (d) { by[d.id] = d.data(); });
      var days = [];
      for (var i = 59; i >= 0; i--) {
        var k = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10), x = by[k] || {};
        days.push({ k: k, v: x.v || 0, u: x.u || 0, m: x.m || 0, d: x.d || 0 });
      }
      function sum(a, f) { return a.reduce(function (s, x) { return s + x[f]; }, 0); }
      var today = days[59], last7 = days.slice(53), prev7 = days.slice(46, 53), last30 = days.slice(30);
      var u7 = sum(last7, 'u'), up7 = sum(prev7, 'u'), trend = up7 ? Math.round((u7 / up7 - 1) * 100) : null;
      var mob = sum(last30, 'm'), desk = sum(last30, 'd'), share = mob + desk ? Math.round(mob / (mob + desk) * 100) : 0;
      // línurit: einstakir gestir á dag síðustu 30 daga (ein röð, sveimtexti á hverjum degi)
      var W = 640, H = 200, L = 34, B = 22, T = 10, max = Math.max(4, Math.max.apply(null, last30.map(function (x) { return x.u; }))) * 1.15;
      var X = function (i) { return L + (W - L - 8) * i / 29; }, Y = function (v) { return T + (H - T - B) * (1 - v / max); };
      var line = last30.map(function (x, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(x.u).toFixed(1); }).join('');
      var area = line + 'L' + X(29) + ',' + (H - B) + 'L' + X(0) + ',' + (H - B) + 'Z';
      var svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Einstakir gestir á dag">' +
        [0, max / 2, max].map(function (t) { return '<line class="grid" x1="' + L + '" x2="' + W + '" y1="' + Y(t) + '" y2="' + Y(t) + '"/><text class="ax" x="' + (L - 6) + '" y="' + (Y(t) + 4) + '" text-anchor="end">' + Math.round(t) + '</text>'; }).join('') +
        '<path d="' + area + '" fill="var(--accent)" opacity=".12"/><path d="' + line + '" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>' +
        last30.map(function (x, i) {
          var lab = A.dateIs(new Date(x.k));
          return '<g data-tip="<b>' + lab + '</b><br>' + x.u + ' gestir · ' + x.v + ' flettingar"><rect class="hit" x="' + (X(i) - 11) + '" y="' + T + '" width="22" height="' + (H - T - B) + '"/>' +
            '<circle class="pt" cx="' + X(i) + '" cy="' + Y(x.u) + '" r="' + (i === 29 ? 4 : 2.5) + '"/></g>' +
            (i % 7 === 2 || i === 29 ? '<text class="ax" x="' + X(i) + '" y="' + (H - 6) + '" text-anchor="middle">' + lab + '</text>' : '');
        }).join('') + '<line class="base" x1="' + L + '" x2="' + W + '" y1="' + (H - B) + '" y2="' + (H - B) + '"/></svg>';
      var el = $('visitDash'); if (!el) return;
      el.innerHTML = '<h4>Heimsóknir</h4><div class="stats">' +
        '<div><b>' + today.u + '</b><span>gestir í dag (' + today.v + ' flettingar)</span></div>' +
        '<div><b>' + u7 + '</b><span>gestir síðustu 7 daga' + (trend != null ? ' <em class="' + (trend >= 0 ? 'up' : 'down') + '">' + (trend >= 0 ? '+' : '') + trend + '%</em>' : '') + '</span></div>' +
        '<div><b>' + sum(last30, 'u') + '</b><span>gestir síðustu 30 daga</span></div>' +
        '<div><b>' + share + '%</b><span>í síma (30 dagar)</span></div></div>' +
        '<div class="chart-wrap">' + svg + '</div>' +
        '<p class="note">Einstakur gestur = einn vafri á dag (nafnlaust, engar persónuupplýsingar). Þínar eigin heimsóknir eru ekki taldar. Talning hófst ' +
        A.dateIs(new Date((days.filter(function (x) { return x.v; })[0] || today).k), true) + '.</p>';
    }).catch(function (e) { var el = $('visitDash'); if (el) el.innerHTML = '<p class="err">Gat ekki sótt heimsóknir: ' + A.esc(e.message) + '</p>'; });
  }

  // ---------- smá-skilaboð ----------
  function toast(msg) {
    var t = $('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 4500);
  }

  // ---------- atburðir ----------
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-acct]') : null;
    if (!t) return;
    var a = t.getAttribute('data-acct'), sid = t.getAttribute('data-sid');
    e.stopPropagation();
    if (a === 'login') showLogin();
    else if (a === 'register' || a === 'reset') doAuth(a);
    else if (a === 'logout') { auth.signOut(); A.closeModal(); }
    else if (a === 'me') showMe();
    else if (a === 'saved') showSaved('cars');
    else if (a === 'tab-cars') showSaved('cars');
    else if (a === 'tab-searches') showSaved('searches');
    else if (a === 'notes') showNotes();
    else if (a === 'admin') showAdmin();
    else if (a === 'clear-notes') { doc.notes = []; persist(); showNotes(); }
    else if (a === 'open-search') {
      var s = doc.searches.filter(function (x) { return x.id === sid; })[0];
      if (s) openSearch(s); else toast('Þessari leit hefur verið eytt.');
    } else if (a === 'del-search') {
      doc.searches = doc.searches.filter(function (x) { return x.id !== sid; });
      persist(); renderHeader(); showSaved('searches');
    } else if (a === 'force-reload') {
      if (t.getAttribute('data-armed') !== '1') { t.setAttribute('data-armed', '1'); t.textContent = 'Smelltu aftur til að endurhlaða allar opnar síður'; return; }
      db.collection('config').doc('app').set({ reloadAt: now() }).then(function () {
        t.textContent = '✓ Sent – opnar síður endurhlaðast núna'; t.removeAttribute('data-armed');
      }).catch(function (err) { toast('Mistókst: ' + err.message); });
    } else if (a === 'admin-del') {
      // tveggja þrepa staðfesting án vafraglugga
      if (t.getAttribute('data-armed') !== '1') { t.setAttribute('data-armed', '1'); t.textContent = 'Smelltu aftur til að staðfesta'; return; }
      db.collection('users').doc(t.getAttribute('data-uid')).delete().then(showAdmin).catch(function (err) { toast('Mistókst: ' + err.message); });
    }
  }, true);
  $('saveSearch').addEventListener('click', saveSearch);

  // vistaðir bílar í glugga: endurteikna listann eftir að bíll er fjarlægður
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('.list [data-save]') : null;
    if (t) setTimeout(function () { if (doc) showSaved('cars'); }, 0);
  });

  // ---------- ræsing ----------
  window.Acct = {
    isSaved: isSaved, toggleSave: toggleSave, openWatch: openWatch,
    dataReady: function () { dataLoaded = true; checkUpdates(); }
  };
  renderHeader();
  if (!window.firebase || !window.FIREBASE_CONFIG) return;
  firebase.initializeApp(window.FIREBASE_CONFIG);
  auth = firebase.auth(); db = firebase.firestore();

  // Stjórnandi getur látið allar opnar síður endurhlaðast (config/app.reloadAt); annars fær fólk nýja útgáfu við næstu endurhleðslu
  var reloadSeen = null;
  db.collection('config').doc('app').onSnapshot(function (d) {
    var v = d.exists ? d.data().reloadAt : 0;
    if (reloadSeen !== null && v && v !== reloadSeen) {
      toast('Ný útgáfa af síðunni – endurhleð…');
      setTimeout(function () { location.reload(); }, 1500);
    }
    reloadSeen = v || 0;
  }, function () {});
  // ---------- heimsóknatalning (nafnlaus): stats/ÁÁÁÁ-MM-DD {v: flettingar, u: einstakir gestir, m: sími, d: tölva} ----------
  var tracked = false;
  function trackVisit() {
    if (tracked || isAdmin() || /^(localhost|127\.)/.test(location.hostname)) return;
    tracked = true;
    var day = new Date().toISOString().slice(0, 10), first = false;
    try { first = localStorage.getItem('vday') !== day; localStorage.setItem('vday', day); } catch (e) {}
    var inc = firebase.firestore.FieldValue.increment, mobile = matchMedia('(max-width: 760px)').matches || /iphone|android/i.test(navigator.userAgent);
    var data = { v: inc(1) };
    if (first) { data.u = inc(1); data[mobile ? 'm' : 'd'] = inc(1); }
    db.collection('stats').doc(day).set(data, { merge: true }).catch(function () {});
  }

  auth.onAuthStateChanged(function (u) {
    user = u; doc = null; checked = false;
    trackVisit();
    renderHeader(); A.refreshSaved();
    if (!u) return;
    db.collection('users').doc(u.uid).get().then(function (d) {
      doc = d.exists ? d.data() : empty();
      doc.saved = doc.saved || {}; doc.searches = doc.searches || []; doc.notes = doc.notes || []; doc.watch = doc.watch || {};
      if (!doc.created) { doc.created = now(); persist(); }
      renderHeader(); A.refreshSaved(); checkUpdates();
    }).catch(function (e) { console.error(e); toast('Gat ekki sótt vistuð gögn: ' + e.message); });
  });
})();
