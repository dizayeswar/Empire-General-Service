/* Electric field worker — self-reported items for Electrical Department */

var _wfrJobPhotos = [];
var _wfrJobUploading = 0;
var _wfrInvoicePhotoUrl = '';
var _wfrInvoiceUploading = false;
var _wfrSubmitting = false;
var _wfrInvoiceSaving = false;
var _wfrReports = [];
var _wfrActiveTab = 'jobs';
var _wfrInvoiceModalId = '';
var _wfrInvoiceModalUrl = '';
var _wfrOfflineSyncRunning = false;
var _wfrOfflinePending = [];

function workerFieldReportIsDataUrl_(url) {
  return String(url || '').indexOf('data:') === 0;
}

function workerFieldReportOfflineId_() {
  return 'wfr-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

function workerFieldReportCompressToBlob_(file, cb) {
  var r = new FileReader();
  r.onload = function (e) {
    var img = new Image();
    img.onload = function () {
      var mx = 1400;
      var s = Math.min(1, mx / Math.max(img.width, img.height));
      var c = document.createElement('canvas');
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(function (b) { cb(b); }, 'image/jpeg', 0.7);
    };
    img.onerror = function () { cb(null); };
    img.src = e.target.result;
  };
  r.onerror = function () { cb(null); };
  r.readAsDataURL(file);
}

async function workerFieldReportOfflineCount_() {
  if (typeof empireOfflineQueueAll !== 'function') return 0;
  var rows = await empireOfflineQueueAll();
  var dept = (ISSUE_CFG && ISSUE_CFG.dept) || '';
  return rows.filter(function (r) {
    return r.type === 'worker_field_report' && r.dept === dept;
  }).length;
}

async function refreshWorkerFieldReportOfflineBanner_() {
  if (typeof refreshWorkerOfflineBanner === 'function') {
    await refreshWorkerOfflineBanner();
    return;
  }
  if (typeof empireOfflineSetBanner !== 'function') return;
  var n = await workerFieldReportOfflineCount_();
  empireOfflineSetBanner(n, function () { syncWorkerFieldReportOffline(false); }, {
    title: workerFieldReportT_('wfrBannerTitle', function (p) {
      var c = p.count || 0;
      return c + ' report' + (c === 1 ? '' : 's') + ' waiting to upload';
    }, { count: n }),
    subtitle: workerFieldReportT_('wfrBannerSubtitle', 'Saved on this phone — tap Retry when you have signal.'),
    buttonLabel: workerFieldReportT_('wfrBannerRetry', 'Retry upload')
  });
}

async function workerFieldReportLoadPendingOffline_() {
  _wfrOfflinePending = [];
  if (typeof empireOfflineQueueAll !== 'function') return;
  try {
    var rows = await empireOfflineQueueAll();
    var dept = (ISSUE_CFG && ISSUE_CFG.dept) || '';
    var user = String(empireGetUser() || '').trim().toLowerCase();
    _wfrOfflinePending = rows.filter(function (r) {
      return r.type === 'worker_field_report' && r.dept === dept && (!r.user || String(r.user).toLowerCase() === user);
    }).sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
  } catch (e) {
    _wfrOfflinePending = [];
  }
}

function workerFieldReportPrepareVoice_() {
  var vid = workerFieldReportVoiceId_();
  if (!navigator.onLine) {
    return workerFieldReportVoiceFromDraftLocal_();
  }
  if (typeof assignVoiceHasDraft_ === 'function' && !assignVoiceHasDraft_(vid)) {
    return Promise.resolve(null);
  }
  var upload = (typeof assignVoiceEnsureUploaded_ === 'function')
    ? assignVoiceEnsureUploaded_(vid, 12000)
    : Promise.resolve(null);
  return upload.catch(function () {
    return workerFieldReportVoiceFromDraftLocal_();
  });
}

function workerFieldReportVoiceFromDraftLocal_() {
  var vid = workerFieldReportVoiceId_();
  if (typeof assignVoiceDraft_ !== 'function' || typeof assignVoiceHasDraft_ !== 'function') {
    return Promise.resolve(null);
  }
  if (!assignVoiceHasDraft_(vid)) return Promise.resolve(null);
  var draft = assignVoiceDraft_(vid);
  if (!draft || !draft.blob || typeof empireOfflineBlobToDataUrl !== 'function') return Promise.resolve(null);
  return empireOfflineBlobToDataUrl(draft.blob).then(function (dataUrl) {
    return {
      _offlineDataUrl: dataUrl,
      by: empireGetUser() || '',
      at: new Date().toISOString(),
      durationSec: Number(draft.durationSec) || 0,
      mimeType: (draft.blob && draft.blob.type) || 'audio/wav'
    };
  });
}

async function enqueueWorkerFieldReportOffline_(payload) {
  if (typeof empireOfflineQueuePut !== 'function') throw new Error('Offline queue not available');
  var id = workerFieldReportOfflineId_();
  var photos = (payload.photos || []).slice();
  var invoice = payload.invoicePhoto || '';
  var item = {
    id: id,
    type: 'worker_field_report',
    dept: (ISSUE_CFG && ISSUE_CFG.dept) || '',
    place: payload.place || '',
    note: payload.note || '',
    materials: payload.materials || '',
    amount: payload.amount || '',
    reportType: payload.reportType || 'maintenance',
    photos: photos,
    invoicePhoto: invoice,
    workerName: payload.workerName || '',
    user: empireGetUser() || '',
    createdAt: Date.now()
  };
  if (payload.voiceNote && payload.voiceNote.url) {
    item.voiceNote = payload.voiceNote;
  } else if (payload.voiceNote && payload.voiceNote._offlineDataUrl) {
    item.voiceNoteDataUrl = payload.voiceNote._offlineDataUrl;
    item.voiceMeta = {
      by: payload.voiceNote.by || empireGetUser() || '',
      at: payload.voiceNote.at || new Date().toISOString(),
      durationSec: Number(payload.voiceNote.durationSec) || 0,
      mimeType: payload.voiceNote.mimeType || 'audio/wav'
    };
  }
  await empireOfflineQueuePut(item);
  await refreshWorkerFieldReportOfflineBanner_();
  await workerFieldReportLoadPendingOffline_();
  workerFieldReportRenderMine_();
  return id;
}

async function syncWorkerFieldReportOffline(silent) {
  if (_wfrOfflineSyncRunning) return { synced: 0 };
  if (!navigator.onLine) {
    if (!silent) {
      var msgOffline = document.getElementById('wfrFormMsg');
      if (msgOffline) {
        msgOffline.textContent = workerFieldReportT_('wfrWaitingSignal', 'Waiting to upload when you have signal.');
        msgOffline.className = 'worker-field-msg';
      } else if (typeof uiAlert === 'function') {
        uiAlert(workerFieldReportT_('wfrWaitingSignal', 'Waiting to upload when you have signal.'));
      }
    }
    return { synced: 0 };
  }
  if (typeof empireOfflineQueueAll !== 'function') return { synced: 0 };
  _wfrOfflineSyncRunning = true;
  var synced = 0;
  try {
    var cfg = workerFieldReportCfg_();
    if (!cfg || !cfg.actions || !cfg.actions.add) return { synced: 0 };
    var rows = await empireOfflineQueueAll();
    var dept = (ISSUE_CFG && ISSUE_CFG.dept) || '';
    var items = rows.filter(function (r) { return r.type === 'worker_field_report' && r.dept === dept; });
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      try {
        var photos = [];
        var srcPhotos = item.photos || [];
        for (var pi = 0; pi < srcPhotos.length; pi++) {
          var pUrl = String(srcPhotos[pi] || '');
          if (!pUrl) continue;
          if (workerFieldReportIsDataUrl_(pUrl)) {
            var pBlob = empireOfflineDataUrlToBlob(pUrl);
            if (!pBlob) throw new Error('Invalid saved photo');
            var uploaded = typeof empireUploadPhotoAsync === 'function'
              ? await empireUploadPhotoAsync(pBlob, workerFieldReportPhotoFolder_())
              : null;
            if (!uploaded) throw new Error('Photo upload failed');
            photos.push(uploaded);
          } else {
            photos.push(pUrl);
          }
        }
        var invoicePhoto = String(item.invoicePhoto || '');
        if (invoicePhoto && workerFieldReportIsDataUrl_(invoicePhoto)) {
          var iBlob = empireOfflineDataUrlToBlob(invoicePhoto);
          if (!iBlob) throw new Error('Invalid saved invoice photo');
          invoicePhoto = typeof empireUploadPhotoAsync === 'function'
            ? await empireUploadPhotoAsync(iBlob, workerFieldReportPhotoFolder_())
            : '';
          if (!invoicePhoto) throw new Error('Invoice photo upload failed');
        }
        var voiceNote = null;
        if (item.voiceNote && item.voiceNote.url) {
          voiceNote = item.voiceNote;
        } else if (item.voiceNoteDataUrl) {
          var vBlob = empireOfflineDataUrlToBlob(item.voiceNoteDataUrl);
          if (!vBlob) throw new Error('Invalid saved voice note');
          var vUrl = typeof empireUploadAudioAsync === 'function'
            ? await empireUploadAudioAsync(vBlob, workerFieldReportPhotoFolder_())
            : null;
          if (!vUrl) throw new Error('Voice note upload failed');
          var meta = item.voiceMeta || {};
          voiceNote = {
            url: vUrl,
            by: meta.by || item.user || '',
            at: meta.at || new Date().toISOString(),
            durationSec: Number(meta.durationSec) || 0,
            mimeType: meta.mimeType || 'audio/wav'
          };
        }
        var body = {
          action: cfg.actions.add,
          token: issueToken() || '',
          place: item.place || '',
          note: item.note || '',
          materials: item.materials || '',
          amount: item.amount || '',
          reportType: item.reportType || 'maintenance',
          photo: photos[0] || '',
          photos: photos,
          invoicePhoto: invoicePhoto || '',
          workerName: item.workerName || ''
        };
        if (voiceNote && voiceNote.url) body.voiceNote = voiceNote;
        var d = await fetchJSONRetry(body, 3, 45000);
        if (d && d.ok === false) {
          if (typeof empireAuthHandleInvalidSession_ === 'function' && empireAuthHandleInvalidSession_(d, typeof issueSessionLogoutOpts === 'function' ? issueSessionLogoutOpts() : undefined)) {
            return { synced: synced };
          }
          throw new Error(d.message || d.error || 'Could not send report');
        }
        if (!(d && (d.ok || d.success))) throw new Error('Unexpected server response');
        await empireOfflineQueueDelete(item.id);
        synced++;
      } catch (e) {
        console.warn('Field report offline sync failed', item.id, e && e.message);
      }
    }
    await refreshWorkerFieldReportOfflineBanner_();
    await workerFieldReportLoadPendingOffline_();
    workerFieldReportRenderMine_();
    if (synced) workerFieldReportLoadMine_(true);
    if (synced && !silent) {
      var msgOk = document.getElementById('wfrFormMsg');
      var text = '\u2705 ' + synced + ' report' + (synced === 1 ? '' : 's') + ' uploaded.';
      if (msgOk && _wfrActiveTab === 'report') {
        msgOk.textContent = text;
        msgOk.className = 'worker-field-msg worker-field-msg-ok';
      } else if (typeof uiAlert === 'function') {
        uiAlert(text);
      }
    }
    return { synced: synced };
  } finally {
    _wfrOfflineSyncRunning = false;
  }
}

function initWorkerFieldReportOfflineSync_() {
  if (!workerFieldReportEnabled_() || !isCivilWorker()) return;
  workerFieldReportLoadPendingOffline_().then(function () {
    refreshWorkerFieldReportOfflineBanner_();
    workerFieldReportRenderMine_();
    syncWorkerFieldReportOffline(true);
  });
  if (!window._wfrOfflineOnlineBound) {
    window._wfrOfflineOnlineBound = true;
    window.addEventListener('online', function () { syncWorkerFieldReportOffline(true); });
  }
  if (!window._wfrOfflinePollStarted) {
    window._wfrOfflinePollStarted = true;
    setInterval(function () {
      if (!isCivilWorker() || _wfrActiveTab !== 'report') return;
      syncWorkerFieldReportOffline(true);
    }, 20000);
  }
}

function workerFieldReportUpdateSubmitBtnLabel_() {
  var btn = document.getElementById('wfrSubmitBtn');
  if (!btn || _wfrSubmitting) return;
  if (!navigator.onLine) {
    btn.textContent = workerFieldReportT_('wfrSubmitOffline', 'Save on device — retry later');
  } else {
    btn.textContent = workerFieldReportT_('wfrSubmit', 'Send to Electrical Department');
  }
}

function workerFieldReportCfg_() {
  return (ISSUE_CFG && ISSUE_CFG.workerFieldReport) || null;
}

function workerFieldReportEnabled_() {
  var cfg = workerFieldReportCfg_();
  return !!(cfg && cfg.enabled && cfg.actions && cfg.actions.add);
}

function workerFieldReportUi_(key, fallback) {
  var i18nMap = {
    jobsTab: 'tabJobs',
    reportTab: 'tabReport',
    placePlaceholder: 'wfrPlacePlaceholder',
    notePlaceholder: 'wfrNotePlaceholder',
    submitSuccess: 'wfrSubmitSuccess'
  };
  if (typeof workerT === 'function' && i18nMap[key]) {
    return workerT(i18nMap[key]);
  }
  var cfg = workerFieldReportCfg_();
  var ui = (cfg && cfg.ui) || {};
  return ui[key] != null && ui[key] !== '' ? ui[key] : fallback;
}

function workerFieldReportT_(key, fallback, params) {
  if (typeof workerT === 'function') {
    var v = workerT(key, params);
    if (v && v !== key) return v;
  }
  if (typeof fallback === 'function') return fallback(params || {});
  return fallback != null ? fallback : key;
}

function workerFieldReportVoiceId_() {
  var cfg = workerFieldReportCfg_();
  return String((cfg && cfg.voiceDraftId) || 'field-report');
}

function workerFieldReportPhotoFolder_() {
  var cfg = workerFieldReportCfg_();
  return String((cfg && cfg.photoFolder) || 'issues/electric-field');
}

function workerFieldReportParseAmount_(raw) {
  if (raw == null || raw === '') return 0;
  var digits = String(raw).replace(/\D/g, '');
  if (!digits) return 0;
  var n = parseInt(digits, 10);
  if (isNaN(n) || n <= 0) return 0;
  return n;
}

function workerFieldReportFormatAmountDigits_(digits) {
  digits = String(digits || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function workerFieldReportHandleAmountInput_(e) {
  var el = (e && e.target) ? e.target : document.getElementById('wfrAmount');
  if (!el) return;
  var digits = String(el.value || '').replace(/\D/g, '');
  var formatted = workerFieldReportFormatAmountDigits_(digits);
  if (el.value !== formatted) el.value = formatted;
}

function workerFieldReportType_(rOrAmount) {
  if (rOrAmount && typeof rOrAmount === 'object') {
    if (rOrAmount.reportType === 'refundable') return 'refundable';
    if (rOrAmount.reportType === 'maintenance') return 'maintenance';
    return workerFieldReportParseAmount_(rOrAmount.amount) > 0 ? 'refundable' : 'maintenance';
  }
  return workerFieldReportParseAmount_(rOrAmount) > 0 ? 'refundable' : 'maintenance';
}

function workerFieldReportRefLabel_(r) {
  var n = Number(r && r.num);
  return (n > 0) ? ('R#' + n) : '';
}

function workerFieldReportTypeBadgeHtml_(r) {
  var t = workerFieldReportType_(r);
  if (t === 'refundable') return '<span class="worker-field-my-type refundable">' + workerFieldReportT_('wfrRefundableBadge', 'Refundable') + '</span>';
  return '<span class="worker-field-my-type maintenance">' + workerFieldReportT_('wfrMaintenanceBadge', 'Maintenance') + '</span>';
}

function workerFieldReportEsc_(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function workerFieldReportVoiceBadgeHtml_(note) {
  if (!note || !note.url) return '';
  var dur = (note.durationSec && typeof assignVoiceFormatSec === 'function')
    ? assignVoiceFormatSec(note.durationSec) : '';
  return '<span class="worker-field-my-voice">' + workerFieldReportT_('wfrVoiceBadge', 'Voice') + (dur ? (' · ' + dur) : '') + '</span>';
}

function workerFieldReportAmountLabel_(amount) {
  var n = workerFieldReportParseAmount_(amount);
  if (!n) return '';
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' IQD';
}

function workerFieldReportNeedsInvoice_(r) {
  return workerFieldReportType_(r) === 'refundable'
    && String(r.status || 'pending').toLowerCase() === 'pending'
    && !String(r.invoicePhoto || '').trim();
}

function workerFieldReportJobPhotoMax_() {
  var cfg = workerFieldReportCfg_();
  var n = cfg && cfg.jobPhotoMax;
  if (n > 0) return n;
  n = ISSUE_CFG && ISSUE_CFG.workerJobPhotoMax;
  return n > 0 ? n : 3;
}

function workerFieldReportJobPhotosFromRow_(r) {
  if (r && r.photos && r.photos.length) return r.photos.slice();
  var raw = String((r && r.photo) || '').trim();
  if (!raw) return [];
  if (raw.charAt(0) === '[') {
    try {
      var arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.filter(function (u) { return String(u || '').trim(); });
    } catch (e) {}
  }
  if (raw.indexOf('|') !== -1) {
    return raw.split('|').map(function (p) { return String(p || '').trim(); }).filter(Boolean);
  }
  return [raw];
}

function workerFieldReportRenderJobPhotoGrid_() {
  var grid = document.getElementById('wfrJobPhotoGrid');
  if (!grid) return;
  if (!_wfrJobPhotos.length) {
    grid.innerHTML = '';
    grid.classList.add('worker-photo-grid-empty');
  } else {
    grid.classList.remove('worker-photo-grid-empty');
    grid.innerHTML = _wfrJobPhotos.map(function (url, i) {
      var offline = workerFieldReportIsDataUrl_(url);
      return '<div class="worker-photo-item"><img src="' + workerFieldReportEsc_(url) + '" onclick="bigImg(this.src)" alt="Photo ' + (i + 1) + '">'
        + '<button type="button" class="worker-photo-remove" onclick="workerFieldReportRemoveJobPhoto(' + i + ')" aria-label="' + workerFieldReportT_('wfrRemovePhotoAria', 'Remove photo') + '">&times;</button>'
        + '<span class="worker-photo-label">' + workerFieldReportT_('wfrPhotoN', function (p) { return 'Photo ' + (p.index || 1); }, { index: i + 1 })
        + (offline ? (' · ' + workerFieldReportT_('wfrOnDevice', 'on device')) : '') + '</span></div>';
    }).join('');
  }
  var addZone = document.getElementById('wfrJobPhotoAddZone');
  if (addZone) {
    var max = workerFieldReportJobPhotoMax_();
    addZone.style.display = (_wfrJobPhotos.length >= max) ? 'none' : '';
  }
  var status = document.getElementById('wfrPhotoStatus');
  if (status && !_wfrJobUploading) {
    if (_wfrJobPhotos.length) {
      status.textContent = '\u2705 ' + workerFieldReportT_('wfrJobPhotosReady', function (p) {
        return p.count + ' photo' + (p.count === 1 ? '' : 's') + ' ready';
      }, { count: _wfrJobPhotos.length });
    } else {
      status.textContent = '';
    }
  }
  workerFieldReportUpdateSubmitBtnLabel_();
}

function workerFieldReportRemoveJobPhoto_(idx) {
  _wfrJobPhotos.splice(idx, 1);
  workerFieldReportRenderJobPhotoGrid_();
}

function workerFieldReportIsRefundableForm_() {
  var check = document.getElementById('wfrRefundableCheck');
  if (check) return !!check.checked;
  var amountEl = document.getElementById('wfrAmount');
  return amountEl ? workerFieldReportParseAmount_(amountEl.value) > 0 : false;
}

function workerFieldReportHandleRefundableCheck_(e) {
  workerFieldReportSyncRefundableUi_();
}

function workerFieldReportSyncRefundableUi_() {
  var refundable = workerFieldReportIsRefundableForm_();
  var block = document.getElementById('wfrRefundablePhotos');
  var invoiceBlock = document.getElementById('wfrInvoiceBlock');
  if (block) block.style.display = refundable ? '' : 'none';
  if (invoiceBlock) invoiceBlock.style.display = refundable ? '' : 'none';
}

function workerFieldReportInit_() {
  if (!workerFieldReportEnabled_() || !isCivilWorker()) return;
  if (typeof workerApplyStaticLang === 'function') workerApplyStaticLang();
  var bar = document.getElementById('workerTabBar');
  if (bar) bar.style.display = 'flex';
  var btnJobs = document.getElementById('workerTabJobs');
  var btnReport = document.getElementById('workerTabReport');
  if (btnJobs) btnJobs.textContent = workerFieldReportUi_('jobsTab', 'Assigned jobs');
  if (btnReport) btnReport.textContent = workerFieldReportUi_('reportTab', 'Add report');
  var place = document.getElementById('wfrPlace');
  var note = document.getElementById('wfrNote');
  if (place) place.placeholder = workerFieldReportUi_('placePlaceholder', 'Where?');
  if (note) note.placeholder = workerFieldReportUi_('notePlaceholder', 'What did you find or do?');
  var check = document.getElementById('wfrRefundableCheck');
  if (check && !check.dataset.wfrRefundableBound) {
    check.dataset.wfrRefundableBound = '1';
    check.addEventListener('change', workerFieldReportHandleRefundableCheck_);
  }
  var amount = document.getElementById('wfrAmount');
  if (amount) {
    amount.placeholder = workerFieldReportUi_('amountPlaceholder', 'IQD — leave empty for maintenance');
    if (!amount.dataset.wfrAmountBound) {
      amount.dataset.wfrAmountBound = '1';
      amount.addEventListener('input', function (e) {
        workerFieldReportHandleAmountInput_(e);
        workerFieldReportSyncRefundableUi_();
      });
    }
  }
  workerFieldReportSyncRefundableUi_();
  workerFieldReportRenderJobPhotoGrid_();
  workerFieldReportMountVoice_();
  workerFieldReportInitCardTap_();
  workerFieldReportClearForm_(false);
  workerFieldReportUpdateSubmitBtnLabel_();
  initWorkerFieldReportOfflineSync_();
  workerFieldReportLoadMine_();
  if (!window._wfrOfflineBtnBound) {
    window._wfrOfflineBtnBound = true;
    window.addEventListener('online', workerFieldReportUpdateSubmitBtnLabel_);
    window.addEventListener('offline', workerFieldReportUpdateSubmitBtnLabel_);
  }
}

function workerFieldReportMountVoice_() {
  var host = document.getElementById('workerFieldVoiceHost');
  if (!host || typeof assignVoiceBoxHtml !== 'function') return;
  host.innerHTML = assignVoiceBoxHtml(workerFieldReportVoiceId_(), null, { workerReport: true });
  if (typeof assignVoiceBindPlayers === 'function') assignVoiceBindPlayers(host);
}

function workerFieldReportSwitchTab_(tab) {
  tab = tab === 'report' ? 'report' : 'jobs';
  _wfrActiveTab = tab;
  var jobsPanel = document.getElementById('workerJobsPanel');
  var reportPanel = document.getElementById('workerReportPanel');
  var btnJobs = document.getElementById('workerTabJobs');
  var btnReport = document.getElementById('workerTabReport');
  var countBar = document.getElementById('workerCountBar');
  if (jobsPanel) jobsPanel.style.display = tab === 'jobs' ? '' : 'none';
  if (reportPanel) reportPanel.style.display = tab === 'report' ? '' : 'none';
  if (countBar) countBar.style.display = tab === 'jobs' ? '' : 'none';
  if (btnJobs) btnJobs.classList.toggle('active', tab === 'jobs');
  if (btnReport) btnReport.classList.toggle('active', tab === 'report');
  if (tab === 'report') {
    workerFieldReportUpdateSubmitBtnLabel_();
    workerFieldReportLoadPendingOffline_().then(function () { workerFieldReportRenderMine_(); });
    workerFieldReportLoadMine_(true);
    syncWorkerFieldReportOffline(true);
  }
}

function workerFieldReportPickPhoto_() {
  if (typeof empireWorkerPickPhoto === 'function') {
    empireWorkerPickPhoto({
      camera: 'wfrFileCamera',
      gallery: 'wfrFileGallery',
      title: workerFieldReportT_('photoTitleJob', 'Job photo')
    });
    return;
  }
  var input = document.getElementById('wfrFileGallery') || document.getElementById('wfrFile');
  if (!input) return;
  input.value = '';
  input.click();
}

function workerFieldReportClearForm_(resetMsg) {
  _wfrJobPhotos = [];
  _wfrJobUploading = 0;
  _wfrInvoicePhotoUrl = '';
  _wfrInvoiceUploading = false;
  var place = document.getElementById('wfrPlace');
  var note = document.getElementById('wfrNote');
  var materials = document.getElementById('wfrMaterials');
  var invoiceImg = document.getElementById('wfrInvoiceImage');
  var status = document.getElementById('wfrPhotoStatus');
  var invoiceStatus = document.getElementById('wfrInvoiceStatus');
  var msg = document.getElementById('wfrFormMsg');
  if (place) place.value = '';
  if (note) note.value = '';
  if (materials) materials.value = '';
  var check = document.getElementById('wfrRefundableCheck');
  if (check) check.checked = false;
  var amount = document.getElementById('wfrAmount');
  if (amount) amount.value = '';
  if (invoiceImg) {
    invoiceImg.style.display = 'none';
    invoiceImg.removeAttribute('src');
  }
  if (status) status.textContent = '';
  if (invoiceStatus) invoiceStatus.textContent = '';
  workerFieldReportRenderJobPhotoGrid_();
  workerFieldReportSyncRefundableUi_();
  if (typeof assignVoiceClearDraft === 'function') assignVoiceClearDraft(workerFieldReportVoiceId_());
  if (resetMsg !== false && msg) {
    msg.textContent = '';
    msg.className = 'worker-field-msg';
  }
}

function workerFieldReportProcessPhoto_(file, kind) {
  if (!file) return;
  kind = kind === 'invoice' ? 'invoice' : 'job';
  if (kind === 'job') {
    var max = workerFieldReportJobPhotoMax_();
    if (_wfrJobPhotos.length >= max) {
      alert(workerFieldReportT_('wfrPhotoMaxReached', function (p) {
        return 'You can add up to ' + p.max + ' job photos. Remove one to add another.';
      }, { max: max }));
      return;
    }
  }
  var status = document.getElementById(kind === 'invoice' ? 'wfrInvoiceStatus' : 'wfrPhotoStatus');
  if (status) status.textContent = workerFieldReportT_('wfrUploading', 'Uploading\u2026');
  if (kind === 'invoice') _wfrInvoiceUploading = true;
  else _wfrJobUploading++;

  function finishWithUrl(url, offline) {
    if (kind === 'invoice') _wfrInvoiceUploading = false;
    else _wfrJobUploading = Math.max(0, _wfrJobUploading - 1);
    if (!url) {
      if (status) status.textContent = '\u274C ' + (_lastEmpireUploadError || workerFieldReportT_('wfrUploadFailed', 'Upload failed — try again'));
      return;
    }
    if (kind === 'invoice') {
      _wfrInvoicePhotoUrl = url;
      var invoiceIm = document.getElementById('wfrInvoiceImage');
      if (invoiceIm) {
        invoiceIm.src = url;
        invoiceIm.style.display = 'block';
      }
      if (status) {
        status.textContent = '\u2705 ' + (offline
          ? workerFieldReportT_('wfrInvoiceSavedOnDevice', 'Invoice saved on this device — will upload with report')
          : workerFieldReportT_('wfrInvoicePhotoReady', 'Invoice photo ready — tap to replace'));
      }
    } else {
      _wfrJobPhotos.push(url);
      workerFieldReportRenderJobPhotoGrid_();
      if (status && offline) {
        status.textContent = '\u2705 ' + workerFieldReportT_('wfrPhotoSavedOnDevice', 'Photo saved on this device. It will upload when you have signal.');
      }
    }
    workerFieldReportUpdateSubmitBtnLabel_();
  }

  workerFieldReportCompressToBlob_(file, function (blob) {
    if (!blob) {
      if (kind === 'invoice') _wfrInvoiceUploading = false;
      else _wfrJobUploading = Math.max(0, _wfrJobUploading - 1);
      if (status) status.textContent = '\u274C ' + workerFieldReportT_('wfrUploadFailed', 'Upload failed — try again');
      return;
    }
    if (!navigator.onLine) {
      if (typeof empireOfflineBlobToDataUrl !== 'function') {
        finishWithUrl(null);
        return;
      }
      empireOfflineBlobToDataUrl(blob).then(function (dataUrl) {
        finishWithUrl(dataUrl, true);
      }).catch(function () { finishWithUrl(null); });
      return;
    }
    empireUploadPhoto(blob, workerFieldReportPhotoFolder_(), function (url) {
      if (url) {
        finishWithUrl(url, false);
        return;
      }
      if (typeof empireOfflineBlobToDataUrl !== 'function') {
        finishWithUrl(null);
        return;
      }
      empireOfflineBlobToDataUrl(blob).then(function (dataUrl) {
        finishWithUrl(dataUrl, true);
      }).catch(function () { finishWithUrl(null); });
    });
  });
}

function workerFieldReportHandleFile_(e) {
  var f = e.target.files && e.target.files[0];
  if (f) workerFieldReportProcessPhoto_(f, 'job');
  e.target.value = '';
}

function workerFieldReportPickInvoicePhoto_() {
  if (typeof empireWorkerPickPhoto === 'function') {
    empireWorkerPickPhoto({
      camera: 'wfrInvoiceFileCamera',
      gallery: 'wfrInvoiceFileGallery',
      title: workerFieldReportT_('photoTitleInvoice', 'Invoice photo')
    });
    return;
  }
  var input = document.getElementById('wfrInvoiceFileGallery') || document.getElementById('wfrInvoiceFile');
  if (!input) return;
  input.value = '';
  input.click();
}

function workerFieldReportHandleInvoiceFile_(e) {
  var f = e.target.files && e.target.files[0];
  if (f) workerFieldReportProcessPhoto_(f, 'invoice');
  e.target.value = '';
}

function workerFieldReportProcessInvoiceModalPhoto_(file) {
  if (!file) return;
  var status = document.getElementById('wfrInvoiceModalStatus');
  if (status) status.textContent = workerFieldReportT_('wfrUploading', 'Uploading\u2026');
  _wfrInvoiceUploading = true;
  empireCompressImage(file, workerFieldReportPhotoFolder_(), function (url) {
    _wfrInvoiceUploading = false;
    if (url) {
      _wfrInvoiceModalUrl = url;
      var im = document.getElementById('wfrInvoiceModalPreview');
      if (im) {
        im.src = url;
        im.style.display = 'block';
      }
      if (status) status.textContent = '\u2705 ' + workerFieldReportT_('wfrInvoicePhotoReadyShort', 'Invoice photo ready');
      var btn = document.getElementById('wfrInvoiceModalSaveBtn');
      if (btn) btn.disabled = false;
    } else if (status) {
      status.textContent = '\u274C ' + (_lastEmpireUploadError || workerFieldReportT_('wfrUploadFailed', 'Upload failed — try again'));
    }
  }, { maxSize: 1400, quality: 0.7 });
}

function workerFieldReportMineUser_() {
  return String(typeof empireGetUser === 'function' ? empireGetUser() : '').trim().toLowerCase();
}

function workerFieldReportIsMine_(r) {
  var user = workerFieldReportMineUser_();
  if (!user) return false;
  var by = String((r && r.reportedBy) || '').trim().toLowerCase();
  return !!by && by === user;
}

function workerFieldReportLoadMine_(force) {
  var cfg = workerFieldReportCfg_();
  if (!cfg || !cfg.actions || !cfg.actions.get || typeof fetchJSONRetry !== 'function') return;
  var host = document.getElementById('workerFieldMyReports');
  if (!host) return;
  fetchJSONRetry({ action: cfg.actions.get, token: issueToken() || '' }, force ? 2 : 1, 45000)
    .then(function (d) {
      var rows = Array.isArray(d) ? d : [];
      // Only this worker's active reports (not other users, not transferred, not deleted).
      _wfrReports = rows.filter(workerFieldReportIsMine_).filter(function (r) {
        return String((r && r.status) || '').toLowerCase() !== 'transferred';
      }).sort(function (a, b) {
        return String(b.createdAt || b.date || '').localeCompare(String(a.createdAt || a.date || ''));
      });
      workerFieldReportRenderMine_();
    })
    .catch(function () {
      if (force) {
        _wfrReports = [];
        workerFieldReportRenderMine_();
        if (host) {
          host.innerHTML = '<p class="worker-empty" style="font-size:13px;">' + workerFieldReportT_('wfrCouldNotLoad', 'Could not load your reports.') + '</p>';
        }
        return;
      }
      if (host && !_wfrReports.length) {
        host.innerHTML = '<p class="worker-empty" style="font-size:13px;">' + workerFieldReportT_('wfrCouldNotLoad', 'Could not load your reports.') + '</p>';
      }
    });
}

function workerFieldReportAttr_(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

var _wfrBodyScrollY = 0;

function workerFieldReportLockBodyScroll_(lock) {
  if (lock) {
    _wfrBodyScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    document.body.classList.add('worker-field-modal-open');
    document.body.style.top = '-' + _wfrBodyScrollY + 'px';
    return;
  }
  document.body.classList.remove('worker-field-modal-open');
  document.body.style.top = '';
  window.scrollTo(0, _wfrBodyScrollY);
}

function workerFieldReportInitCardTap_() {
  var host = document.getElementById('workerFieldMyReports');
  if (!host || host.dataset.wfrTapBound === '1') return;
  host.dataset.wfrTapBound = '1';
  host.addEventListener('click', function (e) {
    var card = e.target.closest('[data-report-id]');
    if (!card || !host.contains(card)) return;
    workerFieldReportOpenView_(card.getAttribute('data-report-id'));
  });
}

function workerFieldReportRenderMine_() {
  var host = document.getElementById('workerFieldMyReports');
  if (!host) return;
  var pendingHtml = '';
  if (_wfrOfflinePending && _wfrOfflinePending.length) {
    pendingHtml = '<div class="worker-field-pending-box" style="margin-bottom:12px;padding:12px;border:2px solid #e6b800;border-radius:12px;background:#fff7e8;">'
      + '<p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#5a4200;">' + workerFieldReportT_('wfrPendingTitle', function (p) {
        return (p.count || 0) + ' report' + ((p.count || 0) === 1 ? '' : 's') + ' waiting to upload';
      }, { count: _wfrOfflinePending.length }) + '</p>'
      + '<p style="margin:0 0 10px;font-size:12px;color:#5a4200;">' + workerFieldReportT_('wfrPendingHint', 'Saved on this phone. Tap Retry when you have signal.') + '</p>'
      + '<button type="button" class="worker-field-submit" style="margin:0;" onclick="syncWorkerFieldReportOffline(false)">' + workerFieldReportT_('wfrBannerRetry', 'Retry upload') + '</button>'
      + '</div>';
  }
  if (!_wfrReports.length && !(_wfrOfflinePending && _wfrOfflinePending.length)) {
    host.innerHTML = pendingHtml + '<p class="worker-empty" style="font-size:13px;">' + workerFieldReportT_('wfrNoReportsSubmitted', 'No reports submitted yet.') + '</p>';
    return;
  }
  var listHtml = !_wfrReports.length ? '' : ('<div class="worker-field-my-list">' + _wfrReports.slice(0, 12).map(function (r) {
    var jobPhotos = workerFieldReportJobPhotosFromRow_(r);
    var media = jobPhotos.length
      ? ('<div class="worker-field-my-media"><img class="worker-field-my-thumb" src="' + workerFieldReportEsc_(jobPhotos[0]) + '" alt="">'
        + (jobPhotos.length > 1 ? ('<span class="worker-field-my-photo-count">' + jobPhotos.length + '</span>') : '')
        + '</div>')
      : '<div class="worker-field-my-media worker-field-my-nophoto">' + workerFieldReportT_('wfrNoJobPhoto', 'No job photo') + '</div>';
    var amountLabel = workerFieldReportAmountLabel_(r.amount);
    var voiceBadge = workerFieldReportVoiceBadgeHtml_(r.voiceNote);
    var needsInvoice = workerFieldReportNeedsInvoice_(r);
    var meta = [];
    if (amountLabel) meta.push('<span class="worker-field-my-amount">' + workerFieldReportEsc_(amountLabel) + '</span>');
    if (voiceBadge) meta.push(voiceBadge);
    if (r.invoicePhoto) meta.push('<span class="worker-field-my-invoice-ok">' + workerFieldReportT_('wfrInvoiceAdded', 'Invoice added') + '</span>');
    var refLabel = workerFieldReportRefLabel_(r);
    var cardClass = 'worker-field-my-card worker-field-my-card-tappable' + (needsInvoice ? ' worker-field-my-card-needs-invoice' : '');
    return '<button type="button" class="' + cardClass + '" data-report-id="' + workerFieldReportAttr_(r.id || '') + '" aria-label="' + workerFieldReportEsc_(workerFieldReportT_('wfrViewReportAria', 'View report details')) + '">'
      + media
      + '<div class="worker-field-my-body">'
      + '<div class="worker-field-my-top">'
      + (refLabel ? ('<span class="worker-field-my-ref">' + workerFieldReportEsc_(refLabel) + '</span>') : '')
      + '<time class="worker-field-my-date">' + workerFieldReportEsc_(r.date || '') + '</time>'
      + '</div>'
      + '<div class="worker-field-my-badges">' + workerFieldReportTypeBadgeHtml_(r) + '</div>'
      + (needsInvoice ? '<div class="worker-field-my-invoice-missing">' + workerFieldReportT_('wfrInvoiceMissing', 'Invoice photo missing') + '</div>' : '')
      + (r.place ? ('<div class="worker-field-my-place">' + workerFieldReportEsc_(r.place) + '</div>') : '')
      + (r.note ? ('<p class="worker-field-my-note">' + workerFieldReportEsc_(r.note) + '</p>') : '')
      + (r.materials ? ('<p class="worker-field-my-note">' + workerFieldReportEsc_(r.materials) + '</p>') : '')
      + (meta.length ? ('<div class="worker-field-my-meta">' + meta.join('') + '</div>') : '')
      + '<div class="worker-field-my-view-hint">' + workerFieldReportT_('wfrTapToView', 'Tap to view') + '</div>'
      + '</div></button>';
  }).join('') + '</div>');
  host.innerHTML = pendingHtml + listHtml;
}

function workerFieldReportStatusLabel_(r) {
  var s = String((r && r.status) || 'pending').toLowerCase();
  if (s === 'transferred') return workerFieldReportT_('wfrStatusTransferred', 'Added to monthly report');
  return workerFieldReportT_('wfrStatusPending', 'Waiting for department review');
}

function workerFieldReportOpenView_(id) {
  var r = _wfrReports.find(function (x) { return String(x.id) === String(id); });
  if (!r) return;
  var modal = document.getElementById('wfrViewModal');
  var body = document.getElementById('wfrViewModalBody');
  if (!modal || !body) return;
  var amountLabel = workerFieldReportAmountLabel_(r.amount);
  var refLabel = workerFieldReportRefLabel_(r);
  var h = '<div class="worker-field-view">';
  h += '<p class="worker-field-view-lead">' + workerFieldReportEsc_(workerFieldReportT_('wfrReadOnlyLead', 'Read only — you cannot edit a submitted report.')) + '</p>';
  if (refLabel) h += '<div class="worker-field-view-row"><span class="worker-field-view-label">' + workerFieldReportT_('wfrReference', 'Reference') + '</span><span class="worker-field-view-value worker-field-view-ref">' + workerFieldReportEsc_(refLabel) + '</span></div>';
  h += '<div class="worker-field-view-row"><span class="worker-field-view-label">' + workerFieldReportT_('wfrType', 'Type') + '</span><span class="worker-field-view-value">' + workerFieldReportTypeBadgeHtml_(r) + '</span></div>';
  h += '<div class="worker-field-view-row"><span class="worker-field-view-label">' + workerFieldReportT_('wfrDate', 'Date') + '</span><span class="worker-field-view-value">' + workerFieldReportEsc_(r.date || '') + '</span></div>';
  h += '<div class="worker-field-view-row"><span class="worker-field-view-label">' + workerFieldReportT_('wfrStatus', 'Status') + '</span><span class="worker-field-view-value">' + workerFieldReportEsc_(workerFieldReportStatusLabel_(r)) + '</span></div>';
  if (r.place) h += '<div class="worker-field-view-row"><span class="worker-field-view-label">' + workerFieldReportT_('wfrPlace', 'Place') + '</span><span class="worker-field-view-value">' + workerFieldReportEsc_(r.place) + '</span></div>';
  if (r.note) h += '<div class="worker-field-view-block"><span class="worker-field-view-label">' + workerFieldReportT_('wfrNoteLabel', 'Note') + '</span><p class="worker-field-view-text">' + workerFieldReportEsc_(r.note) + '</p></div>';
  if (r.materials) h += '<div class="worker-field-view-block"><span class="worker-field-view-label">' + workerFieldReportT_('wfrMaterials', 'Materials') + '</span><p class="worker-field-view-text">' + workerFieldReportEsc_(r.materials) + '</p></div>';
  if (amountLabel) h += '<div class="worker-field-view-row"><span class="worker-field-view-label">' + workerFieldReportT_('wfrAmount', 'Amount') + '</span><span class="worker-field-view-value worker-field-view-amount">' + workerFieldReportEsc_(amountLabel) + '</span></div>';
  var jobPhotos = workerFieldReportJobPhotosFromRow_(r);
  if (jobPhotos.length) {
    h += '<div class="worker-field-view-block"><span class="worker-field-view-label">' + workerFieldReportT_('wfrJobPhotos', 'Job photos') + '</span>';
    h += '<div class="worker-photo-grid worker-field-view-photo-grid">';
    jobPhotos.forEach(function (url, i) {
      h += '<div class="worker-photo-item"><img class="worker-field-view-photo" src="' + workerFieldReportEsc_(url) + '" alt="Job photo ' + (i + 1) + '"></div>';
    });
    h += '</div></div>';
  }
  if (workerFieldReportType_(r) === 'refundable') {
    h += '<div class="worker-field-view-block"><span class="worker-field-view-label">' + workerFieldReportT_('wfrInvoicePhoto', 'Invoice photo') + '</span>';
    if (r.invoicePhoto) {
      h += '<img class="worker-field-view-photo" src="' + workerFieldReportEsc_(r.invoicePhoto) + '" alt="Invoice photo">';
    } else {
      h += '<p class="worker-field-view-missing">' + workerFieldReportT_('wfrNotSubmitted', 'Not submitted') + '</p>';
    }
    h += '</div>';
  }
  if (r.voiceNote && r.voiceNote.url && typeof assignVoiceNoteDisplayHtml === 'function') {
    h += '<div class="worker-field-view-block"><span class="worker-field-view-label">' + workerFieldReportT_('wfrVoiceNote', 'Voice note') + '</span>';
    h += assignVoiceNoteDisplayHtml(r.voiceNote, { worker: true });
    h += '</div>';
  }
  h += '</div>';
  body.innerHTML = h;
  body.querySelectorAll('.worker-field-view-photo').forEach(function (img) {
    img.addEventListener('click', function () {
      if (typeof bigImg === 'function') bigImg(img.src);
    });
  });
  if (typeof assignVoiceBindPlayers === 'function') assignVoiceBindPlayers(body);
  workerFieldReportLockBodyScroll_(true);
  modal.classList.add('show');
}

function workerFieldReportCloseView_() {
  var modal = document.getElementById('wfrViewModal');
  if (modal) modal.classList.remove('show');
  workerFieldReportLockBodyScroll_(false);
}

function workerFieldReportOpenInvoiceModal_(id) {
  var r = _wfrReports.find(function (x) { return String(x.id) === String(id); });
  if (!r || !workerFieldReportNeedsInvoice_(r)) return;
  _wfrInvoiceModalId = String(id);
  _wfrInvoiceModalUrl = '';
  var modal = document.getElementById('wfrInvoiceModal');
  var body = document.getElementById('wfrInvoiceModalBody');
  if (!modal || !body) return;
  var amountLabel = workerFieldReportAmountLabel_(r.amount);
  var h = '<div class="worker-field-invoice-readonly">';
  h += '<p class="worker-field-invoice-lead">' + workerFieldReportT_('wfrInvoiceModalLead', 'You can only add the invoice photo here. Other details cannot be edited.') + '</p>';
  if (r.place) h += '<div class="worker-field-invoice-row"><span class="worker-field-invoice-label">' + workerFieldReportT_('wfrPlace', 'Place') + '</span><span>' + workerFieldReportEsc_(r.place) + '</span></div>';
  if (r.note) h += '<div class="worker-field-invoice-row"><span class="worker-field-invoice-label">' + workerFieldReportT_('wfrNoteLabel', 'Note') + '</span><span>' + workerFieldReportEsc_(r.note) + '</span></div>';
  if (amountLabel) h += '<div class="worker-field-invoice-row"><span class="worker-field-invoice-label">' + workerFieldReportT_('wfrAmount', 'Amount') + '</span><span>' + workerFieldReportEsc_(amountLabel) + '</span></div>';
  if (r.photo) {
    h += '<div class="worker-field-invoice-row"><span class="worker-field-invoice-label">' + workerFieldReportT_('wfrJobPhoto', 'Job photo') + '</span></div>';
    h += '<img class="worker-field-invoice-job-thumb" src="' + workerFieldReportEsc_(r.photo) + '" alt="Job photo">';
  }
  h += '<label class="worker-field-label" style="margin-top:14px;">' + workerFieldReportT_('wfrInvoicePhoto', 'Invoice photo') + '</label>';
  h += '<button type="button" class="worker-field-photo-btn" onclick="workerFieldReportPickInvoiceModalPhoto()">' + workerFieldReportT_('wfrInvoiceModalPick', 'Camera / gallery — invoice') + '</button>';
  h += '<input type="file" id="wfrInvoiceModalFileCamera" class="worker-sr-file-input" accept="image/*" capture="environment" onchange="workerFieldReportHandleInvoiceModalFile(event)">';
  h += '<input type="file" id="wfrInvoiceModalFileGallery" class="worker-sr-file-input" accept="image/*" onchange="workerFieldReportHandleInvoiceModalFile(event)">';
  h += '<p id="wfrInvoiceModalStatus" class="worker-field-photo-status" aria-live="polite"></p>';
  h += '<img id="wfrInvoiceModalPreview" class="worker-field-preview-img" style="display:none" alt="Invoice preview">';
  h += '<button type="button" id="wfrInvoiceModalSaveBtn" class="worker-field-submit" disabled onclick="workerFieldReportSaveInvoicePhoto()">' + workerFieldReportT_('wfrSaveInvoice', 'Save invoice photo') + '</button>';
  h += '<p id="wfrInvoiceModalMsg" class="worker-field-msg" aria-live="polite"></p>';
  h += '</div>';
  body.innerHTML = h;
  modal.classList.add('show');
}

function workerFieldReportCloseInvoiceModal_() {
  _wfrInvoiceModalId = '';
  _wfrInvoiceModalUrl = '';
  var modal = document.getElementById('wfrInvoiceModal');
  if (modal) modal.classList.remove('show');
}

function workerFieldReportPickInvoiceModalPhoto_() {
  if (typeof empireWorkerPickPhoto === 'function') {
    empireWorkerPickPhoto({
      camera: 'wfrInvoiceModalFileCamera',
      gallery: 'wfrInvoiceModalFileGallery',
      title: workerFieldReportT_('photoTitleInvoice', 'Invoice photo')
    });
    return;
  }
  var input = document.getElementById('wfrInvoiceModalFileGallery') || document.getElementById('wfrInvoiceModalFile');
  if (!input) return;
  input.value = '';
  input.click();
}

function workerFieldReportHandleInvoiceModalFile_(e) {
  var f = e.target.files && e.target.files[0];
  if (f) workerFieldReportProcessInvoiceModalPhoto_(f);
  e.target.value = '';
}

function workerFieldReportSaveInvoicePhoto_() {
  if (_wfrInvoiceSaving || _wfrInvoiceUploading) return;
  var cfg = workerFieldReportCfg_();
  if (!cfg || !cfg.actions || !cfg.actions.updateInvoice || !_wfrInvoiceModalId) return;
  if (!_wfrInvoiceModalUrl) {
    alert(workerFieldReportT_('wfrChooseInvoiceFirst', 'Choose an invoice photo first.'));
    return;
  }
  _wfrInvoiceSaving = true;
  var btn = document.getElementById('wfrInvoiceModalSaveBtn');
  var msg = document.getElementById('wfrInvoiceModalMsg');
  if (btn) btn.disabled = true;
  if (msg) {
    msg.textContent = workerFieldReportT_('wfrSaving', 'Saving\u2026');
    msg.className = 'worker-field-msg';
  }
  fetchJSONRetry({
    action: cfg.actions.updateInvoice,
    token: issueToken() || '',
    id: _wfrInvoiceModalId,
    invoicePhoto: _wfrInvoiceModalUrl
  }, 2, 45000).then(function (d) {
    if (d && (d.ok || d.success)) {
      if (msg) {
        msg.textContent = '\u2705 ' + workerFieldReportT_('wfrInvoiceSaved', 'Invoice photo saved.');
        msg.className = 'worker-field-msg worker-field-msg-ok';
      }
      workerFieldReportCloseInvoiceModal_();
      workerFieldReportLoadMine_();
    } else if (d && d.ok === false) {
      if (typeof forceSessionLogout === 'function' && forceSessionLogout(d)) return;
      throw new Error(d.message || d.error || 'Could not save invoice photo');
    } else {
      throw new Error('Unexpected server response');
    }
  }).catch(function (e) {
    if (msg) {
      msg.textContent = '\u274C ' + String((e && e.message) || e || 'Failed');
      msg.className = 'worker-field-msg worker-field-msg-error';
    }
    if (btn) btn.disabled = false;
  }).finally(function () {
    _wfrInvoiceSaving = false;
  });
}

function workerFieldReportSubmit_() {
  if (_wfrSubmitting) return;
  var cfg = workerFieldReportCfg_();
  if (!cfg || !cfg.actions || !cfg.actions.add) return;
  if (_wfrJobUploading || _wfrInvoiceUploading) {
    alert(workerFieldReportT_('wfrWaitUpload', 'Please wait for the photo to finish uploading.'));
    return;
  }
  var placeEl = document.getElementById('wfrPlace');
  var noteEl = document.getElementById('wfrNote');
  var materialsEl = document.getElementById('wfrMaterials');
  var place = placeEl ? String(placeEl.value || '').trim() : '';
  var note = noteEl ? String(noteEl.value || '').trim() : '';
  var materials = materialsEl ? String(materialsEl.value || '').trim() : '';
  var refundable = workerFieldReportIsRefundableForm_();
  var amount = 0;
  var amountEl = document.getElementById('wfrAmount');
  if (amountEl && !document.getElementById('wfrRefundableCheck')) {
    amount = workerFieldReportParseAmount_(amountEl.value);
  }
  var msg = document.getElementById('wfrFormMsg');
  var btn = document.getElementById('wfrSubmitBtn');
  if (refundable && !_wfrJobPhotos.length) {
    if (msg) {
      msg.textContent = workerFieldReportT_('wfrNeedJobPhoto', 'Refundable reports need a job photo before sending.');
      msg.className = 'worker-field-msg worker-field-msg-error';
    }
    return;
  }
  if (refundable && !_wfrInvoicePhotoUrl) {
    if (msg) {
      msg.textContent = workerFieldReportT_('wfrNeedInvoicePhoto', 'Refundable reports need an invoice photo before sending.');
      msg.className = 'worker-field-msg worker-field-msg-error';
    }
    return;
  }
  if (!place && !note && !_wfrJobPhotos.length) {
    var draft = typeof assignVoiceDraft_ === 'function' ? assignVoiceDraft_(workerFieldReportVoiceId_()) : null;
    if (!draft || !draft.blob) {
      if (msg) {
        msg.textContent = workerFieldReportT_('wfrNeedContent', 'Add a place, note, photo, or voice recording.');
        msg.className = 'worker-field-msg worker-field-msg-error';
      }
      return;
    }
  }
  _wfrSubmitting = true;
  if (btn) {
    btn.disabled = true;
    btn.textContent = navigator.onLine
      ? workerFieldReportT_('wfrSending', 'Sending\u2026')
      : workerFieldReportT_('wfrSavingOnDevice', 'Saving on this device\u2026');
  }
  if (msg) {
    msg.textContent = navigator.onLine
      ? workerFieldReportT_('wfrSending', 'Sending\u2026')
      : workerFieldReportT_('wfrSavingOnDevice', 'Saving on this device\u2026');
    msg.className = 'worker-field-msg';
  }

  function finishSubmitUi_() {
    _wfrSubmitting = false;
    if (btn) btn.disabled = false;
    workerFieldReportUpdateSubmitBtnLabel_();
  }

  workerFieldReportPrepareVoice_().then(function (voiceNote) {
    var payload = {
      place: place,
      note: note,
      materials: materials,
      amount: amount || '',
      reportType: refundable ? 'refundable' : 'maintenance',
      photos: _wfrJobPhotos.slice(),
      invoicePhoto: _wfrInvoicePhotoUrl || '',
      workerName: typeof civilWorkerName === 'function' ? civilWorkerName(empireGetUser()) : (empireGetUser() || ''),
      voiceNote: voiceNote
    };
    return enqueueWorkerFieldReportOffline_(payload).then(function () {
      if (typeof assignVoiceClearDraft === 'function') assignVoiceClearDraft(workerFieldReportVoiceId_());
      workerFieldReportClearForm_(false);
      return syncWorkerFieldReportOffline(true).then(function (result) {
        var n = (result && result.synced) || 0;
        if (n > 0) {
          if (msg) {
            msg.textContent = '\u2705 ' + workerFieldReportUi_('submitSuccess', 'Report sent.');
            msg.className = 'worker-field-msg worker-field-msg-ok';
          }
        } else if (msg) {
          msg.textContent = '\u2705 ' + workerFieldReportT_('wfrSavedWillRetry', 'Saved on this device. Upload when you have signal — tap Retry upload.');
          msg.className = 'worker-field-msg worker-field-msg-ok';
        }
      });
    });
  }).catch(function (e) {
    if (msg) {
      msg.textContent = '\u274C ' + String((e && e.message) || e || 'Failed');
      msg.className = 'worker-field-msg worker-field-msg-error';
    }
  }).finally(finishSubmitUi_);
}

window.workerFieldReportRemoveJobPhoto = workerFieldReportRemoveJobPhoto_;
window.workerFieldReportOpenView = workerFieldReportOpenView_;
window.workerFieldReportCloseView = workerFieldReportCloseView_;
window.workerFieldReportHandleRefundableCheck = workerFieldReportHandleRefundableCheck_;
window.workerFieldReportSwitchTab = workerFieldReportSwitchTab_;
window.workerFieldReportSubmit = workerFieldReportSubmit_;
window.syncWorkerFieldReportOffline = syncWorkerFieldReportOffline;
window.workerFieldReportHandleFile = workerFieldReportHandleFile_;
window.workerFieldReportPickPhoto = workerFieldReportPickPhoto_;
window.workerFieldReportPickInvoicePhoto = workerFieldReportPickInvoicePhoto_;
window.workerFieldReportHandleInvoiceFile = workerFieldReportHandleInvoiceFile_;
window.workerFieldReportHandleAmountInput = workerFieldReportHandleAmountInput_;
window.workerFieldReportOpenInvoiceModal = workerFieldReportOpenInvoiceModal_;
window.workerFieldReportCloseInvoiceModal = workerFieldReportCloseInvoiceModal_;
window.workerFieldReportPickInvoiceModalPhoto = workerFieldReportPickInvoiceModalPhoto_;
window.workerFieldReportHandleInvoiceModalFile = workerFieldReportHandleInvoiceModalFile_;
window.workerFieldReportSaveInvoicePhoto = workerFieldReportSaveInvoicePhoto_;
window.workerFieldReportRefresh = function (force) { workerFieldReportLoadMine_(!!force); };
