/* Application → Sync to portal.
 * A person sends Unit Code + phone; the invite bot on the office PC (invite-bot/website_bot.py)
 * updates SAP, sends the portal invitation and writes its progress back. This tab only sends
 * requests, cancels waiting ones and shows the live status. */

var PSYNC_REFRESH_MS = 5000;
var PSYNC_BOT_ONLINE_MS = 60000;   // the bot asks for work every ~10 s
var _psyncRows = [];
var _psyncTimer = null;
var _psyncLoading = false;
var _psyncCanWrite = false;

var PSYNC_STATUS = {
  waiting: { label: 'Waiting', cls: 'psync-st-wait' },
  sap: { label: 'SAP updating…', cls: 'psync-st-run' },
  sap_done: { label: 'SAP done — portal next', cls: 'psync-st-run' },
  portal: { label: 'Portal inviting…', cls: 'psync-st-run' },
  done: { label: 'Done', cls: 'psync-st-ok' },
  failed: { label: 'Failed', cls: 'psync-st-bad' },
  cancelled: { label: 'Cancelled', cls: 'psync-st-off' }
};
var PSYNC_RESULT = {
  'invited': 'Invited ✅',
  'already activated': 'Already activated ✅',
  'already invited': 'Already invited ✅'
};

function psyncEsc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Same rules as the server: "es 4 8 06" → "ES-4-8-06"; '' when it is not a unit code. */
function psyncNormUnit_(raw) {
  var parts = String(raw || '').trim().toUpperCase().split(/[\s\-_/.]+/).filter(Boolean);
  var code = parts.join('-');
  if (!/^[A-Z]{2}(-[A-Z0-9]{1,3}){3}$/.test(code)) return '';
  if (!/\d/.test(code.slice(3))) return '';
  return code;
}

/** "0750 123 4567" / "+964 750 123 4567" → "07501234567"; '' when it is not 07XXXXXXXXX. */
function psyncNormPhone_(raw) {
  var d = String(raw || '')
    .replace(/[٠-٩]/g, function (c) { return String(c.charCodeAt(0) - 0x660); })
    .replace(/[۰-۹]/g, function (c) { return String(c.charCodeAt(0) - 0x6f0); })
    .replace(/\D/g, '');
  if (d.indexOf('00964') === 0) d = '0' + d.slice(5);
  else if (d.indexOf('964') === 0) d = '0' + d.slice(3);
  else if (d.length === 10 && d.charAt(0) === '7') d = '0' + d;
  return /^07\d{9}$/.test(d) ? d : '';
}

function psyncMsg_(text, bad) {
  var el = document.getElementById('psyncMsg');
  if (!el) return;
  el.textContent = text || '';
  el.className = 'psync-msg' + (bad ? ' psync-msg-bad' : (text ? ' psync-msg-ok' : ''));
}

function psyncTime_(iso) {
  if (!iso) return '—';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso).slice(0, 16);
  try {
    return d.toLocaleString('en-GB', {
      timeZone: 'Asia/Baghdad', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  } catch (e) {
    return d.toLocaleString();
  }
}

function psyncShow_() {
  psyncLoad_();
  if (_psyncTimer) clearInterval(_psyncTimer);
  _psyncTimer = setInterval(function () {
    var pane = document.getElementById('portalsync');
    if (!pane || !pane.classList.contains('active') || document.hidden) return;
    psyncLoad_();
  }, PSYNC_REFRESH_MS);
}

function psyncHide_() {
  if (_psyncTimer) clearInterval(_psyncTimer);
  _psyncTimer = null;
}

function psyncLoad_() {
  if (_psyncLoading) return Promise.resolve(_psyncRows);
  _psyncLoading = true;
  return fetchJSONRetry({ action: 'getPortalSyncRequests', token: appToken_() }, 1, 30000).then(function (d) {
    if (!d || d.ok === false) throw new Error((d && (d.message || d.error)) || 'Could not load');
    _psyncRows = Array.isArray(d.requests) ? d.requests : [];
    _psyncCanWrite = !!d.canWrite;
    psyncRenderBot_(d.botLastSeen, d.serverNow);
    psyncRender_();
    return _psyncRows;
  }).catch(function (e) {
    var host = document.getElementById('psyncHost');
    if (host && !_psyncRows.length) {
      host.innerHTML = '<p class="worker-empty">Could not load. ' + psyncEsc_((e && e.message) || e) + '</p>';
    }
    return _psyncRows;
  }).then(function (rows) {
    _psyncLoading = false;
    return rows;
  });
}

function psyncRenderBot_(lastSeen, serverNow) {
  var el = document.getElementById('psyncBot');
  if (!el) return;
  var seen = lastSeen ? new Date(lastSeen).getTime() : 0;
  var now = serverNow ? new Date(serverNow).getTime() : Date.now();
  var online = seen && (now - seen) < PSYNC_BOT_ONLINE_MS;
  el.className = 'psync-bot ' + (online ? 'psync-bot-on' : 'psync-bot-off');
  el.innerHTML = '<span class="psync-dot"></span>'
    + (online ? 'Bot online' : 'Bot offline')
    + '<span class="psync-bot-sub">' + (seen ? ' · last seen ' + psyncEsc_(psyncTime_(lastSeen)) : ' · never seen') + '</span>';
}

function psyncStatusHtml_(r) {
  var st = PSYNC_STATUS[r.status] || { label: r.status || '?', cls: 'psync-st-off' };
  var label = st.label;
  if (r.status === 'done' && r.result) label = PSYNC_RESULT[r.result] || r.result;
  return '<span class="psync-st ' + st.cls + '">' + psyncEsc_(label) + '</span>';
}

function psyncRender_() {
  var host = document.getElementById('psyncHost');
  if (!host) return;
  var form = document.getElementById('psyncForm');
  if (form) form.hidden = !_psyncCanWrite;
  if (!_psyncRows.length) {
    host.innerHTML = '<p class="worker-empty">Nothing sent yet.</p>';
    return;
  }
  var h = '<div class="psync-table-wrap"><table class="psync-table"><thead><tr>'
    + '<th>Sent</th><th>Unit Code</th><th>Phone</th><th>Status</th><th>Details</th><th>By</th><th></th>'
    + '</tr></thead><tbody>';
  _psyncRows.forEach(function (r) {
    var cancel = '';
    if (_psyncCanWrite && r.status === 'waiting') {
      cancel = '<button type="button" class="psync-cancel" onclick="psyncCancel_(\'' + psyncEsc_(r.id) + '\')">Cancel</button>';
    } else if (_psyncCanWrite && psyncCanRetry_(r)) {
      cancel = '<button type="button" class="psync-retry" onclick="psyncRetry_(\'' + psyncEsc_(r.id) + '\', this)">Try again</button>';
    }
    h += '<tr>'
      + '<td data-l="Sent">' + psyncEsc_(psyncTime_(r.createdAt)) + '</td>'
      + '<td data-l="Unit Code"><strong>' + psyncEsc_(r.unitCode) + '</strong></td>'
      + '<td data-l="Phone">' + psyncEsc_(r.phone) + '</td>'
      + '<td data-l="Status">' + psyncStatusHtml_(r) + '</td>'
      + '<td data-l="Details" class="psync-detail">' + psyncEsc_(r.message || '') + '</td>'
      + '<td data-l="By">' + psyncEsc_(r.cancelledBy ? (r.createdBy + ' · cancelled by ' + r.cancelledBy) : r.createdBy) + '</td>'
      + '<td>' + cancel + '</td>'
      + '</tr>';
  });
  host.innerHTML = h + '</tbody></table></div>';
}

function psyncSend_() {
  var unitEl = document.getElementById('psyncUnit');
  var phoneEl = document.getElementById('psyncPhone');
  var unit = psyncNormUnit_(unitEl.value);
  var phone = psyncNormPhone_(phoneEl.value);
  if (!unit) { psyncMsg_('Unit Code must look like ES-4-8-06 or WW-13-24-H.', true); unitEl.focus(); return; }
  if (!phone) { psyncMsg_('Phone must be 07XXXXXXXXX (11 digits).', true); phoneEl.focus(); return; }
  var btn = document.getElementById('psyncSendBtn');
  btn.disabled = true;
  psyncMsg_('Sending…');
  fetchJSONRetry({ action: 'addPortalSyncRequest', token: appToken_(), unitCode: unit, phone: phone }, 0, 30000)
    .then(function (d) {
      if (!d || d.ok === false) {
        psyncMsg_((d && (d.message || d.error)) || 'Could not send.', true);
        return;
      }
      unitEl.value = '';
      phoneEl.value = '';
      psyncMsg_('Sent: ' + unit + ' → ' + phone + '. The bot will start in a few seconds.');
      unitEl.focus();
      psyncLoad_();
    })
    .catch(function (e) { psyncMsg_('Could not send: ' + ((e && e.message) || e), true); })
    .then(function () { btn.disabled = false; });
}

function psyncCancel_(id) {
  var r = _psyncRows.filter(function (x) { return x.id === id; })[0];
  var what = r ? (r.unitCode + ' → ' + r.phone) : 'this request';
  appAsk_('Cancel ' + what + '? The bot will not touch it.', { okLabel: 'Cancel request', cancelLabel: 'Keep it', danger: true }, function () {
    fetchJSONRetry({ action: 'cancelPortalSyncRequest', token: appToken_(), id: id }, 0, 30000).then(function (d) {
      if (!d || d.ok === false) {
        psyncMsg_((d && (d.message || d.error)) || 'Could not cancel.', true);
      } else {
        psyncMsg_('Cancelled ' + what + '.');
      }
      psyncLoad_();
    }).catch(function (e) { psyncMsg_('Could not cancel: ' + ((e && e.message) || e), true); });
  });
}

/** Failed / cancelled, and not already sent again (a newer row for the same unit + phone). */
function psyncCanRetry_(r) {
  if (r.status !== 'failed' && r.status !== 'cancelled') return false;
  var t = new Date(r.createdAt).getTime() || 0;
  return !_psyncRows.some(function (x) {
    return x.id !== r.id && x.unitCode === r.unitCode && x.phone === r.phone
      && (new Date(x.createdAt).getTime() || 0) > t;
  });
}

/** Try again = send the same Unit Code + phone as a new request: the bot does the whole
 * process again (SAP, then portal). The failed row stays as it was, for the record. */
function psyncRetry_(id, btn) {
  var r = _psyncRows.filter(function (x) { return x.id === id; })[0];
  if (!r) return;
  if (btn) btn.disabled = true;
  var what = r.unitCode + ' → ' + r.phone;
  psyncMsg_('Sending again: ' + what + '…');
  fetchJSONRetry({ action: 'addPortalSyncRequest', token: appToken_(), unitCode: r.unitCode, phone: r.phone }, 0, 30000)
    .then(function (d) {
      if (!d || d.ok === false) {
        psyncMsg_((d && (d.message || d.error)) || 'Could not send again.', true);
        if (btn) btn.disabled = false;
        return;
      }
      psyncMsg_('Sent again: ' + what + '. The bot will start in a few seconds.');
      psyncLoad_();
    })
    .catch(function (e) {
      psyncMsg_('Could not send again: ' + ((e && e.message) || e), true);
      if (btn) btn.disabled = false;
    });
}

function psyncKey_(ev) {
  if (ev.key === 'Enter') { ev.preventDefault(); psyncSend_(); }
}
