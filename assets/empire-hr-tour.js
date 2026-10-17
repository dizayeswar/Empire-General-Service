/* Phone tour for line managers and directors.
   Highlights existing buttons only. Never calls confirm or changes the paper. */
(function () {
  var STEP_MS = 6000;
  var _open = false;
  var _offer = false;
  var _index = 0;
  var _steps = [];
  var _timer = null;
  var _hold = false;
  var _keptSelect = false;
  var _offered = false;

  function t(key, fallback, params) {
    if (typeof hrFieldT === 'function') return hrFieldT(key, fallback, params);
    if (typeof fallback === 'function') return fallback(params || {});
    return fallback;
  }

  function directorTrack() {
    return typeof hrIsDirectorOnly_ === 'function' && hrIsDirectorOnly_();
  }

  function lineTrack() {
    return typeof hrIsLine_ === 'function' && hrIsLine_() && !directorTrack();
  }

  function audience() {
    return false;
  }

  function storageKey() {
    return directorTrack() ? 'empire_hr_tour_director_v1' : 'empire_hr_tour_line_v1';
  }

  function seen() {
    try { return localStorage.getItem(storageKey()) === '1'; } catch (e) { return false; }
  }

  function markSeen() {
    try { localStorage.setItem(storageKey(), '1'); } catch (e) {}
  }

  function root() { return document.getElementById('hrTour'); }
  function card() { return document.getElementById('hrTourCard'); }
  function hole() { return document.getElementById('hrTourHole'); }

  function clearTimer() {
    if (_timer) clearTimeout(_timer);
    _timer = null;
  }

  function armTimer() {
    clearTimer();
    if (!_open || _offer || _hold) return;
    _timer = setTimeout(function () { go(1); }, STEP_MS);
  }

  function visible(el) {
    if (!el || el.hidden) return false;
    var st = window.getComputedStyle(el);
    return st.display !== 'none' && st.visibility !== 'hidden';
  }

  function resolve(selectors) {
    var i;
    for (i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (visible(el)) return el;
    }
    return null;
  }

  function inDock(el) {
    return !!(el && el.closest && el.closest('.hr-mobile-dock'));
  }

  function syncSelect(step) {
    if (typeof hrToggleSelectMode_ !== 'function') return;
    var want = !!(step && step.selectMode);
    var can = !!(document.getElementById('hrListSelectBtn') || document.getElementById('hrListConfirmBtn'));
    if (want && can && !_hrSelectMode) hrToggleSelectMode_(true);
    if (!want && _hrSelectMode && !_keptSelect) hrToggleSelectMode_(false);
  }

  function stepsForRole() {
    if (directorTrack()) {
      return [
        { title: 'tourDirListTitle', titleFb: 'Leave requests', body: 'tourDirListBody', bodyFb: 'A paper appears here after the line manager signs. If there is no line manager, it comes here from HR.', targets: ['#tabBtnList'] },
        { title: 'tourDirSelectTitle', titleFb: 'Select', body: 'tourDirSelectBody', bodyFb: 'Tap Select, then tick the papers waiting for you.', targets: ['#hrListSelectBtn', '#hrListEmpty', '#tabBtnList'] },
        { title: 'tourDirConfirmTitle', titleFb: 'Confirm selected', body: 'tourDirConfirmBody', bodyFb: 'Confirm selected places your e-signature in the Director box only. This tour does not press it.', targets: ['#hrListConfirmBtn', '#hrListSelectBtn', '#hrListEmpty', '#tabBtnList'], selectMode: true },
        { title: 'tourDirDoneTitle', titleFb: 'Director confirmed', body: 'tourDirDoneBody', bodyFb: 'After you confirm, the paper returns to HR as a completed request and is listed here. Once it has left your inbox, the stamp cannot be moved.', targets: ['#tabBtnConfirmed'] }
      ];
    }
    var steps = [
      { title: 'tourLineListTitle', titleFb: 'Leave requests', body: 'tourLineListBody', bodyFb: 'Papers HR assigned to you appear here.', targets: ['#tabBtnList'] },
      { title: 'tourLineSelectTitle', titleFb: 'Select', body: 'tourLineSelectBody', bodyFb: 'Tap Select, then tick the papers you will sign.', targets: ['#hrListSelectBtn', '#hrListEmpty', '#tabBtnList'] },
      { title: 'tourLineConfirmTitle', titleFb: 'Confirm selected', body: 'tourLineConfirmBody', bodyFb: 'Confirm selected places your e-signature in the Line Manager box only, then sends the paper to the director. This tour does not press it.', targets: ['#hrListConfirmBtn', '#hrListSelectBtn', '#hrListEmpty', '#tabBtnList'], selectMode: true }
    ];
    if (typeof hrDualEmpLine_ === 'function' && hrDualEmpLine_()) {
      steps.push({ title: 'tourLineBoxTitle', titleFb: 'Which box?', body: 'tourLineBoxBody', bodyFb: 'If your account is also an employee, choose the Line Manager box only. The stamp goes in that box and nowhere else.', targets: ['#list .hr-tab-help', '#tabBtnList'] });
    }
    steps.push(
      { title: 'tourLineArchiveTitle', titleFb: 'Archive', body: 'tourLineArchiveBody', bodyFb: 'After you confirm, the paper is kept here. Pending means the director has not signed yet.', targets: ['#tabBtnSigned'] },
      { title: 'tourLineTeamTitle', titleFb: 'My employees', body: 'tourLineTeamBody', bodyFb: 'People assigned to you as line manager are listed here.', targets: ['#tabBtnTeam'] }
    );
    return steps;
  }

  function placeCard(target) {
    var box = card();
    if (!box) return;
    box.style.top = '12px';
    box.style.bottom = 'auto';
    if (!target) return;
    var cr = box.getBoundingClientRect();
    var tr = target.getBoundingClientRect();
    var overlaps = !(cr.bottom < tr.top || cr.top > tr.bottom || cr.right < tr.left || cr.left > tr.right);
    if (!overlaps) return;
    var belowTop = window.innerHeight - tr.bottom;
    if (belowTop > cr.height + 24) {
      box.style.top = Math.min(window.innerHeight - cr.height - 12, tr.bottom + 12) + 'px';
      return;
    }
    box.style.top = 'auto';
    box.style.bottom = 'calc(116px + env(safe-area-inset-bottom))';
  }

  function spotlight(target) {
    var el = hole();
    var host = root();
    if (!el || !host) return;
    if (!target) {
      el.hidden = true;
      host.classList.remove('has-hole');
      return;
    }
    var r = target.getBoundingClientRect();
    var pad = 6;
    el.hidden = false;
    host.classList.add('has-hole');
    el.style.left = Math.max(4, r.left - pad) + 'px';
    el.style.top = Math.max(4, r.top - pad) + 'px';
    el.style.width = Math.max(24, r.width + pad * 2) + 'px';
    el.style.height = Math.max(24, r.height + pad * 2) + 'px';
  }

  function paint() {
    var host = root();
    if (!host) return;
    host.hidden = false;
    var kicker = document.getElementById('hrTourKicker');
    var title = document.getElementById('hrTourTitle');
    var body = document.getElementById('hrTourBody');
    var back = document.getElementById('hrTourBack');
    var next = document.getElementById('hrTourNext');
    var close = document.getElementById('hrTourClose');
    var step = _offer ? null : _steps[_index];
    if (_offer) {
      if (kicker) {
        kicker.textContent = '';
        kicker.hidden = true;
      }
      if (title) title.textContent = t('tourOfferTitle', 'Phone tour');
      if (body) body.textContent = t('tourOfferBody', 'A short tour of how to approve a leave paper on this phone. Watching it does not sign anything.');
      if (back) back.hidden = true;
      if (close) close.textContent = t('tourNotNow', 'Not now');
      if (next) next.textContent = t('tourStart', 'Start');
      spotlight(null);
      placeCard(null);
      if (next) next.focus();
      return;
    }
    syncSelect(step);
    var target = resolve(step.targets || []);
    if (target && !inDock(target)) {
      try { target.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {}
    }
    if (kicker) {
      kicker.hidden = false;
      kicker.textContent = t('tourStep', 'Step ' + (_index + 1) + ' of ' + _steps.length, { i: _index + 1, n: _steps.length });
    }
    if (title) title.textContent = t(step.title, step.titleFb);
    if (body) body.textContent = t(step.body, step.bodyFb);
    if (back) {
      back.hidden = _index === 0;
      back.textContent = t('tourBack', 'Back');
    }
    if (close) close.textContent = t('tourClose', 'Close');
    if (next) next.textContent = _index === _steps.length - 1 ? t('tourDone', 'Done') : t('tourNext', 'Next');
    requestAnimationFrame(function () {
      target = resolve(step.targets || []);
      spotlight(target);
      placeCard(target);
    });
    if (next) next.focus();
    armTimer();
  }

  function go(delta) {
    if (_offer) {
      if (delta > 0) begin(false);
      else finish(true);
      return;
    }
    var next = _index + delta;
    if (next < 0) return;
    if (next >= _steps.length) {
      finish(true);
      return;
    }
    _index = next;
    _hold = false;
    paint();
  }

  function begin(asOffer) {
    if (!audience()) return;
    _steps = stepsForRole();
    if (!_steps.length) return;
    _open = true;
    _offer = !!asOffer;
    _index = 0;
    _hold = false;
    _keptSelect = !!_hrSelectMode;
    if (!asOffer) markSeen();
    document.body.classList.add('hr-tour-open');
    paint();
  }

  function finish(remember) {
    if (!_open) return;
    clearTimer();
    _open = false;
    _offer = false;
    _hold = false;
    syncSelect(null);
    var host = root();
    if (host) {
      host.hidden = true;
      host.classList.remove('has-hole');
    }
    var el = hole();
    if (el) el.hidden = true;
    document.body.classList.remove('hr-tour-open');
    if (remember) markSeen();
  }

  function onCardPointer(ev) {
    if (!_open || _offer) return;
    var box = card();
    if (!box || !box.contains(ev.target)) return;
    if (ev.target && ev.target.closest && ev.target.closest('#hrTourNext, #hrTourBack, #hrTourClose')) return;
    _hold = true;
    clearTimer();
  }

  function onKey(ev) {
    if (!_open) return;
    if (ev.key === 'Escape') {
      ev.preventDefault();
      finish(true);
    }
  }

  function onReflow() {
    if (!_open || _offer) return;
    var step = _steps[_index];
    if (!step) return;
    var target = resolve(step.targets || []);
    spotlight(target);
    placeCard(target);
  }

  window.hrTourSyncButtons_ = function () {
    var on = audience();
    ['hrTourDockBtn', 'hrTourSettingsBtn'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.hidden = !on;
    });
  };

  window.hrTourMaybeOffer_ = function () {
    if (_open || _offered || !audience() || seen()) return;
    var list = document.getElementById('list');
    if (!list || !list.classList.contains('active')) return;
    _offered = true;
    begin(true);
  };

  window.hrTourStart_ = function () {
    if (!audience()) return;
    _offered = true;
    if (_open && !_offer) finish(false);
    begin(false);
  };

  window.hrTourRefresh_ = function () {
    if (_open) paint();
  };

  function bind() {
    var back = document.getElementById('hrTourBack');
    var next = document.getElementById('hrTourNext');
    var close = document.getElementById('hrTourClose');
    var box = card();
    if (back) back.addEventListener('click', function () { go(-1); });
    if (next) next.addEventListener('click', function () { go(1); });
    if (close) close.addEventListener('click', function () { finish(true); });
    if (box) box.addEventListener('pointerdown', onCardPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    window.hrTourSyncButtons_();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
