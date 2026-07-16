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
  var ext = 'webm';
  var mime = blob && blob.type ? blob.type.toLowerCase() : '';
  if (mime.indexOf('ogg') !== -1) ext = 'ogg';
  else if (mime.indexOf('mp4') !== -1 || mime.indexOf('m4a') !== -1) ext = 'm4a';
  else if (mime.indexOf('mpeg') !== -1 || mime.indexOf('mp3') !== -1) ext = 'mp3';
  var id = (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : (Date.now() + '-' + Math.random().toString(36).slice(2, 10));
  var d = new Date();
  var ym = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  return empireStorageSafeFolder(folder) + '/' + ym + '/' + id + '.' + ext;
}

function empireUploadBlob(blob, folder, path, cb) {
  _lastEmpireUploadError = '';
  if (!blob) { _lastEmpireUploadError = 'No file data'; cb(null); return; }
  if (!empireStorageConfigured()) {
    _lastEmpireUploadError = 'Supabase is not configured in config.js';
    cb(null);
    return;
  }
  var uploadPath = path || empireStorageFilePath(folder, blob);
  var url = String(SUPABASE_CONFIG.url || '').replace(/\/$/, '') +
    '/storage/v1/object/' + SUPABASE_CONFIG.bucket + '/' + uploadPath;
  fetch(url, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_CONFIG.anonKey,
      Authorization: 'Bearer ' + SUPABASE_CONFIG.anonKey,
      'Content-Type': blob.type || 'application/octet-stream',
      'x-upsert': 'true'
    },
    body: blob
  }).then(function (res) {
    return res.text().then(function (txt) {
      if (res.ok) {
        cb(empireStoragePublicUrl(uploadPath));
        return;
      }
      try {
        var err = JSON.parse(txt);
        _lastEmpireUploadError = err.message || err.error || ('Upload failed (' + res.status + ')');
      } catch (e) {
        _lastEmpireUploadError = txt || ('Upload failed (' + res.status + ')');
      }
      cb(null);
    });
  }).catch(function (err) {
    _lastEmpireUploadError = (err && err.message) || 'Network error reaching Supabase';
    cb(null);
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
