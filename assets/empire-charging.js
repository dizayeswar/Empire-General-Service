/* Charging Electricity — department desk (no live charging yet) */

var CHG_DEPT = 'charging';

function chgSwitchTab_(event, tab) {
  if (event && event.preventDefault) event.preventDefault();
  document.querySelectorAll('.tab-content').forEach(function (el) {
    el.classList.toggle('active', el.id === tab);
  });
  document.querySelectorAll('.side-nav .tab-btn').forEach(function (btn) {
    btn.classList.remove('active');
  });
  if (event && event.currentTarget) event.currentTarget.classList.add('active');
}

function chgEnterApp_() {
  var loginPage = document.getElementById('loginPage');
  var main = document.getElementById('mainContainer');
  if (loginPage) loginPage.classList.remove('show');
  if (main) main.classList.add('show');
  if (typeof empireAuthMarkLoginVisible === 'function') empireAuthMarkLoginVisible(false);
  var who = document.getElementById('whoLabel');
  if (who) who.textContent = 'Logged in as: ' + (empireGetUser() || '');
}

function chgHandleLogin_(e) {
  empireAuthLogin(e, CHG_DEPT, {
    onSuccess: function () {
      chgEnterApp_();
    }
  });
}

function chgLogout_() {
  empireAuthLogout({ redirect: 'index.html', reload: false });
}

function chgInit_() {
  if (!empireAuthPageBoot({
    dept: CHG_DEPT,
    sendToHomeLogin: false,
    onEnter: chgEnterApp_
  })) return;
}

document.addEventListener('DOMContentLoaded', chgInit_);
