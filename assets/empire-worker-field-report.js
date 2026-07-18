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

function workerFieldReportClearForm_(resetMsg) {
  _wfrPhotoUrl = '';
  _wfrUploading = false;
  var place = document.getElementById('wfrPlace');
  var note = document.getElementById('wfrNote');
  var img = document.getElementById('wfrImage');
  var area = document.getElementById('wfrImageArea');
  var msg = document.getElementById('wfrFormMsg');
  if (place) place.value = '';
  if (note) note.value = '';
  if (img) img.style.display = 'none';
  if (area) area.innerHTML = 'Tap to paste a photo (Ctrl+V) or use the camera button below';
  if (typeof assignVoiceClearDraft === 'function') assignVoiceClearDraft(workerFieldReportVoiceId_());
  if (resetMsg !== false && msg) {
    msg.textContent = '';
    msg.className = 'worker-field-msg';
  }
}

function workerFieldReportProcessPhoto_(file) {
  if (!file) return;
  var area = document.getElementById('wfrImageArea');
  if (area) area.innerHTML = '\u23F3 Uploading\u2026';
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
      if (area) area.innerHTML = '\u2705 Photo ready';
    } else if (area) {
      area.innerHTML = '\u274C ' + (_lastEmpireUploadError || 'Upload failed — try again');
    }
  }, { maxSize: 1400, quality: 0.7 });
}

function workerFieldReportHandleFile_(e) {
  var f = e.target.files && e.target.files[0];
  if (f) workerFieldReportProcessPhoto_(f);
  e.target.value = '';
}

function workerFieldReportHandlePaste_(e) {
  var items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  for (var i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      e.preventDefault();
      workerFieldReportProcessPhoto_(items[i].getAsFile());
      return;
    }
  }
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
  host.innerHTML = _wfrReports.slice(0, 12).map(function (r) {
    var thumb = r.photo
      ? '<img class="worker-field-my-thumb" src="' + r.photo + '" alt="">'
      : '';
    var voice = (r.voiceNote && r.voiceNote.url && typeof assignVoiceNoteDisplayHtml === 'function')
      ? assignVoiceNoteDisplayHtml(r.voiceNote, { worker: true })
      : '';
    return '<div class="worker-field-my-card">' + thumb
      + '<div class="worker-field-my-body"><div class="worker-field-my-date">' + (r.date || '') + '</div>'
      + (r.place ? ('<div class="worker-field-my-place">' + r.place + '</div>') : '')
      + (r.note ? ('<p class="worker-field-my-note">' + r.note + '</p>') : '')
      + voice + '</div></div>';
  }).join('');
  if (typeof assignVoiceBindPlayers === 'function') assignVoiceBindPlayers(host);
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
  var place = placeEl ? String(placeEl.value || '').trim() : '';
  var note = noteEl ? String(noteEl.value || '').trim() : '';
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
window.workerFieldReportHandlePaste = workerFieldReportHandlePaste_;
