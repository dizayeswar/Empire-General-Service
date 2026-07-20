/* Electric field worker — self-reported items for Electrical Department */

var _wfrPhotoUrl = '';
var _wfrInvoicePhotoUrl = '';
var _wfrUploading = false;
var _wfrInvoiceUploading = false;
var _wfrSubmitting = false;
var _wfrInvoiceSaving = false;
var _wfrReports = [];
var _wfrActiveTab = 'jobs';
var _wfrInvoiceModalId = '';
var _wfrInvoiceModalUrl = '';

function workerFieldReportCfg_() {
  return (ISSUE_CFG && ISSUE_CFG.workerFieldReport) || null;
}

function workerFieldReportEnabled_() {
  var cfg = workerFieldReportCfg_();
  return !!(cfg && cfg.enabled && cfg.actions && cfg.actions.add);
}

function workerFieldReportUi_(key, fallback) {
  var cfg = workerFieldReportCfg_();
  var ui = (cfg && cfg.ui) || {};
  return ui[key] != null && ui[key] !== '' ? ui[key] : fallback;
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

function workerFieldReportTypeBadgeHtml_(r) {
  var t = workerFieldReportType_(r);
  if (t === 'refundable') return '<span class="worker-field-my-type refundable">Refundable</span>';
  return '<span class="worker-field-my-type maintenance">Maintenance</span>';
}

function workerFieldReportEsc_(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function workerFieldReportVoiceBadgeHtml_(note) {
  if (!note || !note.url) return '';
  var dur = (note.durationSec && typeof assignVoiceFormatSec === 'function')
    ? assignVoiceFormatSec(note.durationSec) : '';
  return '<span class="worker-field-my-voice">Voice' + (dur ? (' · ' + dur) : '') + '</span>';
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

function workerFieldReportSyncRefundableUi_() {
  var amountEl = document.getElementById('wfrAmount');
  var refundable = amountEl ? workerFieldReportParseAmount_(amountEl.value) > 0 : false;
  var block = document.getElementById('wfrRefundablePhotos');
  var invoiceBlock = document.getElementById('wfrInvoiceBlock');
  if (block) block.style.display = refundable ? '' : 'none';
  if (invoiceBlock) invoiceBlock.style.display = refundable ? '' : 'none';
}

function workerFieldReportInit_() {
  if (!workerFieldReportEnabled_() || !isCivilWorker()) return;
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
  workerFieldReportMountVoice_();
  workerFieldReportClearForm_(false);
  workerFieldReportLoadMine_();
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
  if (tab === 'report') workerFieldReportLoadMine_(true);
}

function workerFieldReportPickPhoto_() {
  var input = document.getElementById('wfrFile');
  if (!input) return;
  input.value = '';
  input.click();
}

function workerFieldReportClearForm_(resetMsg) {
  _wfrPhotoUrl = '';
  _wfrInvoicePhotoUrl = '';
  _wfrUploading = false;
  _wfrInvoiceUploading = false;
  var place = document.getElementById('wfrPlace');
  var note = document.getElementById('wfrNote');
  var materials = document.getElementById('wfrMaterials');
  var amount = document.getElementById('wfrAmount');
  var img = document.getElementById('wfrImage');
  var invoiceImg = document.getElementById('wfrInvoiceImage');
  var status = document.getElementById('wfrPhotoStatus');
  var invoiceStatus = document.getElementById('wfrInvoiceStatus');
  var msg = document.getElementById('wfrFormMsg');
  if (place) place.value = '';
  if (note) note.value = '';
  if (materials) materials.value = '';
  if (amount) amount.value = '';
  if (img) {
    img.style.display = 'none';
    img.removeAttribute('src');
  }
  if (invoiceImg) {
    invoiceImg.style.display = 'none';
    invoiceImg.removeAttribute('src');
  }
  if (status) status.textContent = '';
  if (invoiceStatus) invoiceStatus.textContent = '';
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
  var status = document.getElementById(kind === 'invoice' ? 'wfrInvoiceStatus' : 'wfrPhotoStatus');
  if (status) status.textContent = '\u23F3 Uploading\u2026';
  if (kind === 'invoice') _wfrInvoiceUploading = true;
  else _wfrUploading = true;
  empireCompressImage(file, workerFieldReportPhotoFolder_(), function (url) {
    if (kind === 'invoice') _wfrInvoiceUploading = false;
    else _wfrUploading = false;
    if (url) {
      if (kind === 'invoice') {
        _wfrInvoicePhotoUrl = url;
        var invoiceIm = document.getElementById('wfrInvoiceImage');
        if (invoiceIm) {
          invoiceIm.src = url;
          invoiceIm.style.display = 'block';
        }
        if (status) status.textContent = '\u2705 Invoice photo ready — tap to replace';
      } else {
        _wfrPhotoUrl = url;
        var im = document.getElementById('wfrImage');
        if (im) {
          im.src = url;
          im.style.display = 'block';
        }
        if (status) status.textContent = '\u2705 Job photo ready — tap to replace';
      }
    } else if (status) {
      status.textContent = '\u274C ' + (_lastEmpireUploadError || 'Upload failed — try again');
    }
  }, { maxSize: 1400, quality: 0.7 });
}

function workerFieldReportHandleFile_(e) {
  var f = e.target.files && e.target.files[0];
  if (f) workerFieldReportProcessPhoto_(f, 'job');
  e.target.value = '';
}

function workerFieldReportPickInvoicePhoto_() {
  var input = document.getElementById('wfrInvoiceFile');
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
  if (status) status.textContent = '\u23F3 Uploading\u2026';
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
      if (status) status.textContent = '\u2705 Invoice photo ready';
      var btn = document.getElementById('wfrInvoiceModalSaveBtn');
      if (btn) btn.disabled = false;
    } else if (status) {
      status.textContent = '\u274C ' + (_lastEmpireUploadError || 'Upload failed — try again');
    }
  }, { maxSize: 1400, quality: 0.7 });
}

function workerFieldReportLoadMine_(force) {
  var cfg = workerFieldReportCfg_();
  if (!cfg || !cfg.actions || !cfg.actions.get || typeof fetchJSONRetry !== 'function') return;
  var host = document.getElementById('workerFieldMyReports');
  if (!host) return;
  fetchJSONRetry({ action: cfg.actions.get, token: issueToken() || '' }, force ? 2 : 1, 45000)
    .then(function (d) {
      _wfrReports = Array.isArray(d) ? d : [];
      workerFieldReportRenderMine_();
    })
    .catch(function () {
      if (force) {
        _wfrReports = [];
        workerFieldReportRenderMine_();
        if (host) {
          host.innerHTML = '<p class="worker-empty" style="font-size:13px;">Could not load your reports.</p>';
        }
        return;
      }
      if (host && !_wfrReports.length) {
        host.innerHTML = '<p class="worker-empty" style="font-size:13px;">Could not load your reports.</p>';
      }
    });
}

function workerFieldReportRenderMine_() {
  var host = document.getElementById('workerFieldMyReports');
  if (!host) return;
  if (!_wfrReports.length) {
    host.innerHTML = '<p class="worker-empty" style="font-size:13px;">No reports submitted yet.</p>';
    return;
  }
  host.innerHTML = '<div class="worker-field-my-list">' + _wfrReports.slice(0, 12).map(function (r) {
    var media = r.photo
      ? ('<div class="worker-field-my-media"><img class="worker-field-my-thumb" src="' + workerFieldReportEsc_(r.photo) + '" alt=""></div>')
      : '<div class="worker-field-my-media worker-field-my-nophoto">No job photo</div>';
    var amountLabel = workerFieldReportAmountLabel_(r.amount);
    var voiceBadge = workerFieldReportVoiceBadgeHtml_(r.voiceNote);
    var needsInvoice = workerFieldReportNeedsInvoice_(r);
    var meta = [];
    if (amountLabel) meta.push('<span class="worker-field-my-amount">' + workerFieldReportEsc_(amountLabel) + '</span>');
    if (voiceBadge) meta.push(voiceBadge);
    if (r.invoicePhoto) meta.push('<span class="worker-field-my-invoice-ok">Invoice added</span>');
    var cardClass = 'worker-field-my-card' + (needsInvoice ? ' worker-field-my-card-needs-invoice' : '');
    var clickAttr = needsInvoice ? (' onclick="workerFieldReportOpenInvoiceModal(' + JSON.stringify(String(r.id || '')) + ')" role="button" tabindex="0"') : '';
    return '<article class="' + cardClass + '"' + clickAttr + '>'
      + media
      + '<div class="worker-field-my-body">'
      + '<div class="worker-field-my-top">'
      + workerFieldReportTypeBadgeHtml_(r)
      + '<time class="worker-field-my-date">' + workerFieldReportEsc_(r.date || '') + '</time>'
      + '</div>'
      + (needsInvoice ? '<div class="worker-field-my-invoice-missing">Invoice photo missing — tap to add</div>' : '')
      + (r.place ? ('<div class="worker-field-my-place">' + workerFieldReportEsc_(r.place) + '</div>') : '')
      + (r.note ? ('<p class="worker-field-my-note">' + workerFieldReportEsc_(r.note) + '</p>') : '')
      + (r.materials ? ('<p class="worker-field-my-note">' + workerFieldReportEsc_(r.materials) + '</p>') : '')
      + (meta.length ? ('<div class="worker-field-my-meta">' + meta.join('') + '</div>') : '')
      + '</div></article>';
  }).join('') + '</div>';
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
  h += '<p class="worker-field-invoice-lead">You can only add the invoice photo here. Other details cannot be edited.</p>';
  if (r.place) h += '<div class="worker-field-invoice-row"><span class="worker-field-invoice-label">Place</span><span>' + workerFieldReportEsc_(r.place) + '</span></div>';
  if (r.note) h += '<div class="worker-field-invoice-row"><span class="worker-field-invoice-label">Note</span><span>' + workerFieldReportEsc_(r.note) + '</span></div>';
  if (amountLabel) h += '<div class="worker-field-invoice-row"><span class="worker-field-invoice-label">Amount</span><span>' + workerFieldReportEsc_(amountLabel) + '</span></div>';
  if (r.photo) {
    h += '<div class="worker-field-invoice-row"><span class="worker-field-invoice-label">Job photo</span></div>';
    h += '<img class="worker-field-invoice-job-thumb" src="' + workerFieldReportEsc_(r.photo) + '" alt="Job photo">';
  }
  h += '<label class="worker-field-label" style="margin-top:14px;">Invoice photo</label>';
  h += '<button type="button" class="worker-field-photo-btn" onclick="workerFieldReportPickInvoiceModalPhoto()">Camera / gallery — invoice</button>';
  h += '<input type="file" id="wfrInvoiceModalFile" accept="image/*" style="display:none" onchange="workerFieldReportHandleInvoiceModalFile(event)">';
  h += '<p id="wfrInvoiceModalStatus" class="worker-field-photo-status" aria-live="polite"></p>';
  h += '<img id="wfrInvoiceModalPreview" class="worker-field-preview-img" style="display:none" alt="Invoice preview">';
  h += '<button type="button" id="wfrInvoiceModalSaveBtn" class="worker-field-submit" disabled onclick="workerFieldReportSaveInvoicePhoto()">Save invoice photo</button>';
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
  var input = document.getElementById('wfrInvoiceModalFile');
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
    alert('Choose an invoice photo first.');
    return;
  }
  _wfrInvoiceSaving = true;
  var btn = document.getElementById('wfrInvoiceModalSaveBtn');
  var msg = document.getElementById('wfrInvoiceModalMsg');
  if (btn) btn.disabled = true;
  if (msg) {
    msg.textContent = '\u23F3 Saving\u2026';
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
        msg.textContent = '\u2705 Invoice photo saved.';
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
  if (_wfrUploading || _wfrInvoiceUploading) {
    alert('Please wait for the photo to finish uploading.');
    return;
  }
  var placeEl = document.getElementById('wfrPlace');
  var noteEl = document.getElementById('wfrNote');
  var materialsEl = document.getElementById('wfrMaterials');
  var amountEl = document.getElementById('wfrAmount');
  var place = placeEl ? String(placeEl.value || '').trim() : '';
  var note = noteEl ? String(noteEl.value || '').trim() : '';
  var materials = materialsEl ? String(materialsEl.value || '').trim() : '';
  var amount = amountEl ? workerFieldReportParseAmount_(amountEl.value) : 0;
  var msg = document.getElementById('wfrFormMsg');
  var btn = document.getElementById('wfrSubmitBtn');
  if (amount > 0 && !_wfrPhotoUrl) {
    if (msg) {
      msg.textContent = 'Refundable reports need a job photo before sending.';
      msg.className = 'worker-field-msg worker-field-msg-error';
    }
    return;
  }
  if (!place && !note && !_wfrPhotoUrl) {
    var draft = typeof assignVoiceDraft_ === 'function' ? assignVoiceDraft_(workerFieldReportVoiceId_()) : null;
    if (!draft || !draft.blob) {
      if (msg) {
        msg.textContent = 'Add a place, note, photo, or voice recording.';
        msg.className = 'worker-field-msg worker-field-msg-error';
      }
      return;
    }
  }
  _wfrSubmitting = true;
  if (btn) btn.disabled = true;
  if (msg) {
    msg.textContent = '\u23F3 Sending\u2026';
    msg.className = 'worker-field-msg';
  }
  var voiceUpload = (typeof assignVoiceEnsureUploaded_ === 'function')
    ? assignVoiceEnsureUploaded_(workerFieldReportVoiceId_(), 45000)
    : Promise.resolve(null);
  voiceUpload.then(function (voiceNote) {
    try {
      if (typeof assignVoiceBlockSaveIfDraftFailed_ === 'function') {
        assignVoiceBlockSaveIfDraftFailed_(workerFieldReportVoiceId_(), voiceNote);
      }
    } catch (voiceErr) {
      throw voiceErr;
    }
    var body = {
      action: cfg.actions.add,
      token: issueToken() || '',
      place: place,
      note: note,
      materials: materials,
      amount: amount || '',
      photo: _wfrPhotoUrl || '',
      invoicePhoto: _wfrInvoicePhotoUrl || '',
      workerName: typeof civilWorkerName === 'function' ? civilWorkerName(empireGetUser()) : (empireGetUser() || '')
    };
    if (voiceNote) body.voiceNote = voiceNote;
    return fetchJSONRetry(body, 2, 45000);
  }).then(function (d) {
    if (d && (d.ok || d.success)) {
      if (msg) {
        msg.textContent = '\u2705 ' + workerFieldReportUi_('submitSuccess', 'Report sent.');
        msg.className = 'worker-field-msg worker-field-msg-ok';
      }
      workerFieldReportClearForm_(false);
      workerFieldReportLoadMine_();
    } else if (d && d.ok === false) {
      if (typeof forceSessionLogout === 'function' && forceSessionLogout(d)) return;
      throw new Error(d.message || d.error || 'Could not send report');
    } else {
      throw new Error('Unexpected server response');
    }
  }).catch(function (e) {
    if (msg) {
      msg.textContent = '\u274C ' + String((e && e.message) || e || 'Failed');
      msg.className = 'worker-field-msg worker-field-msg-error';
    }
  }).finally(function () {
    _wfrSubmitting = false;
    if (btn) btn.disabled = false;
  });
}

window.workerFieldReportSwitchTab = workerFieldReportSwitchTab_;
window.workerFieldReportSubmit = workerFieldReportSubmit_;
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
