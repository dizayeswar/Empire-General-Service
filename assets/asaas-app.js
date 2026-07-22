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
var ASAAS_APARTMENTS = ['', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

var _asaasItems = [];
var _asaasLogItems = [{ desc: '', photo: '', uploading: false }];
var _asaasReturnPhotoUrl = '';
var _asaasStickerPhotoUrl = '';
var _asaasReturnUploading = false;
var _asaasStickerUploading = false;
var _asaasSubmitting = false;
var _asaasActiveTab = 'log';
var _asaasReturnId = '';
var _asaasStickerItemId = '';

function asaasNewLogItem_() {
  return { desc: '', photo: '', uploading: false };
}
function asaasLogItemUploading_() {
  return _asaasLogItems.some(function (it) { return it.uploading; });
}

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
function asaasFloorPart_(floor) {
  var f = String(floor || '').trim();
  if (!f) return '';
  var m = f.match(/^F(\d+)$/i);
  if (m) return m[1];
  return f;
}
function asaasLocStr_(r) {
  if (!r) return '';
  var building = String(r.building || '').trim();
  var floorPart = asaasFloorPart_(r.floor);
  var apt = String(r.apartment || '').trim();
  if (!building) return '';
  var tail = floorPart + apt;
  return tail ? building + '-' + tail : building;
}
function asaasItemSummaryHtml_(r) {
  var h = '<div class="asaas-item-summary">';
  h += '<p class="asaas-item-summary-line"><span class="asaas-item-summary-label">' + asaasT('refShort') + ':</span> <strong>' + asaasEsc_(asaasRef_(r.num)) + '</strong></p>';
  var loc = asaasLocStr_(r);
  if (loc) h += '<p class="asaas-item-summary-line"><span class="asaas-item-summary-label">' + asaasT('location') + ':</span> ' + asaasEsc_(loc) + '</p>';
  if (r.itemDescription) h += '<p class="asaas-item-summary-line"><span class="asaas-item-summary-label">' + asaasT('description') + ':</span> ' + asaasEsc_(r.itemDescription) + '</p>';
  h += '</div>';
  return h;
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
function asaasPopulateApartments_() {
  var el = document.getElementById('asaasApartment');
  if (!el) return;
  el.innerHTML = '';
  ASAAS_APARTMENTS.forEach(function (a) {
    var o = document.createElement('option');
    o.value = a;
    o.textContent = a ? a : asaasT('apartmentUnknown');
    el.appendChild(o);
  });
}
function asaasSyncLogItemsFromDom_() {
  var el = document.getElementById('asaasItemDesc0');
  if (el && _asaasLogItems[0]) _asaasLogItems[0].desc = el.value;
}
function asaasRenderLogItemBlocks_() {
  var host = document.getElementById('asaasItemsHost');
  if (!host) return;
  var it = _asaasLogItems[0] || asaasNewLogItem_();
  _asaasLogItems[0] = it;
  var html = '';
  html += '<label class="worker-field-label" for="asaasItemDesc0">' + asaasT('item') + '</label>';
  html += '<input type="text" id="asaasItemDesc0" class="worker-field-input asaas-item-desc" data-idx="0" value="' + asaasEsc_(it.desc) + '" data-asaas-i18n-placeholder="itemPlaceholder" placeholder="' + asaasEsc_(asaasT('itemPlaceholder')) + '" autocomplete="off">';
  html += '<label class="worker-field-label">' + asaasT('photo') + '</label>';
  html += '<button type="button" class="worker-field-photo-btn" onclick="asaasPickItemPhoto_(0)">' + asaasT('addPhoto') + '</button>';
  html += '<input type="file" id="asaasFileCamera-0" class="worker-sr-file-input" accept="image/*" capture="environment" onchange="asaasHandleItemFile_(event,0)">';
  html += '<input type="file" id="asaasFileGallery-0" class="worker-sr-file-input" accept="image/*" onchange="asaasHandleItemFile_(event,0)">';
  html += '<p id="asaasPhotoStatus-0" class="worker-field-photo-status">' + (it.photo ? ('\u2705 ' + asaasEsc_(asaasT('photoReady'))) : '') + '</p>';
  if (it.photo) html += '<img class="worker-field-preview-img" src="' + asaasEsc_(it.photo) + '" alt="">';
  host.innerHTML = html;
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
  asaasPopulateApartments_();
  asaasRenderLogItemBlocks_();
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
  if (isAsaasMobile_() && document.getElementById('asaasApartment')) {
    var aptVal = document.getElementById('asaasApartment').value;
    asaasPopulateApartments_();
    document.getElementById('asaasApartment').value = aptVal;
  }
  if (document.getElementById('asaasItemsHost')) asaasRenderLogItemBlocks_();
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
      + '<div class="asaas-card-loc">' + asaasEsc_(asaasLocStr_(r)) + '</div>'
      + '<div class="asaas-card-item">' + asaasEsc_(r.itemDescription || '') + '</div>'
      + '<div class="asaas-card-status">' + asaasEsc_(st) + '</div>'
      + (r.status !== 'returned' ? ('<div class="asaas-card-days">' + asaasEsc_(asaasT('daysInWarehouse', { days: days })) + '</div>') : '')
      + '</div></div>';
  }).join('') + '</div>';
}

function asaasPickPhoto_(kind) {
  if (kind === 'return') {
    if (typeof empireWorkerPickPhoto === 'function') {
      empireWorkerPickPhoto({
        camera: 'asaasReturnFileCamera',
        gallery: 'asaasReturnFileGallery',
        title: asaasT('photoTitleReturn')
      });
    }
    return;
  }
  if (kind === 'sticker') {
    if (typeof empireWorkerPickPhoto === 'function') {
      empireWorkerPickPhoto({
        camera: 'asaasStickerFileCamera',
        gallery: 'asaasStickerFileGallery',
        title: asaasT('photoTitleSticker')
      });
    }
  }
}
function asaasPickItemPhoto_(idx) {
  idx = Number(idx);
  if (typeof empireWorkerPickPhoto === 'function') {
    empireWorkerPickPhoto({
      camera: 'asaasFileCamera-' + idx,
      gallery: 'asaasFileGallery-' + idx,
      title: asaasT('photoTitle')
    });
  }
}
function asaasProcessPhoto_(file, kind) {
  if (!file) return;
  var isSticker = kind === 'sticker';
  var isReturn = kind === 'return';
  if (!isReturn && !isSticker) return;
  var status = document.getElementById(isSticker ? 'asaasStickerPhotoStatus' : 'asaasReturnPhotoStatus');
  if (status) status.textContent = asaasT('uploading');
  if (isSticker) _asaasStickerUploading = true;
  else _asaasReturnUploading = true;
  empireCompressImage(file, ASAAS_PHOTO_FOLDER, function (url) {
    if (isSticker) _asaasStickerUploading = false;
    else _asaasReturnUploading = false;
    if (url) {
      if (isSticker) {
        _asaasStickerPhotoUrl = url;
        var imS = document.getElementById('asaasStickerPreview');
        if (imS) { imS.src = url; imS.style.display = 'block'; }
      } else {
        _asaasReturnPhotoUrl = url;
        var im = document.getElementById('asaasReturnPreview');
        if (im) { im.src = url; im.style.display = 'block'; }
      }
      if (status) status.textContent = '\u2705 ' + asaasT('photoReady');
    } else if (status) {
      status.textContent = '\u274C ' + (_lastEmpireUploadError || asaasT('uploadFailed'));
    }
  }, { maxSize: 1400, quality: 0.7 });
}
function asaasProcessItemPhoto_(file, idx) {
  if (!file) return;
  idx = Number(idx);
  if (!_asaasLogItems[idx]) return;
  var status = document.getElementById('asaasPhotoStatus-' + idx);
  if (status) status.textContent = asaasT('uploading');
  _asaasLogItems[idx].uploading = true;
  empireCompressImage(file, ASAAS_PHOTO_FOLDER, function (url) {
    _asaasLogItems[idx].uploading = false;
    if (url) {
      _asaasLogItems[idx].photo = url;
      asaasRenderLogItemBlocks_();
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
function asaasHandleItemFile_(e, idx) {
  var f = e.target.files && e.target.files[0];
  if (f) asaasProcessItemPhoto_(f, idx);
  e.target.value = '';
}

function asaasClearForm_() {
  _asaasLogItems = [asaasNewLogItem_()];
  asaasRenderLogItemBlocks_();
  var aptEl = document.getElementById('asaasApartment');
  if (aptEl) aptEl.value = '';
  var msg = document.getElementById('asaasFormMsg');
  if (msg) { msg.textContent = ''; msg.className = 'worker-field-msg'; }
}

function asaasSubmitItem_() {
  if (_asaasSubmitting || asaasLogItemUploading_() || _asaasReturnUploading || _asaasStickerUploading) return;
  asaasSyncLogItemsFromDom_();
  var building = (document.getElementById('asaasBuilding') || {}).value || '';
  var floor = (document.getElementById('asaasFloor') || {}).value || '';
  var spot = (document.getElementById('asaasSpot') || {}).value || '';
  var apartment = String((document.getElementById('asaasApartment') || {}).value || '').trim();
  var msg = document.getElementById('asaasFormMsg');
  var btn = document.getElementById('asaasSubmitBtn');
  var it = _asaasLogItems[0] || asaasNewLogItem_();
  if (!building || !floor) {
    if (msg) { msg.textContent = asaasT('needLocation'); msg.className = 'worker-field-msg worker-field-msg-error'; }
    return;
  }
  var desc = String(it.desc || '').trim();
  if (!desc && !it.photo) {
    if (msg) { msg.textContent = asaasT('needDescription'); msg.className = 'worker-field-msg worker-field-msg-error'; }
    return;
  }
  if (!it.photo) {
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
    itemDescription: desc,
    apartment: apartment,
    photo: it.photo || '',
    removedByName: empireGetUser() || ''
  }, 2, 45000).then(function (d) {
    if (d && (d.ok || d.success)) {
      var ref = Number(d.num) > 0 ? asaasRef_(d.num) : '';
      if (msg) {
        msg.textContent = '\u2705 ' + asaasT('submitSuccess', { ref: ref });
        msg.className = 'worker-field-msg worker-field-msg-ok';
      }
      asaasClearForm_();
      return asaasLoadItems_(true);
    }
    throw new Error((d && (d.message || d.error)) || 'Failed');
  }).then(function () {
    if (isAsaasMobile_()) asaasSwitchTab_('list');
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
  _asaasStickerItemId = r.status !== 'returned' ? r.id : '';
  _asaasStickerPhotoUrl = '';
  var modal = document.getElementById('asaasViewModal');
  var body = document.getElementById('asaasViewModalBody');
  if (!modal || !body) return;
  var inWarehouse = r.status !== 'returned';
  var h = '<div class="worker-field-view">';
  if (r.status === 'returned') h += '<p class="worker-field-view-lead">' + asaasEsc_(asaasT('readOnlyReturned')) + '</p>';
  h += asaasItemSummaryHtml_(r);
  h += '<div class="worker-field-view-row"><span class="worker-field-view-label">' + asaasT('status') + '</span><span class="worker-field-view-value">' + asaasEsc_(r.status === 'returned' ? asaasT('returned') : asaasT('inWarehouse')) + '</span></div>';
  h += '<div class="worker-field-view-row"><span class="worker-field-view-label">' + asaasT('date') + '</span><span class="worker-field-view-value">' + asaasEsc_(r.date || '') + '</span></div>';
  if (r.spot) h += '<div class="worker-field-view-row"><span class="worker-field-view-label">' + asaasT('spot') + '</span><span class="worker-field-view-value">' + asaasEsc_(r.spot) + '</span></div>';
  if (r.photo) h += '<div class="worker-field-view-block"><span class="worker-field-view-label">' + asaasT('photo') + '</span><img class="worker-field-view-photo" src="' + asaasEsc_(r.photo) + '" alt="" onclick="bigImg(this.src)"></div>';
  if (inWarehouse) {
    h += '<hr style="margin:18px 0;border:none;border-top:1px solid var(--card-border);">';
    h += asaasStickerSectionHtml_(r, true);
  } else if (r.photo2) {
    h += '<div class="worker-field-view-block"><span class="worker-field-view-label">' + asaasT('stickerPhoto') + '</span><img class="worker-field-view-photo" src="' + asaasEsc_(r.photo2) + '" alt="" onclick="bigImg(this.src)"></div>';
  }
  if (r.status === 'returned') {
    h += '<div class="worker-field-view-block"><span class="worker-field-view-label">' + asaasT('returnDetails') + '</span>';
    h += '<p class="worker-field-view-text">' + asaasEsc_(r.returnedTo || '') + (r.returnApartment ? (' · ' + r.returnApartment) : '') + '</p>';
    if (r.returnPhoto) h += '<img class="worker-field-view-photo" src="' + asaasEsc_(r.returnPhoto) + '" alt="" onclick="bigImg(this.src)">';
    h += '</div>';
  } else if (isAsaasMobile_()) {
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

function asaasStickerSectionHtml_(r, editable) {
  var h = '<div class="worker-field-view-block asaas-sticker-block">';
  h += '<span class="worker-field-view-label">' + asaasT('stickerPhoto') + '</span>';
  if (r.photo2) {
    h += '<img class="worker-field-view-photo" src="' + asaasEsc_(r.photo2) + '" alt="" onclick="bigImg(this.src)">';
    return h + '</div>';
  }
  if (!editable) {
    h += '<p class="worker-field-view-text">' + asaasEsc_(asaasT('stickerPhotoMissing')) + '</p></div>';
    return h;
  }
  h += '<p class="worker-field-view-lead">' + asaasEsc_(asaasT('stickerPhotoHint')) + '</p>';
  h += '<button type="button" class="worker-field-photo-btn" onclick="asaasPickPhoto_(\'sticker\')">' + asaasT('addPhoto') + '</button>';
  h += '<input type="file" id="asaasStickerFileCamera" class="worker-sr-file-input" accept="image/*" capture="environment" onchange="asaasHandleFile_(event,\'sticker\')">';
  h += '<input type="file" id="asaasStickerFileGallery" class="worker-sr-file-input" accept="image/*" onchange="asaasHandleFile_(event,\'sticker\')">';
  h += '<p id="asaasStickerPhotoStatus" class="worker-field-photo-status"></p>';
  h += '<img id="asaasStickerPreview" class="worker-field-preview-img" style="display:none" alt="">';
  h += '<button type="button" id="asaasStickerBtn" class="worker-field-submit" onclick="asaasSaveStickerPhoto_()">' + asaasT('saveStickerPhoto') + '</button>';
  h += '<p id="asaasStickerMsg" class="worker-field-msg"></p></div>';
  return h;
}

function asaasSaveStickerPhoto_() {
  if (!_asaasStickerItemId || _asaasStickerUploading) return;
  var msg = document.getElementById('asaasStickerMsg');
  if (!_asaasStickerPhotoUrl) {
    if (msg) { msg.textContent = asaasT('needStickerPhoto'); msg.className = 'worker-field-msg worker-field-msg-error'; }
    return;
  }
  var btn = document.getElementById('asaasStickerBtn');
  if (btn) btn.disabled = true;
  fetchJSONRetry({
    action: 'updateAsaasItem',
    token: asaasToken_(),
    id: _asaasStickerItemId,
    photo2: _asaasStickerPhotoUrl
  }, 2, 45000).then(function (d) {
    if (d && (d.ok || d.success)) {
      if (msg) { msg.textContent = '\u2705 ' + asaasT('stickerPhotoSaved'); msg.className = 'worker-field-msg worker-field-msg-ok'; }
      return asaasLoadItems_(true);
    }
    throw new Error((d && (d.message || d.error)) || 'Failed');
  }).then(function () {
    var r = _asaasItems.find(function (x) { return String(x.id) === String(_asaasStickerItemId); });
    if (r && isAsaasMobile_()) asaasOpenViewModal_(r);
  }).catch(function (e) {
    if (msg) { msg.textContent = '\u274C ' + String((e && e.message) || e); msg.className = 'worker-field-msg worker-field-msg-error'; }
    if (btn) btn.disabled = false;
  });
}

function asaasCloseViewModal_() {
  _asaasReturnId = '';
  _asaasReturnPhotoUrl = '';
  _asaasStickerItemId = '';
  _asaasStickerPhotoUrl = '';
  var modal = document.getElementById('asaasViewModal');
  if (modal) modal.classList.remove('show');
}

function asaasOpenReturnModal_(r) {
  _asaasReturnId = '';
  _asaasReturnPhotoUrl = '';
  _asaasStickerItemId = '';
  _asaasStickerPhotoUrl = '';
  var modal = document.getElementById('asaasReturnModal');
  var body = document.getElementById('asaasReturnModalBody');
  if (!modal || !body) return;
  var inWarehouse = r.status !== 'returned';
  var h = '<div class="asaas-return-form worker-field-view">';
  h += asaasItemSummaryHtml_(r);
  h += '<div class="worker-field-view-row"><span class="worker-field-view-label">' + asaasT('status') + '</span><span class="worker-field-view-value">' + asaasEsc_(r.status === 'returned' ? asaasT('returned') : asaasT('inWarehouse')) + '</span></div>';
  h += '<div class="worker-field-view-row"><span class="worker-field-view-label">' + asaasT('date') + '</span><span class="worker-field-view-value">' + asaasEsc_(r.date || '') + '</span></div>';
  if (r.spot) h += '<div class="worker-field-view-row"><span class="worker-field-view-label">' + asaasT('spot') + '</span><span class="worker-field-view-value">' + asaasEsc_(r.spot) + '</span></div>';
  if (r.photo) h += '<div class="worker-field-view-block"><span class="worker-field-view-label">' + asaasT('photo') + '</span><img class="worker-field-view-photo" src="' + asaasEsc_(r.photo) + '" alt="" onclick="bigImg(this.src)"></div>';
  if (r.photo2) {
    h += '<div class="worker-field-view-block"><span class="worker-field-view-label">' + asaasT('stickerPhoto') + '</span><img class="worker-field-view-photo" src="' + asaasEsc_(r.photo2) + '" alt="" onclick="bigImg(this.src)"></div>';
  } else if (inWarehouse) {
    h += '<div class="worker-field-view-block"><span class="worker-field-view-label">' + asaasT('stickerPhoto') + '</span><p class="worker-field-view-text">' + asaasEsc_(asaasT('stickerPhotoMissing')) + '</p></div>';
  }
  if (r.warehouseNote) {
    h += '<div class="worker-field-view-block"><span class="worker-field-view-label">' + asaasT('warehouseNote') + '</span><p class="worker-field-view-text">' + asaasEsc_(r.warehouseNote) + '</p></div>';
  }
  if (r.status === 'returned') {
    h += '<div class="worker-field-view-block"><span class="worker-field-view-label">' + asaasT('returnDetails') + '</span>';
    h += '<p class="worker-field-view-text">' + asaasEsc_(r.returnedTo || '') + (r.returnApartment ? (' · ' + r.returnApartment) : '') + '</p>';
    if (r.returnNote) h += '<p class="worker-field-view-text">' + asaasEsc_(r.returnNote) + '</p>';
    if (r.returnPhoto) h += '<img class="worker-field-view-photo" src="' + asaasEsc_(r.returnPhoto) + '" alt="" onclick="bigImg(this.src)">';
    h += '</div>';
  } else {
    h += '<p class="worker-field-view-lead">' + asaasEsc_(asaasT('officeViewOnlyHint')) + '</p>';
  }
  h += '</div>';
  body.innerHTML = h;
  modal.classList.add('show');
}

function asaasCloseReturnModal_() {
  var modal = document.getElementById('asaasReturnModal');
  if (modal) modal.classList.remove('show');
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
