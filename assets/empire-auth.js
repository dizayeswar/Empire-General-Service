/* Empire World EGS — unified session (Phase 4) */

var EMPIRE_AUTH_KEYS = {
  token: 'empire_token',
  user: 'empire_user',
  role: 'empire_role',
  perms: 'empire_perms',
  tokenDept: 'empire_token_dept',
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

function empireCanAccessDept(requiredDept) {
  var td = String(empireGetTokenDept() || '').trim().toLowerCase();
  requiredDept = String(requiredDept || '').trim().toLowerCase();
  if (!empireGetToken() || !requiredDept) return false;
  if (td === 'all') return true;
  return td === requiredDept;
}

function empireSetSession(username, data) {
  data = data || {};
  empireAuthSet('loggedIn', 'true');
  empireAuthSet('user', username || data.username || '');
  empireAuthSet('token', data.token || '');
  empireAuthSet('role', data.role || '');
  empireAuthSet('perms', JSON.stringify(data.perms || {}));
  empireAuthSet('tokenDept', String(data.dept || data.tokenDept || '').trim().toLowerCase());
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
  'electrical department': 'electrical.html'
};

var EMPIRE_LOGIN_PAGE = 'index.html';

function empireNormDept(dept) {
  return String(dept || '').trim().toLowerCase();
}

function empireIsAdminSession() {
  return empireGetToken() && empireNormDept(empireGetTokenDept()) === 'all';
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
    return false;
  }

  if (!empireCanAccessDept(opts.dept) && !empireIsAdminSession()) {
    empireRedirectToDeptHome(empireGetTokenDept());
    return false;
  }

  if (loginPage) loginPage.classList.remove('show');
  if (main) main.classList.add('show');
  if (typeof opts.onEnter === 'function') opts.onEnter();
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
        if (typeof onUpdate === 'function') onUpdate(d);
      } else if (d && d.ok === false && String(d.error || '').toLowerCase().indexOf('token') !== -1) {
        empireAuthLogout({ reload: true });
      }
    })
    .catch(function () {});
}

empireMigrateSession();
