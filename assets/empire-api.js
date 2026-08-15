/* Empire World EGS - shared API helpers (Phase 2) */

const LOADING_HTML =
  '<div class="load-wrap empire-state"><div class="load-ring"></div><p>Loading… please wait.</p></div>';

function empireEscHtml_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function empireLoadingHtml(msg) {
  return '<div class="load-wrap empire-state"><div class="load-ring"></div><p>' +
    empireEscHtml_(msg || 'Loading… please wait.') + '</p></div>';
}

function empireEmptyHtml(title, hint) {
  var h = '<div class="empire-state empire-empty">';
  h += '<p class="empire-empty-title">' + empireEscHtml_(title || 'Nothing here yet') + '</p>';
  if (hint) h += '<p class="empire-empty-hint">' + empireEscHtml_(hint) + '</p>';
  h += '</div>';
  return h;
}

function empireErrorHtml(msg, retryLabel) {
  var h = '<div class="empire-state empire-error">';
  h += '<p class="empire-error-title">Couldn’t load</p>';
  h += '<p class="empire-error-hint">' + empireEscHtml_(msg || 'Check your connection and try again.') + '</p>';
  if (retryLabel) {
    h += '<p class="empire-error-hint">' + empireEscHtml_(retryLabel) + '</p>';
  }
  h += '</div>';
  return h;
}

function fetchWithTimeout(url, options, timeoutMs) {
  timeoutMs = timeoutMs || 90000;
  var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timer;
  options = options || {};
  if (ctrl) {
    options.signal = ctrl.signal;
    timer = setTimeout(function () {
      try {
        ctrl.abort();
      } catch (e) {}
    }, timeoutMs);
  }
  return fetch(url, options).finally(function () {
    if (timer) clearTimeout(timer);
  });
}

function fetchJSONRetry(body, tries, timeoutMs) {
  tries = tries || 2;
  timeoutMs = timeoutMs || 90000;
  var apiUrl = (typeof EMPIRE_API_ENDPOINT !== 'undefined' && EMPIRE_API_ENDPOINT)
    ? EMPIRE_API_ENDPOINT
    : GOOGLE_SCRIPT_URL;
  return fetchWithTimeout(apiUrl, { method: 'POST', body: JSON.stringify(body) }, timeoutMs)
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    })
    .then(function (text) {
      try {
        return JSON.parse(text);
      } catch (e) {
        throw new Error('Invalid server response. Refresh and try again. If it keeps failing, redeploy empire-api.');
      }
    })
    .catch(function (e) {
      if (e && e.name === 'AbortError') {
        throw new Error('Server timed out (timeout). Google Apps Script can be slow — wait a moment and try again.');
      }
      if (tries > 1) {
        return new Promise(function (res) {
          setTimeout(res, 400);
        }).then(function () {
          return fetchJSONRetry(body, tries - 1, timeoutMs);
        });
      }
      throw e;
    });
}

function empireShowLoginMessage(msgEl, text, isError) {
  if (!msgEl) return;
  msgEl.classList.remove('error');
  if (isError) msgEl.classList.add('error');
  msgEl.style.display = 'block';
  msgEl.textContent = text;
}

/** Verify password without creating a session (mobile logout confirm). */
function empireVerifyPassword(username, password) {
  return fetchJSONRetry(
    { action: 'verifyPassword', username: username, password: password },
    1,
    30000
  );
}

/** Login with retry. opts: { username, password, dept, messageEl } */
function empireLogin(opts) {
  opts = opts || {};
  var msgEl = opts.messageEl;
  var started = Date.now();
  var slowTimer;
  empireShowLoginMessage(msgEl, '⏳ Signing in…', false);
  if (msgEl) {
    slowTimer = setInterval(function () {
      if (Date.now() - started < 12000) return;
      empireShowLoginMessage(msgEl, '⏳ Still signing in… Google server can take 20–60 seconds.', false);
    }, 12000);
  }
  return fetchJSONRetry(
    { action: 'verifyLogin', username: opts.username, password: opts.password, dept: opts.dept },
    2,
    90000
  )
    .then(function (d) {
      if (d && d.success) return d;
      var err = new Error((d && d.message) || 'Login failed');
      err.loginResponse = d;
      throw err;
    })
    .catch(function (err) {
      empireShowLoginMessage(msgEl, '❌ ' + err.message, true);
      throw err;
    })
    .finally(function () {
      if (slowTimer) clearInterval(slowTimer);
    });
}
