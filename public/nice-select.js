/* Sérhannaðir fellilistar í stað kerfislista (macOS/iOS).
   Upprunalega <select> heldur sér (falið) og er áfram „sannleikurinn“: gildi, change-atburðir og kóði sem les .value virka óbreytt.
   Nice.enhance(rót) – breytir öllum select í rótinni; Nice.refresh() – uppfærir texta eftir að kóði breytti .value. */
(function () {
  'use strict';

  var open = null;  // { wrap, sel, pop }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function label(sel) { var o = sel.options[sel.selectedIndex]; return o ? o.text : ''; }

  function close() {
    if (!open) return;
    open.pop.hidden = true; open.wrap.classList.remove('open'); open.btn.setAttribute('aria-expanded', 'false');
    open = null;
  }

  function build(sel) {
    var wrap = document.createElement('div');
    wrap.className = 'ns' + (sel.className ? ' ' + sel.className : '');
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'ns-btn';
    btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-expanded', 'false');
    if (sel.getAttribute('aria-label')) btn.setAttribute('aria-label', sel.getAttribute('aria-label'));
    btn.innerHTML = '<span class="ns-val"></span>' + (window.ic ? window.ic('chevron-down', 'ns-chev') : '▾');
    var pop = document.createElement('div');
    pop.className = 'ns-pop'; pop.hidden = true; pop.setAttribute('role', 'listbox');
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel); wrap.appendChild(btn); wrap.appendChild(pop);
    sel.setAttribute('data-nice', '1'); sel.classList.add('ns-native'); sel.tabIndex = -1;
    sel._ns = { wrap: wrap, btn: btn, pop: pop, sel: sel };

    function render(filter) {
      var q = (filter || '').toLowerCase(), many = sel.options.length > 12, html = '';
      if (many) html += '<div class="ns-search">' + (window.ic ? window.ic('search') : '') + '<input type="search" placeholder="Leita…" value="' + esc(filter || '') + '"></div>';
      html += '<ul>';
      [].forEach.call(sel.options, function (o, i) {
        if (q && o.text.toLowerCase().indexOf(q) < 0) return;
        var on = i === sel.selectedIndex;
        html += '<li role="option" data-i="' + i + '" class="' + (on ? 'on' : '') + '" aria-selected="' + on + '"><span>' + esc(o.text) + '</span>' +
          (on && window.ic ? window.ic('check') : '') + '</li>';
      });
      pop.innerHTML = html + '</ul>';
      var inp = pop.querySelector('input');
      if (inp) {
        inp.addEventListener('input', function () { render(inp.value); var i2 = pop.querySelector('input'); i2.focus(); i2.setSelectionRange(i2.value.length, i2.value.length); });
        inp.addEventListener('keydown', key);
      }
    }
    function choose(i) {
      if (sel.selectedIndex !== i) { sel.selectedIndex = i; sel.dispatchEvent(new Event('change', { bubbles: true })); }
      update(); close(); btn.focus();
    }
    function update() { wrap.querySelector('.ns-val').textContent = label(sel); }
    function key(e) {
      var items = [].slice.call(pop.querySelectorAll('li')), cur = pop.querySelector('li.hl') || pop.querySelector('li.on'), k = items.indexOf(cur);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        k = Math.max(0, Math.min(items.length - 1, k + (e.key === 'ArrowDown' ? 1 : -1)));
        items.forEach(function (x) { x.classList.remove('hl'); });
        if (items[k]) { items[k].classList.add('hl'); items[k].scrollIntoView({ block: 'nearest' }); }
      } else if (e.key === 'Enter' && cur) { e.preventDefault(); choose(+cur.getAttribute('data-i')); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); btn.focus(); }
    }
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (open && open.wrap === wrap) return close();
      close();
      render('');
      pop.hidden = false; wrap.classList.add('open'); btn.setAttribute('aria-expanded', 'true');
      // opnast upp á við ef ekki er pláss fyrir neðan
      var r = btn.getBoundingClientRect();
      wrap.classList.toggle('up', window.innerHeight - r.bottom < 300 && r.top > window.innerHeight - r.bottom);
      open = { wrap: wrap, btn: btn, pop: pop };
      var on = pop.querySelector('li.on'); if (on) on.scrollIntoView({ block: 'nearest' });
      var inp = pop.querySelector('input'); if (inp && !('ontouchstart' in window)) inp.focus();
    });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!open) btn.click(); else key(e); }
      else if (open && (e.key === 'Enter' || e.key === 'Escape')) key(e);
    });
    pop.addEventListener('click', function (e) {
      e.stopPropagation();
      var li = e.target.closest('li'); if (li) choose(+li.getAttribute('data-i'));
    });
    sel.addEventListener('change', update);
    // valkostum skipt út í kóða (t.d. bílasölulistinn): uppfæra textann
    new MutationObserver(update).observe(sel, { childList: true });
    update();
  }

  function enhance(root) {
    (root || document).querySelectorAll('select:not([data-nice]):not([hidden])').forEach(build);
  }
  function refresh() {
    document.querySelectorAll('select[data-nice]').forEach(function (s) { if (s._ns) s._ns.wrap.querySelector('.ns-val').textContent = label(s); });
  }
  document.addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  window.Nice = { enhance: enhance, refresh: refresh };
  enhance(document);
})();
