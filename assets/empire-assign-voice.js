/* Civil issue assignment — voice note for workers */

var _assignVoiceDraft = {};
var _assignVoiceActiveId = '';
var ASSIGN_VOICE_MAX_SEC = 120;

function assignVoiceMicIconHtml() {
  return '<span class="nav-icon" style="width:15px;height:15px;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/></svg></span>';
}

function assignVoiceStopIconHtml() {
  return '<span class="nav-icon" style="width:15px;height:15px;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg></span>';
}

function assignVoiceFormatSec(sec) {
  sec = Math.max(0, Math.floor(Number(sec) || 0));
  var m = Math.floor(sec / 60);
  var s = sec % 60;
  return m + ':' + String(s).padStart(2, '0');
}

function assignVoiceNowStamp() {
  var now = new Date();
  var z = function (n) { return String(n).padStart(2, '0'); };
  return now.getFullYear() + '-' + z(now.getMonth() + 1) + '-' + z(now.getDate()) + ' ' + z(now.getHours()) + ':' + z(now.getMinutes());
}

function assignVoiceDraft_(issueId) {
  issueId = String(issueId || '');
  if (!_assignVoiceDraft[issueId]) {
    _assignVoiceDraft[issueId] = {
      blob: null,
      previewUrl: '',
      durationSec: 0,
      recording: false,
      recorder: null,
      stream: null,
      timer: null,
      startedAt: 0
    };
  }
  return _assignVoiceDraft[issueId];
}

function assignVoiceReleaseDraft_(draft) {
  if (!draft) return;
  if (draft.previewUrl) {
    try { URL.revokeObjectURL(draft.previewUrl); } catch (e) {}
    draft.previewUrl = '';
  }
  draft.blob = null;
  draft.durationSec = 0;
}

function assignVoiceStopTracks_(draft) {
  if (!draft || !draft.stream) return;
  try {
    draft.stream.getTracks().forEach(function (t) { t.stop(); });
  } catch (e) {}
  draft.stream = null;
}

function assignVoiceStopRecording_(issueId, silent) {
  var draft = assignVoiceDraft_(issueId);
  if (draft.timer) {
    clearInterval(draft.timer);
    draft.timer = null;
  }
  if (draft.recorder && draft.recording) {
    try { draft.recorder.stop(); } catch (e) {}
  }
  draft.recording = false;
  if (_assignVoiceActiveId === issueId) _assignVoiceActiveId = '';
  if (!silent) assignVoiceRefreshUi(issueId);
}

function assignVoiceClearDraft(issueId) {
  assignVoiceStopRecording_(issueId, true);
  var draft = assignVoiceDraft_(issueId);
  assignVoiceReleaseDraft_(draft);
  assignVoiceStopTracks_(draft);
  assignVoiceRefreshUi(issueId);
}

function assignVoiceCloseActive_() {
  if (_assignVoiceActiveId) assignVoiceStopRecording_(_assignVoiceActiveId, true);
}

function assignVoiceRefreshUi(issueId) {
  var wrap = document.getElementById('assign-voice-' + issueId);
  if (!wrap) return;
  var draft = assignVoiceDraft_(issueId);
  var status = wrap.querySelector('.assign-voice-status');
  var timer = wrap.querySelector('.assign-voice-timer');
  var preview = wrap.querySelector('.assign-voice-preview');
  var recordBtn = wrap.querySelector('.assign-voice-record-btn');
  var stopBtn = wrap.querySelector('.assign-voice-stop-btn');
  var clearBtn = wrap.querySelector('.assign-voice-clear-btn');
  if (timer) timer.textContent = assignVoiceFormatSec(draft.durationSec);
  if (status) {
    if (draft.recording) status.textContent = 'Recording… tap Stop when finished.';
    else if (draft.blob) status.textContent = 'New voice note ready — saved when you click Save assignment.';
    else status.textContent = 'Tap Record and speak instructions for the worker.';
  }
  if (preview) {
    if (draft.blob && draft.previewUrl) {
      preview.innerHTML = '<audio controls preload="metadata" src="' + draft.previewUrl + '"></audio>';
      preview.style.display = 'block';
    } else {
      preview.innerHTML = '';
      preview.style.display = 'none';
    }
  }
  if (recordBtn) recordBtn.disabled = !!draft.recording;
  if (stopBtn) stopBtn.disabled = !draft.recording;
  if (clearBtn) clearBtn.style.display = (draft.blob && !draft.recording) ? 'inline-flex' : 'none';
}

function assignVoiceStartRecord(issueId) {
  issueId = String(issueId || '');
  if (!issueId) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Voice notes need microphone access. Use Chrome or Edge on a phone or computer with a mic.');
    return;
  }
  assignVoiceCloseActive_();
  var draft = assignVoiceDraft_(issueId);
  assignVoiceReleaseDraft_(draft);
  navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
    draft.stream = stream;
    var mime = '';
    if (window.MediaRecorder && MediaRecorder.isTypeSupported) {
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mime = 'audio/webm;codecs=opus';
      else if (MediaRecorder.isTypeSupported('audio/webm')) mime = 'audio/webm';
      else if (MediaRecorder.isTypeSupported('audio/mp4')) mime = 'audio/mp4';
    }
    var chunks = [];
    var recorder;
    try {
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch (e) {
      assignVoiceStopTracks_(draft);
      alert('Could not start recording on this device.');
      return;
    }
    draft.recorder = recorder;
    draft.recording = true;
    draft.startedAt = Date.now();
    draft.durationSec = 0;
    _assignVoiceActiveId = issueId;
    recorder.ondataavailable = function (ev) {
      if (ev.data && ev.data.size) chunks.push(ev.data);
    };
    recorder.onstop = function () {
      assignVoiceStopTracks_(draft);
      draft.recording = false;
      if (_assignVoiceActiveId === issueId) _assignVoiceActiveId = '';
      if (!chunks.length) {
        assignVoiceRefreshUi(issueId);
        return;
      }
      var type = (chunks[0] && chunks[0].type) || mime || 'audio/webm';
      draft.blob = new Blob(chunks, { type: type });
      draft.durationSec = Math.max(1, Math.round((Date.now() - draft.startedAt) / 1000));
      if (draft.previewUrl) {
        try { URL.revokeObjectURL(draft.previewUrl); } catch (e) {}
      }
      draft.previewUrl = URL.createObjectURL(draft.blob);
      assignVoiceRefreshUi(issueId);
    };
    recorder.start(250);
    if (draft.timer) clearInterval(draft.timer);
    draft.timer = setInterval(function () {
      draft.durationSec = Math.floor((Date.now() - draft.startedAt) / 1000);
      assignVoiceRefreshUi(issueId);
      if (draft.durationSec >= ASSIGN_VOICE_MAX_SEC) assignVoiceStopRecord(issueId);
    }, 500);
    assignVoiceRefreshUi(issueId);
  }).catch(function () {
    alert('Microphone permission denied. Allow the mic in your browser settings and try again.');
  });
}

function assignVoiceStopRecord(issueId) {
  var draft = assignVoiceDraft_(issueId);
  if (!draft.recording) return;
  if (draft.timer) {
    clearInterval(draft.timer);
    draft.timer = null;
  }
  try { draft.recorder.stop(); } catch (e) {}
}

function assignVoiceNoteDisplayHtml(note, opts) {
  opts = opts || {};
  if (!note || !note.url) return '';
  var by = note.by ? (' from ' + note.by) : '';
  var at = note.at ? (' · ' + dateOnly(note.at)) : '';
  var dur = note.durationSec ? (' · ' + assignVoiceFormatSec(note.durationSec)) : '';
  var h = '<div class="assign-voice-playback' + (opts.worker ? ' assign-voice-playback-worker' : '') + '">';
  h += '<div class="assign-voice-playback-label"><strong>Voice note' + by + '</strong><span class="assign-voice-playback-meta">' + at + dur + '</span></div>';
  h += '<audio controls preload="metadata" src="' + note.url + '"></audio>';
  h += '</div>';
  return h;
}

function assignVoiceBoxHtml(issueId, existingNote) {
  issueId = String(issueId || '');
  var h = '<div class="assign-voice-note" id="assign-voice-' + issueId + '" onclick="event.stopPropagation()">';
  h += '<label>Voice note for worker <span class="assign-voice-optional">(optional)</span></label>';
  if (existingNote && existingNote.url) {
    h += assignVoiceNoteDisplayHtml(existingNote, { existing: true });
    h += '<p class="assign-voice-replace-hint">Record below to replace the current voice note when you save.</p>';
  }
  h += '<div class="assign-voice-controls">';
  h += '<button type="button" class="assign-voice-record-btn" onclick="assignVoiceStartRecord(\'' + issueId + '\')">' + assignVoiceMicIconHtml() + ' Record</button>';
  h += '<button type="button" class="assign-voice-stop-btn" onclick="assignVoiceStopRecord(\'' + issueId + '\')" disabled>' + assignVoiceStopIconHtml() + ' Stop</button>';
  h += '<span class="assign-voice-timer">0:00</span>';
  h += '<button type="button" class="assign-voice-clear-btn" onclick="assignVoiceClearDraft(\'' + issueId + '\')" style="display:none;">Clear</button>';
  h += '</div>';
  h += '<p class="assign-voice-status">Tap Record and speak instructions for the worker.</p>';
  h += '<div class="assign-voice-preview" style="display:none;"></div>';
  h += '</div>';
  return h;
}

function uploadAssignVoiceForIssue(issueId) {
  var draft = assignVoiceDraft_(issueId);
  if (!draft.blob) return Promise.resolve(null);
  if (!empireStorageConfigured()) {
    return Promise.reject(new Error('Supabase is not configured — cannot upload voice note.'));
  }
  return empireUploadAudioAsync(draft.blob, 'civil-assign-voice').then(function (url) {
    if (!url) {
      throw new Error(_lastEmpireUploadError || 'Voice note upload failed');
    }
    return {
      url: url,
      by: empireGetUser() || '',
      at: assignVoiceNowStamp(),
      durationSec: draft.durationSec || 0
    };
  });
}

function assignVoiceOnModalClose_() {
  assignVoiceCloseActive_();
}
