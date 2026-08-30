/* Empire Electrical Department — standalone Electric Minus log (not linked to jobs). */
(function () {
  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function rows() {
    return Array.isArray(window.EMPIRE_ELECTRIC_MINUS) ? window.EMPIRE_ELECTRIC_MINUS : [];
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

  function fillFilters() {
    var monthEl = document.getElementById('em-month');
    var agentEl = document.getElementById('em-agent');
    if (!monthEl || !agentEl) return;
    var all = rows();
    var months = uniqueSorted(all.map(function (r) { return monthKey(r.date); }));
    var agents = uniqueSorted(all.map(function (r) { return r.agent; }));
    var keepMonth = monthEl.value;
    var keepAgent = agentEl.value;
    monthEl.innerHTML = '<option value="">All months</option>' + months.map(function (m) {
      return '<option value="' + esc(m) + '">' + esc(m) + '</option>';
    }).join('');
    agentEl.innerHTML = '<option value="">All agents</option>' + agents.map(function (a) {
      return '<option value="' + esc(a) + '">' + esc(a) + '</option>';
    }).join('');
    if (keepMonth) monthEl.value = keepMonth;
    if (keepAgent) agentEl.value = keepAgent;
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
    var list = filtered();
    if (summary) {
      summary.textContent = list.length + ' record' + (list.length === 1 ? '' : 's')
        + (list.length !== all.length ? ' of ' + all.length : '');
    }
    var h = '<div class="em-table-wrap"><table><thead><tr>'
      + '<th>#</th><th>Unit</th><th>Date</th><th>Time</th><th>Agent</th><th>Phone</th><th>Notes</th>'
      + '</tr></thead><tbody>';
    if (!list.length) {
      h += '<tr><td colspan="7">'
        + (typeof empireEmptyHtml === 'function'
          ? empireEmptyHtml('No Electric Minus records match', 'Try another month, agent, or search.')
          : 'No records match.')
        + '</td></tr>';
    } else {
      list.forEach(function (r) {
        h += '<tr class="job-row">'
          + '<td>' + esc(r.no) + '</td>'
          + '<td>' + esc(r.unit) + '</td>'
          + '<td>' + esc(fmtDate(r.date) || r.date || '—') + '</td>'
          + '<td>' + esc(r.time || '—') + '</td>'
          + '<td>' + esc(r.agent || '—') + '</td>'
          + '<td>' + phoneHtml(r.phone) + '</td>'
          + '<td class="em-notes">' + esc(r.notes || '—') + '</td>'
          + '</tr>';
      });
    }
    h += '</tbody></table></div>';
    host.innerHTML = h;
  }

  function initElectricMinus() {
    fillFilters();
    if (typeof empireBindFilterPersistence === 'function') {
      empireBindFilterPersistence({
        key: 'eldept_minus_filters',
        fields: ['em-month', 'em-agent', 'em-search'],
        onApply: function () { renderElectricMinus(); }
      });
    }
    renderElectricMinus();
  }

  window.renderElectricMinus = renderElectricMinus;
  window.initElectricMinus = initElectricMinus;
})();
