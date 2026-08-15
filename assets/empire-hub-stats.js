/* Empire World EGS — hub tile summary helpers (Phase 5A) */

function formatHubActivity(iso) {
  if (!iso) return '';
  var d = new Date(String(iso).replace(' ', 'T'));
  if (isNaN(d.getTime())) return 'Last activity: ' + iso;
  return 'Last activity: ' + d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function hubSummaryBadgeHtml(stat) {
  if (!stat || !stat.open || stat.open <= 0) return '';
  var cls = stat.level === 'alert' ? 'tile-badge alert' : 'tile-badge warn';
  return '<span class="' + cls + '">' + stat.open + ' open</span>';
}

function hubSummaryFooterHtml(stat) {
  if (!stat) return '<div class="tile-stat muted">Loading stats…</div>';
  var level = stat.level || 'muted';
  var label = stat.label || '';
  var activity = formatHubActivity(stat.lastActivity);
  return '<div class="tile-stat ' + level + '">' + label + '</div>' +
    (activity ? '<div class="tile-activity">' + activity + '</div>' : '');
}

function applyHubTileStats(selector, statsMap) {
  statsMap = statsMap || {};
  document.querySelectorAll(selector).forEach(function (el) {
    var key = el.getAttribute('data-dept');
    var stat = statsMap[key];
    var badge = el.querySelector('.tile-badge-slot');
    var footer = el.querySelector('.tile-footer');
    if (badge) badge.innerHTML = hubSummaryBadgeHtml(stat);
    if (footer) footer.innerHTML = hubSummaryFooterHtml(stat);
  });
}

function loadHubSummary(opts) {
  opts = opts || {};
  var tk = empireGetToken();
  if (!tk) return;
  var cacheKey = 'empire_hub_summary_v1';
  try {
    var cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      var parsed = JSON.parse(cached);
      if (parsed && parsed.at && (Date.now() - parsed.at) < 120000 && parsed.summary) {
        if (typeof opts.onData === 'function') opts.onData(parsed.summary);
      }
    }
  } catch (e) {}
  return fetchJSONRetry({ action: 'getSummary', token: tk }, 2, 45000)
    .then(function (d) {
      if (d && d.ok && d.summary && typeof opts.onData === 'function') {
        try { sessionStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), summary: d.summary })); } catch (e2) {}
        opts.onData(d.summary);
      }
    })
    .catch(function () {
      if (typeof opts.onError === 'function') opts.onError();
    });
}

function hubTileHtml(c) {
  return '<div class="tile-top">' +
    '<div class="tile-icon-wrap"><span class="tile-icon">' + c.icon + '</span></div>' +
    '<div class="tile-top-right">' +
      '<span class="tile-badge-slot"></span>' +
      '<span class="tile-arrow" aria-hidden="true">→</span>' +
    '</div>' +
    '</div>' +
    '<h2>' + c.name + '</h2>' +
    '<p>' + c.desc + '</p>' +
    '<div class="tile-footer"><div class="tile-stat muted">Loading stats…</div></div>';
}

function hubExpandableTileHeadHtml(c) {
  return '<div class="tile-top">' +
    '<div class="tile-icon-wrap"><span class="tile-icon">' + c.icon + '</span></div>' +
    '<div class="tile-top-right">' +
      '<span class="tile-badge-slot"></span>' +
      '<span class="tile-expand-chevron" aria-hidden="true">▾</span>' +
    '</div>' +
    '</div>' +
    '<h2>' + c.name + '</h2>' +
    '<p>' + c.desc + '</p>' +
    '<div class="tile-footer"><div class="tile-stat muted">Loading stats…</div></div>';
}

function hubChildTileHtml(c) {
  return '<div class="tile-child-top">' +
    '<span class="tile-child-icon">' + c.icon + '</span>' +
    '<span class="tile-badge-slot"></span>' +
    '<span class="tile-child-arrow" aria-hidden="true">→</span>' +
    '</div>' +
    '<strong class="tile-child-name">' + c.name + '</strong>' +
    '<p class="tile-child-desc">' + c.desc + '</p>' +
    '<div class="tile-footer"><div class="tile-stat muted">Loading stats…</div></div>';
}
