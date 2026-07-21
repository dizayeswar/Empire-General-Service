/* Civil issue assignment — voice note for workers (WAV = plays on iOS + Android) */

var _assignVoiceDraft = {};
var _assignVoiceActiveId = '';
var _assignVoicePlayerCache = {};
var ASSIGN_VOICE_MAX_SEC = 120;
var ASSIGN_VOICE_PREFERRED_RATE = 48000;

function assignVoiceMicIconHtml() {
  return '<span class="nav-icon" style="width:15px;height:15px;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/></svg></span>';
}

function assignVoiceStopIconHtml() {
  return '<span class="nav-icon" style="width:15px;height:15px;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg></span>';
}

function assignVoiceTrashIconHtml() {
  return '<span class="nav-icon" style="width:14px;height:14px;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></span>';
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
      stream: null,
      timer: null,
      startedAt: 0,
      audioContext: null,
      audioProcessor: null,
      audioSource: null,
      wavSamples: null,
      captureSampleRate: 0
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

function assignVoiceStopWavCapture_(draft) {
  if (!draft) return;
  try {
    if (draft.audioProcessor) draft.audioProcessor.disconnect();
    if (draft.audioSource) draft.audioSource.disconnect();
    if (draft.audioContext) draft.audioContext.close();
  } catch (e) {}
  draft.audioProcessor = null;
  draft.audioSource = null;
  draft.audioContext = null;
}

function assignVoiceEncodeWavBlob_(sampleChunks, sampleRate) {
  sampleRate = sampleRate || ASSIGN_VOICE_PREFERRED_RATE;
  var total = 0;
  var i;
  for (i = 0; i < sampleChunks.length; i++) total += sampleChunks[i].length;
  if (!total) return null;

  var peak = 0;
  for (i = 0; i < sampleChunks.length; i++) {
    var chunk = sampleChunks[i];
    for (var j = 0; j < chunk.length; j++) {
      var abs = Math.abs(chunk[j]);
      if (abs > peak) peak = abs;
    }
  }
  var gain = peak > 0.02 ? Math.min(0.92 / peak, 6) : 1;

  var buffer = new ArrayBuffer(44 + total * 2);
  var view = new DataView(buffer);
  function writeStr(off, str) {
    for (var k = 0; k < str.length; k++) view.setUint8(off + k, str.charCodeAt(k));
  }
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + total * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, total * 2, true);
  var offset = 44;
  for (i = 0; i < sampleChunks.length; i++) {
    chunk = sampleChunks[i];
    for (j = 0; j < chunk.length; j++) {
      var v = Math.max(-1, Math.min(1, chunk[j] * gain));
      view.setInt16(offset, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

function assignVoiceStopRecording_(issueId, silent) {
  var draft = assignVoiceDraft_(issueId);
  if (draft.timer) {
    clearInterval(draft.timer);
    draft.timer = null;
  }
  if (draft.recording) {
    draft.recording = false;
    assignVoiceStopWavCapture_(draft);
    assignVoiceStopTracks_(draft);
    if (draft.wavSamples && draft.wavSamples.length) {
      draft.blob = assignVoiceEncodeWavBlob_(draft.wavSamples, draft.captureSampleRate || ASSIGN_VOICE_PREFERRED_RATE);
      if (draft.blob) {
        draft.durationSec = Math.max(1, Math.round((Date.now() - draft.startedAt) / 1000));
        if (draft.previewUrl) {
          try { URL.revokeObjectURL(draft.previewUrl); } catch (e) {}
        }
        draft.previewUrl = URL.createObjectURL(draft.blob);
      }
    }
    draft.wavSamples = null;
  }
  if (_assignVoiceActiveId === issueId) _assignVoiceActiveId = '';
  if (!silent) assignVoiceRefreshUi(issueId);
}

function assignVoiceClearDraft(issueId) {
  assignVoiceStopRecording_(issueId, true);
  var draft = assignVoiceDraft_(issueId);
  assignVoiceReleaseDraft_(draft);
  assignVoiceStopTracks_(draft);
  assignVoiceStopWavCapture_(draft);
  draft.wavSamples = null;
  assignVoiceRefreshUi(issueId);
}

function assignVoiceCloseActive_() {
  if (_assignVoiceActiveId) assignVoiceStopRecording_(_assignVoiceActiveId, true);
}

function assignVoiceEscapeAttr_(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function assignVoiceInlinePlayerHtml_(url, durationSec) {
  var dur = Math.max(0, Number(durationSec) || 0);
  var h = '<div class="assign-voice-inline-player" data-url="' + assignVoiceEscapeAttr_(url) + '" data-duration="' + dur + '">';
  h += '<button type="button" class="assign-voice-play-btn" aria-label="Play voice note"><span class="assign-voice-play-icon">&#9654;</span> Play voice note</button>';
  h += '<span class="assign-voice-play-time">' + (dur ? ('0:00 / ' + assignVoiceFormatSec(dur)) : 'Tap Play') + '</span>';
  h += '<p class="assign-voice-play-err" style="display:none;">Could not play this voice note.</p>';
  h += '</div>';
  return h;
}

function assignVoicePlayerStop_(state) {
  if (!state) return;
  if (state.tickTimer) {
    clearInterval(state.tickTimer);
    state.tickTimer = null;
  }
  if (state.audio) {
    try { state.audio.pause(); } catch (e) {}
  }
  state.playing = false;
}

function assignVoicePlayerUpdateBtn_(state, btn, iconEl, timeEl, totalSec) {
  if (!btn) return;
  if (state.loading) {
    btn.disabled = true;
    btn.innerHTML = 'Loading\u2026';
    return;
  }
  btn.disabled = false;
  if (state.playing) {
    btn.innerHTML = '<span class="assign-voice-play-icon">\u23F8</span> Pause';
  } else {
    btn.innerHTML = '<span class="assign-voice-play-icon">\u9654;</span> Play voice note';
  }
  if (timeEl && state.audio && !isNaN(state.audio.currentTime)) {
    var cur = Math.floor(state.audio.currentTime);
    var tot = totalSec || (state.audio.duration && !isNaN(state.audio.duration) ? Math.floor(state.audio.duration) : 0);
    timeEl.textContent = assignVoiceFormatSec(cur) + (tot ? (' / ' + assignVoiceFormatSec(tot)) : '');
  }
}

function assignVoiceIsOldFormat_(url) {
  var u = String(url || '').toLowerCase();
  return u.indexOf('.webm') !== -1 || u.indexOf('.ogg') !== -1;
}

function assignVoiceLoadAudioForPlayer_(wrap, state, done) {
  var url = wrap.getAttribute('data-url') || '';
  if (!url) { done(new Error('Missing voice URL')); return; }
  if (state.blobUrl) { done(null); return; }
  if (url.indexOf('blob:') === 0) {
    state.blobUrl = url;
    state.audio = new Audio(url);
    state.audio.playsInline = true;
    state.audio.setAttribute('playsinline', '');
    state.audio.setAttribute('webkit-playsinline', '');
    done(null);
    return;
  }
  var bindEnded = function () {
    state.audio.addEventListener('ended', function () {
      state.playing = false;
      assignVoicePlayerUpdateBtn_(state, wrap.querySelector('.assign-voice-play-btn'), null, wrap.querySelector('.assign-voice-play-time'), Number(wrap.getAttribute('data-duration')) || 0);
    });
  };
  var useDirectUrl = function () {
    state.audio = new Audio(url);
    state.audio.playsInline = true;
    state.audio.setAttribute('playsinline', '');
    state.audio.setAttribute('webkit-playsinline', '');
    state.audio.preload = 'auto';
    bindEnded();
    done(null);
  };
  fetch(url, { mode: 'cors', cache: 'no-store' }).then(function (res) {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.blob();
  }).then(function (blob) {
    var type = blob.type || 'audio/wav';
    if (type === 'application/octet-stream' || !type) {
      blob = new Blob([blob], { type: 'audio/wav' });
    }
    state.blobUrl = URL.createObjectURL(blob);
    state.audio = new Audio(state.blobUrl);
    state.audio.playsInline = true;
    state.audio.setAttribute('playsinline', '');
    state.audio.setAttribute('webkit-playsinline', '');
    bindEnded();
    done(null);
  }).catch(function () {
    useDirectUrl();
  });
}

function assignVoiceBindPlayers(root) {
  root = root || document;
  root.querySelectorAll('.assign-voice-inline-player').forEach(function (wrap) {
    if (wrap.getAttribute('data-voice-bound') === '1') return;
    wrap.setAttribute('data-voice-bound', '1');
    var btn = wrap.querySelector('.assign-voice-play-btn');
    var timeEl = wrap.querySelector('.assign-voice-play-time');
    var errEl = wrap.querySelector('.assign-voice-play-err');
    var totalSec = Number(wrap.getAttribute('data-duration')) || 0;
    var state = { audio: null, blobUrl: '', playing: false, loading: false, tickTimer: null };
    _assignVoicePlayerCache[wrap] = state;

    btn.addEventListener('click', function () {
      if (errEl) errEl.style.display = 'none';
      var remoteUrl = wrap.getAttribute('data-url') || '';
      if (/iphone|ipad|ipod/i.test(navigator.userAgent) && assignVoiceIsOldFormat_(remoteUrl)) {
        if (errEl) {
          errEl.textContent = 'This voice note uses an old format that iPhone cannot play. Ask the editor to open the issue and record again.';
          errEl.style.display = 'block';
        }
        return;
      }
      if (!state.audio && !state.loading) {
        state.loading = true;
        assignVoicePlayerUpdateBtn_(state, btn, null, timeEl, totalSec);
        assignVoiceLoadAudioForPlayer_(wrap, state, function (e) {
          state.loading = false;
          if (e || !state.audio) {
            if (errEl) errEl.style.display = 'block';
            assignVoicePlayerUpdateBtn_(state, btn, null, timeEl, totalSec);
            return;
          }
          assignVoicePlayerUpdateBtn_(state, btn, null, timeEl, totalSec);
          state.audio.play().then(function () {
            state.playing = true;
            assignVoicePlayerUpdateBtn_(state, btn, null, timeEl, totalSec);
            if (state.tickTimer) clearInterval(state.tickTimer);
            state.tickTimer = setInterval(function () {
              assignVoicePlayerUpdateBtn_(state, btn, null, timeEl, totalSec);
            }, 250);
          }).catch(function () {
            if (errEl) errEl.style.display = 'block';
          });
        });
        return;
      }
      if (!state.audio) return;
      if (state.playing) {
        state.audio.pause();
        state.playing = false;
        if (state.tickTimer) clearInterval(state.tickTimer);
        assignVoicePlayerUpdateBtn_(state, btn, null, timeEl, totalSec);
      } else {
        state.audio.play().then(function () {
          state.playing = true;
          assignVoicePlayerUpdateBtn_(state, btn, null, timeEl, totalSec);
          if (state.tickTimer) clearInterval(state.tickTimer);
          state.tickTimer = setInterval(function () {
            assignVoicePlayerUpdateBtn_(state, btn, null, timeEl, totalSec);
          }, 250);
        }).catch(function () {
          if (errEl) errEl.style.display = 'block';
        });
      }
    });
  });
}

function assignVoiceRefreshUi(issueId) {
  var wrap = document.getElementById('assign-voice-' + issueId);
  if (!wrap) return;
  var draft = assignVoiceDraft_(issueId);
  var status = wrap.querySelector('.assign-voice-status');
  var timer = wrap.querySelector('.assign-voice-timer');
  var live = wrap.querySelector('.assign-voice-recording-live');
  var liveTime = wrap.querySelector('.assign-voice-live-time');
  var preview = wrap.querySelector('.assign-voice-preview');
  var recordBtn = wrap.querySelector('.assign-voice-record-btn');
  var stopBtn = wrap.querySelector('.assign-voice-stop-btn');
  var deleteBtn = wrap.querySelector('.assign-voice-delete-btn');
  var t = assignVoiceFormatSec(draft.durationSec);
  if (timer) timer.textContent = t;
  if (liveTime) liveTime.textContent = t;
  if (live) live.style.display = draft.recording ? 'flex' : 'none';
  if (status) {
    if (draft.recording) status.textContent = 'Speak now — tap Stop when finished.';
    else if (draft.blob) status.textContent = 'Preview your recording below, or delete and record again.';
    else status.textContent = 'Tap Record and speak instructions for the worker.';
  }
  if (preview) {
    if (draft.blob && draft.previewUrl) {
      preview.innerHTML = assignVoiceInlinePlayerHtml_(draft.previewUrl, draft.durationSec);
      preview.style.display = 'block';
      assignVoiceBindPlayers(preview);
    } else {
      preview.innerHTML = '';
      preview.style.display = 'none';
    }
  }
  if (recordBtn) recordBtn.disabled = !!draft.recording;
  if (stopBtn) stopBtn.disabled = !draft.recording;
  if (deleteBtn) deleteBtn.style.display = (draft.blob && !draft.recording) ? 'inline-flex' : 'none';
}

function assignVoiceStartWavCapture_(issueId, stream, draft) {
  var AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    assignVoiceStopTracks_(draft);
    alert('Could not start recording on this device.');
    return;
  }
  draft.recording = true;
  draft.startedAt = Date.now();
  draft.durationSec = 0;
  draft.wavSamples = [];
  draft.captureSampleRate = 0;
  _assignVoiceActiveId = issueId;
  try {
    draft.audioContext = new AudioCtx({ sampleRate: ASSIGN_VOICE_PREFERRED_RATE });
  } catch (e) {
    draft.audioContext = new AudioCtx();
  }
  draft.captureSampleRate = draft.audioContext.sampleRate || ASSIGN_VOICE_PREFERRED_RATE;
  var wire = function () {
    draft.audioSource = draft.audioContext.createMediaStreamSource(stream);
    draft.audioProcessor = draft.audioContext.createScriptProcessor(2048, 1, 1);
    draft.audioProcessor.onaudioprocess = function (ev) {
      if (!draft.recording) return;
      draft.wavSamples.push(new Float32Array(ev.inputBuffer.getChannelData(0)));
    };
    var silent = draft.audioContext.createGain();
    silent.gain.value = 0;
    draft.audioSource.connect(draft.audioProcessor);
    draft.audioProcessor.connect(silent);
    silent.connect(draft.audioContext.destination);
    assignVoiceStartTimer_(issueId, draft);
    assignVoiceRefreshUi(issueId);
  };
  if (draft.audioContext.state === 'suspended') {
    draft.audioContext.resume().then(wire).catch(function () { wire(); });
  } else {
    wire();
  }
}

function assignVoiceStartTimer_(issueId, draft) {
  if (draft.timer) clearInterval(draft.timer);
  draft.timer = setInterval(function () {
    draft.durationSec = Math.floor((Date.now() - draft.startedAt) / 1000);
    assignVoiceRefreshUi(issueId);
    if (draft.durationSec >= ASSIGN_VOICE_MAX_SEC) assignVoiceStopRecord(issueId);
  }, 200);
}

function assignVoiceStartRecord(issueId) {
  issueId = String(issueId || '');
  if (!issueId) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Voice notes need microphone access. Use Chrome or Safari on your phone.');
    return;
  }
  assignVoiceCloseActive_();
  var draft = assignVoiceDraft_(issueId);
  assignVoiceReleaseDraft_(draft);
  assignVoiceStopWavCapture_(draft);
  navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: false,
      autoGainControl: true,
      channelCount: 1
    }
  }).then(function (stream) {
    draft.stream = stream;
    assignVoiceStartWavCapture_(issueId, stream, draft);
  }).catch(function () {
    alert('Microphone permission denied. Allow the mic in your browser settings and try again.');
  });
}

function assignVoiceStopRecord(issueId) {
  var draft = assignVoiceDraft_(issueId);
  if (!draft.recording) return;
  assignVoiceStopRecording_(issueId, false);
}

function assignVoiceNoteDisplayHtml(note, opts) {
  opts = opts || {};
  if (!note || !note.url) return '';
  var by = note.by ? (' from ' + note.by) : '';
  var at = note.at ? (' · ' + dateOnly(note.at)) : '';
  var dur = note.durationSec ? (' · ' + assignVoiceFormatSec(note.durationSec)) : '';
  var h = '<div class="assign-voice-playback' + (opts.worker ? ' assign-voice-playback-worker' : '') + '">';
  h += '<div class="assign-voice-playback-label"><strong>Voice note' + by + '</strong><span class="assign-voice-playback-meta">' + at + dur + '</span></div>';
  h += assignVoiceInlinePlayerHtml_(note.url, note.durationSec || 0);
  h += '</div>';
  return h;
}

function assignVoiceWorkerT_(key, fallback) {
  if (typeof workerT === 'function') {
    var v = workerT(key);
    if (v && v !== key) return v;
  }
  return fallback != null ? fallback : key;
}

function assignVoiceBoxHtml(issueId, existingNote, opts) {
  opts = opts || {};
  var locked = !!opts.locked;
  issueId = String(issueId || '');
  var h = '<div class="assign-voice-note' + (locked ? ' assign-voice-note-locked' : '') + '" id="assign-voice-' + issueId + '" onclick="event.stopPropagation()">';
  h += '<label>' + (opts.workerReport
    ? assignVoiceWorkerT_('voiceLabel', 'Voice note <span class="assign-voice-optional">(optional)</span>')
    : 'Voice note for worker <span class="assign-voice-optional">(optional)</span>') + '</label>';
  if (locked) {
    if (existingNote && existingNote.url) {
      h += assignVoiceNoteDisplayHtml(existingNote, { existing: true });
    } else {
      h += '<p class="assign-voice-status">No voice note recorded.</p>';
    }
    h += '</div>';
    return h;
  }
  if (existingNote && existingNote.url) {
    h += assignVoiceNoteDisplayHtml(existingNote, { existing: true });
    h += '<p class="assign-voice-replace-hint">Record below to replace the current voice note when you save.</p>';
  }
  h += '<div class="assign-voice-recording-live" style="display:none;"><span class="assign-voice-live-dot"></span><span class="assign-voice-live-time">0:00</span><span class="assign-voice-live-label">' + (opts.workerReport ? assignVoiceWorkerT_('voiceRecording', 'Recording') : 'Recording') + '</span></div>';
  h += '<div class="assign-voice-controls">';
  h += '<button type="button" class="assign-voice-record-btn" onclick="assignVoiceStartRecord(\'' + issueId + '\')">' + assignVoiceMicIconHtml() + ' ' + (opts.workerReport ? assignVoiceWorkerT_('voiceRecord', 'Record') : 'Record') + '</button>';
  h += '<button type="button" class="assign-voice-stop-btn" onclick="assignVoiceStopRecord(\'' + issueId + '\')" disabled>' + assignVoiceStopIconHtml() + ' ' + (opts.workerReport ? assignVoiceWorkerT_('voiceStop', 'Stop') : 'Stop') + '</button>';
  h += '<span class="assign-voice-timer">0:00</span>';
  h += '<button type="button" class="assign-voice-delete-btn" onclick="assignVoiceClearDraft(\'' + issueId + '\')" style="display:none;">' + assignVoiceTrashIconHtml() + ' ' + (opts.workerReport ? assignVoiceWorkerT_('voiceDelete', 'Delete recording') : 'Delete recording') + '</button>';
  h += '</div>';
  h += '<p class="assign-voice-status">' + (opts.workerReport ? assignVoiceWorkerT_('voiceStatusWorker', 'Tap Record and describe what you found.') : 'Tap Record and speak instructions for the worker.') + '</p>';
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
  var uploadBlob = draft.blob.type === 'audio/wav'
    ? draft.blob
    : new Blob([draft.blob], { type: 'audio/wav' });
  return empireUploadAudioAsync(uploadBlob, 'civil-assign-voice').then(function (url) {
    if (!url) {
      throw new Error(_lastEmpireUploadError || 'Voice note upload failed');
    }
    return {
      url: url,
      by: empireGetUser() || '',
      at: assignVoiceNowStamp(),
      durationSec: draft.durationSec || 0,
      mimeType: 'audio/wav'
    };
  });
}

function assignVoiceHasDraft_(issueId) {
  var draft = assignVoiceDraft_(issueId);
  return !!(draft && draft.blob);
}

/** Optional voice: no recording = skip. If recorded, upload must succeed or save is blocked. */
function uploadAssignVoiceRequired_(issueId, timeoutMs) {
  timeoutMs = timeoutMs || 45000;
  if (!assignVoiceHasDraft_(issueId)) return Promise.resolve(null);
  if (typeof uploadAssignVoiceForIssue !== 'function') {
    return Promise.reject(new Error('Voice upload is not available.'));
  }
  return Promise.race([
    uploadAssignVoiceForIssue(issueId),
    new Promise(function (_, reject) {
      setTimeout(function () {
        reject(new Error('Voice note upload timed out. Check your connection and try again.'));
      }, timeoutMs);
    })
  ]).then(function (note) {
    if (!note || !note.url) {
      throw new Error(_lastEmpireUploadError || 'Voice note upload failed. The job was not saved — try again or delete the recording.');
    }
    return note;
  });
}

function assignVoiceEnsureUploaded_(issueId, timeoutMs) {
  if (typeof uploadAssignVoiceRequired_ === 'function') {
    return uploadAssignVoiceRequired_(issueId, timeoutMs);
  }
  if (assignVoiceHasDraft_(issueId)) {
    if (typeof uploadAssignVoiceForIssue === 'function') {
      return uploadAssignVoiceForIssue(issueId);
    }
    return Promise.reject(new Error('Voice note could not upload. Refresh the page and try again.'));
  }
  return Promise.resolve(null);
}

function assignVoiceBlockSaveIfDraftFailed_(issueId, voiceNote) {
  if (!assignVoiceHasDraft_(issueId)) return;
  if (!voiceNote || !voiceNote.url) {
    throw new Error('Voice note failed to upload. The job was not saved — try again or delete the recording.');
  }
}

function assignVoiceOnModalClose_() {
  assignVoiceCloseActive_();
}
