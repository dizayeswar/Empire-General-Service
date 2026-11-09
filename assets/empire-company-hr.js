/* E2 / E3 on the HR pages.
 * - Shows which company the page is working in (badge next to "HR Department").
 * - E3 papers use the E3 logo. Only the picture changes: the locked HR-F-06 logo box
 *   (size, position, transforms) stays exactly as it is.
 * Needs empire-auth.js (empireGetCompany). Without it, everything stays E2.
 */
(function () {
  var E3_LOGO = 'assets/hr-f06-logo-e3.png?v=2026-11-09-e3-print';

  function company() {
    try {
      return typeof empireGetCompany === 'function' ? empireGetCompany() : 'E2';
    } catch (e) {
      return 'E2';
    }
  }

  function swapLogo(img) {
    if (!img || img.getAttribute('data-company-logo') === 'E3') return;
    img.setAttribute('data-company-logo', 'E3');
    // No E3 logo uploaded yet: keep the box empty rather than print the E2 logo on an E3 paper.
    img.addEventListener('error', function () { img.style.visibility = 'hidden'; }, { once: true });
    img.src = E3_LOGO;
    img.alt = 'E3';
  }

  function swapAll(root) {
    if (company() !== 'E3') return;
    (root || document).querySelectorAll('img.hr-f06-logo').forEach(swapLogo);
  }

  /* ---------- E3 print layout (2026-11-09, asked by the user) ----------
   * Added to every E3 print page (single, batch, PDF) after the locked print CSS, so it wins.
   * The screen paper and the E2 print are never touched.
   * - Footer HR-F-06 / Rev.2 ~17.5 mm higher than E2 (E2: translate(0,-13mm); sheet prints at 94%).
   * - Whole page offset and logo offset/size: admins set them in the "Adjust E3 paper" window
   *   (click the logo on an E3 paper). Saved on the server (getHrPaperAdjust / saveHrPaperAdjust).
   *   Default = whole page 5 mm up, logo as is. */
  var ADJ_DEFAULT = { page: { x: 0, y: -5 }, logo: { x: 0, y: 0, size: 100 } };
  var _adj = cloneAdj(ADJ_DEFAULT);

  function cloneAdj(a) {
    a = a || {};
    var p = a.page || {}, l = a.logo || {};
    var n = function (v, d) { v = Number(v); return isFinite(v) ? v : d; };
    return {
      page: { x: n(p.x, ADJ_DEFAULT.page.x), y: n(p.y, ADJ_DEFAULT.page.y) },
      logo: { x: n(l.x, 0), y: n(l.y, 0), size: n(l.size, 100) }
    };
  }

  function printCss(a) {
    var s = (a.logo.size || 100) / 100;
    return '<style id="e3PrintAdjust">' +
      '.hr-f06-doc-foot{transform:translate(0,-31.5mm)!important;}' +
      // translate before the locked 94% scale = real millimetres on paper
      '.hr-f06-sheet{transform:translate(' + a.page.x + 'mm,' + a.page.y + 'mm) scale(0.94)!important;}' +
      // the E3 picture has the box's own shape, so scaling width and height together keeps it true
      '.hr-f06-logo{width:' + (51.22 * s).toFixed(2) + 'mm!important;height:' + (25.30 * s).toFixed(2) + 'mm!important;' +
      'position:relative!important;left:' + a.logo.x + 'mm!important;top:' + a.logo.y + 'mm!important;}' +
      '</style>';
  }

  var _origBuild = null;

  function hookPrint() {
    if (typeof window.hrBuildPrintHtml_ !== 'function' || window.hrBuildPrintHtml_.e3Hooked) return;
    _origBuild = window.hrBuildPrintHtml_;
    var hooked = function (bodyHtml, title) {
      var html = _origBuild.apply(this, arguments);
      if (company() !== 'E3') return html;
      return String(html).replace('</head>', printCss(_adj) + '</head>');
    };
    hooked.e3Hooked = true;
    window.hrBuildPrintHtml_ = hooked;
  }

  function loadAdjust() {
    if (company() !== 'E3' || typeof fetchJSONRetry !== 'function' || typeof empireGetToken !== 'function' || !empireGetToken()) return;
    fetchJSONRetry({ action: 'getHrPaperAdjust', token: empireGetToken() }, 1, 20000).then(function (d) {
      if (d && d.ok && d.adjust) _adj = cloneAdj(d.adjust);
    }).catch(function () {});
  }

  function isAdmin() {
    try { return typeof empireIsAdminRole === 'function' && empireIsAdminRole(); } catch (e) { return false; }
  }

  /* ---------- "Adjust E3 paper" window (admins, E3 only) ---------- */
  var PAGE_W = 794, PAGE_H = 1123; // A4 at 96 dpi

  function el(tag, css, html) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function sheetHtmlForPreview() {
    var sheet = document.querySelector('.hr-f06-sheet');
    if (!sheet) return '';
    try {
      if (typeof hrBakePrintClone_ === 'function') return hrBakePrintClone_(sheet).outerHTML;
    } catch (e) { /* fall back */ }
    return sheet.outerHTML;
  }

  function openEditor() {
    if (document.getElementById('e3AdjustWin') || !_origBuild) return;
    var draft = cloneAdj(_adj);
    var bodyHtml = sheetHtmlForPreview();

    var overlay = el('div', 'position:fixed;inset:0;z-index:100000;background:rgba(20,20,30,.55);display:flex;' +
      'align-items:center;justify-content:center;padding:16px;font-family:inherit;');
    overlay.id = 'e3AdjustWin';
    var card = el('div', 'background:#fff;color:#232a3d;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.35);' +
      'display:flex;gap:18px;padding:18px;max-height:100%;max-width:100%;overflow:auto;flex-wrap:wrap;');
    overlay.appendChild(card);

    var avail = Math.max(320, window.innerHeight - 80);
    var scale = Math.min(0.62, avail / PAGE_H);
    var holder = el('div', 'flex:none;width:' + Math.round(PAGE_W * scale) + 'px;height:' + Math.round(PAGE_H * scale) +
      'px;overflow:hidden;border:1px solid #c9ccd6;box-shadow:0 2px 10px rgba(0,0,0,.12);background:#fff;position:relative;');
    var frame = el('iframe', 'border:0;width:' + PAGE_W + 'px;height:' + PAGE_H + 'px;transform:scale(' + scale + ');' +
      'transform-origin:top left;background:#fff;pointer-events:none;');
    frame.setAttribute('title', 'Print preview');
    holder.appendChild(frame);
    card.appendChild(holder);

    var side = el('div', 'flex:1 1 260px;min-width:250px;max-width:320px;display:flex;flex-direction:column;gap:12px;font-size:14px;');
    side.appendChild(el('h2', 'margin:0;font-size:18px;color:#185fa5;', 'Adjust E3 paper'));
    side.appendChild(el('p', 'margin:0;color:#5b6478;font-size:13px;line-height:1.4;',
      'The preview is the real print page. Changes apply to E3 prints on every PC after <strong>Save</strong>. E2 is not affected.'));

    function row(label, get, set, step, unit) {
      var r = el('div', 'display:flex;align-items:center;gap:6px;');
      r.appendChild(el('span', 'flex:1;font-weight:600;', label));
      var minus = el('button', 'width:34px;height:32px;border-radius:8px;border:1px solid #e6cddc;background:#faf6f8;cursor:pointer;font-size:15px;box-shadow:none;', '−');
      var inp = el('input', 'width:64px;height:30px;text-align:center;border:1px solid #d5d8e0;border-radius:8px;font:inherit;');
      inp.type = 'number'; inp.step = String(step);
      var plus = el('button', 'width:34px;height:32px;border-radius:8px;border:1px solid #e6cddc;background:#faf6f8;cursor:pointer;font-size:15px;box-shadow:none;', '+');
      minus.type = plus.type = 'button';
      r.appendChild(minus); r.appendChild(inp); r.appendChild(plus);
      r.appendChild(el('span', 'width:22px;color:#8a90a0;font-size:12px;', unit));
      function show() { inp.value = String(Math.round(get() * 10) / 10); }
      function put(v) { v = Number(v); if (!isFinite(v)) return; set(Math.round(v * 10) / 10); show(); render(); }
      minus.onclick = function () { put(get() - step); };
      plus.onclick = function () { put(get() + step); };
      inp.oninput = function () { if (inp.value !== '' && inp.value !== '-') put(inp.value); };
      rows.push(show);
      show();
      return r;
    }
    var rows = [];

    function group(title, items) {
      var g = el('div', 'border:1px solid #efe8ed;border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:8px;');
      g.appendChild(el('div', 'font-weight:700;color:#8d015d;', title));
      items.forEach(function (i) { g.appendChild(i); });
      side.appendChild(g);
    }
    // "Up" shown as a positive number: up 5 = page.y -5
    group('Whole page', [
      row('Up ↑', function () { return -draft.page.y; }, function (v) { draft.page.y = -v; }, 1, 'mm'),
      row('Right →', function () { return draft.page.x; }, function (v) { draft.page.x = v; }, 1, 'mm')
    ]);
    group('Logo', [
      row('Size', function () { return draft.logo.size; }, function (v) { draft.logo.size = Math.max(20, Math.min(300, v)); }, 5, '%'),
      row('Up ↑', function () { return -draft.logo.y; }, function (v) { draft.logo.y = -v; }, 1, 'mm'),
      row('Right →', function () { return draft.logo.x; }, function (v) { draft.logo.x = v; }, 1, 'mm')
    ]);

    var msg = el('p', 'margin:0;min-height:18px;font-size:13px;');
    var btns = el('div', 'display:flex;gap:8px;flex-wrap:wrap;');
    var bSave = el('button', 'padding:9px 18px;border-radius:50px;border:0;background:#8d015d;color:#fff;font-weight:700;cursor:pointer;', 'Save');
    var bReset = el('button', 'padding:9px 14px;border-radius:50px;border:1px solid #e6cddc;background:#fff;color:#185fa5;font-weight:600;cursor:pointer;', 'Reset');
    var bClose = el('button', 'padding:9px 14px;border-radius:50px;border:1px solid #e6cddc;background:#fff;color:#185fa5;font-weight:600;cursor:pointer;', 'Close');
    [bSave, bReset, bClose].forEach(function (b) { b.type = 'button'; btns.appendChild(b); });
    side.appendChild(btns);
    side.appendChild(msg);
    card.appendChild(side);

    var timer = null;
    function render() {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var html = String(_origBuild(bodyHtml, 'Preview')).replace('</head>', printCss(draft) + '</head>');
        frame.srcdoc = html;
      }, 80);
    }
    function say(text, ok) { msg.textContent = text; msg.style.color = ok ? '#1f7a35' : '#a23a39'; }
    function close() { overlay.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }

    bClose.onclick = close;
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey);
    bReset.onclick = function () {
      draft = cloneAdj(ADJ_DEFAULT);
      rows.forEach(function (f) { f(); });
      render();
      say('Back to the default. Press Save to keep it.', true);
    };
    bSave.onclick = function () {
      bSave.disabled = true;
      say('Saving…', true);
      fetchJSONRetry({ action: 'saveHrPaperAdjust', token: empireGetToken(), adjust: draft }, 1, 20000).then(function (d) {
        if (!d || d.ok === false) {
          var m = (d && (d.message || d.error)) || 'Save failed.';
          if (/unknown action/i.test(m)) m = 'The server is not updated yet (empire-api deploy needed).';
          throw new Error(m);
        }
        _adj = cloneAdj(d.adjust || draft);
        say('Saved. E3 papers now print like this.', true);
      }).catch(function (err) {
        say(err.message || 'Save failed.', false);
      }).then(function () { bSave.disabled = false; });
    };

    document.body.appendChild(overlay);
    render();
  }

  function bindEditor() {
    if (company() !== 'E3' || !isAdmin()) return;
    var style = el('style', null, 'img.hr-f06-logo[data-company-logo="E3"]{cursor:pointer;}' +
      'img.hr-f06-logo[data-company-logo="E3"]:hover{outline:2px dashed #8d015d;outline-offset:3px;}' +
      '@media print{img.hr-f06-logo{outline:0!important;}}');
    document.head.appendChild(style);
    document.querySelectorAll('img.hr-f06-logo').forEach(function (i) { i.title = 'Click to adjust the E3 paper (admin)'; });
    document.addEventListener('click', function (e) {
      var img = e.target && e.target.closest && e.target.closest('img.hr-f06-logo');
      if (!img || company() !== 'E3' || !isAdmin()) return;
      e.preventDefault();
      e.stopPropagation();
      openEditor();
    }, true);
  }

  var TAG_CSS = 'display:inline-block;margin-left:8px;padding:1px 8px;border-radius:50px;' +
    'background:#8d015d;color:#fff;font-size:12px;font-weight:700;vertical-align:middle;';

  /* People who work in both companies (e.g. a director who only has HR) never see the hub,
   * so the badge becomes an E2 | E3 switch here. Others just see which company they are in. */
  function switchHtml(c) {
    return ['E2', 'E3'].map(function (x) {
      var on = x === c;
      return '<button type="button" data-company="' + x + '" aria-pressed="' + on + '" style="' +
        'border:0;cursor:pointer;font:inherit;font-size:12px;font-weight:700;line-height:1;padding:4px 9px;margin:0;' +
        'border-radius:50px;box-shadow:none;transform:none;' +
        (on ? 'background:#8d015d;color:#fff;' : 'background:transparent;color:#8d015d;') + '">' + x + '</button>';
    }).join('');
  }

  function addBadges() {
    var c = company();
    var canSwitch = typeof empireCanSwitchCompany === 'function' && empireCanSwitchCompany();
    if (c !== 'E3' && !canSwitch) return;
    document.querySelectorAll('[data-hr-i18n="deptTitle"], .wrap > header > h1').forEach(function (h) {
      if (h.querySelector('.company-tag')) return;
      var tag = document.createElement('span');
      tag.className = 'company-tag';
      if (!canSwitch) {
        tag.textContent = c;
        tag.style.cssText = TAG_CSS;
        h.appendChild(tag);
        return;
      }
      tag.setAttribute('role', 'group');
      tag.setAttribute('aria-label', 'Company');
      tag.style.cssText = 'display:inline-flex;gap:2px;margin-left:8px;padding:2px;border-radius:50px;' +
        'border:1px solid #e6cddc;background:#faf6f8;vertical-align:middle;';
      tag.innerHTML = switchHtml(c);
      tag.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-company]');
        if (!b) return;
        e.preventDefault();
        e.stopPropagation();
        var want = b.getAttribute('data-company');
        if (want === company()) return;
        if (typeof empireSetCompany === 'function' && empireSetCompany(want)) location.reload();
      });
      h.appendChild(tag);
    });
    if (document.title.indexOf(c + ' — ') !== 0) document.title = c + ' — ' + document.title;
  }

  function boot() {
    addBadges();
    hookPrint();
    swapAll(document);
    loadAdjust();
    bindEditor();
    if (company() !== 'E3' || typeof MutationObserver === 'undefined') return;
    new MutationObserver(function (list) {
      list.forEach(function (m) {
        m.addedNodes.forEach(function (n) {
          if (n.nodeType !== 1) return;
          if (n.matches && n.matches('img.hr-f06-logo')) swapLogo(n);
          else if (n.querySelectorAll) swapAll(n);
        });
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  /* The HR page re-reads the account after it loads (empireAuthRefreshPerms). Logins from before
   * E2/E3 only learn their companies then: redraw the switch, and reload once if the company changed
   * (e.g. an E3-only account that still had E2 saved), so the logo and lists match. */
  var bootCompany = company();
  if (typeof window.empireAuthRefreshPerms === 'function') {
    var origRefresh = window.empireAuthRefreshPerms;
    window.empireAuthRefreshPerms = function (onUpdate) {
      return origRefresh(function (d) {
        if (typeof onUpdate === 'function') onUpdate(d);
        if (company() !== bootCompany) { location.reload(); return; }
        document.querySelectorAll('.company-tag').forEach(function (t) { t.remove(); });
        addBadges();
      });
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
