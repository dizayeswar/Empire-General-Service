/* Empire General Service — offline upload queue (Phase 5D) */

var EMPIRE_OFFLINE_DB = 'empire_egs_offline';
var EMPIRE_OFFLINE_STORE = 'queue';
var _empireOfflineDbPromise = null;

function empireOfflineDbOpen() {
  if (_empireOfflineDbPromise) return _empireOfflineDbPromise;
  _empireOfflineDbPromise = new Promise(function (resolve, reject) {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB not available'));
      return;
    }
    var req = indexedDB.open(EMPIRE_OFFLINE_DB, 1);
    req.onupgradeneeded = function (e) {
      e.target.result.createObjectStore(EMPIRE_OFFLINE_STORE, { keyPath: 'id' });
    };
    req.onsuccess = function (e) { resolve(e.target.result); };
    req.onerror = function () { reject(req.error || new Error('Could not open offline queue')); };
  });
  return _empireOfflineDbPromise;
}

function empireOfflineQueueAll() {
  return empireOfflineDbOpen().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(EMPIRE_OFFLINE_STORE, 'readonly');
      var req = tx.objectStore(EMPIRE_OFFLINE_STORE).getAll();
      req.onsuccess = function () { resolve(req.result || []); };
      req.onerror = function () { reject(req.error); };
    });
  });
}

function empireOfflineQueuePut(record) {
  return empireOfflineDbOpen().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(EMPIRE_OFFLINE_STORE, 'readwrite');
      tx.objectStore(EMPIRE_OFFLINE_STORE).put(record);
      tx.oncomplete = function () { resolve(record); };
      tx.onerror = function () { reject(tx.error); };
    });
  });
}

function empireOfflineQueueDelete(id) {
  return empireOfflineDbOpen().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(EMPIRE_OFFLINE_STORE, 'readwrite');
      tx.objectStore(EMPIRE_OFFLINE_STORE).delete(id);
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
    });
  });
}

function empireOfflineQueueCount() {
  return empireOfflineQueueAll().then(function (rows) { return rows.length; }).catch(function () { return 0; });
}

function empireOfflineBlobToDataUrl(blob) {
  return new Promise(function (resolve, reject) {
    var r = new FileReader();
    r.onload = function () { resolve(r.result); };
    r.onerror = function () { reject(r.error || new Error('Could not read image')); };
    r.readAsDataURL(blob);
  });
}

function empireOfflineDataUrlToBlob(dataUrl) {
  try {
    var s = String(dataUrl || '');
    if (!s || s.indexOf('blob:') === 0) return null;
    if (s.indexOf('http://') === 0 || s.indexOf('https://') === 0) return null;
    var comma = s.indexOf(',');
    if (comma < 0) return null;
    var meta = s.slice(0, comma);
    var b64 = s.slice(comma + 1);
    if (!b64) return null;
    // Skip huge payloads instead of atob-crashing low-memory phones (~6MB decoded).
    if (b64.length > 8 * 1024 * 1024) return null;
    var mime = (meta.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
    var bin = atob(b64);
    var len = bin.length;
    var arr = new Uint8Array(len);
    var i;
    for (i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  } catch (e) {
    return null;
  }
}

function empireOfflineSetBanner(count, onSync, opts) {
  var bar = document.getElementById('empire-offline-banner');
  if (!count) {
    if (bar) bar.remove();
    return;
  }
  opts = opts || {};
  var title = opts.title || (count + ' photo upload' + (count === 1 ? '' : 's') + ' waiting');
  var subtitle = opts.subtitle || 'Saved on this device — will sync when you have signal.';
  var buttonLabel = opts.buttonLabel || 'Sync now';
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'empire-offline-banner';
    bar.setAttribute('role', 'status');
    document.body.appendChild(bar);
    var style = document.createElement('style');
    style.textContent =
      '#empire-offline-banner{position:fixed;left:12px;right:12px;top:12px;z-index:5100;}' +
      '#empire-offline-banner .empire-offline-inner{display:flex;align-items:center;justify-content:space-between;gap:12px;' +
        'background:#fff7e8;color:#5a4200;border:2px solid #e6b800;border-radius:16px;padding:12px 14px;' +
        'box-shadow:0 8px 24px rgba(0,0,0,.15);font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;}' +
      '#empire-offline-banner strong{display:block;font-size:14px;}' +
      '#empire-offline-banner span{font-size:12px;opacity:.9;}' +
      '#empire-offline-banner button{background:#8d015d;color:#fff;border:none;border-radius:999px;' +
        'padding:8px 14px;font-weight:700;font-size:12px;cursor:pointer;white-space:nowrap;}';
    document.head.appendChild(style);
  }
  bar.innerHTML =
    '<div class="empire-offline-inner">' +
      '<div><strong>' + title + '</strong>' +
      '<span>' + subtitle + '</span></div>' +
      '<button type="button" id="empireOfflineSyncBtn">' + buttonLabel + '</button>' +
    '</div>';
  var btn = document.getElementById('empireOfflineSyncBtn');
  if (btn && typeof onSync === 'function') btn.onclick = onSync;
}
