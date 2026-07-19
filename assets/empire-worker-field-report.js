/* Electric field worker — self-reported items for Electrical Department */

var _wfrPhotoUrl = '';
var _wfrUploading = false;
var _wfrSubmitting = false;
var _wfrReports = [];
var _wfrActiveTab = 'jobs';

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
      amount.addEventListener('input', workerFieldReportHandleAmountInput_);
    }
  }
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
  if (tab === 'report') workerFieldReportLoadMine_();
}

function workerFieldReportPickPhoto_() {
  var input = document.getElementById('wfrFile');
  if (!input) return;
  input.value = '';
  input.click();
}

function workerFieldReportClearForm_(resetMsg) {
  _wfrPhotoUrl = '';
  _wfrUploading = false;
  var place = document.getElementById('wfrPlace');
  var note = document.getElementById('wfrNote');
  var materials = document.getElementById('wfrMaterials');
  var amount = document.getElementById('wfrAmount');
  var img = document.getElementById('wfrImage');
  var status = document.getElementById('wfrPhotoStatus');
  var msg = document.getElementById('wfrFormMsg');
  if (place) place.value = '';
  if (note) note.value = '';
  if (materials) materials.value = '';
  if (amount) amount.value = '';
  if (img) {
    img.style.display = 'none';
    img.removeAttribute('src');
  }
  if (status) status.textContent = '';
  if (typeof assignVoiceClearDraft === 'function') assignVoiceClearDraft(workerFieldReportVoiceId_());
  if (resetMsg !== false && msg) {
    msg.textContent = '';
    msg.className = 'worker-field-msg';
  }
}

function workerFieldReportProcessPhoto_(file) {
  if (!file) return;
  var status = document.getElementById('wfrPhotoStatus');
  if (status) status.textContent = '\u23F3 Uploading\u2026';
  _wfrUploading = true;
  empireCompressImage(file, workerFieldReportPhotoFolder_(), function (url) {
    _wfrUploading = false;
    if (url) {
      _wfrPhotoUrl = url;
      var im = document.getElementById('wfrImage');
      if (im) {
        im.src = url;
        im.style.display = 'block';
      }
      if (status) status.textContent = '\u2705 Photo ready — tap Camera / gallery to replace';
    } else if (status) {
      status.textContent = '\u274C ' + (_lastEmpireUploadError || 'Upload failed — try again');
    }
  }, { maxSize: 1400, quality: 0.7 });
}

function workerFieldReportHandleFile_(e) {
  var f = e.target.files && e.target.files[0];
  if (f) workerFieldReportProcessPhoto_(f);
  e.target.value = '';
}

function workerFieldReportLoadMine_() {
  var cfg = workerFieldReportCfg_();
  if (!cfg || !cfg.actions || !cfg.actions.get || typeof fetchJSONRetry !== 'function') return;
  var host = document.getElementById('workerFieldMyReports');
  if (!host) return;
  fetchJSONRetry({ action: cfg.actions.get, token: issueToken() || '' }, 1, 45000)
    .then(function (d) {
      _wfrReports = Array.isArray(d) ? d : [];
      workerFieldReportRenderMine_();
    })
    .catch(function () {
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
      : '<div class="worker-field-my-media worker-field-my-nophoto">No photo</div>';
    var amountLabel = workerFieldReportAmountLabel_(r.amount);
    var voiceBadge = workerFieldReportVoiceBadgeHtml_(r.voiceNote);
    var meta = [];
    if (amountLabel) meta.push('<span class="worker-field-my-amount">' + workerFieldReportEsc_(amountLabel) + '</span>');
    if (voiceBadge) meta.push(voiceBadge);
    return '<article class="worker-field-my-card">'
      + media
      + '<div class="worker-field-my-body">'
      + '<div class="worker-field-my-top">'
      + workerFieldReportTypeBadgeHtml_(r)
      + '<time class="worker-field-my-date">' + workerFieldReportEsc_(r.date || '') + '</time>'
      + '</div>'
      + (r.place ? ('<div class="worker-field-my-place">' + workerFieldReportEsc_(r.place) + '</div>') : '')
      + (r.note ? ('<p class="worker-field-my-note">' + workerFieldReportEsc_(r.note) + '</p>') : '')
      + (r.materials ? ('<p class="worker-field-my-note">' + workerFieldReportEsc_(r.materials) + '</p>') : '')
      + (meta.length ? ('<div class="worker-field-my-meta">' + meta.join('') + '</div>') : '')
      + '</div></article>';
  }).join('') + '</div>';
}

function workerFieldReportSubmit_() {
  if (_wfrSubmitting) return;
  var cfg = workerFieldReportCfg_();
  if (!cfg || !cfg.actions || !cfg.actions.add) return;
  if (_wfrUploading) {
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
  var voicePromise = (typeof uploadAssignVoiceForIssue === 'function')
    ? uploadAssignVoiceForIssue(workerFieldReportVoiceId_()).catch(function () { return null; })
    : Promise.resolve(null);
  voicePromise.then(function (voiceNote) {
    var body = {
      action: cfg.actions.add,
      token: issueToken() || '',
      place: place,
      note: note,
      materials: materials,
      amount: amount || '',
      photo: _wfrPhotoUrl || '',
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
window.workerFieldReportHandleAmountInput = workerFieldReportHandleAmountInput_;
