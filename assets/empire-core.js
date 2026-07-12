/* Empire World EGS - shared UI (Phase 2)
 * Theme, dialogs, sidebar, date helpers. */

var TOGGLE_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="15" cy="12" r="3"/><rect width="20" height="14" x="2" y="5" rx="7"/></svg>';

function fmtDT(s) {
  if (!s) return '';
  var d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(d.getTime())) return String(s);
  var z = function (n) {
    return String(n).padStart(2, '0');
  };
  var out =
    d.getFullYear() +
    '-' +
    z(d.getMonth() + 1) +
    '-' +
    z(d.getDate()) +
    ' ' +
    z(d.getHours()) +
    ':' +
    z(d.getMinutes());
  return out.replace(/ 00:00$/, '');
}

function dateOnly(s) {
  if (!s) return '';
  var str = String(s);
  var m = str.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  var d = new Date(str.replace(' ', 'T'));
  if (isNaN(d.getTime())) return str;
  var z = function (n) {
    return String(n).padStart(2, '0');
  };
  return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
}

function setEmpireLogos(theme) {
  var src = theme === 'dark' ? 'logo.png' : 'logo-light.png';
  document.querySelectorAll(
    'img.empire-logo, img.hub-toolbar-logo, img.sidebar-logo, img[alt="Empire World"], img[alt="Empire General Service"]'
  ).forEach(function (im) {
    im.onerror = function () {
      this.onerror = null;
      this.src = 'logo.png';
    };
    im.src = src;
  });
}

function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  setEmpireLogos(t);
  try {
    localStorage.setItem('empire_theme', t);
  } catch (e) {}
  document.querySelectorAll('.theme-btn').forEach(function (b) {
    var ic = b.querySelector('.theme-icon');
    if (ic) {
      ic.innerHTML = TOGGLE_ICON;
      ic.style.transform = t === 'dark' ? 'none' : 'scaleX(-1)';
    }
    var lbl = b.querySelector('.lbl');
    if (lbl) {
      lbl.textContent = t === 'dark' ? 'Dark Mode' : 'Light Mode';
    }
  });
}

function toggleTheme() {
  var cur = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(cur === 'dark' ? 'light' : 'dark');
}

(function () {
  var saved = 'light';
  try {
    saved = localStorage.getItem('empire_theme') || 'light';
  } catch (e) {}
  applyTheme(saved);
})();

function toggleSidebar() {
  var sb = document.getElementById('sidebar');
  if (!sb) return;
  var collapsed = sb.classList.toggle('collapsed');
  try {
    localStorage.setItem('empire_sidebar_collapsed', collapsed ? '1' : '0');
  } catch (e) {}
}

(function () {
  try {
    if (localStorage.getItem('empire_sidebar_collapsed') === '1') {
      var sb = document.getElementById('sidebar');
      if (sb) sb.classList.add('collapsed');
    }
  } catch (e) {}
})();

(function () {
  function ov() {
    var o = document.getElementById('uiDlg');
    if (!o) {
      o = document.createElement('div');
      o.id = 'uiDlg';
      o.style.cssText =
        'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:4000;align-items:center;justify-content:center;';
      o.innerHTML =
        '<div style="background:var(--panel);border:2px solid var(--card-border);border-radius:14px;max-width:430px;width:92%;padding:24px;box-shadow:0 10px 40px var(--shadow);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;"><div id="uiDlgMsg" style="font-size:15px;line-height:1.5;margin-bottom:18px;white-space:pre-wrap;"></div><div id="uiDlgBtns" style="display:flex;gap:10px;justify-content:flex-end;"></div></div>';
      document.body.appendChild(o);
    }
    return o;
  }
  function mkbtn(t, bg) {
    var b = document.createElement('button');
    b.textContent = t;
    b.style.cssText =
      'background:' +
      bg +
      ';color:#fff;border:2px solid ' +
      bg +
      ';padding:10px 18px;border-radius:6px;font-weight:600;font-size:14px;cursor:pointer;';
    return b;
  }
  window.uiAlert = function (msg) {
    return new Promise(function (res) {
      var o = ov();
      document.getElementById('uiDlgMsg').textContent = String(msg);
      var bw = document.getElementById('uiDlgBtns');
      bw.innerHTML = '';
      var ok = mkbtn('OK', '#8d015d');
      ok.onclick = function () {
        o.style.display = 'none';
        res();
      };
      bw.appendChild(ok);
      o.style.display = 'flex';
      setTimeout(function () {
        ok.focus();
      }, 30);
    });
  };
  window.uiConfirm = function (msg) {
    return new Promise(function (res) {
      var o = ov();
      document.getElementById('uiDlgMsg').textContent = String(msg);
      var bw = document.getElementById('uiDlgBtns');
      bw.innerHTML = '';
      var c = mkbtn('Cancel', '#888');
      c.onclick = function () {
        o.style.display = 'none';
        res(false);
      };
      var ok = mkbtn('OK', '#C5504F');
      ok.onclick = function () {
        o.style.display = 'none';
        res(true);
      };
      bw.appendChild(c);
      bw.appendChild(ok);
      o.style.display = 'flex';
      setTimeout(function () {
        ok.focus();
      }, 30);
    });
  };
  window.alert = function (m) {
    window.uiAlert(m);
  };
})();

/** Saved typography + light-mode dimming (hub pages and others). */
(function () {
  try {
    var st = JSON.parse(localStorage.getItem('ewTypography') || '{}');
    var r = document.documentElement.style;
    if (st.h1) r.setProperty('--fs-h1', st.h1 + 'px');
    if (st.h2) r.setProperty('--fs-h2', st.h2 + 'px');
    if (st.h3) r.setProperty('--fs-h3', st.h3 + 'px');
    if (st.body) r.setProperty('--fs-body', st.body + 'px');
    if (st.btn) r.setProperty('--fs-btn', st.btn + 'px');
    if (st.font) {
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href =
        'https://fonts.googleapis.com/css2?family=' +
        st.font +
        ':wght@400;600;700&display=swap';
      document.head.appendChild(l);
      r.setProperty(
        '--app-font',
        "'" + st.font + "',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"
      );
    }
    var LT = {
      '--bg': '#f4f6fb',
      '--panel': '#ffffff',
      '--card': '#ffffff',
      '--header-bg': '#ffffff',
      '--btn-bg': '#ffffff',
      '--tab-bg': '#ffffff'
    };
    function shade(hex, f) {
      var n = parseInt(hex.slice(1), 16);
      return (
        'rgb(' +
        Math.round(((n >> 16) & 255) * f) +
        ',' +
        Math.round(((n >> 8) & 255) * f) +
        ',' +
        Math.round((n & 255) * f) +
        ')'
      );
    }
    function dim() {
      var isLight = document.documentElement.getAttribute('data-theme') !== 'dark';
      var d = st.dim || 0;
      Object.keys(LT).forEach(function (k) {
        if (isLight && d > 0) document.documentElement.style.setProperty(k, shade(LT[k], 1 - d / 100));
        else document.documentElement.style.removeProperty(k);
      });
    }
    new MutationObserver(dim).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
    dim();
  } catch (e) {}
})();

function syncMonthInput(input) {
  if (!input) return;
  input.classList.toggle('has-value', !!input.value);
}

function initMonthPickers() {
  document.querySelectorAll('.month-input-wrap input[type="month"]').forEach(function (input) {
    syncMonthInput(input);
    if (input._monthBound) return;
    input._monthBound = true;
    input.addEventListener('change', function () {
      syncMonthInput(input);
    });
    input.addEventListener('input', function () {
      syncMonthInput(input);
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMonthPickers);
} else {
  initMonthPickers();
}
window.addEventListener('load', initMonthPickers);

(function loadEmpirePwa() {
  if (!('serviceWorker' in navigator)) return;
  var s = document.createElement('script');
  s.src = 'assets/empire-pwa.js';
  s.async = true;
  document.head.appendChild(s);
})();
