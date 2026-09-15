/* Charging Electricity — live charge log dashboard */

var CHG_TRASH_SHEETS = ['ChargingRequests'];
var CHG_DEPT = 'charging';
var CHG_ROWS_ = [];
var CHG_COUNTS_ = { total: 0, charged: 0, waiting: 0, retryQueued: 0 };
var CHG_FILTER_KPI_ = '';
var CHG_TIMER_ = null;
var CHG_BOT_TIMER_ = null;
var CHG_BOT_ = { enabled: false, updatedBy: '', updatedAt: '' };
var CHG_LOADING_ = false;
var CHG_SUM_DAY_ = '';
var CHG_SUM_MONTH_ = '';

var CHG_STATUS_LABEL = {
  charged: 'Charged',
  cannot_charge: 'Cannot charge',
  no_row: 'No row in Nova',
  ambiguous: 'More than one Nova row',
  phone_none: 'Phone search found none',
  phone_many: 'Phone search found more than one',
  stopped: 'Stopped'
};

function chgEsc_(s) {
  if (typeof empireEscHtml_ === 'function') return empireEscHtml_(s);
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

var CHG_TAB_SECTION_ = {
  dash: 'charging_dash',
  summary: 'charging_summary',
  waiting: 'charging_waiting',
  charged: 'charging_charged',
  bin: 'charging_bin'
};

function chgSwitchTab_(event, tab) {
  if (event && event.preventDefault) event.preventDefault();
  if (!chgCanReadTab_(tab)) return;
  document.querySelectorAll('.tab-content').forEach(function (el) {
    el.classList.toggle('active', el.id === tab);
  });
  document.querySelectorAll('.side-nav .tab-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.getAttribute('data-chg-tab') === tab);
  });
  if (tab === 'waiting') {
    CHG_FILTER_KPI_ = 'waiting';
    var st = document.getElementById('chgFilterStatus');
    if (st) st.value = 'waiting';
  } else if (tab === 'charged') {
    CHG_FILTER_KPI_ = 'charged';
    var st2 = document.getElementById('chgFilterStatus');
    if (st2) st2.value = 'charged';
  } else if (tab === 'dash' && (CHG_FILTER_KPI_ === 'waiting' || CHG_FILTER_KPI_ === 'charged')) {
    CHG_FILTER_KPI_ = '';
    var st3 = document.getElementById('chgFilterStatus');
    if (st3) st3.value = '';
  } else if (tab === 'bin') {
    chgRbLoad_(true);
  }
  chgRender_();
}

function chgEnterApp_() {
  var loginPage = document.getElementById('loginPage');
  var main = document.getElementById('mainContainer');
  if (loginPage) loginPage.classList.remove('show');
  if (main) main.classList.add('show');
  if (typeof empireAuthMarkLoginVisible === 'function') empireAuthMarkLoginVisible(false);
  var who = document.getElementById('whoLabel');
  if (who) who.textContent = 'Logged in as: ' + (empireGetUser() || '');
  chgShowStaffTools_();
  chgApplyBotBar_();
  chgLoad_(true);
  chgStartAutoRefresh_();
  chgStartBotPoll_();
}

function chgHandleLogin_(e) {
  empireAuthLogin(e, CHG_DEPT, {
    onSuccess: function () {
      chgEnterApp_();
    }
  });
}

function chgLogout_() {
  if (CHG_TIMER_) {
    clearInterval(CHG_TIMER_);
    CHG_TIMER_ = null;
  }
  if (CHG_BOT_TIMER_) {
    clearInterval(CHG_BOT_TIMER_);
    CHG_BOT_TIMER_ = null;
  }
  empireAuthLogout({ redirect: 'index.html', reload: false });
}

function chgIsAdmin_() {
  if (typeof empireIsAdminRole === 'function') return empireIsAdminRole();
  var role = String(typeof empireGetRole === 'function' ? empireGetRole() : '').toLowerCase();
  if (role === 'admin') return true;
  return typeof empireModuleLevel === 'function' && empireModuleLevel('admin') === 'write';
}

function chgSectionLevel_(key) {
  if (chgIsAdmin_()) return 'write';
  if (typeof empireModuleLevel !== 'function') return 'none';
  return empireModuleLevel(key);
}

function chgCanReadSection_(key) {
  return chgSectionLevel_(key) !== 'none';
}

function chgCanWriteSection_(key) {
  return chgSectionLevel_(key) === 'write';
}

function chgCanReadTab_(tab) {
  var key = CHG_TAB_SECTION_[tab];
  return key ? chgCanReadSection_(key) : false;
}

function chgCanWriteDash_() {
  return chgCanWriteSection_('charging_dash');
}

function chgCanWriteWaiting_() {
  return chgCanWriteDash_() || chgCanWriteSection_('charging_waiting');
}

function chgCanWriteCharged_() {
  return chgCanWriteDash_() || chgCanWriteSection_('charging_charged');
}

function chgCanWriteRow_(row) {
  if (!row) return chgCanWriteDash_();
  return String(row.status) === 'charged' ? chgCanWriteCharged_() : chgCanWriteWaiting_();
}

function chgCanWriteBin_() {
  return chgCanWriteSection_('charging_bin');
}

function chgCanReadBin_() {
  return chgCanReadSection_('charging_bin');
}

function chgCanWriteBot_() {
  return chgCanWriteSection_('charging_bot');
}

function chgCanWriteReset_() {
  return chgCanWriteSection_('charging_reset');
}

function chgCanWrite_() {
  return chgCanWriteDash_() || chgCanWriteWaiting_() || chgCanWriteCharged_();
}

function chgFirstAllowedTab_() {
  var tabs = ['dash', 'summary', 'waiting', 'charged', 'bin'];
  for (var i = 0; i < tabs.length; i++) {
    if (chgCanReadTab_(tabs[i])) return tabs[i];
  }
  return '';
}

function chgBotOn_() {
  return !!CHG_BOT_.enabled;
}

function chgToken_() {
  return typeof empireGetToken === 'function' ? (empireGetToken() || '') : '';
}

function chgFormatDt_(iso) {
  var t = String(iso || '').trim();
  if (!t) return '—';
  var d = new Date(t);
  if (isNaN(d.getTime())) return t;
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Baghdad',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(d);
  } catch (e) {
    return t;
  }
}

function chgDurationLabel_(row) {
  if (!row || String(row.status) !== 'charged') return '—';
  var a = Date.parse(String(row.startedAt || ''));
  var b = Date.parse(String(row.chargedAt || ''));
  if (!a || !b || b < a) return '—';
  var mins = Math.round((b - a) / 60000);
  if (mins < 1) return '< 1 min';
  if (mins < 60) return mins + ' min';
  var h = Math.floor(mins / 60);
  var m = mins % 60;
  return m ? (h + ' h ' + m + ' min') : (h + ' h');
}

function chgFormatAmt_(raw) {
  var n = String(raw || '').replace(/\D/g, '');
  if (!n) return '—';
  try {
    return Number(n).toLocaleString('en-US') + ' IQD';
  } catch (e2) {
    return n + ' IQD';
  }
}

function chgMoney_(n) {
  var v = Number(n || 0);
  if (!isFinite(v) || v < 0) v = 0;
  try {
    return v.toLocaleString('en-US') + ' IQD';
  } catch (e) {
    return String(v) + ' IQD';
  }
}

function chgBaghdadParts_(iso) {
  var d = iso ? new Date(iso) : new Date();
  if (isNaN(d.getTime())) d = new Date();
  var ymd = '';
  try {
    ymd = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Baghdad',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
  } catch (e) {
    ymd = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  return { ymd: ymd, ym: ymd.slice(0, 7) };
}

function chgEnsureSumPeriod_() {
  var now = chgBaghdadParts_();
  if (!CHG_SUM_DAY_) CHG_SUM_DAY_ = now.ymd;
  if (!CHG_SUM_MONTH_) CHG_SUM_MONTH_ = now.ym;
}

function chgOnSumDay_() {
  var el = document.getElementById('chgSumDay');
  CHG_SUM_DAY_ = (el && el.value) || chgBaghdadParts_().ymd;
  chgRenderSummary_();
}

function chgOnSumMonth_() {
  var el = document.getElementById('chgSumMonth');
  CHG_SUM_MONTH_ = (el && el.value) || chgBaghdadParts_().ym;
  chgRenderSummary_();
}

function chgSumGoToday_() {
  var now = chgBaghdadParts_();
  CHG_SUM_DAY_ = now.ymd;
  CHG_SUM_MONTH_ = now.ym;
  chgRenderSummary_();
}

function chgPickSumDay_(ymd) {
  var s = String(ymd || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return;
  CHG_SUM_DAY_ = s;
  CHG_SUM_MONTH_ = s.slice(0, 7);
  chgRenderSummary_();
}

function chgPrettyDay_(ymd) {
  var d = new Date(String(ymd) + 'T12:00:00');
  if (isNaN(d.getTime())) return ymd;
  try {
    return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  } catch (e) {
    return ymd;
  }
}

function chgPrettyMonth_(ym) {
  var d = new Date(String(ym) + '-01T12:00:00');
  if (isNaN(d.getTime())) return ym;
  try {
    return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(d);
  } catch (e) {
    return ym;
  }
}

function chgChargeWhen_(row) {
  return String((row && (row.chargedAt || row.createdAt)) || '');
}

function chgAmtNum_(row) {
  var n = Number(String((row && row.amount) || '').replace(/\D/g, ''));
  return n > 0 ? n : 0;
}

function chgKind_(row) {
  if (!row) return 'other';
  if (row.tariff === 'T2' || row.electricType === 'generator') return 'generator';
  if (row.tariff === 'T1' || row.electricType === 'national') return 'national';
  return 'other';
}

function chgEmptyBucket_() {
  return {
    count: 0,
    amount: 0,
    national: { count: 0, amount: 0 },
    generator: { count: 0, amount: 0 },
    other: { count: 0, amount: 0 },
    nova: { count: 0, amount: 0 },
    overseas: { count: 0, amount: 0 }
  };
}

function chgAddToBucket_(b, row) {
  var amt = chgAmtNum_(row);
  b.count += 1;
  b.amount += amt;
  var k = chgKind_(row);
  b[k].count += 1;
  b[k].amount += amt;
  if (chgIsOverseas_(row)) {
    b.overseas.count += 1;
    b.overseas.amount += amt;
  } else {
    b.nova.count += 1;
    b.nova.amount += amt;
  }
}

function chgPeriodStats_(ymd, ym) {
  var day = chgEmptyBucket_();
  var month = chgEmptyBucket_();
  var byDay = {};
  CHG_ROWS_.forEach(function (row) {
    if (String(row.status) !== 'charged') return;
    var p = chgBaghdadParts_(chgChargeWhen_(row));
    if (p.ym === ym) {
      chgAddToBucket_(month, row);
      if (!byDay[p.ymd]) byDay[p.ymd] = chgEmptyBucket_();
      chgAddToBucket_(byDay[p.ymd], row);
    }
    if (p.ymd === ymd) chgAddToBucket_(day, row);
  });
  return { day: day, month: month, byDay: byDay };
}

function chgSumSplitHtml_(b) {
  var extra = '';
  if (b.other.count) {
    extra = '<div class="chg-sum-other">' + chgEsc_(String(b.other.count)) +
      ' with no T1/T2 · ' + chgEsc_(chgMoney_(b.other.amount)) + '</div>';
  }
  return '<div class="chg-sum-split">' +
    '<div class="chg-sum-kind nat"><span>National · T1</span><b>' + chgEsc_(chgMoney_(b.national.amount)) +
    '</b><em>' + chgEsc_(String(b.national.count)) + ' charged</em></div>' +
    '<div class="chg-sum-kind gen"><span>Generator · T2</span><b>' + chgEsc_(chgMoney_(b.generator.amount)) +
    '</b><em>' + chgEsc_(String(b.generator.count)) + ' charged</em></div>' +
    '</div>' + extra +
    '<p class="chg-sum-sys">Nova ' + chgEsc_(chgMoney_(b.nova.amount)) +
    ' · Overseas ' + chgEsc_(chgMoney_(b.overseas.amount)) + '</p>';
}

function chgSumCardHtml_(title, subtitle, b) {
  return '<article class="chg-sum-card">' +
    '<h3>' + chgEsc_(title) + '</h3>' +
    '<p class="chg-sum-sub">' + chgEsc_(subtitle) + '</p>' +
    '<div class="chg-sum-hero"><b>' + chgEsc_(chgMoney_(b.amount)) + '</b>' +
    '<span>' + chgEsc_(String(b.count)) + ' charged</span></div>' +
    chgSumSplitHtml_(b) +
    '</article>';
}

function chgSumDaysHtml_(byDay, ym, selectedYmd) {
  var keys = Object.keys(byDay).sort().reverse();
  if (!keys.length) {
    return chgEmptyDesk_('No charged RUs this month', 'Pick another month, or wait until a charge is saved.');
  }
  var body = keys.map(function (ymd) {
    var b = byDay[ymd];
    var on = ymd === selectedYmd ? ' is-on' : '';
    return '<tr class="chg-sum-day-row' + on + '" onclick="chgPickSumDay_(\'' + ymd + '\')">' +
      '<td>' + chgEsc_(chgPrettyDay_(ymd)) + '</td>' +
      '<td>' + chgEsc_(String(b.count)) + '</td>' +
      '<td>' + chgEsc_(String(b.national.count)) + ' · ' + chgEsc_(chgMoney_(b.national.amount)) + '</td>' +
      '<td>' + chgEsc_(String(b.generator.count)) + ' · ' + chgEsc_(chgMoney_(b.generator.amount)) + '</td>' +
      '<td class="chg-amt">' + chgEsc_(chgMoney_(b.amount)) + '</td>' +
      '</tr>';
  }).join('');
  var cards = keys.map(function (ymd) {
    var b = byDay[ymd];
    var on = ymd === selectedYmd ? ' is-on' : '';
    return '<button type="button" class="chg-sum-day-card' + on + '" onclick="chgPickSumDay_(\'' + ymd + '\')">' +
      '<strong>' + chgEsc_(chgPrettyDay_(ymd)) + '</strong>' +
      '<span>' + chgEsc_(chgMoney_(b.amount)) + '</span>' +
      '<em>' + chgEsc_(String(b.count)) + ' charged · National ' +
      chgEsc_(chgMoney_(b.national.amount)) + ' · Generator ' +
      chgEsc_(chgMoney_(b.generator.amount)) + '</em></button>';
  }).join('');
  return '<div class="chg-table-wrap chg-sum-table-wrap"><table class="chg-table"><thead><tr>' +
    '<th>Day</th><th>Charged</th><th>National</th><th>Generator</th><th>Total</th>' +
    '</tr></thead><tbody>' + body + '</tbody></table></div>' +
    '<div class="chg-sum-day-cards">' + cards + '</div>';
}

function chgRenderSummary_() {
  chgEnsureSumPeriod_();
  var dayEl = document.getElementById('chgSumDay');
  var monthEl = document.getElementById('chgSumMonth');
  if (dayEl && dayEl.value !== CHG_SUM_DAY_) dayEl.value = CHG_SUM_DAY_;
  if (monthEl && monthEl.value !== CHG_SUM_MONTH_) monthEl.value = CHG_SUM_MONTH_;
  var stats = chgPeriodStats_(CHG_SUM_DAY_, CHG_SUM_MONTH_);
  var cards = document.getElementById('chgSumCards');
  if (cards) {
    cards.innerHTML =
      chgSumCardHtml_('Day', chgPrettyDay_(CHG_SUM_DAY_), stats.day) +
      chgSumCardHtml_('Month', chgPrettyMonth_(CHG_SUM_MONTH_), stats.month);
  }
  var days = document.getElementById('chgSumDays');
  if (days) days.innerHTML = chgSumDaysHtml_(stats.byDay, CHG_SUM_MONTH_, CHG_SUM_DAY_);
}

function chgIsOverseas_(row) {
  if (String(row.source || '').toLowerCase() === 'overseas') return true;
  if (String(row.source || '').toLowerCase() === 'nova') return false;
  var u = String(row.unitId || '').trim().toUpperCase().replace(/\s+/g, '');
  if (/^RV-/.test(u) || /^RA-/.test(u) || /^WD-/.test(u)) return true;
  var m = u.match(/^WW-(\d+)(?:-|$)/);
  return !!(m && Number(m[1]) >= 1 && Number(m[1]) <= 11);
}

function chgSystemLabel_(row) {
  return chgIsOverseas_(row) ? 'Overseas' : 'Nova';
}

function chgTypeLabel_(row) {
  if (chgIsOverseas_(row)) return 'STS';
  if (row.tariff === 'T2' || row.electricType === 'generator') return 'T2 · generator';
  if (row.tariff === 'T1' || row.electricType === 'national') return 'T1 · national';
  return '—';
}

function chgStatusLabel_(status) {
  return CHG_STATUS_LABEL[status] || status || '—';
}

function chgPillHtml_(row) {
  var st = String(row.status || '');
  var sys = chgIsOverseas_(row) ? 'overseas' : 'nova';
  var html = '<span class="chg-pill ' + sys + '">' + chgEsc_(chgSystemLabel_(row)) + '</span>';
  html += '<span class="chg-pill ' + chgEsc_(st) + '">' + chgEsc_(chgStatusLabel_(st)) + '</span>';
  if (row.retryRequested && st !== 'charged') {
    html += '<span class="chg-pill retry">Retry queued</span>';
  }
  return html;
}

function chgThumbHtml_(row) {
  var url = String(row.invoiceUrl || '').trim();
  if (!url) return '<div class="chg-thumb-empty">No photo</div>';
  if (typeof empireThumbImgHtml === 'function') {
    return empireThumbImgHtml(url, 'chg-thumb', 'Invoice ' + (row.ru || ''), 88);
  }
  return '<img class="chg-thumb" src="' + chgEsc_(url) + '" alt="" loading="lazy">';
}

function chgIsWaiting_(row) {
  return String(row.status || '') !== 'charged';
}

function chgPassFilters_(row, statusFilter, typeFilter, q) {
  var st = String(row.status || '');
  var sysFilter = (document.getElementById('chgFilterSystem') || {}).value || '';
  if (sysFilter === 'overseas' && !chgIsOverseas_(row)) return false;
  if (sysFilter === 'nova' && chgIsOverseas_(row)) return false;
  if (typeFilter === 'national' && row.electricType !== 'national' && row.tariff !== 'T1') return false;
  if (typeFilter === 'generator' && row.electricType !== 'generator' && row.tariff !== 'T2') return false;
  if (statusFilter === 'charged' && st !== 'charged') return false;
  if (statusFilter === 'waiting' && st === 'charged') return false;
  if (statusFilter === 'retry' && (!row.retryRequested || st === 'charged')) return false;
  if (statusFilter && statusFilter !== 'charged' && statusFilter !== 'waiting' && statusFilter !== 'retry' && st !== statusFilter) {
    return false;
  }
  if (q) {
    var blob = [row.ru, row.unitId, row.novaSearch, row.note, row.amount, chgStatusLabel_(st), chgTypeLabel_(row), chgSystemLabel_(row)]
      .join(' ')
      .toLowerCase();
    if (blob.indexOf(q) === -1) return false;
  }
  return true;
}

function chgFiltered_(forceStatus) {
  var statusFilter = forceStatus || (document.getElementById('chgFilterStatus') || {}).value || '';
  var typeFilter = (document.getElementById('chgFilterType') || {}).value || '';
  var q = String((document.getElementById('chgSearch') || {}).value || '').trim().toLowerCase();
  return CHG_ROWS_.filter(function (row) {
    return chgPassFilters_(row, statusFilter, typeFilter, q);
  });
}

function chgOnFilterChange_() {
  var st = document.getElementById('chgFilterStatus');
  CHG_FILTER_KPI_ = (st && st.value) || '';
  chgRender_();
}

function chgSetKpi_(key) {
  if (!chgCanReadTab_('dash')) return;
  CHG_FILTER_KPI_ = key || '';
  var st = document.getElementById('chgFilterStatus');
  if (st) st.value = key || '';
  document.querySelectorAll('.tab-content').forEach(function (el) {
    el.classList.toggle('active', el.id === 'dash');
  });
  document.querySelectorAll('.side-nav .tab-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.getAttribute('data-chg-tab') === 'dash');
  });
  chgRender_();
}

function chgKpiHtml_() {
  var c = CHG_COUNTS_;
  var on = CHG_FILTER_KPI_;
  function card(key, n, label, cls) {
    var isOn = on === key || (!on && key === '');
    return '<button type="button" class="chg-kpi ' + cls + (isOn ? ' is-on' : '') + '" onclick="chgSetKpi_(\'' + key + '\')">' +
      '<b>' + chgEsc_(String(n)) + '</b><span>' + chgEsc_(label) + '</span></button>';
  }
  return card('', c.total || 0, 'All RUs', '') +
    card('charged', c.charged || 0, 'Charged', 'ok') +
    card('waiting', c.waiting || 0, 'Waiting', 'warn') +
    card('retry', c.retryQueued || 0, 'Retry queue', 'accent');
}

function chgSafeId_(id) {
  var s = String(id || '');
  return /^[a-zA-Z0-9-]+$/.test(s) ? s : '';
}

function chgSafeRu_(ru) {
  var s = String(ru || '').toUpperCase();
  return /^RU-\d+$/.test(s) ? s : '';
}

function chgRowOpen_(id) {
  var row = CHG_ROWS_.filter(function (r) { return r.id === id; })[0];
  if (!row) return;
  var root = document.getElementById('chgDrawerRoot');
  var drawer = document.getElementById('chgDrawer');
  if (!root || !drawer) return;
  var inv = String(row.invoiceUrl || '').trim();
  var safeId = chgSafeId_(row.id);
  var invoiceBlock = inv
    ? '<img class="chg-invoice-full" src="' + chgEsc_(inv) + '" alt="Invoice" onclick="chgOpenLightboxRow_(\'' + safeId + '\')">'
    : '<div class="chg-invoice-missing">No invoice picture — this RU was not charged.</div>';
  var retryBtn = '';
  var delBtn = '';
  if (chgCanWriteWaiting_() && chgBotOn_() && chgIsWaiting_(row) && !row.retryRequested) {
    var ru = chgSafeRu_(row.ru);
    if (ru) {
      retryBtn = '<button type="button" class="chg-retry-btn" onclick="chgRetryOne_(\'' + ru + '\')">Queue this RU for retry</button>';
    }
  }
  if (chgCanWriteRow_(row) && safeId) {
    delBtn = '<button type="button" class="chg-del-btn" onclick="chgDeleteOne_(\'' + safeId + '\')">Move to Recycle Bin</button>';
  }
  drawer.innerHTML =
    '<div class="chg-drawer-bar"><div><h3 id="chgDrawerTitle">' + chgEsc_(row.ru) + '</h3>' +
    '<p class="chg-lead" style="margin-top:6px">' + chgPillHtml_(row) + '</p></div>' +
    '<button type="button" class="chg-drawer-close" onclick="chgCloseDrawer_()" aria-label="Close">×</button></div>' +
    '<dl class="chg-dl">' +
    '<dt>Saved</dt><dd>' + chgEsc_(chgFormatDt_(row.createdAt)) + '</dd>' +
    '<dt>Updated</dt><dd>' + chgEsc_(chgFormatDt_(row.updatedAt)) + '</dd>' +
    (row.startedAt ? '<dt>Started</dt><dd>' + chgEsc_(chgFormatDt_(row.startedAt)) + '</dd>' : '') +
    (row.chargedAt ? '<dt>Finished</dt><dd>' + chgEsc_(chgFormatDt_(row.chargedAt)) + '</dd>' : '') +
    '<dt>Duration</dt><dd>' + chgEsc_(chgDurationLabel_(row)) + '</dd>' +
    '<dt>Unit</dt><dd class="chg-unit">' + chgEsc_(row.unitId || '—') + '</dd>' +
    '<dt>System</dt><dd>' + chgEsc_(chgSystemLabel_(row)) + '</dd>' +
    '<dt>Search</dt><dd class="chg-unit">' + chgEsc_(row.novaSearch || '—') + '</dd>' +
    '<dt>Electricity</dt><dd>' + chgEsc_(chgTypeLabel_(row)) + '</dd>' +
    '<dt>Amount</dt><dd>' + chgEsc_(chgFormatAmt_(row.amount)) + '</dd>' +
    '<dt>Cause</dt><dd>' + chgEsc_(row.note || (row.status === 'charged' ? 'Charged' : '—')) + '</dd>' +
    '<dt>Saved by</dt><dd>' + chgEsc_(row.createdBy || '—') + '</dd>' +
    '</dl>' +
    invoiceBlock +
    '<div class="chg-drawer-acts">' + retryBtn + delBtn + '</div>';
  root.hidden = false;
}

function chgCloseDrawer_() {
  var root = document.getElementById('chgDrawerRoot');
  if (root) root.hidden = true;
}

function chgOpenLightboxRow_(id) {
  var row = CHG_ROWS_.filter(function (r) { return r.id === id; })[0];
  var url = row && String(row.invoiceUrl || '').trim();
  if (!url) return;
  var box = document.getElementById('chgLightbox');
  var img = document.getElementById('chgLightboxImg');
  if (!box || !img) return;
  img.src = url;
  box.hidden = false;
}

function chgCloseLightbox_(event) {
  if (event && event.target && event.target.id === 'chgLightboxImg') return;
  var box = document.getElementById('chgLightbox');
  var img = document.getElementById('chgLightboxImg');
  if (box) box.hidden = true;
  if (img) img.src = '';
}

function chgTableHtml_(rows) {
  if (!rows.length) {
    return typeof empireEmptyHtml === 'function'
      ? empireEmptyHtml('Nothing matches', 'Try another search or status filter.')
      : '<div class="empire-empty">Nothing matches.</div>';
  }
  var body = rows.map(function (row) {
    return '<tr onclick="chgRowOpen_(\'' + chgSafeId_(row.id) + '\')">' +
      '<td class="chg-dt">' + chgEsc_(chgFormatDt_(row.createdAt)) + '</td>' +
      '<td class="chg-ru">' + chgEsc_(row.ru) + '</td>' +
      '<td class="chg-unit">' + chgEsc_(row.unitId || '—') + '</td>' +
      '<td class="chg-sys">' + chgEsc_(chgSystemLabel_(row)) + '</td>' +
      '<td class="chg-type">' + chgEsc_(chgTypeLabel_(row)) + '</td>' +
      '<td class="chg-amt">' + chgEsc_(chgFormatAmt_(row.amount)) + '</td>' +
      '<td>' + chgPillHtml_(row) + '</td>' +
      '<td class="chg-dur">' + chgEsc_(chgDurationLabel_(row)) + '</td>' +
      '<td' + (String(row.invoiceUrl || '').trim() ? ' onclick="event.stopPropagation();chgOpenLightboxRow_(\'' + chgSafeId_(row.id) + '\')"' : '') + '>' + chgThumbHtml_(row) + '</td>' +
      '<td class="chg-note-cell">' + chgEsc_(row.note || '') + '</td>' +
      '</tr>';
  }).join('');
  var cards = rows.map(function (row) {
    return '<button type="button" class="chg-card" onclick="chgRowOpen_(\'' + chgSafeId_(row.id) + '\')">' +
      '<div class="chg-card-top">' + chgThumbHtml_(row) +
      '<div class="chg-card-meta"><div class="chg-card-ru">' + chgEsc_(row.ru) + '</div>' +
      '<div class="chg-card-unit">' + chgEsc_(row.unitId || '—') + ' · ' + chgEsc_(chgSystemLabel_(row)) + '</div>' +
      chgPillHtml_(row) + '</div></div>' +
      '<div class="chg-card-row"><span>' + chgEsc_(chgFormatDt_(row.createdAt)) + '</span>' +
      '<span>' + chgEsc_(chgTypeLabel_(row)) + '</span>' +
      '<span>' + chgEsc_(chgFormatAmt_(row.amount)) + '</span>' +
      '<span>' + chgEsc_(chgDurationLabel_(row)) + '</span></div>' +
      (row.note ? '<div class="chg-card-note">' + chgEsc_(row.note) + '</div>' : '') +
      '</button>';
  }).join('');
  return '<div class="chg-table-wrap"><table class="chg-table"><thead><tr>' +
    '<th>Saved</th><th>RU</th><th>Unit</th><th>System</th><th>Type</th><th>Amount</th><th>Status</th><th>Duration</th><th>Invoice</th><th>Cause</th>' +
    '</tr></thead><tbody>' + body + '</tbody></table></div>' +
    '<div class="chg-cards">' + cards + '</div>';
}

function chgEmptyDesk_(title, hint) {
  if (typeof empireEmptyHtml === 'function') return empireEmptyHtml(title, hint);
  return '<p>' + chgEsc_(title) + '</p>';
}

function chgRender_() {
  var kpis = document.getElementById('chgKpis');
  if (kpis) kpis.innerHTML = chgKpiHtml_();

  var canRetry = chgCanWriteWaiting_();
  ['chgRetryBtnDash', 'chgRetryBtnWait'].forEach(function (id) {
    var btn = document.getElementById(id);
    if (!btn) return;
    btn.style.display = canRetry ? '' : 'none';
    btn.disabled = !canRetry || !chgBotOn_() || !(CHG_COUNTS_.waiting > 0);
    if (!chgBotOn_()) btn.title = 'The bot is Off. Try failed again does nothing.';
    else if (!canRetry) btn.title = 'Write access required';
    else btn.title = 'Queue every waiting RU for the laptop robot';
  });

  var dashRows = chgFiltered_();
  var summary = document.getElementById('chgSummary');
  if (summary) {
    summary.textContent = dashRows.length + ' of ' + CHG_ROWS_.length + ' request' +
      (CHG_ROWS_.length === 1 ? '' : 's') + ' shown.';
  }
  var list = document.getElementById('chgList');
  if (list) {
    if (!CHG_ROWS_.length) {
      list.innerHTML = chgEmptyDesk_(
        'No charges saved yet',
        'The laptop robot writes each RU here after it tries Nova. This page does not take money.'
      );
    } else {
      list.innerHTML = chgTableHtml_(dashRows);
    }
  }

  var waiting = CHG_ROWS_.filter(chgIsWaiting_);
  var waitEl = document.getElementById('chgWaitingList');
  if (waitEl) {
    waitEl.innerHTML = waiting.length
      ? chgTableHtml_(waiting)
      : chgEmptyDesk_('Nothing waiting', 'Failed charges will appear here with the cause and no invoice.');
  }

  var charged = CHG_ROWS_.filter(function (r) { return r.status === 'charged'; });
  var chEl = document.getElementById('chgChargedList');
  if (chEl) {
    chEl.innerHTML = charged.length
      ? chgTableHtml_(charged)
      : chgEmptyDesk_('No charged RUs yet', 'When Nova Pay succeeds, the invoice is saved on that same RU.');
  }
  chgRenderSummary_();
}

function chgSetLoading_(on) {
  CHG_LOADING_ = !!on;
  var icon = document.getElementById('navRefreshIcon');
  if (icon) icon.classList.toggle('spinning', !!on);
}

function chgLoad_(force) {
  if (CHG_LOADING_ && !force) return;
  var token = chgToken_();
  if (!token) return;
  var bin = document.getElementById('bin');
  if (bin && bin.classList.contains('active')) chgRbLoad_(force);
  if (!chgCanReadSection_('charging_dash') && !chgCanReadSection_('charging_summary') && !chgCanReadSection_('charging_waiting') && !chgCanReadSection_('charging_charged')) {
    return;
  }
  chgSetLoading_(true);
  var list = document.getElementById('chgList');
  if (list && !CHG_ROWS_.length && typeof empireLoadingHtml === 'function') {
    list.innerHTML = empireLoadingHtml('Loading charge log…');
  }
  return fetchJSONRetry({ action: 'getChargingRequests', token: token }, force ? 2 : 1, 45000)
    .then(function (d) {
      if (!d || !d.ok) throw new Error((d && (d.message || d.error)) || 'Could not load charging rows.');
      CHG_ROWS_ = d.rows || [];
      CHG_COUNTS_ = d.counts || CHG_COUNTS_;
      if (d.bot) chgSetBot_(d.bot);
      chgRender_();
    })
    .catch(function (e) {
      var msg = (e && e.message) || 'Could not load the charge log.';
      var html = typeof empireErrorHtml === 'function'
        ? empireErrorHtml(msg, 'Use Refresh in the sidebar.')
        : '<p>' + chgEsc_(msg) + '</p>';
      ['chgList', 'chgWaitingList', 'chgChargedList', 'chgSumDays'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.innerHTML = html;
      });
    })
    .then(function () {
      chgSetLoading_(false);
    });
}

function chgStartAutoRefresh_() {
  if (CHG_TIMER_) clearInterval(CHG_TIMER_);
  CHG_TIMER_ = setInterval(function () {
    if (document.hidden) return;
    chgLoad_(false);
  }, 45000);
}

function chgTryFailedAgain_() {
  if (!chgBotOn_()) {
    return uiAlert('The bot is Off. Try failed again does nothing until Bot On/Off is turned On.');
  }
  if (!chgCanWriteWaiting_()) {
    return uiAlert('You can view this desk, but you cannot queue retries.');
  }
  var n = CHG_COUNTS_.waiting || 0;
  if (!n) return uiAlert('There are no waiting RUs to retry.');
  uiConfirm(
    'Queue ' + n + ' waiting RU' + (n === 1 ? '' : 's') +
      ' for retry, one by one, once each?\n\nThis does not take money from the website. The laptop robot uses this queue.',
    { okLabel: 'Queue retries' }
  ).then(function (ok) {
    if (!ok) return;
    return fetchJSONRetry({
      action: 'requestChargingRetry',
      token: chgToken_()
    }, 1, 45000).then(function (d) {
      if (!d || !d.ok) throw new Error((d && (d.message || d.error)) || 'Could not queue retries.');
      var q = Number(d.queued || 0);
      return uiAlert(
        q
          ? q + ' RU' + (q === 1 ? '' : 's') + ' queued. The robot will try the oldest first.'
          : 'Nothing was queued.'
      ).then(function () {
        return chgLoad_(true);
      });
    });
  }).catch(function (e) {
    uiAlert((e && e.message) || 'Could not queue retries.');
  });
}

function chgSetBot_(bot) {
  CHG_BOT_ = {
    enabled: !!(bot && bot.enabled),
    updatedBy: bot && bot.updatedBy ? String(bot.updatedBy) : '',
    updatedAt: bot && bot.updatedAt ? String(bot.updatedAt) : ''
  };
  chgApplyBotBar_();
}

function chgApplyBotBar_() {
  var bar = document.getElementById('chgBotBar');
  var label = document.getElementById('chgBotLabel');
  var hint = document.getElementById('chgBotHint');
  var btn = document.getElementById('chgBotToggle');
  var on = chgBotOn_();
  if (bar) bar.classList.toggle('is-on', on);
  if (bar) bar.classList.toggle('is-off', !on);
  if (label) label.textContent = on ? 'Bot On' : 'Bot Off';
  if (hint) {
    hint.textContent = on
      ? 'The bot may process RUs: Nova Pay, invoice, SET PIN, and the dashboard. It pays only if apartment, tariff, and amount match.'
      : 'Stopped. Laptop watch, Pay, SET PIN, and this desk all stop. Try failed again does nothing.';
    if (CHG_BOT_.updatedBy) {
      hint.textContent += ' Last change: ' + chgFormatDt_(CHG_BOT_.updatedAt) + ' by ' + CHG_BOT_.updatedBy + '.';
    }
  }
  if (btn) {
    btn.style.display = chgCanWriteBot_() ? '' : 'none';
    btn.textContent = on ? 'Turn Off' : 'Turn On';
    btn.disabled = false;
  }
}

function chgPollBot_() {
  var token = chgToken_();
  if (!token) return;
  fetchJSONRetry({ action: 'getChargingBotStatus', token: token }, 1, 20000).then(function (d) {
    if (!d || !d.ok || !d.bot) return;
    var was = chgBotOn_();
    chgSetBot_(d.bot);
    if (was !== chgBotOn_()) chgRender_();
  }).catch(function () {});
}

function chgStartBotPoll_() {
  if (CHG_BOT_TIMER_) clearInterval(CHG_BOT_TIMER_);
  CHG_BOT_TIMER_ = setInterval(function () {
    if (document.hidden) return;
    chgPollBot_();
  }, 8000);
}

function chgToggleBot_() {
  if (!chgCanWriteBot_()) {
    return uiAlert('Bot On/Off write access is required.');
  }
  var next = !chgBotOn_();
  var msg = next
    ? 'Turn the bot On?\n\nIt will process RUs on the laptop: Nova Pay, invoice, and SET PIN. This can take money.'
    : 'Turn the bot Off now?\n\nIt stops everything: laptop watch, Pay, SET PIN, and the charging chat. No money after this.';
  uiConfirm(msg, {
    okLabel: next ? 'Turn On' : 'Turn Off',
    danger: !next
  }).then(function (ok) {
    if (!ok) return;
    var btn = document.getElementById('chgBotToggle');
    if (btn) btn.disabled = true;
    return fetchJSONRetry({
      action: 'setChargingBotEnabled',
      token: chgToken_(),
      enabled: next
    }, 1, 30000).then(function (d) {
      if (typeof empireAuthHandleInvalidSession_ === 'function' && empireAuthHandleInvalidSession_(d)) return;
      if (!d || !d.ok) throw new Error((d && (d.message || d.error)) || 'Could not change the bot switch.');
      chgSetBot_(d.bot || { enabled: next });
      chgRender_();
    }).catch(function (e) {
      uiAlert((e && e.message) || 'Could not change the bot switch.');
    }).then(function () {
      if (btn) btn.disabled = false;
    });
  });
}

function chgShowStaffTools_() {
  var tabMap = {
    dash: 'chgDashTabBtn',
    summary: 'chgSummaryTabBtn',
    waiting: 'chgWaitingTabBtn',
    charged: 'chgChargedTabBtn',
    bin: 'chgBinTabBtn'
  };
  Object.keys(tabMap).forEach(function (tab) {
    var el = document.getElementById(tabMap[tab]);
    if (!el) return;
    el.style.display = chgCanReadTab_(tab) ? '' : 'none';
  });
  var reset = document.getElementById('chgResetBtn');
  if (reset) reset.style.display = chgCanWriteReset_() ? '' : 'none';
  var binActs = document.querySelector('.chg-bin-acts');
  if (binActs) binActs.style.display = chgCanWriteBin_() ? '' : 'none';
  var first = chgFirstAllowedTab_();
  if (first) chgSwitchTab_({ preventDefault: function () {} }, first);
}

function chgSafeTrashId_(id) {
  var s = String(id || '');
  return /^[a-zA-Z0-9-]+$/.test(s) ? s : '';
}

function chgRbItems_(d) {
  if (Array.isArray(d)) return d;
  if (d && Array.isArray(d.items)) return d.items;
  return [];
}

function chgRbItemHtml_(it) {
  var tid = chgSafeTrashId_(it.trashId);
  if (!tid) return '';
  var when = chgFormatDt_(it.deletedAt);
  var how = it.reason === 'reset'
    ? '<span class="rb-how reset">Reset</span>'
    : '<span class="rb-how">Delete</span>';
  var st = String(it.status || '');
  var status = st
    ? '<span class="chg-pill ' + chgEsc_(st) + '">' + chgEsc_(chgStatusLabel_(st)) + '</span>'
    : '';
  var locParts = [];
  if (it.unitId) locParts.push(String(it.unitId));
  if (it.amount) locParts.push(chgFormatAmt_(it.amount));
  var loc = chgEsc_(locParts.join(' · '));
  return '<div class="rb-item">'
    + '<div class="rb-body">'
    + '<div class="rb-title">' + chgEsc_(it.ru || it.preview || 'Charge request') + ' ' + status + '</div>'
    + (loc ? '<div class="rb-loc">' + loc + '</div>' : '')
    + '<div class="rb-meta">' + chgEsc_(when) + (it.deletedBy ? (' · ' + chgEsc_(it.deletedBy)) : '') + ' · ' + how + '</div>'
    + '</div>'
    + (chgCanWriteBin_()
      ? '<div class="rb-actions">'
        + '<button type="button" class="rb-restore" onclick="chgRbRestore_(\'' + tid + '\')">Restore</button>'
        + '<button type="button" class="rb-purge" onclick="chgRbPurge_(\'' + tid + '\')" title="Delete forever">✕</button>'
        + '</div>'
      : '')
    + '</div>';
}

function chgRbLoad_(force) {
  if (!chgCanReadBin_()) return;
  var box = document.getElementById('chgRbList');
  if (!box) return;
  box.innerHTML = typeof empireLoadingHtml === 'function'
    ? empireLoadingHtml('Loading Recycle Bin…')
    : '<p>Loading…</p>';
  fetchJSONRetry({
    action: 'getTrash',
    dept: CHG_DEPT,
    sheets: CHG_TRASH_SHEETS,
    token: chgToken_()
  }, force ? 2 : 1, 30000).then(function (d) {
    if (typeof empireAuthHandleInvalidSession_ === 'function' && empireAuthHandleInvalidSession_(d)) return;
    if (d && d.ok === false) throw new Error(d.message || d.error || 'Could not load Recycle Bin.');
    var items = chgRbItems_(d);
    if (!items.length) {
      box.innerHTML = chgEmptyDesk_('The bin is empty', 'Deleted or reset RUs appear here until you restore them or empty the bin.');
      return;
    }
    box.innerHTML = '<div class="rb-items">' + items.map(chgRbItemHtml_).join('') + '</div>';
  }).catch(function (e) {
    box.innerHTML = typeof empireErrorHtml === 'function'
      ? empireErrorHtml((e && e.message) || 'Could not load Recycle Bin.')
      : '<p>' + chgEsc_((e && e.message) || 'Could not load') + '</p>';
  });
}

function chgRbRestore_(id) {
  var tid = chgSafeTrashId_(id);
  if (!tid || !chgCanWriteBin_()) return;
  var go = function () {
    fetchJSONRetry({
      action: 'restoreTrash',
      dept: CHG_DEPT,
      sheets: CHG_TRASH_SHEETS,
      trashIds: [tid],
      token: chgToken_()
    }, 1, 30000).then(function (d) {
      if (typeof empireAuthHandleInvalidSession_ === 'function' && empireAuthHandleInvalidSession_(d)) return;
      if (d && d.ok === false) throw new Error(d.message || d.error || 'Restore failed.');
      chgRbLoad_(true);
      return chgLoad_(true);
    }).catch(function (e) {
      uiAlert((e && e.message) || 'Restore failed.');
    });
  };
  uiConfirm('Restore this RU to the dashboard?').then(function (ok) { if (ok) go(); });
}

function chgRbPurge_(id) {
  var tid = chgSafeTrashId_(id);
  if (!tid || !chgCanWriteBin_()) return;
  var go = function () {
    fetchJSONRetry({
      action: 'purgeTrash',
      dept: CHG_DEPT,
      sheets: CHG_TRASH_SHEETS,
      trashIds: [tid],
      token: chgToken_()
    }, 1, 30000).then(function (d) {
      if (typeof empireAuthHandleInvalidSession_ === 'function' && empireAuthHandleInvalidSession_(d)) return;
      if (d && d.ok === false) throw new Error(d.message || d.error || 'Could not delete forever.');
      chgRbLoad_(true);
    }).catch(function (e) {
      uiAlert((e && e.message) || 'Could not delete forever.');
    });
  };
  uiConfirm('Delete this RU forever? This cannot be undone.', { danger: true }).then(function (ok) { if (ok) go(); });
}

function chgRbRestoreAll_() {
  if (!chgCanWriteBin_()) return;
  if (!document.querySelector('#chgRbList .rb-item')) {
    uiAlert('The bin is empty.');
    return;
  }
  var go = function () {
    fetchJSONRetry({
      action: 'restoreTrash',
      dept: CHG_DEPT,
      sheets: CHG_TRASH_SHEETS,
      token: chgToken_()
    }, 1, 60000).then(function (d) {
      if (typeof empireAuthHandleInvalidSession_ === 'function' && empireAuthHandleInvalidSession_(d)) return;
      if (d && d.ok === false) throw new Error(d.message || d.error || 'Restore all failed.');
      chgRbLoad_(true);
      return chgLoad_(true);
    }).catch(function (e) {
      uiAlert((e && e.message) || 'Restore all failed.');
    });
  };
  uiConfirm('Restore everything in the Recycle Bin?').then(function (ok) { if (ok) go(); });
}

function chgRbEmpty_() {
  if (!chgCanWriteBin_()) return;
  if (!document.querySelector('#chgRbList .rb-item')) {
    uiAlert('The bin is empty.');
    return;
  }
  var go = function () {
    fetchJSONRetry({
      action: 'purgeTrash',
      dept: CHG_DEPT,
      sheets: CHG_TRASH_SHEETS,
      token: chgToken_()
    }, 1, 60000).then(function (d) {
      if (typeof empireAuthHandleInvalidSession_ === 'function' && empireAuthHandleInvalidSession_(d)) return;
      if (d && d.ok === false) throw new Error(d.message || d.error || 'Empty bin failed.');
      chgRbLoad_(true);
    }).catch(function (e) {
      uiAlert((e && e.message) || 'Empty bin failed.');
    });
  };
  uiConfirm('Empty the Recycle Bin? This deletes every item forever.', { danger: true }).then(function (ok) { if (ok) go(); });
}

function chgDeleteOne_(id) {
  var safeId = chgSafeId_(id);
  var row = CHG_ROWS_.filter(function (r) { return r.id === safeId; })[0];
  if (!safeId || !chgCanWriteRow_(row)) return;
  var go = function () {
    fetchJSONRetry({
      action: 'deleteChargingRequest',
      token: chgToken_(),
      id: safeId
    }, 1, 30000).then(function (d) {
      if (typeof empireAuthHandleInvalidSession_ === 'function' && empireAuthHandleInvalidSession_(d)) return;
      if (!d || d.ok === false) throw new Error((d && (d.message || d.error)) || 'Could not move to Recycle Bin.');
      chgCloseDrawer_();
      return chgLoad_(true).then(function () {
        var bin = document.getElementById('bin');
        if (bin && bin.classList.contains('active')) chgRbLoad_(true);
      });
    }).catch(function (e) {
      uiAlert((e && e.message) || 'Could not move to Recycle Bin.');
    });
  };
  uiConfirm('Move this RU to the Recycle Bin?').then(function (ok) { if (ok) go(); });
}

function chgOpenResetModal_() {
  if (!chgCanWriteReset_()) return;
  var m = document.getElementById('chgResetModal');
  var pw = document.getElementById('chgResetPwInput');
  var msg = document.getElementById('chgResetMsg');
  if (pw) pw.value = '';
  if (msg) msg.textContent = '';
  if (m) m.style.display = 'flex';
  if (pw) setTimeout(function () { pw.focus(); }, 50);
}

function chgCloseResetModal_() {
  var m = document.getElementById('chgResetModal');
  if (m) m.style.display = 'none';
}

function chgDoReset_() {
  var pwEl = document.getElementById('chgResetPwInput');
  var msg = document.getElementById('chgResetMsg');
  if (!pwEl || !msg) return;
  var pw = String(pwEl.value || '');
  if (!pw) {
    msg.style.color = '#C5504F';
    msg.textContent = 'Please enter the password.';
    return;
  }
  msg.style.color = 'var(--text-soft)';
  msg.textContent = 'Moving to Recycle Bin…';
  fetchJSONRetry({
    action: 'clearChargingRequests',
    token: chgToken_(),
    resetPassword: pw,
    username: typeof empireGetUser === 'function' ? empireGetUser() : ''
  }, 1, 60000).then(function (d) {
    if (typeof empireAuthHandleInvalidSession_ === 'function' && empireAuthHandleInvalidSession_(d)) return;
    if (d && d.error === 'bad_password') {
      msg.style.color = '#C5504F';
      msg.textContent = 'Wrong password — nothing was deleted.';
      return;
    }
    if (d && d.error === 'not_allowed') {
      msg.style.color = '#C5504F';
      msg.textContent = 'Not allowed.';
      return;
    }
    if (d && d.ok === false) {
      msg.style.color = '#C5504F';
      msg.textContent = d.message || d.error || 'Reset failed.';
      return;
    }
    msg.style.color = '#1d9e75';
    msg.textContent = 'Moved ' + (d.cleared || 0) + ' RU' + ((d.cleared || 0) === 1 ? '' : 's') + ' to the Recycle Bin.';
    chgLoad_(true);
    chgRbLoad_(true);
    setTimeout(chgCloseResetModal_, 900);
  }).catch(function (e) {
    msg.style.color = '#C5504F';
    msg.textContent = (e && e.message) || 'Reset failed.';
  });
}

function chgRetryOne_(ru) {
  if (!chgBotOn_()) {
    return uiAlert('The bot is Off. Try failed again does nothing until Bot On/Off is turned On.');
  }
  if (!chgCanWriteWaiting_()) return;
  fetchJSONRetry({
    action: 'requestChargingRetry',
    token: chgToken_(),
    ru: ru
  }, 1, 30000).then(function (d) {
    if (!d || !d.ok) throw new Error((d && (d.message || d.error)) || 'Could not queue that RU.');
    chgCloseDrawer_();
    return chgLoad_(true);
  }).catch(function (e) {
    uiAlert((e && e.message) || 'Could not queue that RU.');
  });
}

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    chgCloseLightbox_(e);
    chgCloseDrawer_();
    chgCloseResetModal_();
  }
});

function chgInit_() {
  if (!empireAuthPageBoot({
    dept: CHG_DEPT,
    sendToHomeLogin: false,
    onEnter: chgEnterApp_
  })) return;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', chgInit_);
} else {
  chgInit_();
}
