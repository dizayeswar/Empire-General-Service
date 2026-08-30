/* Empire Electrical Department — standalone Electric Minus log (not linked to jobs). */
(function () {
  var extras = [];

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function seedRows() {
    var raw = Array.isArray(window.EMPIRE_ELECTRIC_MINUS) ? window.EMPIRE_ELECTRIC_MINUS : [];
    return raw.map(function (r) {
      return {
        id: 'seed-' + String(r.no || ''),
        no: String(r.no || ''),
        unit: r.unit || '',
        date: r.date || '',
        time: r.time || '',
        agent: r.agent || '',
        phone: r.phone || '',
        notes: r.notes || '',
        extra: false
      };
    });
  }

  function rows() {
    return seedRows().concat(extras);
  }

  function fmtDate(iso) {
    var s = String(iso || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return Number(s.slice(8, 10)) + '/' + Number(s.slice(5, 7)) + '/' + s.slice(0, 4);
  }

  function monthKey(iso) {
    var s = String(iso || '');
    return /^\d{4}-\d{2}/.test(s) ? s.slice(0, 7) : '';
  }

  function uniqueSorted(list) {
    var seen = {};
    var out = [];
    list.forEach(function (v) {
      var t = String(v || '').trim();
      if (!t) return;
      var k = t.toLowerCase();
      if (seen[k]) return;
      seen[k] = true;
      out.push(t);
    });
    out.sort(function (a, b) {
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });
    return out;
  }

  function phoneHtml(raw) {
    var s = String(raw || '').trim();
    if (!s) return '—';
    if (/^[+\d][\d\s()+.-]{6,}$/.test(s)) {
      return '<a class="em-phone" href="tel:' + esc(s.replace(/[^\d+]/g, '')) + '">' + esc(s) + '</a>';
    }
    return esc(s);
  }

  function canAdd() {
    var p = typeof PERMS === 'function' ? PERMS() : {};
    return p.add !== false;
  }

  function canDelete() {
    var p = typeof PERMS === 'function' ? PERMS() : {};
    return p.del !== false;
  }

  function fillFilters() {
    var monthEl = document.getElementById('em-month');
    var agentEl = document.getElementById('em-agent');
    var agentList = document.getElementById('em-agent-list');
    var all = rows();
    var months = uniqueSorted(all.map(function (r) { return monthKey(r.date); }));
    var agents = uniqueSorted(all.map(function (r) { return r.agent; }));
    if (monthEl) {
      var keepMonth = monthEl.value;
      monthEl.innerHTML = '<option value="">All months</option>' + months.map(function (m) {
        return '<option value="' + esc(m) + '">' + esc(m) + '</option>';
      }).join('');
      if (keepMonth) monthEl.value = keepMonth;
    }
    if (agentEl) {
      var keepAgent = agentEl.value;
      agentEl.innerHTML = '<option value="">All agents</option>' + agents.map(function (a) {
        return '<option value="' + esc(a) + '">' + esc(a) + '</option>';
      }).join('');
      if (keepAgent) agentEl.value = keepAgent;
    }
    if (agentList) {
      agentList.innerHTML = agents.map(function (a) {
        return '<option value="' + esc(a) + '">';
      }).join('');
    }
  }

  function filtered() {
    var monthEl = document.getElementById('em-month');
    var agentEl = document.getElementById('em-agent');
    var searchEl = document.getElementById('em-search');
    var month = monthEl ? String(monthEl.value || '') : '';
    var agent = agentEl ? String(agentEl.value || '').toLowerCase() : '';
    var q = searchEl ? String(searchEl.value || '').trim().toLowerCase() : '';
    return rows().filter(function (r) {
      if (month && monthKey(r.date) !== month) return false;
      if (agent && String(r.agent || '').toLowerCase() !== agent) return false;
      if (q) {
        var hay = [r.no, r.unit, r.date, fmtDate(r.date), r.time, r.agent, r.phone, r.notes]
          .join(' ')
          .toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function renderElectricMinus() {
    var host = document.getElementById('electricMinusTable');
    var summary = document.getElementById('electricMinusSummary');
    if (!host) return;
    var all = rows();
    var list = filtered().slice();
    list.sort(function (a, b) {
      var ad = String(a.date || '');
      var bd = String(b.date || '');
      if (ad !== bd) return bd.localeCompare(ad);
      return (Number(b.no) || 0) - (Number(a.no) || 0);
    });
    if (summary) {
      summary.textContent = list.length + ' record' + (list.length === 1 ? '' : 's')
        + (list.length !== all.length ? ' of ' + all.length : '');
    }
    var showDel = canDelete();
    var h = '<div class="em-table-wrap"><table><thead><tr>'
      + '<th>#</th><th>Unit</th><th>Date</th><th>Time</th><th>Agent</th><th>Phone</th><th>Notes</th>'
      + (showDel ? '<th></th>' : '')
      + '</tr></thead><tbody>';
    if (!list.length) {
      h += '<tr><td colspan="' + (showDel ? 8 : 7) + '">'
        + (typeof empireEmptyHtml === 'function'
          ? empireEmptyHtml('No Electric Minus records match', 'Try another month, agent, or search.')
          : 'No records match.')
        + '</td></tr>';
    } else {
      list.forEach(function (r) {
        var del = '';
        if (showDel && r.extra && r.id) {
          del = '<button type="button" class="act-btn" onclick="deleteElectricMinus(\'' + esc(r.id) + '\')" style="color:#fff;background:#C5504F;border-color:#C5504F;">Delete</button>';
        }
        h += '<tr class="job-row">'
          + '<td>' + esc(r.no) + '</td>'
          + '<td>' + esc(r.unit) + '</td>'
          + '<td>' + esc(fmtDate(r.date) || r.date || '—') + '</td>'
          + '<td>' + esc(r.time || '—') + '</td>'
          + '<td>' + esc(r.agent || '—') + '</td>'
          + '<td>' + phoneHtml(r.phone) + '</td>'
          + '<td class="em-notes">' + esc(r.notes || '—') + '</td>'
          + (showDel ? ('<td>' + (del || '') + '</td>') : '')
          + '</tr>';
      });
    }
    h += '</tbody></table></div>';
    host.innerHTML = h;
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  function nowTimeValue() {
    var d = new Date();
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function timeToSheet(hhmm) {
    var s = String(hhmm || '').trim();
    if (!s) return '';
    var p = s.split(':');
    var h = parseInt(p[0], 10);
    if (!Number.isFinite(h)) return s;
    var m = pad2(parseInt(p[1], 10) || 0);
    var ampm = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12;
    if (!h12) h12 = 12;
    return h12 + ':' + m + ampm;
  }

  function resetAddForm() {
    var unit = document.getElementById('em-add-unit');
    var date = document.getElementById('em-add-date');
    var time = document.getElementById('em-add-time');
    var agent = document.getElementById('em-add-agent');
    var phone = document.getElementById('em-add-phone');
    var notes = document.getElementById('em-add-notes');
    if (unit) unit.value = '';
    if (date) date.value = new Date().toISOString().slice(0, 10);
    if (time) time.value = nowTimeValue();
    if (agent) agent.value = '';
    if (phone) phone.value = '';
    if (notes) notes.value = '';
    if (unit) unit.focus();
  }

  function token() {
    return typeof tok === 'function' ? tok() : (typeof empireGetToken === 'function' ? empireGetToken() : '');
  }

  function loadElectricMinusExtras() {
    if (typeof fetchJSONRetry !== 'function') return;
    fetchJSONRetry({ action: 'getElectricalMinus', token: token() })
      .then(function (d) {
        if (Array.isArray(d)) {
          extras = d.map(function (r) {
            return {
              id: r.id || '',
              no: String(r.no || r.num || ''),
              unit: r.unit || '',
              date: r.date || '',
              time: r.time || '',
              agent: r.agent || '',
              phone: r.phone || '',
              notes: r.notes || '',
              extra: true
            };
          });
          fillFilters();
          renderElectricMinus();
        } else if (d && d.ok === false && typeof forceSessionLogout === 'function') {
          forceSessionLogout(d);
        }
      })
      .catch(function () {});
  }

  function saveElectricMinus() {
    if (!canAdd()) { alert('You do not have permission to add.'); return; }
    var unitEl = document.getElementById('em-add-unit');
    var dateEl = document.getElementById('em-add-date');
    var timeEl = document.getElementById('em-add-time');
    var agentEl = document.getElementById('em-add-agent');
    var phoneEl = document.getElementById('em-add-phone');
    var notesEl = document.getElementById('em-add-notes');
    var btn = document.getElementById('em-add-save');
    var unit = unitEl ? String(unitEl.value || '').trim() : '';
    if (!unit) { alert('Please enter a unit.'); if (unitEl) unitEl.focus(); return; }
    var rec = {
      action: 'addElectricalMinus',
      token: token(),
      unit: unit,
      date: dateEl ? dateEl.value : '',
      time: timeToSheet(timeEl ? timeEl.value : ''),
      agent: agentEl ? String(agentEl.value || '').trim() : '',
      phone: phoneEl ? String(phoneEl.value || '').trim() : '',
      notes: notesEl ? String(notesEl.value || '').trim() : ''
    };
    if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
    var post = typeof fetchJSONRetry === 'function'
      ? fetchJSONRetry(rec)
      : fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify(rec) }).then(function (r) { return r.json(); });
    post.then(function (d) {
      if (d && d.ok === false) {
        if (d.error === 'unauthorized' || d.error === 'invalid_token') {
          if (typeof forceSessionLogout === 'function') forceSessionLogout(d);
          return;
        }
        alert(d.message || d.error || 'Could not save.');
        return;
      }
      if (d && d.row) {
        extras.push({
          id: d.row.id || d.id || '',
          no: String(d.row.no || d.num || ''),
          unit: d.row.unit || rec.unit,
          date: d.row.date || rec.date,
          time: d.row.time || rec.time,
          agent: d.row.agent || rec.agent,
          phone: d.row.phone || rec.phone,
          notes: d.row.notes || rec.notes,
          extra: true
        });
      }
      fillFilters();
      var monthEl = document.getElementById('em-month');
      if (monthEl && rec.date) monthEl.value = String(rec.date).slice(0, 7);
      renderElectricMinus();
      resetAddForm();
    }).catch(function (e) {
      alert((e && e.message) || 'Could not save.');
    }).finally(function () {
      if (btn) { btn.disabled = false; btn.style.opacity = ''; }
    });
  }

  function deleteElectricMinus(id) {
    if (!canDelete()) { alert('You do not have permission to delete.'); return; }
    id = String(id || '').trim();
    if (!id) return;
    var go = function () {
      var rec = { action: 'deleteElectricalMinus', token: token(), id: id };
      var post = typeof fetchJSONRetry === 'function'
        ? fetchJSONRetry(rec)
        : fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify(rec) }).then(function (r) { return r.json(); });
      post.then(function (d) {
        if (d && d.ok === false) { alert(d.message || d.error || 'Could not delete.'); return; }
        extras = extras.filter(function (r) { return r.id !== id; });
        fillFilters();
        renderElectricMinus();
      }).catch(function (e) {
        alert((e && e.message) || 'Could not delete.');
      });
    };
    if (typeof uiConfirm === 'function') {
      uiConfirm('Delete this Electric Minus record?').then(function (ok) { if (ok) go(); });
    } else if (confirm('Delete this Electric Minus record?')) {
      go();
    }
  }

  function initElectricMinus() {
    resetAddForm();
    ['em-add-unit', 'em-add-date', 'em-add-time', 'em-add-agent', 'em-add-phone', 'em-add-notes'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); saveElectricMinus(); }
      });
    });
    fillFilters();
    if (typeof empireBindFilterPersistence === 'function') {
      empireBindFilterPersistence({
        key: 'eldept_minus_filters',
        fields: ['em-month', 'em-agent', 'em-search'],
        onApply: function () { renderElectricMinus(); }
      });
    }
    renderElectricMinus();
    loadElectricMinusExtras();
  }

  window.renderElectricMinus = renderElectricMinus;
  window.initElectricMinus = initElectricMinus;
  window.saveElectricMinus = saveElectricMinus;
  window.deleteElectricMinus = deleteElectricMinus;
})();
