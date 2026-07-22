/* Empire World EGS — unified session (Phase 4) */

var EMPIRE_AUTH_KEYS = {
  token: 'empire_token',
  user: 'empire_user',
  role: 'empire_role',
  perms: 'empire_perms',
  tokenDept: 'empire_token_dept',
  projects: 'empire_projects',
  trade: 'empire_trade',
  electricalHide: 'empire_electrical_hide',
  loggedIn: 'empire_loggedIn'
};

var EMPIRE_LEGACY_PROFILES = [
  { token: 'authToken', user: 'currentUser', role: 'userRole', perms: null, loggedIn: 'isLoggedIn', tokenDept: 'cleaning' },
  { token: 'hse_token', user: 'hse_user', role: 'hse_role', perms: 'hse_perms', loggedIn: 'hse_isLoggedIn', tokenDept: 'hse' },
  { token: 'civdept_token', user: 'civdept_user', role: 'civdept_role', perms: 'civdept_perms', loggedIn: 'civdept_loggedIn', tokenDept: 'civil department' },
  { token: 'eldept_token', user: 'eldept_user', role: 'eldept_role', perms: 'eldept_perms', loggedIn: 'eldept_loggedIn', tokenDept: 'electrical department' },
  { token: 'civ_token', user: 'civ_user', role: 'civ_role', perms: 'civ_perms', loggedIn: 'civ_isLoggedIn', tokenDept: 'civil issue' },
  { token: 'fire_token', user: 'fire_user', role: 'fire_role', perms: 'fire_perms', loggedIn: 'fire_isLoggedIn', tokenDept: 'fire' },
  { token: 'elec_token', user: 'elec_user', role: 'elec_role', perms: 'elec_perms', loggedIn: 'elec_isLoggedIn', tokenDept: 'electric issue' }
];

var EMPIRE_LEGACY_CLEAR_KEYS = [
  'isLoggedIn', 'currentUser', 'authToken', 'userRole', 'cleaning_reports_cache',
  'hse_isLoggedIn', 'hse_user', 'hse_token', 'hse_role', 'hse_perms', 'hse_issues_cache',
  'civdept_loggedIn', 'civdept_user', 'civdept_token', 'civdept_role', 'civdept_perms', 'civdept_jobs_cache',
  'eldept_loggedIn', 'eldept_user', 'eldept_token', 'eldept_role', 'eldept_perms', 'eldept_jobs_cache',
  'civ_isLoggedIn', 'civ_user', 'civ_token', 'civ_role', 'civ_perms', 'civ_issues_cache', 'civ_issues_cache_ts',
  'fire_isLoggedIn', 'fire_user', 'fire_token', 'fire_role', 'fire_perms', 'fire_issues_cache', 'fire_issues_cache_ts',
  'elec_isLoggedIn', 'elec_user', 'elec_token', 'elec_role', 'elec_perms', 'elec_issues_cache', 'elec_issues_cache_ts'
];

function empireAuthLs(k) {
  return localStorage.getItem(EMPIRE_AUTH_KEYS[k]) || '';
}

function empireAuthSet(k, v) {
  if (v === undefined || v === null || v === '') localStorage.removeItem(EMPIRE_AUTH_KEYS[k]);
  else localStorage.setItem(EMPIRE_AUTH_KEYS[k], v);
}

function empireMigrateSession() {
  if (empireAuthLs('token')) return;
  for (var i = 0; i < EMPIRE_LEGACY_PROFILES.length; i++) {
    var p = EMPIRE_LEGACY_PROFILES[i];
    var tk = localStorage.getItem(p.token) || '';
    if (!tk) continue;
    empireAuthSet('token', tk);
    empireAuthSet('user', localStorage.getItem(p.user) || '');
    empireAuthSet('role', localStorage.getItem(p.role) || '');
    if (p.perms) empireAuthSet('perms', localStorage.getItem(p.perms) || '{}');
    empireAuthSet('tokenDept', p.tokenDept || '');
    empireAuthSet('loggedIn', 'true');
    return;
  }
}

function empireGetToken() {
  empireMigrateSession();
  return empireAuthLs('token');
}

function empireGetUser() {
  empireMigrateSession();
  return empireAuthLs('user');
}

function empireGetRole() {
  empireMigrateSession();
  return empireAuthLs('role');
}

function empireGetPerms() {
  empireMigrateSession();
  try {
    return JSON.parse(empireAuthLs('perms') || '{}');
  } catch (e) {
    return {};
  }
}

function empireGetTokenDept() {
  empireMigrateSession();
  return empireAuthLs('tokenDept');
}

function empireGetProjects() {
  empireMigrateSession();
  try {
    var raw = empireAuthLs('projects');
    if (!raw) return null;
    var list = JSON.parse(raw);
    if (!Array.isArray(list) || !list.length) return null;
    return list;
  } catch (e) {
    return null;
  }
}

function empireGetTrade() {
  empireMigrateSession();
  return empireAuthLs('trade');
}

function empireGetElectricalHide() {
  empireMigrateSession();
  return empireAuthLs('electricalHide');
}

function empireApplyHideTokens_(p, hide) {
  p = p || {};
  var raw = String(hide || '').toLowerCase();
  if (!raw) return p;
  var out = {};
  var k;
  for (k in p) {
    if (Object.prototype.hasOwnProperty.call(p, k)) out[k] = p[k];
  }
  var tokens = raw.indexOf(',') === -1 ? [raw] : raw.split(',');
  tokens.forEach(function (tok) {
    tok = String(tok || '').trim();
    if (!tok) return;
    if (tok.indexOf('add') !== -1) out.add = false;
    if (tok.indexOf('edit') !== -1) out.edit = false;
    if (tok.indexOf('delete') !== -1 || tok.indexOf('del') !== -1) out.del = false;
    if (tok.indexOf('analytic') !== -1) out.analytics = false;
    if (tok.indexOf('report') !== -1 || tok.indexOf('monthly') !== -1) out.report = false;
    if (tok.indexOf('dashboard') !== -1 || tok === 'dash') out.dashboard = false;
    if (tok.indexOf('categor') !== -1) out.categories = false;
    if (tok.indexOf('live') !== -1 && tok.indexOf('loc') !== -1) out.liveLocation = false;
    if (tok.indexOf('field report') !== -1) out.fieldReports = false;
    if (tok.indexOf('jobs') !== -1 || tok === 'job') out.jobsTab = false;
    if (tok.indexOf('issues') !== -1 || tok === 'issue') out.issuesTab = false;
    if (tok.indexOf('not electric') !== -1 || tok.indexOf('not civil') !== -1 || tok.indexOf('not dept') !== -1) out.notElectricTab = false;
    if (tok.indexOf('needs month') !== -1 || tok.indexOf('fix delay') !== -1) out.fixDelayTab = false;
  });
  return out;
}

function empireMergeElectricalHidePerms(basePerms, electricalHide) {
  return empireApplyHideTokens_(basePerms, electricalHide);
}

function empireGetElectricalPerms() {
  return empireMergeElectricalHidePerms(empireGetPerms(), empireGetElectricalHide());
}

function empireCanAccessProject(project) {
  var scoped = empireGetProjects();
  if (!scoped) return true;
  return scoped.indexOf(String(project || '').trim().toLowerCase()) !== -1;
}

function empireParseDeptList(deptStr) {
  var s = empireNormDept(deptStr);
  if (!s) return [];
  if (s === 'all') return ['all'];
  if (s.indexOf(',') === -1) return [s];
  return s.split(',').map(function (p) { return p.trim(); }).filter(Boolean);
}

function empireCanAccessDept(requiredDept) {
  if (!empireGetToken() || !requiredDept) return false;
  var required = empireParseDeptList(requiredDept);
  if (!required.length) return false;
  var list = empireParseDeptList(empireGetTokenDept());
  if (list.indexOf('all') !== -1) return true;
  for (var i = 0; i < required.length; i++) {
    var r = required[i];
    if (list.indexOf(r) !== -1) return true;
    if (r === 'electrical department' && list.indexOf('electric issue') !== -1) return true;
    if (r === 'electric issue' && list.indexOf('electrical department') !== -1) return true;
  }
  return false;
}

function empireAuthMarkLoginVisible(visible) {
  try {
    document.body.classList.toggle('auth-login-visible', !!visible);
    document.body.classList.toggle('auth-ready', !visible);
  } catch (e) {}
}

function empireSetSession(username, data) {
  data = data || {};
  empireAuthSet('loggedIn', 'true');
  empireAuthSet('user', username || data.username || '');
  empireAuthSet('token', data.token || '');
  empireAuthSet('role', data.role || '');
  empireAuthSet('perms', JSON.stringify(data.perms || {}));
  empireAuthSet('tokenDept', String(data.dept || data.tokenDept || '').trim().toLowerCase());
  empireAuthSet('projects', JSON.stringify(data.projects || []));
  empireAuthSet('trade', String(data.trade || '').trim().toLowerCase());
  empireAuthSet('electricalHide', String(data.electricalHide || '').trim());
}

function empireClearLegacyKeys() {
  EMPIRE_LEGACY_CLEAR_KEYS.forEach(function (k) {
    try {
      localStorage.removeItem(k);
    } catch (e) {}
  });
}

function empireClearSession() {
  Object.keys(EMPIRE_AUTH_KEYS).forEach(function (k) {
    try {
      localStorage.removeItem(EMPIRE_AUTH_KEYS[k]);
    } catch (e) {}
  });
  empireClearLegacyKeys();
}

var EMPIRE_DEPT_HOME = {
  cleaning: 'cleaning-dashboard.html',
  'civil issue': 'civil-issue.html',
  fire: 'fire-issue.html',
  'electric issue': 'electric-issue.html',
  hse: 'hse-inspection.html',
  'civil department': 'civil-department.html',
  'electrical department': 'electrical.html',
  asaas: 'asaas.html'
};

var EMPIRE_LOGIN_PAGE = 'index.html';

function empireNormDept(dept) {
  return String(dept || '').trim().toLowerCase();
}

function empireIsAdminSession() {
  return empireGetToken() && empireNormDept(empireGetTokenDept()) === 'all';
}

function empireIsMultiDeptSession() {
  return empireParseDeptList(empireGetTokenDept()).length > 1;
}

function empireSingleDeptHome() {
  var list = empireParseDeptList(empireGetTokenDept());
  if (list.length === 1 && list[0] !== 'all') return list[0];
  return null;
}

function empireRedirectToUserHome() {
  var single = empireSingleDeptHome();
  if (single) {
    empireRedirectToDeptHome(single);
    return;
  }
  if (!empireOnLoginPage()) location.replace(EMPIRE_LOGIN_PAGE);
}

function empireHomeForDept(dept) {
  return EMPIRE_DEPT_HOME[empireNormDept(dept)] || EMPIRE_LOGIN_PAGE;
}

function empireRedirectToDeptHome(dept) {
  var url = empireHomeForDept(dept);
  if (url && location.pathname.indexOf(url) === -1) location.replace(url);
}

function empireOnLoginPage() {
  var path = (location.pathname || '').toLowerCase();
  if (path.endsWith('/index.html')) return true;
  if (path.endsWith('/')) return true;
  var file = path.split('/').pop();
  return !file || file === 'index.html';
}

function empireAuthLogout(opts) {
  opts = opts || {};
  empireClearSession();
  if (opts.extraKeys) {
    opts.extraKeys.forEach(function (k) {
      try {
        localStorage.removeItem(k);
      } catch (e) {}
    });
  }
  if (opts.redirect) location.href = opts.redirect;
  else if (opts.reload !== false) location.reload();
}

function empireAuthLogoutTxt_(key, fallback, params) {
  if (typeof workerT === 'function') {
    var w = workerT(key, params);
    if (w && w !== key) return w;
  }
  if (typeof asaasT === 'function') {
    var a = asaasT(key, params);
    if (a && a !== key) return a;
  }
  if (typeof fallback === 'function') return fallback(params || {});
  return fallback != null ? fallback : key;
}

function empireAuthMobileLogoutRequired_(opts) {
  opts = opts || {};
  if (opts.requirePassword === true) return true;
  if (opts.requirePassword === false) return false;
  if (document.body && document.body.classList.contains('civil-worker-mode')) return true;
  var asaasMobile = document.getElementById('asaasMobileApp');
  if (asaasMobile && asaasMobile.classList.contains('show')) return true;
  return false;
}

function empireAuthEnsureLogoutModal_() {
  if (document.getElementById('empireLogoutModal')) return;
  var modal = document.createElement('div');
  modal.id = 'empireLogoutModal';
  modal.className = 'worker-modal empire-logout-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'empireLogoutModalTitle');
  modal.innerHTML = ''
    + '<header class="worker-modal-head empire-logout-modal-head">'
    + '<strong id="empireLogoutModalTitle" data-empire-logout-i18n="logoutConfirmTitle">Log out?</strong>'
    + '</header>'
    + '<div class="worker-modal-scroll empire-logout-modal-body">'
    + '<p class="empire-logout-lead" data-empire-logout-i18n="logoutConfirmLead">Enter your login password to confirm logout.</p>'
    + '<label class="worker-field-label" for="empireLogoutPassword" data-empire-logout-i18n="logoutPasswordLabel">Password</label>'
    + '<input type="password" id="empireLogoutPassword" class="worker-field-input empire-logout-password" autocomplete="current-password" data-empire-logout-i18n-placeholder="logoutPasswordPlaceholder" placeholder="Your login password">'
    + '<p id="empireLogoutMsg" class="worker-field-msg empire-logout-msg" aria-live="polite"></p>'
    + '<div class="empire-logout-actions">'
    + '<button type="button" id="empireLogoutCancelBtn" class="worker-field-photo-btn empire-logout-cancel" data-empire-logout-i18n="logoutCancel">Cancel</button>'
    + '<button type="button" id="empireLogoutConfirmBtn" class="worker-field-submit empire-logout-confirm" data-empire-logout-i18n="logoutConfirmBtn">Log out</button>'
    + '</div></div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', function (ev) {
    if (ev.target === modal) empireAuthCloseLogoutModal_();
  });
  var cancelBtn = document.getElementById('empireLogoutCancelBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', empireAuthCloseLogoutModal_);
  var confirmBtn = document.getElementById('empireLogoutConfirmBtn');
  if (confirmBtn) confirmBtn.addEventListener('click', empireAuthConfirmLogout_);
  var pwEl = document.getElementById('empireLogoutPassword');
  if (pwEl) {
    pwEl.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        empireAuthConfirmLogout_();
      }
    });
  }
}

var _empireLogoutPendingOpts = null;
var _empireLogoutVerifying = false;

function empireAuthLogoutModalApplyLang_() {
  var modal = document.getElementById('empireLogoutModal');
  if (!modal) return;
  modal.querySelectorAll('[data-empire-logout-i18n]').forEach(function (el) {
    var key = el.getAttribute('data-empire-logout-i18n');
    if (!key) return;
    el.textContent = empireAuthLogoutTxt_(key, el.textContent);
  });
  modal.querySelectorAll('[data-empire-logout-i18n-placeholder]').forEach(function (el) {
    var key = el.getAttribute('data-empire-logout-i18n-placeholder');
    if (!key) return;
    el.placeholder = empireAuthLogoutTxt_(key, el.placeholder || '');
  });
}

function empireAuthCloseLogoutModal_() {
  var modal = document.getElementById('empireLogoutModal');
  if (modal) modal.classList.remove('show');
  _empireLogoutPendingOpts = null;
  _empireLogoutVerifying = false;
  var pwEl = document.getElementById('empireLogoutPassword');
  if (pwEl) pwEl.value = '';
  var msg = document.getElementById('empireLogoutMsg');
  if (msg) {
    msg.textContent = '';
    msg.className = 'worker-field-msg empire-logout-msg';
  }
  var btn = document.getElementById('empireLogoutConfirmBtn');
  if (btn) btn.disabled = false;
}

function empireAuthConfirmLogout_() {
  if (_empireLogoutVerifying || !_empireLogoutPendingOpts) return;
  var pwEl = document.getElementById('empireLogoutPassword');
  var msg = document.getElementById('empireLogoutMsg');
  var btn = document.getElementById('empireLogoutConfirmBtn');
  var password = pwEl ? String(pwEl.value || '').trim() : '';
  var username = empireGetUser();
  if (!password) {
    if (msg) {
      msg.textContent = empireAuthLogoutTxt_('logoutNeedPassword', 'Enter your password.');
      msg.className = 'worker-field-msg worker-field-msg-error empire-logout-msg';
    }
    if (pwEl) pwEl.focus();
    return;
  }
  if (typeof empireVerifyPassword !== 'function') {
    empireAuthCloseLogoutModal_();
    if (typeof _empireLogoutPendingOpts.beforeLogout === 'function') _empireLogoutPendingOpts.beforeLogout();
    empireAuthLogout(_empireLogoutPendingOpts);
    return;
  }
  _empireLogoutVerifying = true;
  if (btn) btn.disabled = true;
  if (msg) {
    msg.textContent = empireAuthLogoutTxt_('logoutChecking', 'Checking password\u2026');
    msg.className = 'worker-field-msg empire-logout-msg';
  }
  empireVerifyPassword(username, password).then(function (d) {
    if (d && (d.ok || d.success)) {
      var opts = _empireLogoutPendingOpts;
      empireAuthCloseLogoutModal_();
      if (typeof opts.beforeLogout === 'function') opts.beforeLogout();
      empireAuthLogout(opts);
      return;
    }
    if (msg) {
      msg.textContent = empireAuthLogoutTxt_('logoutWrongPassword', 'Wrong password. Try again.');
      msg.className = 'worker-field-msg worker-field-msg-error empire-logout-msg';
    }
    if (pwEl) {
      pwEl.value = '';
      pwEl.focus();
    }
  }).catch(function () {
    if (msg) {
      msg.textContent = empireAuthLogoutTxt_('logoutVerifyFailed', 'Could not verify password. Check your signal and try again.');
      msg.className = 'worker-field-msg worker-field-msg-error empire-logout-msg';
    }
  }).finally(function () {
    _empireLogoutVerifying = false;
    if (btn) btn.disabled = false;
  });
}

function empireAuthWorkerLogout(opts) {
  opts = opts || {};
  if (!empireAuthMobileLogoutRequired_(opts)) {
    if (typeof opts.beforeLogout === 'function') opts.beforeLogout();
    empireAuthLogout(opts);
    return;
  }
  empireAuthEnsureLogoutModal_();
  empireAuthLogoutModalApplyLang_();
  _empireLogoutPendingOpts = opts;
  var modal = document.getElementById('empireLogoutModal');
  var pwEl = document.getElementById('empireLogoutPassword');
  var msg = document.getElementById('empireLogoutMsg');
  if (msg) {
    msg.textContent = '';
    msg.className = 'worker-field-msg empire-logout-msg';
  }
  if (modal) modal.classList.add('show');
  if (pwEl) {
    pwEl.value = '';
    setTimeout(function () { pwEl.focus(); }, 60);
  }
}

function empireAuthLogin(e, dept, opts) {
  if (e && e.preventDefault) e.preventDefault();
  opts = opts || {};
  var u = (document.getElementById(opts.usernameId || 'loginUsername') || {}).value || '';
  var p = (document.getElementById(opts.passwordId || 'loginPassword') || {}).value || '';
  var m = opts.messageEl || document.getElementById('loginMessage');
  return empireLogin({ username: u, password: p, dept: dept, messageEl: m }).then(function (d) {
    empireSetSession(u, d);
    empireClearLegacyKeys();
    if (typeof opts.onSuccess === 'function') opts.onSuccess(d);
    return d;
  });
}

function empireAuthPageBoot(opts) {
  opts = opts || {};
  empireMigrateSession();
  var loginPage = document.getElementById(opts.loginPageId || 'loginPage');
  var main = document.getElementById(opts.mainId || 'mainContainer');

  if (!empireGetToken()) {
    if (opts.sendToHomeLogin !== false && !empireOnLoginPage()) {
      location.replace(EMPIRE_LOGIN_PAGE);
      return false;
    }
    if (loginPage) loginPage.classList.add('show');
    if (main) main.classList.remove('show');
    empireAuthMarkLoginVisible(true);
    return false;
  }

  if (!empireCanAccessDept(opts.dept)) {
    empireRedirectToUserHome();
    return false;
  }

  if (loginPage) loginPage.classList.remove('show');
  empireAuthMarkLoginVisible(false);
  if (typeof opts.onEnter === 'function') opts.onEnter();
  else if (main) main.classList.add('show');
  return true;
}

var _empireSessionLogoutActive = false;

function empireAuthSessionLogout(opts) {
  if (_empireSessionLogoutActive) return;
  _empireSessionLogoutActive = true;
  opts = opts || {};
  empireAuthLogout({
    extraKeys: opts.extraKeys,
    redirect: opts.redirect || EMPIRE_LOGIN_PAGE,
    reload: false
  });
}

function empireSessionInvalid_(d) {
  if (!d || d.ok !== false) return false;
  var err = String(d.error || '').toLowerCase().trim();
  if (!err) return false;
  if (err === 'password_changed' || err === 'session_expired') return true;
  if (err === 'invalid token' || err === 'token expired' || err === 'no token') return true;
  if (err === 'not authenticated' || err === 'not_authenticated') return true;
  return false;
}

function empireAuthHandleInvalidSession_(d, opts) {
  opts = opts || {};
  if (!empireSessionInvalid_(d)) return false;
  empireAuthSessionLogout(opts);
  return true;
}

function empireAuthRefreshPerms(onUpdate) {
  var tk = empireGetToken();
  if (!tk) return;
  return fetchJSONRetry({ action: 'getPerms', token: tk })
    .then(function (d) {
      if (d && d.ok && d.perms) {
        empireAuthSet('perms', JSON.stringify(d.perms));
        if (d.role) empireAuthSet('role', d.role);
        if (d.projects) empireAuthSet('projects', JSON.stringify(d.projects));
        if (d.trade) empireAuthSet('trade', String(d.trade).trim().toLowerCase());
        if (d.electricalHide != null) empireAuthSet('electricalHide', String(d.electricalHide || '').trim());
        if (typeof onUpdate === 'function') onUpdate(d);
      } else if (empireAuthHandleInvalidSession_(d)) {
        return;
      }
    })
    .catch(function () {});
}

(function empireAuthBindBfCacheFix_() {
  if (window.__empireAuthBfCacheBound) return;
  window.__empireAuthBfCacheBound = true;
  window.addEventListener('pageshow', function (ev) {
    if (!ev || !ev.persisted) return;
    var lp = document.getElementById('loginPage');
    if (!lp || !lp.classList.contains('show')) return;
    empireAuthMarkLoginVisible(true);
    try {
      var key = 'empire_bf_' + location.pathname;
      if (sessionStorage.getItem(key) === '1') return;
      sessionStorage.setItem(key, '1');
    } catch (e) {}
    location.reload();
  });
})();

empireMigrateSession();
