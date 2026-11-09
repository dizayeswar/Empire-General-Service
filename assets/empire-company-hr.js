/* E2 / E3 on the HR pages.
 * - Shows which company the page is working in (badge next to "HR Department").
 * - E3 papers use the E3 logo. Only the picture changes: the locked HR-F-06 logo box
 *   (size, position, transforms) stays exactly as it is.
 * Needs empire-auth.js (empireGetCompany). Without it, everything stays E2.
 */
(function () {
  var E3_LOGO = 'assets/hr-f06-logo-e3.png?v=2026-11-09-e3';

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

  function addBadges() {
    var c = company();
    var showBadge = c === 'E3' || (typeof empireCanSwitchCompany === 'function' && empireCanSwitchCompany());
    if (!showBadge) return;
    document.querySelectorAll('[data-hr-i18n="deptTitle"], .wrap > header > h1').forEach(function (h) {
      if (h.querySelector('.company-tag')) return;
      var tag = document.createElement('span');
      tag.className = 'company-tag';
      tag.textContent = c;
      tag.style.cssText = 'display:inline-block;margin-left:8px;padding:1px 8px;border-radius:50px;' +
        'background:#8d015d;color:#fff;font-size:12px;font-weight:700;vertical-align:middle;';
      h.appendChild(tag);
    });
    if (document.title.indexOf(c + ' — ') !== 0) document.title = c + ' — ' + document.title;
  }

  function boot() {
    addBadges();
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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
