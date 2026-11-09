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
  function empty() { return { saved: {}, searches: [], notes: [] }; }
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
    var el = $('acct');
    if (!user) { el.innerHTML = '<button type="button" class="pill-btn" data-acct="login">Innskrá</button>'; return; }
    var n = unread(), saved = doc ? Object.keys(doc.saved).length : 0;
    el.innerHTML =
      '<button type="button" class="pill-btn" data-acct="saved">♥ Vistað' + (saved ? ' (' + saved + ')' : '') + '</button>' +
      '<button type="button" class="pill-btn bell" data-acct="notes" aria-label="Tilkynningar">🔔' + (n ? '<span class="dot">' + n + '</span>' : '') + '</button>' +
      (isAdmin() ? '<button type="button" class="pill-btn" data-acct="admin">Stjórnandi</button>' : '') +
      '<button type="button" class="pill-btn" data-acct="me" title="' + A.esc(user.email) + '">Aðgangur</button>';
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
          var diff = s.price && c.price !== s.price ? '<span class="note">Var ' + A.kr(s.price) + ' þegar þú vistaðir</span>' : '';
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
    A.openModal('<div class="m narrow"><div class="m-head"><h2>Aðgangur</h2><button class="x" data-close aria-label="Loka">×</button></div>' +
      '<p>Skráður inn sem <b>' + A.esc(user.email) + '</b>' + (isAdmin() ? ' (stjórnandi)' : '') + '</p>' +
      '<div class="actions"><button type="button" class="sec" data-acct="logout">Skrá út</button></div></div>');
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
        '<p class="note">Heimildir: ' + Object.keys(bySrc).map(function (k) { return A.esc(k) + ' ' + bySrc[k]; }).join(' · ') + '</p>' +
        '<div class="tbl-wrap"><table><thead><tr><th>Netfang</th><th>Stofnaður</th><th>Síðast</th><th class="num">Bílar</th><th class="num">Leitir</th><th></th></tr></thead><tbody>' +
        rows.map(function (r) {
          return '<tr><td>' + A.esc(r.email) + '</td><td>' + (r.created ? when(r.created) : '–') + '</td><td>' + (r.last ? when(r.last) : '–') + '</td>' +
            '<td class="num">' + r.ns + '</td><td class="num">' + r.nq + '</td><td>' +
            (r.id === user.uid ? '' : '<button type="button" class="link danger" data-acct="admin-del" data-uid="' + A.esc(r.id) + '">Eyða gögnum</button>') + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<p class="note">„Eyða gögnum“ eyðir vistuðum bílum, leitum og tilkynningum notandans (ekki innskráningunni sjálfri).</p></div>';
    }).catch(function (e) {
      $('modalBody').innerHTML = '<div class="m"><div class="m-head"><h2>Stjórnandi</h2><button class="x" data-close aria-label="Loka">×</button></div><p class="err">Aðgangi hafnað: ' + A.esc(e.message) + '</p></div>';
    });
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
    isSaved: isSaved, toggleSave: toggleSave,
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
  auth.onAuthStateChanged(function (u) {
    user = u; doc = null; checked = false;
    renderHeader(); A.refreshSaved();
    if (!u) return;
    db.collection('users').doc(u.uid).get().then(function (d) {
      doc = d.exists ? d.data() : empty();
      doc.saved = doc.saved || {}; doc.searches = doc.searches || []; doc.notes = doc.notes || [];
      if (!doc.created) { doc.created = now(); persist(); }
      renderHeader(); A.refreshSaved(); checkUpdates();
    }).catch(function (e) { console.error(e); toast('Gat ekki sótt vistuð gögn: ' + e.message); });
  });
})();
