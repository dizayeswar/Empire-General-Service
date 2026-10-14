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
  timeoutMs = timeoutMs || 45000;
  var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timer;
  var timedOut = false;
  options = options || {};
  if (ctrl) options.signal = ctrl.signal;
  var timeoutPromise = new Promise(function (_resolve, reject) {
    timer = setTimeout(function () {
      timedOut = true;
      try {
        if (ctrl) ctrl.abort();
      } catch (e) {}
      var err = new Error('The server took too long. Check the connection and try again.');
      err.name = 'AbortError';
      reject(err);
    }, timeoutMs);
  });
  var req = fetch(url, options).then(function (r) {
    if (timedOut) {
      var err = new Error('The server took too long. Check the connection and try again.');
      err.name = 'AbortError';
      throw err;
    }
    return r;
  });
  return Promise.race([req, timeoutPromise]).finally(function () {
    if (timer) clearTimeout(timer);
  });
}

function fetchJSONRetry(body, tries, timeoutMs, opts) {
  tries = tries || 2;
  timeoutMs = timeoutMs || 45000;
  opts = opts || {};
  var apiUrl = (typeof EMPIRE_API_ENDPOINT !== 'undefined' && EMPIRE_API_ENDPOINT)
    ? EMPIRE_API_ENDPOINT
    : GOOGLE_SCRIPT_URL;
  return fetchWithTimeout(apiUrl, { method: 'POST', body: JSON.stringify(body) }, timeoutMs)
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    })
    .then(function (text) {
      var data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Invalid server response. Refresh and try again.');
      }
      if (!opts.skipAuthLogout && typeof empireAuthHandleInvalidSession_ === 'function') {
        var page = '';
        try { page = String(location.pathname || '').split('/').pop() || ''; } catch (e2) {}
        empireAuthHandleInvalidSession_(data, { redirect: page || 'index.html' });
      }
      return data;
    })
    .catch(function (e) {
      if (e && e.name === 'AbortError') {
        throw new Error('The server took too long. Check the connection and try again.');
      }
      if (tries > 1) {
        return new Promise(function (res) {
          setTimeout(res, 400);
        }).then(function () {
          return fetchJSONRetry(body, tries - 1, timeoutMs, opts);
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
    20000,
    { skipAuthLogout: true }
  );
}

/** Login with retry. opts: { username, password, dept, messageEl } */
function empireLogin(opts) {
  opts = opts || {};
  var msgEl = opts.messageEl;
  var started = Date.now();
  var slowTimer;
  empireShowLoginMessage(msgEl, 'Signing in…', false);
  if (msgEl) {
    slowTimer = setInterval(function () {
      if (Date.now() - started < 8000) return;
      empireShowLoginMessage(msgEl, 'Still signing in… a slow connection can take a few more seconds.', false);
    }, 8000);
  }
  return fetchJSONRetry(
    { action: 'verifyLogin', username: opts.username, password: opts.password, dept: opts.dept },
    2,
    40000,
    { skipAuthLogout: true }
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
