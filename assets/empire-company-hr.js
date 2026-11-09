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

  /* E3 printout only (2026-11-09, asked by the user): the HR-F-06 / Rev.2 footer prints ~17.5 mm
   * higher than the locked E2 footer (E2 print: translate(0,-13mm); the sheet prints at 94%, so
   * -31.5mm here = ~17.5 mm on paper). Added to every print page (single, batch, PDF) after the
   * locked print CSS, so it wins. The screen paper and the E2 print are not touched. */
  var E3_PRINT_CSS = '<style id="e3PrintFoot">.hr-f06-doc-foot{transform:translate(0,-31.5mm)!important;}</style>';

  function hookPrint() {
    if (typeof window.hrBuildPrintHtml_ !== 'function' || window.hrBuildPrintHtml_.e3Hooked) return;
    var orig = window.hrBuildPrintHtml_;
    var hooked = function (bodyHtml, title) {
      var html = orig.apply(this, arguments);
      if (company() !== 'E3') return html;
      return String(html).replace('</head>', E3_PRINT_CSS + '</head>');
    };
    hooked.e3Hooked = true;
    window.hrBuildPrintHtml_ = hooked;
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
