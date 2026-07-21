/* A.S.A.A.S — West Wing corridor storage */
var ASAAS_DEPT = 'asaas';
var ASAAS_PHOTO_FOLDER = 'issues/asaas';
var ASAAS_WW_FLOORS = {
  WW1:['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8'],
  WW2:['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10'],
  WW3:['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12'],
  WW4:['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14'],
  WW5:['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14','F15','F16'],
  WW6:['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14','F15','F16','F17','F18'],
  WW7:['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14','F15','F16','F17','F18','F19','F20'],
  WW8:['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14','F15','F16','F17','F18','F19','F20','F21','F22'],
  WW9:['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14','F15','F16','F17','F18','F19','F20','F21','F22','F23','F24'],
  WW10:['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14','F15','F16','F17','F18','F19','F20','F21','F22','F23','F24','F25','F26'],
  WW11:['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14','F15','F16','F17','F18','F19','F20','F21','F22','F23','F24','F25','F26'],
  WW12:['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14','F15','F16','F17','F18','F19','F20','F21','F22','F23','F24','F25','F26','F27','F28','F29','F30'],
  WW13:['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14','F15','F16','F17','F18','F19','F20','F21','F22','F23','F24','F25','F26','F27','F28','F29','F30'],
  WW14:['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14','F15','F16','F17','F18','F19','F20','F21','F22','F23','F24','F25','F26','F27','F28','F29','F30'],
  WW15:['B1','Ground','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12','F13','F14','F15','F16','F17','F18','F19','F20','F21','F22','F23','F24','F25','F26','F27','F28','F29','F30']
};
var ASAAS_SPOTS = ['Corridor','In front of apartment door','Service stairs','Elevator lobby','Parking','Other'];

var _asaasItems = [];
var _asaasPhotoUrl = '';
var _asaasReturnPhotoUrl = '';
var _asaasUploading = false;
var _asaasReturnUploading = false;
var _asaasSubmitting = false;
var _asaasActiveTab = 'log';
var _asaasReturnId = '';

function asaasToken_() { return empireGetToken() || ''; }
function isAsaasMobile_() {
  return String(empireGetUser() || '').trim().toLowerCase() === 'asaas_guard1';
}
function asaasRef_(n) {
  var num = Number(n);
  return num > 0 ? ('A#' + num) : '';
}
function asaasEsc_(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function asaasDaysSince_(isoOrDate) {
  if (!isoOrDate) return 0;
  var d = new Date(String(isoOrDate).replace(' ', 'T'));
  if (isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}
function asaasLocStr_(r) {
  return [r.building, r.floor, r.spot].filter(Boolean).join(' · ');
}

function asaasPopulateBuildings_() {
  var el = document.getElementById('asaasBuilding');
  if (!el) return;
  el.innerHTML = '';
  Object.keys(ASAAS_WW_FLOORS).forEach(function (b) {
    var o = document.createElement('option');
    o.value = b;
    o.textContent = b;
    el.appendChild(o);
  });
  asaasUpdateFloors_();
}
function asaasUpdateFloors_() {
  var bEl = document.getElementById('asaasBuilding');
  var fEl = document.getElementById('asaasFloor');
  if (!bEl || !fEl) return;
  var floors = ASAAS_WW_FLOORS[bEl.value] || [];
  fEl.innerHTML = '';
  floors.forEach(function (f) {
    var o = document.createElement('option');
    o.value = f;
    o.textContent = f;
    fEl.appendChild(o);
  });
}
function asaasPopulateSpots_() {
  var el = document.getElementById('asaasSpot');
  if (!el) return;
  el.innerHTML = '';
  ASAAS_SPOTS.forEach(function (s) {
    var o = document.createElement('option');
    o.value = s;
    o.textContent = s;
    el.appendChild(o);
  });
}

function asaasEnterMobile_() {
  document.body.classList.add('asaas-mobile-mode');
  document.getElementById('loginPage').classList.remove('show');
  if (typeof empireAuthMarkLoginVisible === 'function') empireAuthMarkLoginVisible(false);
  document.getElementById('asaasOfficeApp').classList.remove('show');
  document.getElementById('asaasMobileApp').classList.add('show');
  if (typeof asaasApplyStaticLang === 'function') asaasApplyStaticLang();
  var title = document.getElementById('asaasMobileTitle');
  if (title) title.textContent = empireGetUser() || asaasT('titleMobile');
  asaasPopulateBuildings_();
  asaasPopulateSpots_();
  asaasLoadItems_(true);
}
function asaasEnterOffice_() {
  document.body.classList.remove('asaas-mobile-mode');
  document.documentElement.setAttribute('dir', 'ltr');
  document.getElementById('loginPage').classList.remove('show');
  if (typeof empireAuthMarkLoginVisible === 'function') empireAuthMarkLoginVisible(false);
  document.getElementById('asaasMobileApp').classList.remove('show');
  document.getElementById('asaasOfficeApp').classList.add('show');
  var wl = document.getElementById('asaasWhoLabel');
  if (wl) wl.textContent = 'Logged in as: ' + (empireGetUser() || '') + (empireGetRole() ? (' (' + empireGetRole() + ')') : '');
  asaasLoadItems_(true);
}

function asaasRouteView_() {
  if (isAsaasMobile_()) asaasEnterMobile_();
  else asaasEnterOffice_();
}

function asaasHandleLogin_(e) {
  empireAuthLogin(e, ASAAS_DEPT, {
    onSuccess: function () { asaasRouteView_(); }
  });
}
function asaasLogout_() {
  empireAuthLogout({ redirect: 'index.html', reload: false });
}

function asaasSwitchTab_(tab) {
  if (isAsaasMobile_()) {
    tab = tab === 'list' ? 'list' : 'log';
    _asaasActiveTab = tab;
    var logPanel = document.getElementById('asaasLogPanel');
    var listPanel = document.getElementById('asaasMobileListPanel');
    var btnLog = document.getElementById('asaasTabLog');
    var btnList = document.getElementById('asaasTabList');
    if (logPanel) logPanel.style.display = tab === 'log' ? '' : 'none';
    if (listPanel) listPanel.style.display = tab === 'list' ? '' : 'none';
    if (btnLog) btnLog.classList.toggle('active', tab === 'log');
    if (btnList) btnList.classList.toggle('active', tab === 'list');
    return;
  }
  document.querySelectorAll('#asaasOfficeApp .tab-content').forEach(function (el) { el.classList.remove('active'); });
  document.querySelectorAll('#asaasOfficeApp .tab-btn').forEach(function (el) { el.classList.remove('active'); });
  var pane = document.getElementById(tab);
  if (pane) pane.classList.add('active');
  if (event && event.currentTarget) event.currentTarget.classList.add('active');
  if (tab === 'analytics') asaasRenderAnalytics_();
}

function asaasRefreshIcons_() {
  return [
    document.getElementById('asaasNavRefreshIcon'),
    document.getElementById('asaasListRefreshIcon'),
    document.getElementById('asaasAnalyticsRefreshIcon'),
    document.getElementById('asaasMobileRefreshIcon')
  ].filter(Boolean);
}
function asaasSetRefreshSpinning_(on) {
  asaasRefreshIcons_().forEach(function (el) {
    if (on) el.classList.add('spinning');
    else el.classList.remove('spinning');
  });
}
function asaasRefresh_(force) {
  asaasSetRefreshSpinning_(true);
  return asaasLoadItems_(force !== false).finally(function () {
    asaasSetRefreshSpinning_(false);
  });
}

function asaasLoadItems_(force) {
  return fetchJSONRetry({ action: 'getAsaasItems', token: asaasToken_() }, force ? 2 : 1, 45000)
    .then(function (d) {
      _asaasItems = Array.isArray(d) ? d : [];
      asaasRefreshUi_();
    })
    .catch(function () {
      if (!_asaasItems.length) asaasRefreshUi_();
    });
}
window.asaasRefreshUi_ = function () {
  asaasRenderCountBar_();
  asaasRenderMobileRecent_();
  asaasRenderOfficeList_();
  var analyticsPane = document.getElementById('analytics');
  if (analyticsPane && analyticsPane.classList.contains('active')) asaasRenderAnalytics_();
  if (typeof asaasApplyStaticLang === 'function') asaasApplyStaticLang();
};

function asaasFilteredItems_() {
  var status = (document.getElementById('asaasFilterStatus') || {}).value || '';
  var q = String((document.getElementById('asaasSearch') || {}).value || '').toLowerCase();
  return _asaasItems.filter(function (r) {
    if (status && r.status !== status) return false;
    if (!q) return true;
    var ref = asaasRef_(r.num).toLowerCase().replace('#', '');
    var hay = (ref + ' ' + (r.building || '') + ' ' + (r.floor || '') + ' ' + (r.itemDescription || '') + ' ' + (r.apartment || '')).toLowerCase();
    return hay.indexOf(q.replace('#', '')) !== -1;
  });
}

function asaasMobileFilteredItems_() {
  var q = String((document.getElementById('asaasMobileSearch') || {}).value || '').trim().toLowerCase();
  return _asaasItems.filter(function (r) {
    if (r.status === 'returned') return false;
    if (!q) return true;
    var ref = asaasRef_(r.num).toLowerCase();
    var num = String(r.num || '');
    var needle = q.replace(/^a#?\s*/i, '').replace('#', '');
    return ref.indexOf(q) !== -1
      || num === needle
      || (needle && ref.replace('#', '').indexOf(needle) !== -1);
  });
}

function asaasRenderCountBar_() {
  var bar = document.getElementById('asaasCountBar');
  if (!bar) return;
  var n = _asaasItems.filter(function (r) { return r.status !== 'returned'; }).length;
  bar.textContent = asaasT('countInWarehouse', { count: n });
}

function asaasRenderMobileRecent_() {
  var host = document.getElementById('asaasMobileRecent');
  if (!host) return;
  var rows = asaasMobileFilteredItems_();
  if (!rows.length) {
    var emptyKey = (document.getElementById('asaasMobileSearch') || {}).value ? 'noItems' : 'noWarehouseItems';
    host.innerHTML = '<p class="worker-empty" style="font-size:13px;">' + asaasEsc_(asaasT(emptyKey)) + '</p>';
    return;
  }
  host.innerHTML = rows.map(function (r) {
    var thumb = r.photo
      ? '<img class="worker-field-my-thumb" src="' + asaasEsc_(r.photo) + '" alt="">'
      : '';
    var st = asaasT('inWarehouse');
    return '<button type="button" class="worker-field-my-card worker-field-my-card-tappable" data-asaas-id="' + asaasEsc_(r.id) + '">'
      + (thumb ? ('<div class="worker-field-my-media">' + thumb + '</div>') : '')
      + '<div class="worker-field-my-body">'
      + '<div class="worker-field-my-top"><span class="worker-field-my-ref">' + asaasEsc_(asaasRef_(r.num)) + '</span>'
      + '<time class="worker-field-my-date">' + asaasEsc_(r.date || '') + '</time></div>'
      + '<div class="worker-field-my-badges"><span class="worker-field-my-type refundable">' + asaasEsc_(st) + '</span></div>'
      + '<div class="worker-field-my-place">' + asaasEsc_(asaasLocStr_(r)) + '</div>'
      + '<p class="worker-field-my-note">' + asaasEsc_(r.itemDescription || '') + '</p>'
      + '<div class="worker-field-my-view-hint">' + asaasEsc_(asaasT('tapToReturn')) + '</div>'
      + '</div></button>';
  }).join('');
}

function asaasRenderOfficeList_() {
  var host = document.getElementById('asaasItemTable');
  if (!host) return;
  var rows = asaasFilteredItems_();
  if (!rows.length) {
    host.innerHTML = '<p class="worker-empty">' + asaasEsc_(asaasT('noItems')) + '</p>';
    return;
  }
  host.innerHTML = '<div class="asaas-card-grid">' + rows.map(function (r) {
    var days = asaasDaysSince_(r.createdAt || r.date);
    var st = r.status === 'returned' ? asaasT('returned') : asaasT('inWarehouse');
    var cardCls = 'asaas-card' + (r.status === 'returned' ? ' asaas-card-returned' : ' asaas-card-warehouse');
    return '<div class="' + cardCls + '" onclick="asaasOpenDetail_(\'' + asaasEsc_(r.id).replace(/'/g, "\\'") + '\')">'
      + (r.photo ? ('<img class="asaas-card-thumb" src="' + asaasEsc_(r.photo) + '" alt="">') : '')
      + '<div class="asaas-card-body">'
      + '<div class="asaas-card-ref">' + asaasEsc_(asaasRef_(r.num)) + '</div>'
      + '<div class="asaas-card-status">' + asaasEsc_(st) + '</div>'
      + '<div class="asaas-card-loc">' + asaasEsc_(asaasLocStr_(r)) + '</div>'
      + '<div class="asaas-card-item">' + asaasEsc_(r.itemDescription || '') + '</div>'
      + (r.apartment ? ('<div class="asaas-card-apt">' + asaasEsc_(r.apartment) + '</div>') : '')
      + (r.status !== 'returned' ? ('<div class="asaas-card-days">' + asaasEsc_(asaasT('daysInWarehouse', { days: days })) + '</div>') : '')
      + '</div></div>';
  }).join('') + '</div>';
}

function asaasPickPhoto_(kind) {
  kind = kind === 'return' ? 'return' : 'item';
  if (typeof empireWorkerPickPhoto === 'function') {
    empireWorkerPickPhoto({
      camera: kind === 'return' ? 'asaasReturnFileCamera' : 'asaasFileCamera',
      gallery: kind === 'return' ? 'asaasReturnFileGallery' : 'asaasFileGallery',
      title: kind === 'return' ? asaasT('photoTitleReturn') : asaasT('photoTitle')
    });
  }
}
function asaasProcessPhoto_(file, kind) {
  if (!file) return;
  kind = kind === 'return' ? 'return' : 'item';
  var status = document.getElementById(kind === 'return' ? 'asaasReturnPhotoStatus' : 'asaasPhotoStatus');
  if (status) status.textContent = asaasT('uploading');
  if (kind === 'return') _asaasReturnUploading = true;
  else _asaasUploading = true;
  empireCompressImage(file, ASAAS_PHOTO_FOLDER, function (url) {
    if (kind === 'return') _asaasReturnUploading = false;
    else _asaasUploading = false;
    if (url) {
      if (kind === 'return') {
        _asaasReturnPhotoUrl = url;
        var im = document.getElementById('asaasReturnPreview');
        if (im) { im.src = url; im.style.display = 'block'; }
      } else {
        _asaasPhotoUrl = url;
        var im2 = document.getElementById('asaasPreview');
        if (im2) { im2.src = url; im2.style.display = 'block'; }
      }
      if (status) status.textContent = '\u2705 ' + asaasT('photoReady');
    } else if (status) {
      status.textContent = '\u274C ' + (_lastEmpireUploadError || asaasT('uploadFailed'));
    }
  }, { maxSize: 1400, quality: 0.7 });
}
function asaasHandleFile_(e, kind) {
  var f = e.target.files && e.target.files[0];
  if (f) asaasProcessPhoto_(f, kind);
  e.target.value = '';
}

function asaasClearForm_() {
  _asaasPhotoUrl = '';
  _asaasUploading = false;
  ['asaasItemDesc', 'asaasApartment'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  var im = document.getElementById('asaasPreview');
  if (im) { im.style.display = 'none'; im.removeAttribute('src'); }
  var st = document.getElementById('asaasPhotoStatus');
  if (st) st.textContent = '';
  var msg = document.getElementById('asaasFormMsg');
  if (msg) { msg.textContent = ''; msg.className = 'worker-field-msg'; }
}

function asaasSubmitItem_() {
  if (_asaasSubmitting || _asaasUploading) return;
  var building = (document.getElementById('asaasBuilding') || {}).value || '';
  var floor = (document.getElementById('asaasFloor') || {}).value || '';
  var spot = (document.getElementById('asaasSpot') || {}).value || '';
  var itemDescription = String((document.getElementById('asaasItemDesc') || {}).value || '').trim();
  var apartment = String((document.getElementById('asaasApartment') || {}).value || '').trim();
  var msg = document.getElementById('asaasFormMsg');
  var btn = document.getElementById('asaasSubmitBtn');
  if (!building || !floor) {
    if (msg) { msg.textContent = asaasT('needLocation'); msg.className = 'worker-field-msg worker-field-msg-error'; }
    return;
  }
  if (!_asaasPhotoUrl && !itemDescription) {
    if (msg) { msg.textContent = asaasT('needDescription'); msg.className = 'worker-field-msg worker-field-msg-error'; }
    return;
  }
  if (!_asaasPhotoUrl) {
    if (msg) { msg.textContent = asaasT('needPhoto'); msg.className = 'worker-field-msg worker-field-msg-error'; }
    return;
  }
  _asaasSubmitting = true;
  if (btn) btn.disabled = true;
  if (msg) { msg.textContent = asaasT('sending'); msg.className = 'worker-field-msg'; }
  fetchJSONRetry({
    action: 'addAsaasItem',
    token: asaasToken_(),
    building: building,
    floor: floor,
    spot: spot,
    itemDescription: itemDescription,
    apartment: apartment,
    photo: _asaasPhotoUrl,
    removedByName: empireGetUser() || ''
  }, 2, 45000).then(function (d) {
    if (d && (d.ok || d.success)) {
      var ref = Number(d.num) > 0 ? asaasRef_(d.num) : '';
      if (msg) {
        msg.textContent = '\u2705 ' + asaasT('submitSuccess', { ref: ref });
        msg.className = 'worker-field-msg worker-field-msg-ok';
      }
      asaasClearForm_();
      asaasLoadItems_(true);
      if (isAsaasMobile_()) asaasSwitchTab_('list');
    } else throw new Error((d && (d.message || d.error)) || 'Failed');
  }).catch(function (e) {
    if (msg) {
      msg.textContent = '\u274C ' + String((e && e.message) || e);
      msg.className = 'worker-field-msg worker-field-msg-error';
    }
  }).finally(function () {
    _asaasSubmitting = false;
    if (btn) btn.disabled = false;
  });
}

function asaasOpenDetail_(id) {
  var r = _asaasItems.find(function (x) { return String(x.id) === String(id); });
  if (!r) return;
  if (isAsaasMobile_()) {
    asaasOpenViewModal_(r);
    return;
  }
  asaasOpenReturnModal_(r);
}

function asaasOpenViewModal_(r) {
  _asaasReturnId = r.status !== 'returned' ? r.id : '';
  _asaasReturnPhotoUrl = '';
  var modal = document.getElementById('asaasViewModal');
  var body = document.getElementById('asaasViewModalBody');
  if (!modal || !body) return;
  var canReturn = isAsaasMobile_() && r.status !== 'returned';
  var h = '<div class="worker-field-view">';
  if (r.status === 'returned') h += '<p class="worker-field-view-lead">' + asaasEsc_(asaasT('readOnlyReturned')) + '</p>';
  h += '<div class="worker-field-view-row"><span class="worker-field-view-label">' + asaasT('reference') + '</span><span class="worker-field-view-value worker-field-view-ref">' + asaasEsc_(asaasRef_(r.num)) + '</span></div>';
  h += '<div class="worker-field-view-row"><span class="worker-field-view-label">' + asaasT('status') + '</span><span class="worker-field-view-value">' + asaasEsc_(r.status === 'returned' ? asaasT('returned') : asaasT('inWarehouse')) + '</span></div>';
  h += '<div class="worker-field-view-row"><span class="worker-field-view-label">' + asaasT('date') + '</span><span class="worker-field-view-value">' + asaasEsc_(r.date || '') + '</span></div>';
  h += '<div class="worker-field-view-row"><span class="worker-field-view-label">' + asaasT('spot') + '</span><span class="worker-field-view-value">' + asaasEsc_(asaasLocStr_(r)) + '</span></div>';
  if (r.apartment) h += '<div class="worker-field-view-row"><span class="worker-field-view-label">' + asaasT('apartment') + '</span><span class="worker-field-view-value">' + asaasEsc_(r.apartment) + '</span></div>';
  h += '<div class="worker-field-view-block"><span class="worker-field-view-label">' + asaasT('item') + '</span><p class="worker-field-view-text">' + asaasEsc_(r.itemDescription || '') + '</p></div>';
  if (r.photo) h += '<div class="worker-field-view-block"><span class="worker-field-view-label">' + asaasT('photo') + '</span><img class="worker-field-view-photo" src="' + asaasEsc_(r.photo) + '" alt="" onclick="bigImg(this.src)"></div>';
  if (r.status === 'returned') {
    h += '<div class="worker-field-view-block"><span class="worker-field-view-label">' + asaasT('returnDetails') + '</span>';
    h += '<p class="worker-field-view-text">' + asaasEsc_(r.returnedTo || '') + (r.returnApartment ? (' · ' + r.returnApartment) : '') + '</p>';
    if (r.returnPhoto) h += '<img class="worker-field-view-photo" src="' + asaasEsc_(r.returnPhoto) + '" alt="" onclick="bigImg(this.src)">';
    h += '</div>';
  } else if (canReturn) {
    h += '<hr style="margin:18px 0;border:none;border-top:1px solid var(--card-border);">';
    h += '<p class="worker-field-view-lead">' + asaasEsc_(asaasT('mobileReturnHint')) + '</p>';
    h += '<label class="worker-field-label" for="asaasReturnedTo">' + asaasT('returnedTo') + '</label>';
    h += '<input type="text" id="asaasReturnedTo" class="worker-field-input" autocomplete="name">';
    h += '<label class="worker-field-label">' + asaasT('signedPaperPhoto') + '</label>';
    h += '<button type="button" class="worker-field-photo-btn" onclick="asaasPickPhoto_(\'return\')">' + asaasT('addPhoto') + '</button>';
    h += '<input type="file" id="asaasReturnFileCamera" class="worker-sr-file-input" accept="image/*" capture="environment" onchange="asaasHandleFile_(event,\'return\')">';
    h += '<input type="file" id="asaasReturnFileGallery" class="worker-sr-file-input" accept="image/*" onchange="asaasHandleFile_(event,\'return\')">';
    h += '<p id="asaasReturnPhotoStatus" class="worker-field-photo-status"></p>';
    h += '<img id="asaasReturnPreview" class="worker-field-preview-img" style="display:none" alt="">';
    h += '<button type="button" id="asaasReturnBtn" class="worker-field-submit worker-field-submit-green" onclick="asaasMarkReturned_()">' + asaasT('markReturned') + '</button>';
    h += '<p id="asaasReturnMsg" class="worker-field-msg"></p>';
  }
  h += '</div>';
  body.innerHTML = h;
  modal.classList.add('show');
}

function asaasCloseViewModal_() {
  _asaasReturnId = '';
  _asaasReturnPhotoUrl = '';
  var modal = document.getElementById('asaasViewModal');
  if (modal) modal.classList.remove('show');
}

function asaasOpenReturnModal_(r) {
  _asaasReturnId = r.id;
  _asaasReturnPhotoUrl = '';
  var modal = document.getElementById('asaasReturnModal');
  var body = document.getElementById('asaasReturnModalBody');
  if (!modal || !body) return;
  var readOnly = r.status === 'returned';
  var h = '<div class="asaas-return-form">';
  if (readOnly) h += '<p class="worker-field-view-lead">' + asaasEsc_(asaasT('readOnlyReturned')) + '</p>';
  h += '<div class="asaas-return-head"><strong>' + asaasEsc_(asaasRef_(r.num)) + '</strong> — ' + asaasEsc_(r.itemDescription || '') + '</div>';
  if (r.photo) h += '<img class="worker-field-view-photo" src="' + asaasEsc_(r.photo) + '" alt="" onclick="bigImg(this.src)">';
  h += '<p class="asaas-return-loc">' + asaasEsc_(asaasLocStr_(r)) + '</p>';
  if (!readOnly) {
    h += '<label class="worker-field-label" for="asaasWarehouseNote">' + asaasT('warehouseNote') + '</label>';
    h += '<input type="text" id="asaasWarehouseNote" class="worker-field-input" value="' + asaasEsc_(r.warehouseNote || '') + '" placeholder="' + asaasEsc_(asaasT('warehouseNotePlaceholder')) + '">';
    h += '<label class="worker-field-label" for="asaasOfficeApartment">' + asaasT('apartment') + '</label>';
    h += '<input type="text" id="asaasOfficeApartment" class="worker-field-input" value="' + asaasEsc_(r.apartment || '') + '" placeholder="' + asaasEsc_(asaasT('apartmentPlaceholder')) + '">';
    h += '<button type="button" class="worker-field-submit" style="margin-top:8px;" onclick="asaasSaveNote_()">' + asaasT('saveNote') + '</button>';
    h += '<hr style="margin:16px 0;border:none;border-top:1px solid var(--card-border);">';
    h += '<label class="worker-field-label" for="asaasReturnedTo">' + asaasT('returnedTo') + '</label>';
    h += '<input type="text" id="asaasReturnedTo" class="worker-field-input">';
    h += '<label class="worker-field-label" for="asaasReturnApartment">' + asaasT('returnApartment') + '</label>';
    h += '<input type="text" id="asaasReturnApartment" class="worker-field-input" value="' + asaasEsc_(r.apartment || '') + '">';
    h += '<label class="worker-field-label">' + asaasT('signedPaperPhoto') + '</label>';
    h += '<button type="button" class="worker-field-photo-btn" onclick="asaasPickPhoto_(\'return\')">' + asaasT('addPhoto') + '</button>';
    h += '<input type="file" id="asaasReturnFileCamera" class="worker-sr-file-input" accept="image/*" capture="environment" onchange="asaasHandleFile_(event,\'return\')">';
    h += '<input type="file" id="asaasReturnFileGallery" class="worker-sr-file-input" accept="image/*" onchange="asaasHandleFile_(event,\'return\')">';
    h += '<p id="asaasReturnPhotoStatus" class="worker-field-photo-status"></p>';
    h += '<img id="asaasReturnPreview" class="worker-field-preview-img" style="display:none" alt="">';
    h += '<label class="worker-field-label" for="asaasReturnNote">' + asaasT('returnNote') + '</label>';
    h += '<input type="text" id="asaasReturnNote" class="worker-field-input">';
    h += '<button type="button" id="asaasReturnBtn" class="worker-field-submit worker-field-submit-green" onclick="asaasMarkReturned_()">' + asaasT('markReturned') + '</button>';
  } else {
    h += '<p><strong>' + asaasT('returnedTo') + ':</strong> ' + asaasEsc_(r.returnedTo || '') + '</p>';
    if (r.returnApartment) h += '<p><strong>' + asaasT('returnApartment') + ':</strong> ' + asaasEsc_(r.returnApartment) + '</p>';
    if (r.returnPhoto) h += '<img class="worker-field-view-photo" src="' + asaasEsc_(r.returnPhoto) + '" alt="" onclick="bigImg(this.src)">';
  }
  h += '<p id="asaasReturnMsg" class="worker-field-msg"></p></div>';
  body.innerHTML = h;
  modal.classList.add('show');
}

function asaasCloseReturnModal_() {
  _asaasReturnId = '';
  _asaasReturnPhotoUrl = '';
  var modal = document.getElementById('asaasReturnModal');
  if (modal) modal.classList.remove('show');
}

function asaasSaveNote_() {
  if (!_asaasReturnId) return;
  var msg = document.getElementById('asaasReturnMsg');
  fetchJSONRetry({
    action: 'updateAsaasItem',
    token: asaasToken_(),
    id: _asaasReturnId,
    warehouseNote: String((document.getElementById('asaasWarehouseNote') || {}).value || '').trim(),
    apartment: String((document.getElementById('asaasOfficeApartment') || {}).value || '').trim()
  }, 2, 45000).then(function (d) {
    if (d && (d.ok || d.success)) {
      if (msg) { msg.textContent = '\u2705 Saved'; msg.className = 'worker-field-msg worker-field-msg-ok'; }
      asaasLoadItems_(true);
    } else throw new Error((d && (d.message || d.error)) || 'Failed');
  }).catch(function (e) {
    if (msg) { msg.textContent = '\u274C ' + String((e && e.message) || e); msg.className = 'worker-field-msg worker-field-msg-error'; }
  });
}

function asaasMarkReturned_() {
  if (!_asaasReturnId || _asaasReturnUploading) return;
  var msg = document.getElementById('asaasReturnMsg');
  var returnedTo = String((document.getElementById('asaasReturnedTo') || {}).value || '').trim();
  var returnApartment = String((document.getElementById('asaasReturnApartment') || {}).value || '').trim();
  var returnNote = String((document.getElementById('asaasReturnNote') || {}).value || '').trim();
  if (!returnedTo) {
    if (msg) { msg.textContent = asaasT('needReturnName'); msg.className = 'worker-field-msg worker-field-msg-error'; }
    return;
  }
  if (!_asaasReturnPhotoUrl) {
    if (msg) { msg.textContent = asaasT('needReturnPhoto'); msg.className = 'worker-field-msg worker-field-msg-error'; }
    return;
  }
  var btn = document.getElementById('asaasReturnBtn');
  if (btn) btn.disabled = true;
  fetchJSONRetry({
    action: 'markAsaasReturned',
    token: asaasToken_(),
    id: _asaasReturnId,
    returnedTo: returnedTo,
    returnApartment: returnApartment,
    returnPhoto: _asaasReturnPhotoUrl,
    returnNote: returnNote
  }, 2, 45000).then(function (d) {
    if (d && (d.ok || d.success)) {
      if (msg) { msg.textContent = '\u2705 ' + asaasT('returnSuccess'); msg.className = 'worker-field-msg worker-field-msg-ok'; }
      asaasCloseReturnModal_();
      asaasCloseViewModal_();
      asaasLoadItems_(true);
    } else throw new Error((d && (d.message || d.error)) || 'Failed');
  }).catch(function (e) {
    if (msg) { msg.textContent = '\u274C ' + String((e && e.message) || e); msg.className = 'worker-field-msg worker-field-msg-error'; }
    if (btn) btn.disabled = false;
  });
}

function asaasRenderAnalytics_() {
  var host = document.getElementById('asaasAnalyticsContent');
  if (!host) return;
  var total = _asaasItems.length;
  var warehouse = _asaasItems.filter(function (r) { return r.status !== 'returned'; }).length;
  var returned = total - warehouse;
  host.innerHTML = '<div class="stats">'
    + '<div class="stat-box"><div class="stat-value">' + total + '</div><div class="stat-label">Total items</div></div>'
    + '<div class="stat-box"><div class="stat-value" style="color:#d68910;">' + warehouse + '</div><div class="stat-label">In warehouse</div></div>'
    + '<div class="stat-box"><div class="stat-value" style="color:#27ae60;">' + returned + '</div><div class="stat-label">Returned</div></div>'
    + '</div>';
}

function bigImg(src) {
  var m = document.getElementById('asaasImgModal');
  var im = document.getElementById('asaasImgBig');
  if (m && im) { im.src = src; m.classList.add('show'); }
}
function closeAsaasImg_() {
  var m = document.getElementById('asaasImgModal');
  if (m) m.classList.remove('show');
}

document.addEventListener('click', function (e) {
  var card = e.target.closest('[data-asaas-id]');
  if (card) asaasOpenDetail_(card.getAttribute('data-asaas-id'));
});

function asaasBoot_() {
  if (!empireGetToken()) {
    document.getElementById('loginPage').classList.add('show');
    if (typeof empireAuthMarkLoginVisible === 'function') empireAuthMarkLoginVisible(true);
    return;
  }
  if (!empireCanAccessDept(ASAAS_DEPT)) {
    location.replace('index.html');
    return;
  }
  asaasRouteView_();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', asaasBoot_);
else asaasBoot();
