/* Charging Electricity — live charge log dashboard */

var CHG_TRASH_SHEETS = ['ChargingRequests'];
var CHG_DEPT = 'charging';
var CHG_ROWS_ = [];
var CHG_COUNTS_ = { total: 0, charged: 0, waiting: 0, retryQueued: 0 };
var CHG_FILTER_KPI_ = '';
var CHG_TIMER_ = null;
var CHG_LOADING_ = false;

var CHG_STATUS_LABEL = {
  charged: 'Charged',
  cannot_charge: 'Cannot charge',
  no_row: 'No row in Nova',
  ambiguous: 'More than one Nova row',
  phone_none: 'Phone search found none',
  phone_many: 'Phone search found more than one'
};

function chgEsc_(s) {
  if (typeof empireEscHtml_ === 'function') return empireEscHtml_(s);
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function chgSwitchTab_(event, tab) {
  if (event && event.preventDefault) event.preventDefault();
  document.querySelectorAll('.tab-content').forEach(function (el) {
    el.classList.toggle('active', el.id === tab);
  });
  document.querySelectorAll('.side-nav .tab-btn').forEach(function (btn) {
    btn.classList.remove('active');
  });
  if (event && event.currentTarget) event.currentTarget.classList.add('active');
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
  chgLoad_(true);
  chgStartAutoRefresh_();
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
  empireAuthLogout({ redirect: 'index.html', reload: false });
}

function chgCanWrite_() {
  var role = String(typeof empireGetRole === 'function' ? empireGetRole() : '').toLowerCase();
  if (role === 'admin') return true;
  if (role === 'viewer') return false;
  return typeof empireModuleLevel === 'function' && empireModuleLevel('charging') === 'write';
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

function chgFormatAmt_(raw) {
  var n = String(raw || '').replace(/\D/g, '');
  if (!n) return '—';
  try {
    return Number(n).toLocaleString('en-US') + ' IQD';
  } catch (e2) {
    return n + ' IQD';
  }
}

function chgTypeLabel_(row) {
  if (row.tariff === 'T2' || row.electricType === 'generator') return 'T2 · generator';
  if (row.tariff === 'T1' || row.electricType === 'national') return 'T1 · national';
  return '—';
}

function chgStatusLabel_(status) {
  return CHG_STATUS_LABEL[status] || status || '—';
}

function chgPillHtml_(row) {
  var st = String(row.status || '');
  var html = '<span class="chg-pill ' + chgEsc_(st) + '">' + chgEsc_(chgStatusLabel_(st)) + '</span>';
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
  if (typeFilter === 'national' && row.electricType !== 'national' && row.tariff !== 'T1') return false;
  if (typeFilter === 'generator' && row.electricType !== 'generator' && row.tariff !== 'T2') return false;
  if (statusFilter === 'charged' && st !== 'charged') return false;
  if (statusFilter === 'waiting' && st === 'charged') return false;
  if (statusFilter === 'retry' && (!row.retryRequested || st === 'charged')) return false;
  if (statusFilter && statusFilter !== 'charged' && statusFilter !== 'waiting' && statusFilter !== 'retry' && st !== statusFilter) {
    return false;
  }
  if (q) {
    var blob = [row.ru, row.unitId, row.novaSearch, row.note, row.amount, chgStatusLabel_(st), chgTypeLabel_(row)]
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
  CHG_FILTER_KPI_ = key || '';
  var st = document.getElementById('chgFilterStatus');
  if (st) st.value = key || '';
  document.querySelectorAll('.tab-content').forEach(function (el) {
    el.classList.toggle('active', el.id === 'dash');
  });
  document.querySelectorAll('.side-nav .tab-btn').forEach(function (btn, i) {
    btn.classList.toggle('active', i === 0);
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
  if (chgCanWrite_() && chgIsWaiting_(row) && !row.retryRequested) {
    var ru = chgSafeRu_(row.ru);
    if (ru) {
      retryBtn = '<button type="button" class="chg-retry-btn" onclick="chgRetryOne_(\'' + ru + '\')">Queue this RU for retry</button>';
    }
  }
  if (chgCanWrite_() && safeId) {
    delBtn = '<button type="button" class="chg-del-btn" onclick="chgDeleteOne_(\'' + safeId + '\')">Move to Recycle Bin</button>';
  }
  drawer.innerHTML =
    '<div class="chg-drawer-bar"><div><h3 id="chgDrawerTitle">' + chgEsc_(row.ru) + '</h3>' +
    '<p class="chg-lead" style="margin-top:6px">' + chgPillHtml_(row) + '</p></div>' +
    '<button type="button" class="chg-drawer-close" onclick="chgCloseDrawer_()" aria-label="Close">×</button></div>' +
    '<dl class="chg-dl">' +
    '<dt>Saved</dt><dd>' + chgEsc_(chgFormatDt_(row.createdAt)) + '</dd>' +
    '<dt>Updated</dt><dd>' + chgEsc_(chgFormatDt_(row.updatedAt)) + '</dd>' +
    (row.chargedAt ? '<dt>Charged</dt><dd>' + chgEsc_(chgFormatDt_(row.chargedAt)) + '</dd>' : '') +
    '<dt>Unit</dt><dd class="chg-unit">' + chgEsc_(row.unitId || '—') + '</dd>' +
    '<dt>Nova search</dt><dd class="chg-unit">' + chgEsc_(row.novaSearch || '—') + '</dd>' +
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
      '<td class="chg-type">' + chgEsc_(chgTypeLabel_(row)) + '</td>' +
      '<td class="chg-amt">' + chgEsc_(chgFormatAmt_(row.amount)) + '</td>' +
      '<td>' + chgPillHtml_(row) + '</td>' +
      '<td' + (String(row.invoiceUrl || '').trim() ? ' onclick="event.stopPropagation();chgOpenLightboxRow_(\'' + chgSafeId_(row.id) + '\')"' : '') + '>' + chgThumbHtml_(row) + '</td>' +
      '<td class="chg-note-cell">' + chgEsc_(row.note || '') + '</td>' +
      '</tr>';
  }).join('');
  var cards = rows.map(function (row) {
    return '<button type="button" class="chg-card" onclick="chgRowOpen_(\'' + chgSafeId_(row.id) + '\')">' +
      '<div class="chg-card-top">' + chgThumbHtml_(row) +
      '<div class="chg-card-meta"><div class="chg-card-ru">' + chgEsc_(row.ru) + '</div>' +
      '<div class="chg-card-unit">' + chgEsc_(row.unitId || '—') + '</div>' +
      chgPillHtml_(row) + '</div></div>' +
      '<div class="chg-card-row"><span>' + chgEsc_(chgFormatDt_(row.createdAt)) + '</span>' +
      '<span>' + chgEsc_(chgTypeLabel_(row)) + '</span>' +
      '<span>' + chgEsc_(chgFormatAmt_(row.amount)) + '</span></div>' +
      (row.note ? '<div class="chg-card-note">' + chgEsc_(row.note) + '</div>' : '') +
      '</button>';
  }).join('');
  return '<div class="chg-table-wrap"><table class="chg-table"><thead><tr>' +
    '<th>Saved</th><th>RU</th><th>Unit</th><th>Type</th><th>Amount</th><th>Status</th><th>Invoice</th><th>Cause</th>' +
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

  var canWrite = chgCanWrite_();
  ['chgRetryBtnDash', 'chgRetryBtnWait'].forEach(function (id) {
    var btn = document.getElementById(id);
    if (!btn) return;
    btn.disabled = !canWrite || !(CHG_COUNTS_.waiting > 0);
    btn.title = canWrite
      ? 'Queue every waiting RU for the laptop robot'
      : 'Write access required';
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
      chgRender_();
    })
    .catch(function (e) {
      var msg = (e && e.message) || 'Could not load the charge log.';
      var html = typeof empireErrorHtml === 'function'
        ? empireErrorHtml(msg, 'Use Refresh in the sidebar.')
        : '<p>' + chgEsc_(msg) + '</p>';
      ['chgList', 'chgWaitingList', 'chgChargedList'].forEach(function (id) {
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
  if (!chgCanWrite_()) {
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

function chgShowStaffTools_() {
  var show = chgCanWrite_();
  var binTab = document.getElementById('chgBinTabBtn');
  var reset = document.getElementById('chgResetBtn');
  if (binTab) binTab.style.display = show ? '' : 'none';
  if (reset) reset.style.display = show ? '' : 'none';
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
    + '<div class="rb-actions">'
    + '<button type="button" class="rb-restore" onclick="chgRbRestore_(\'' + tid + '\')">Restore</button>'
    + '<button type="button" class="rb-purge" onclick="chgRbPurge_(\'' + tid + '\')" title="Delete forever">✕</button>'
    + '</div></div>';
}

function chgRbLoad_(force) {
  if (!chgCanWrite_()) return;
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
  if (!tid || !chgCanWrite_()) return;
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
  if (!tid || !chgCanWrite_()) return;
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
  if (!chgCanWrite_()) return;
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
  if (!chgCanWrite_()) return;
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
  if (!safeId || !chgCanWrite_()) return;
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
  if (!chgCanWrite_()) return;
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
  if (!chgCanWrite_()) return;
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
