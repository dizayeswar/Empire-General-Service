/* Empire World EGS - shared API helpers (Phase 2) */

const LOADING_HTML =
  '<div class="load-wrap"><div class="load-ring"></div><p>Loading requests, please wait.</p></div>';

function fetchJSONRetry(body, tries) {
  tries = tries || 2;
  return fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: JSON.stringify(body) })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .catch(function (e) {
      if (tries > 1) {
        return new Promise(function (res) {
          setTimeout(res, 400);
        }).then(function () {
          return fetchJSONRetry(body, tries - 1);
        });
      }
      throw e;
    });
}

/** Login with retry. opts: { username, password, dept, messageEl } */
function empireLogin(opts) {
  opts = opts || {};
  var msgEl = opts.messageEl;
  if (msgEl) {
    msgEl.className = 'login-message';
    msgEl.style.display = 'block';
    msgEl.textContent = '⏳ Signing in…';
  }
  return fetchJSONRetry(
    { action: 'verifyLogin', username: opts.username, password: opts.password, dept: opts.dept },
    2
  )
    .then(function (d) {
      if (d && d.success) return d;
      var err = new Error((d && d.message) || 'Login failed');
      err.loginResponse = d;
      throw err;
    })
    .catch(function (err) {
      if (msgEl) {
        msgEl.className = 'login-message error';
        msgEl.textContent = '❌ ' + err.message;
      }
      throw err;
    });
}
