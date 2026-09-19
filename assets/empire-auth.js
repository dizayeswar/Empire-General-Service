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
  warehouseSigSections: 'empire_warehouse_sig_sections',
  moduleAccess: 'empire_module_access',
  signature: 'empire_user_signature',
  signatureRole: 'empire_user_signature_role',
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

function empireGetWarehouseSigSections() {
  empireMigrateSession();
  try {
    var list = JSON.parse(empireAuthLs('warehouseSigSections') || '[]');
    if (!Array.isArray(list)) return [];
    var allowed = { auth: 1, issued: 1, received: 1 };
    return list
      .map(function (s) { return String(s || '').trim().toLowerCase(); })
      .filter(function (s) { return !!allowed[s]; });
  } catch (e) {
    return [];
  }
}

function empireGetModuleAccess() {
  empireMigrateSession();
  try {
    var o = JSON.parse(empireAuthLs('moduleAccess') || '{}');
    if (!o || typeof o !== 'object') return {};
    return empireFoldModuleAccess(o);
  } catch (e) {
    return {};
  }
}

var EMPIRE_CHARGING_SECTIONS = [
  'charging_dash', 'charging_summary', 'charging_waiting', 'charging_charged',
  'charging_bin', 'charging_bot', 'charging_reset'
];

var EMPIRE_SECTION_FOLD_GROUPS = [
  {
    parent: 'cleaning',
    children: [
      'cleaning_dash', 'cleaning_analytics', 'cleaning_monthly',
      'cleaning_ec', 'cleaning_es', 'cleaning_wd', 'cleaning_ww', 'cleaning_ww2', 'cleaning_ra'
    ]
  },
  { parent: 'civil_department', children: ['civil_jobs', 'civil_field', 'civil_add', 'civil_report', 'civil_analytics'] },
  {
    parent: 'civil_issue',
    children: ['civil_iss_list', 'civil_iss_add', 'civil_iss_analytics', 'civil_iss_not', 'civil_iss_delay', 'civil_iss_gps']
  },
  {
    parent: 'electrical_department',
    children: ['elec_jobs', 'elec_field', 'elec_add', 'elec_report', 'elec_analytics', 'elec_minus']
  },
  {
    parent: 'electric_issue',
    children: ['elec_iss_list', 'elec_iss_add', 'elec_iss_analytics', 'elec_iss_not', 'elec_iss_delay', 'elec_iss_gps']
  },
  { parent: 'hse', children: ['hse_log', 'hse_add', 'hse_monthly', 'hse_analytics'] },
  { parent: 'fire', children: ['fire_list', 'fire_add', 'fire_analytics'] },
  { parent: 'asaas', children: ['asaas_list', 'asaas_analytics'] },
  { parent: 'application', children: ['app_door', 'app_summary', 'app_issues'] },
  { parent: 'ups', children: ['ups_register', 'ups_checklist', 'ups_history', 'ups_summary', 'ups_add'] },
  {
    parent: 'charging',
    children: EMPIRE_CHARGING_SECTIONS,
    skipOnLegacy: ['charging_bot'],
    writeOnlyOnLegacy: ['charging_bin', 'charging_reset']
  },
  {
    parent: 'warehouse_desk',
    children: [
      'warehouse_note', 'warehouse_saved', 'warehouse_sap', 'warehouse_spusage',
      'warehouse_sigs'
    ]
  },
  {
    parent: 'warehouse_invoices',
    children: ['warehouse_invoice', 'warehouse_invsp', 'warehouse_invamount'],
    stickyParent: true
  }
];

function empireAccessRank_(v) {
  v = String(v || 'none').trim().toLowerCase();
  if (v === 'write') return 2;
  if (v === 'read') return 1;
  return 0;
}

function empireMaxAccessLevel_() {
  var max = 0;
  for (var i = 0; i < arguments.length; i++) {
    var r = empireAccessRank_(arguments[i]);
    if (r > max) max = r;
  }
  return max === 2 ? 'write' : (max === 1 ? 'read' : 'none');
}

function empireFoldModuleAccess(src) {
  var o = src && typeof src === 'object' ? src : {};
  var out = {};
  Object.keys(o).forEach(function (k) { out[k] = o[k]; });
  EMPIRE_SECTION_FOLD_GROUPS.forEach(function (g) {
    var anyChild = g.children.some(function (k) {
      return empireAccessRank_(out[k]) > 0;
    });
    var parent = String(out[g.parent] || 'none').trim().toLowerCase();
    if (!anyChild && (parent === 'read' || parent === 'write')) {
      g.children.forEach(function (k) {
        if (g.skipOnLegacy && g.skipOnLegacy.indexOf(k) !== -1) return;
        if (g.writeOnlyOnLegacy && g.writeOnlyOnLegacy.indexOf(k) !== -1) {
          if (parent === 'write') out[k] = 'write';
          return;
        }
        out[k] = parent;
      });
    }
    if (!g.stickyParent) {
      var levels = [out[g.parent]];
      g.children.forEach(function (k) { levels.push(out[k]); });
      out[g.parent] = empireMaxAccessLevel_.apply(null, levels);
    }
  });
  return out;
}

function empireFoldChargingAccess(src) {
  return empireFoldModuleAccess(src);
}

function empireApplySectionNav() {
  try {
    var nodes = document.querySelectorAll('[data-access-key]');
    if (!nodes.length) return;
    var isAdmin = typeof empireIsAdminRole === 'function' && empireIsAdminRole();
    nodes.forEach(function (el) {
      var key = el.getAttribute('data-access-key');
      if (!key) return;
      var ok = isAdmin || empireModuleLevel(key) !== 'none';
      if (ok) return;
      el.style.display = 'none';
      el.classList.remove('active');
    });
    var activeBtn = document.querySelector('.side-nav .tab-btn.active, .side-nav-issue .tab-btn.active, .cm-tab.active, .worker-tab-btn.active');
    if (activeBtn && activeBtn.style.display === 'none') {
      var next = null;
      document.querySelectorAll('.side-nav .tab-btn[data-access-key], .side-nav-issue .tab-btn[data-access-key], .cm-tab[data-access-key], .worker-tab-btn[data-access-key]').forEach(function (b) {
        if (next || b.style.display === 'none') return;
        next = b;
      });
      if (next) next.click();
    }
  } catch (e) {}
}

function empireGetSignature() {
  empireMigrateSession();
  return empireAuthLs('signature');
}

function empireSetSignature(url) {
  empireAuthSet('signature', String(url || ''));
}

function empireGetSignatureRole() {
  empireMigrateSession();
  var v = String(empireAuthLs('signatureRole') || '').trim().toLowerCase();
  if (v === 'employee') return 'emp';
  if (v === 'line_manager' || v === 'manager') return 'line';
  if (v === 'emp' || v === 'line' || v === 'director' || v === 'hr') return v;
  return '';
}

function empireSetSignatureRole(role) {
  empireAuthSet('signatureRole', String(role || ''));
}

function empireModuleLevel(key) {
  var v = String(empireGetModuleAccess()[key] || 'none').trim().toLowerCase();
  if (v === 'read' || v === 'write') return v;
  return 'none';
}

function empireIsWarehouseSigner() {
  var staffKeys = [
    'warehouse_note', 'warehouse_saved', 'warehouse_sap', 'warehouse_spusage', 'warehouse_sigs',
    'warehouse_invoice', 'warehouse_invoices', 'warehouse_invsp', 'warehouse_invamount'
  ];
  for (var i = 0; i < staffKeys.length; i++) {
    if (empireModuleLevel(staffKeys[i]) !== 'none') return false;
  }
  if (
    empireModuleLevel('warehouse_assigned') !== 'none' ||
    empireModuleLevel('warehouse_done') !== 'none' ||
    empireModuleLevel('warehouse_sig_auth') !== 'none' ||
    empireModuleLevel('warehouse_sig_issued') !== 'none' ||
    empireModuleLevel('warehouse_sig_received') !== 'none'
  ) {
    return true;
  }
  var role = String(empireGetRole() || '').toLowerCase().replace(/[\s-]+/g, '_');
  if (role === 'warehouse_receiver' || role === 'receiver') return true;
  // Editor/Admin with warehouse (or all) in Department = full GIN desk.
  if ((role === 'admin' || role === 'editor') && typeof empireCanAccessDept === 'function' && empireCanAccessDept('warehouse')) {
    return false;
  }
  return empireGetWarehouseSigSections().length > 0;
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
    if (tok.indexOf('minus') !== -1) out.minusTab = false;
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
  if (typeof empireIsAdminRole === 'function' && empireIsAdminRole()) return true;
  var required = empireParseDeptList(requiredDept);
  if (!required.length) return false;
  var list = empireParseDeptList(empireGetTokenDept());
  if (list.indexOf('all') !== -1) return true;
  var moduleKeysByDept = {
    cleaning: [
      'cleaning', 'cleaning_dash', 'cleaning_analytics', 'cleaning_monthly',
      'cleaning_ec', 'cleaning_es', 'cleaning_wd', 'cleaning_ww', 'cleaning_ww2', 'cleaning_ra'
    ],
    'civil department': ['civil_department', 'civil_jobs', 'civil_field', 'civil_add', 'civil_report', 'civil_analytics'],
    'civil issue': [
      'civil_issue', 'civil_iss_list', 'civil_iss_add', 'civil_iss_analytics',
      'civil_iss_not', 'civil_iss_delay', 'civil_iss_gps'
    ],
    'electrical department': [
      'electrical_department', 'elec_jobs', 'elec_field', 'elec_add', 'elec_report', 'elec_analytics', 'elec_minus'
    ],
    'electric issue': [
      'electric_issue', 'elec_iss_list', 'elec_iss_add', 'elec_iss_analytics',
      'elec_iss_not', 'elec_iss_delay', 'elec_iss_gps'
    ],
    hse: ['hse', 'hse_log', 'hse_add', 'hse_monthly', 'hse_analytics'],
    fire: ['fire', 'fire_list', 'fire_add', 'fire_analytics'],
    asaas: ['asaas', 'asaas_list', 'asaas_analytics'],
    application: ['application', 'app_door', 'app_summary', 'app_issues'],
    ups: ['ups', 'ups_register', 'ups_checklist', 'ups_history', 'ups_summary', 'ups_add'],
    charging: [
      'charging', 'charging_dash', 'charging_summary', 'charging_waiting', 'charging_charged',
      'charging_bin', 'charging_bot', 'charging_reset'
    ],
    warehouse: [
      'warehouse_desk', 'warehouse_note', 'warehouse_saved', 'warehouse_assigned', 'warehouse_done',
      'warehouse_sap', 'warehouse_spusage', 'warehouse_sigs',
      'warehouse_invoice', 'warehouse_invoices', 'warehouse_invsp', 'warehouse_invamount',
      'warehouse_sig_auth', 'warehouse_sig_issued', 'warehouse_sig_received'
    ],
    hr: ['hr', 'hr_director']
  };
  function moduleAllowsDeptToken(token) {
    var keys = moduleKeysByDept[token];
    if (!keys || !keys.length) return false;
    for (var j = 0; j < keys.length; j++) {
      if (empireModuleLevel(keys[j]) !== 'none') return true;
    }
    return false;
  }
  for (var i = 0; i < required.length; i++) {
    var r = required[i];
    if (list.indexOf(r) !== -1) return true;
    if (moduleAllowsDeptToken(r)) return true;
    if (r === 'electrical department' && list.indexOf('electric issue') !== -1) return true;
    if (r === 'electric issue' && list.indexOf('electrical department') !== -1) return true;
    if (r === 'civil department' && list.indexOf('civil issue') !== -1) return true;
    if (r === 'civil issue' && list.indexOf('civil department') !== -1) return true;
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
  var whSig = data.warehouseSigSections;
  if (Array.isArray(whSig)) empireAuthSet('warehouseSigSections', JSON.stringify(whSig));
  else if (typeof whSig === 'string') empireAuthSet('warehouseSigSections', JSON.stringify(
    whSig.split(/[,+|/\s]+/).map(function (s) { return s.trim(); }).filter(Boolean)
  ));
  else empireAuthSet('warehouseSigSections', '[]');
  if (data.moduleAccess && typeof data.moduleAccess === 'object') {
    empireAuthSet('moduleAccess', JSON.stringify(data.moduleAccess));
  } else {
    empireAuthSet('moduleAccess', '{}');
  }
  if (data.signature) empireAuthSet('signature', String(data.signature));
  else empireAuthSet('signature', '');
  if (data.signatureRole) empireAuthSet('signatureRole', String(data.signatureRole));
  else empireAuthSet('signatureRole', '');
  setTimeout(function () { empireGuardUsernameAutofill(); }, 0);
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
  warehouse: 'warehouse.html',
  asaas: 'asaas.html',
  application: 'application.html',
  ups: 'ups.html',
  charging: 'charging-electricity.html',
  hr: 'hr-department.html'
};

var EMPIRE_LOGIN_PAGE = 'index.html';

function empireNormDept(dept) {
  return String(dept || '').trim().toLowerCase();
}

function empireIsAdminSession() {
  return empireGetToken() && empireNormDept(empireGetTokenDept()) === 'all';
}

/** True when the signed-in account can manage users (Admin module Write or role admin). */
function empireIsAdminRole() {
  if (!empireGetToken()) return false;
  if (empireModuleLevel('admin') === 'write') return true;
  return String(empireGetRole() || '').toLowerCase() === 'admin';
}

function empireIsMultiDeptSession() {
  return empireParseDeptList(empireGetTokenDept()).length > 1;
}

function empireSingleDeptHome() {
  var list = empireParseDeptList(empireGetTokenDept());
  if (list.length === 1 && list[0] !== 'all') return list[0];
  return null;
}

function empireIsCleaningSupervisorRole(role) {
  role = String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return role === 'cleaning_supervisor' || role === 'supervisor';
}

function empireIsCleaningSupervisor() {
  if (empireIsCleaningSupervisorRole(empireGetRole())) return true;
  try {
    var perms = empireGetPerms();
    if (perms && perms.mobileOnly) return true;
  } catch (e) {}
  return false;
}

function empireHomeForDept(dept) {
  dept = empireNormDept(dept);
  if (empireIsCleaningSupervisor() && dept === 'cleaning') {
    return 'cleaning-mobile.html';
  }
  // Civil is merged like Electrical: workers → mobile issue page; desk → department.
  if (dept === 'civil issue' || dept === 'civil department') {
    if (String(empireGetRole() || '').toLowerCase() === 'worker') return 'civil-issue.html';
    return 'civil-department.html';
  }
  return EMPIRE_DEPT_HOME[dept] || EMPIRE_LOGIN_PAGE;
}

function empireRedirectToUserHome() {
  if (empireIsCleaningSupervisor()) {
    if (location.pathname.indexOf('cleaning-mobile.html') === -1) {
      location.replace('cleaning-mobile.html');
    }
    return;
  }
  var single = empireSingleDeptHome();
  if (single) {
    empireRedirectToDeptHome(single);
    return;
  }
  if (!empireOnLoginPage()) location.replace(EMPIRE_LOGIN_PAGE);
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
  if (typeof cleaningT === 'function') {
    var c = cleaningT(key, params);
    if (c && c !== key) return c;
  }
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
  if (document.body && document.body.classList.contains('cleaning-supervisor-mode')) return true;
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

var _empireAutofillGen = 0;
var _empireAutofillUntil = 0;
var _empireAutofillBound = false;
var _empireAutofillMo = null;

function empireAutofillFire_(el, type) {
  try {
    el.dispatchEvent(new Event(type, { bubbles: true }));
  } catch (e) {}
}

function empireIsLoginAutofillField_(el) {
  if (!el) return true;
  var id = String(el.id || '').toLowerCase();
  if (/^(loginusername|loginpassword|hubusername|hubpassword|cmusername|cmpassword|empirelogoutpassword)$/.test(id)) return true;
  var ac = String(el.getAttribute('autocomplete') || '').toLowerCase();
  if (ac === 'username' || ac === 'current-password' || ac === 'new-password') {
    if (el.closest('#loginPage, #loginView, #cmLogin, .login-page, .login-form, .login-box, .cm-login, .cm-login-card')) return true;
  }
  if (el.closest('#loginPage, #loginView, #cmLogin, .login-page, .login-form, .cm-login')) return true;
  return false;
}

function empireIsSearchLikeField_(el) {
  if (!el) return false;
  var type = String(el.type || 'text').toLowerCase();
  if (type === 'search') return true;
  var blob = [
    el.id,
    el.name,
    el.className,
    el.getAttribute('placeholder') || '',
    el.getAttribute('aria-label') || ''
  ].join(' ').toLowerCase();
  if (/search|filter/.test(blob)) return true;
  var group = el.closest('label, .form-group, .cm-field');
  if (group && /search/i.test(String(group.textContent || '').slice(0, 80))) return true;
  return false;
}

function empireHardenSearchField_(el) {
  if (!el || empireIsLoginAutofillField_(el)) return;
  el.setAttribute('autocomplete', 'off');
  el.setAttribute('autocorrect', 'off');
  el.setAttribute('autocapitalize', 'none');
  el.setAttribute('spellcheck', 'false');
  el.setAttribute('data-lpignore', 'true');
  el.setAttribute('data-1p-ignore', 'true');
  if (el._empireUserTouched) return;
  if (document.activeElement === el) return;
  el.setAttribute('readonly', 'readonly');
  if (el._empireAutofillHardened) return;
  el._empireAutofillHardened = true;
  el.addEventListener('focus', function () {
    el.removeAttribute('readonly');
  });
  el.addEventListener('pointerdown', function () {
    el._empireUserTouched = true;
    el.removeAttribute('readonly');
  });
  el.addEventListener('keydown', function () {
    el._empireUserTouched = true;
    el.removeAttribute('readonly');
  });
}

function empireHardenSearchFields_() {
  var nodes = document.querySelectorAll('input, textarea');
  for (var i = 0; i < nodes.length; i++) {
    var el = nodes[i];
    var type = String(el.type || 'text').toLowerCase();
    if (type !== 'text' && type !== 'search' && type !== 'tel' && type !== 'email' && el.tagName !== 'TEXTAREA') continue;
    if (empireIsSearchLikeField_(el)) empireHardenSearchField_(el);
  }
}

function empireDisableSpentLoginFields_() {
  ['loginUsername', 'loginPassword', 'hubUsername', 'hubPassword', 'cmUsername', 'cmPassword'].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.value = '';
    el.setAttribute('autocomplete', 'off');
    el.disabled = true;
  });
}

function empireClearUsernameAutofill_(fireEvents) {
  var user = String(empireGetUser() || '').trim().toLowerCase();
  if (!user || user.length < 2) return;
  var nodes = document.querySelectorAll('input, textarea');
  for (var i = 0; i < nodes.length; i++) {
    var el = nodes[i];
    if (empireIsLoginAutofillField_(el)) continue;
    if (el._empireUserTouched) continue;
    var type = String(el.type || 'text').toLowerCase();
    if (type === 'password' || type === 'hidden' || type === 'checkbox' || type === 'radio' || type === 'file' || type === 'button' || type === 'submit' || type === 'reset' || type === 'image' || type === 'date' || type === 'datetime-local' || type === 'month' || type === 'time' || type === 'week' || type === 'color' || type === 'range' || type === 'number') continue;
    if (el.readOnly && !empireIsSearchLikeField_(el) && !el._empireAutofillHardened) continue;
    if (String(el.value || '').trim().toLowerCase() !== user) continue;
    el.value = '';
    if (fireEvents) {
      empireAutofillFire_(el, 'input');
      empireAutofillFire_(el, 'change');
    }
  }
}

function empireBindUsernameAutofillGuard_() {
  if (_empireAutofillBound) return;
  _empireAutofillBound = true;
  document.addEventListener('input', function (ev) {
    if (Date.now() > _empireAutofillUntil) return;
    var el = ev.target;
    if (!el || el._empireUserTouched || empireIsLoginAutofillField_(el)) return;
    var user = String(empireGetUser() || '').trim().toLowerCase();
    if (!user || user.length < 2) return;
    if (String(el.value || '').trim().toLowerCase() !== user) return;
    el.value = '';
  }, true);
  document.addEventListener('animationstart', function (ev) {
    if (!ev || ev.animationName !== 'empireOnAutofill') return;
    if (Date.now() > _empireAutofillUntil) return;
    empireClearUsernameAutofill_(true);
  }, true);
}

function empireWatchUsernameAutofillDom_(gen) {
  if (_empireAutofillMo) {
    _empireAutofillMo.disconnect();
    _empireAutofillMo = null;
  }
  if (!document.body) return;
  _empireAutofillMo = new MutationObserver(function () {
    if (gen !== _empireAutofillGen || Date.now() > _empireAutofillUntil) return;
    empireHardenSearchFields_();
    empireClearUsernameAutofill_(true);
  });
  _empireAutofillMo.observe(document.body, { childList: true, subtree: true });
}

function empireGuardUsernameAutofill() {
  if (typeof empireGetUser !== 'function' || !String(empireGetUser() || '').trim()) return;
  var gen = ++_empireAutofillGen;
  _empireAutofillUntil = Date.now() + 4000;
  empireBindUsernameAutofillGuard_();
  empireDisableSpentLoginFields_();
  empireHardenSearchFields_();
  empireClearUsernameAutofill_(false);
  empireWatchUsernameAutofillDom_(gen);
  [0, 50, 150, 400, 800, 1500, 2500, 3500].forEach(function (ms) {
    setTimeout(function () {
      if (gen !== _empireAutofillGen) return;
      empireHardenSearchFields_();
      empireClearUsernameAutofill_(true);
    }, ms);
  });
  setTimeout(function () {
    if (gen !== _empireAutofillGen) return;
    if (_empireAutofillMo) {
      _empireAutofillMo.disconnect();
      _empireAutofillMo = null;
    }
  }, 4200);
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
    empireGuardUsernameAutofill();
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
  if (typeof empireApplySectionNav === 'function') empireApplySectionNav();
  empireGuardUsernameAutofill();
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
        if (d.dept) empireAuthSet('tokenDept', String(d.dept).trim().toLowerCase());
        if (d.projects) empireAuthSet('projects', JSON.stringify(d.projects));
        if (d.trade) empireAuthSet('trade', String(d.trade).trim().toLowerCase());
        if (d.electricalHide != null) empireAuthSet('electricalHide', String(d.electricalHide || '').trim());
        if (d.warehouseSigSections) {
          empireAuthSet(
            'warehouseSigSections',
            JSON.stringify(Array.isArray(d.warehouseSigSections) ? d.warehouseSigSections : [])
          );
        }
        if (d.moduleAccess && typeof d.moduleAccess === 'object') {
          empireAuthSet('moduleAccess', JSON.stringify(d.moduleAccess));
        }
        if (d.signature != null) empireAuthSet('signature', String(d.signature || ''));
        if (d.signatureRole != null) empireAuthSet('signatureRole', String(d.signatureRole || ''));
        if (typeof onUpdate === 'function') onUpdate(d);
        if (typeof empireApplySectionNav === 'function') empireApplySectionNav();
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
(function empireAuthAutofillBoot_() {
  function run() {
    if (!empireGetToken()) return;
    empireGuardUsernameAutofill();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
