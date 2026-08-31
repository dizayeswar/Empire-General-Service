/* Empire General Service — Supabase Storage photo uploads */

var _lastEmpireUploadError = '';

function empireStorageConfigured() {
  return !!(typeof SUPABASE_CONFIG !== 'undefined' &&
    SUPABASE_CONFIG.url &&
    SUPABASE_CONFIG.anonKey &&
    SUPABASE_CONFIG.bucket);
}

function isImgbbUrl(url) {
  var u = String(url || '').toLowerCase();
  return u.indexOf('i.ibb.co') !== -1 ||
    u.indexOf('ibb.co/') !== -1 ||
    u.indexOf('imgbb.com') !== -1;
}

function isSupabasePhotoUrl(url) {
  if (!empireStorageConfigured()) return false;
  var base = String(SUPABASE_CONFIG.url || '').replace(/\/$/, '').toLowerCase();
  var bucket = String(SUPABASE_CONFIG.bucket || '').toLowerCase();
  var u = String(url || '').toLowerCase();
  return u.indexOf(base) !== -1 && u.indexOf('/storage/v1/object/') !== -1 && u.indexOf('/' + bucket + '/') !== -1;
}

function empireStoragePublicUrl(path) {
  var base = String(SUPABASE_CONFIG.url || '').replace(/\/$/, '');
  var bucket = SUPABASE_CONFIG.bucket || 'empire-photos';
  return base + '/storage/v1/object/public/' + bucket + '/' + String(path || '').replace(/^\/+/, '');
}

/** Smaller image URL for list cards (falls back to original if transform unavailable). */
var _empireThumbTransformOk = true;
function empireMarkThumbTransformFailed() {
  _empireThumbTransformOk = false;
  try { sessionStorage.setItem('empire_thumbs_ok', '0'); } catch (e) {}
}
function empireThumbUrl(url, width) {
  var u = String(url || '').trim();
  if (!u || !empireStorageConfigured() || !_empireThumbTransformOk) return u;
  width = width || 240;
  var base = String(SUPABASE_CONFIG.url || '').replace(/\/$/, '');
  var marker = '/storage/v1/object/public/';
  var idx = u.indexOf(marker);
  if (idx === -1) return u;
  var rest = u.slice(idx + marker.length);
  if (!rest) return u;
  return base + '/storage/v1/render/image/public/' + rest +
    (rest.indexOf('?') === -1 ? '?' : '&') + 'width=' + width + '&resize=contain&quality=70';
}

function empireThumbImgHtml(url, cls, alt, width) {
  var full = String(url || '').trim();
  if (!full) return '';
  var thumb = empireThumbUrl(full, width || 240);
  var a = alt != null ? String(alt) : '';
  var usingThumb = thumb !== full;
  return '<img class="' + (cls || 'thumb') + '" src="' + thumb + '" data-full="' + full.replace(/"/g, '&quot;') +
    '" loading="lazy" decoding="async" alt="' + a.replace(/"/g, '&quot;') +
    '" onerror="if(' + (usingThumb ? 'true' : 'false') + '&&window.empireMarkThumbTransformFailed)empireMarkThumbTransformFailed();if(this.dataset.full&&this.src!==this.dataset.full){this.src=this.dataset.full;}">';
}

/** One-time probe: if transforms are off, skip render URLs for the rest of the session. */
function empireProbeThumbSupport_() {
  if (!empireStorageConfigured() || !_empireThumbTransformOk) return;
  try {
    if (sessionStorage.getItem('empire_thumbs_ok') === '0') {
      _empireThumbTransformOk = false;
      return;
    }
    if (sessionStorage.getItem('empire_thumbs_ok') === '1') return;
  } catch (e) {}
  var probe = String(SUPABASE_CONFIG.url || '').replace(/\/$/, '') +
    '/storage/v1/render/image/public/' + encodeURIComponent(SUPABASE_CONFIG.bucket || 'empire-photos') +
    '/__empire_thumb_probe__.jpg?width=8';
  fetch(probe, { method: 'GET', mode: 'cors' }).then(function (r) {
    // 400/404 = endpoint exists but file missing (transforms likely ON)
    // 403/402/5xx with feature disabled often appears as 403
    var ok = r.status === 400 || r.status === 404 || r.status === 200;
    _empireThumbTransformOk = ok;
    try { sessionStorage.setItem('empire_thumbs_ok', ok ? '1' : '0'); } catch (e2) {}
  }).catch(function () {
    /* keep trying thumbs; img onerror will disable */
  });
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', empireProbeThumbSupport_);
  else setTimeout(empireProbeThumbSupport_, 0);
}

function empireStorageSafeFolder(folder) {
  return String(folder || 'misc')
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-zA-Z0-9/_-]+/g, '-')
    .replace(/\/{2,}/g, '/');
}

function empireStorageFilePath(folder, blob) {
  var ext = 'jpg';
  var mime = blob && blob.type ? blob.type.toLowerCase() : '';
  if (mime.indexOf('png') !== -1) ext = 'png';
  else if (mime.indexOf('webp') !== -1) ext = 'webp';
  else if (mime.indexOf('gif') !== -1) ext = 'gif';
  var id = (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : (Date.now() + '-' + Math.random().toString(36).slice(2, 10));
  var d = new Date();
  var ym = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  return empireStorageSafeFolder(folder) + '/' + ym + '/' + id + '.' + ext;
}

function empireStorageAudioPath(folder, blob) {
  var ext = 'wav';
  var mime = blob && blob.type ? blob.type.toLowerCase() : '';
  if (mime.indexOf('webm') !== -1) ext = 'webm';
  else if (mime.indexOf('ogg') !== -1) ext = 'ogg';
  else if (mime.indexOf('mp4') !== -1 || mime.indexOf('m4a') !== -1) ext = 'm4a';
  else if (mime.indexOf('mpeg') !== -1 || mime.indexOf('mp3') !== -1) ext = 'mp3';
  var id = (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : (Date.now() + '-' + Math.random().toString(36).slice(2, 10));
  var d = new Date();
  var ym = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  return empireStorageSafeFolder(folder) + '/' + ym + '/' + id + '.' + ext;
}

function empireStorageFriendlyError_(raw) {
  var msg = String(raw || '');
  if (/row-level security/i.test(msg)) {
    return 'Upload blocked by storage policy. Hard refresh after the latest update (signed uploads require login). If it still fails, ask admin to apply the storage harden SQL.';
  }
  return msg;
}

function empireUploadBlob(blob, folder, path, cb) {
  _lastEmpireUploadError = '';
  if (!blob) { _lastEmpireUploadError = 'No file data'; cb(null); return; }
  if (!empireStorageConfigured()) {
    _lastEmpireUploadError = 'Supabase is not configured in config.js';
    cb(null);
    return;
  }
  var token = (typeof empireGetToken === 'function' && empireGetToken()) || '';
  if (!token) {
    _lastEmpireUploadError = 'Login required to upload files.';
    cb(null);
    return;
  }
  var mime = (blob && blob.type) || '';
  var extHint = '';
  if (path) {
    var m = String(path).match(/\.([a-z0-9]+)$/i);
    if (m) extHint = m[1];
  }
  var apiUrl = (typeof GOOGLE_SCRIPT_URL !== 'undefined' && GOOGLE_SCRIPT_URL)
    ? GOOGLE_SCRIPT_URL
    : (typeof EMPIRE_API_ENDPOINT !== 'undefined' ? EMPIRE_API_ENDPOINT : '');
  if (!apiUrl) {
    _lastEmpireUploadError = 'API URL not configured';
    cb(null);
    return;
  }

  var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var finished = false;
  function finish(result) {
    if (finished) return;
    finished = true;
    clearTimeout(timeoutId);
    cb(result);
  }
  var timeoutId = setTimeout(function () {
    if (controller) controller.abort();
    else finish(null);
    if (!finished) _lastEmpireUploadError = 'Upload timed out — check your connection and try again.';
  }, 90000);

  var signBody = {
    action: 'getSignedUpload',
    token: token,
    folder: folder || 'misc',
    contentType: mime,
    ext: extHint
  };

  fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(signBody),
    signal: controller ? controller.signal : undefined
  }).then(function (res) {
    return res.json().then(function (d) {
      if (!d || d.ok === false || !d.signedUrl) {
        _lastEmpireUploadError = (d && (d.message || d.error)) || ('Could not get upload URL (' + res.status + ')');
        finish(null);
        return null;
      }
      return d;
    });
  }).then(function (signed) {
    if (!signed) return;
    var putHeaders = {
      'Content-Type': mime || 'application/octet-stream'
    };
    if (signed.token) putHeaders['x-upsert'] = 'true';
    return fetch(signed.signedUrl, {
      method: 'PUT',
      headers: putHeaders,
      body: blob,
      signal: controller ? controller.signal : undefined
    }).then(function (putRes) {
      return putRes.text().then(function (txt) {
        if (putRes.ok) {
          finish(signed.publicUrl || empireStoragePublicUrl(signed.path));
          return;
        }
        try {
          var err = JSON.parse(txt);
          _lastEmpireUploadError = empireStorageFriendlyError_(err.message || err.error || ('Upload failed (' + putRes.status + ')'));
        } catch (e) {
          _lastEmpireUploadError = empireStorageFriendlyError_(txt || ('Upload failed (' + putRes.status + ')'));
        }
        finish(null);
      });
    });
  }).catch(function (err) {
    if (err && err.name === 'AbortError') {
      _lastEmpireUploadError = 'Upload timed out — check your connection and try again.';
    } else {
      _lastEmpireUploadError = (err && err.message) || 'Network error reaching Supabase';
    }
    finish(null);
  });
}

function empireUploadPhoto(blob, folder, cb) {
  if (!blob) { _lastEmpireUploadError = 'No image data'; cb(null); return; }
  empireUploadBlob(blob, folder, empireStorageFilePath(folder, blob), cb);
}

function empireUploadAudio(blob, folder, cb) {
  if (!blob) { _lastEmpireUploadError = 'No audio data'; cb(null); return; }
  empireUploadBlob(blob, folder, empireStorageAudioPath(folder, blob), cb);
}

function empireUploadAudioAsync(blob, folder) {
  return new Promise(function (resolve) { empireUploadAudio(blob, folder, resolve); });
}

function empireUploadPhotoAsync(blob, folder) {
  return new Promise(function (resolve) { empireUploadPhoto(blob, folder, resolve); });
}

function empireCompressImage(file, folder, cb, opts) {
  opts = opts || {};
  var maxSize = opts.maxSize || 1400;
  var quality = opts.quality != null ? opts.quality : 0.7;
  _lastEmpireUploadError = '';
  if (!file) { _lastEmpireUploadError = 'No image selected'; cb(null); return; }
  var r = new FileReader();
  r.onerror = function () { _lastEmpireUploadError = 'Could not read image file'; cb(null); };
  r.onload = function (e) {
    var img = new Image();
    img.onerror = function () { _lastEmpireUploadError = 'Could not process image'; cb(null); };
    img.onload = function () {
      var s = Math.min(1, maxSize / Math.max(img.width, img.height));
      var c = document.createElement('canvas');
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(function (b) {
        if (!b) { _lastEmpireUploadError = 'Could not compress image'; cb(null); return; }
        empireUploadPhoto(b, folder, cb);
      }, 'image/jpeg', quality);
    };
    img.src = e.target.result;
  };
  r.readAsDataURL(file);
}

/** @deprecated Use empireUploadPhoto — kept for offline queue sync code */
function uploadToImgbb(file, cb) {
  empireUploadPhoto(file, 'misc', cb);
}

/** @deprecated Use empireUploadPhotoAsync */
function uploadToImgbbAsync(blob) {
  return empireUploadPhotoAsync(blob, 'misc');
}
