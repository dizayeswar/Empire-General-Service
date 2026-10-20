/* A.S.A.A.S Leave Request — fill on screen, print on A4. No saving yet. */
(function () {
  var TW = 56.6929; // twips per mm
  function mm(tw) { return (tw / TW).toFixed(2) + 'mm'; }
  function f(cls) { return '<div class="alv-f' + (cls ? ' ' + cls : '') + '" contenteditable="true"></div>'; }
  function date(id) {
    return '<div class="alv-f" id="' + id + '" contenteditable="true" data-ph="Click or tap to enter a date."></div>';
  }
  var LEAVE_TYPES = ['Annual leave', 'Sick Leave', 'Unpaid Leave', 'Bereavement Leave', 'Marriage leave', 'Other Leave'];

  // One block = label row + bordered table. Tops and row heights in mm, measured from Word's PDF.
  function block(topMm, label, labelMm, gridTw, rows, labelDropMm) {
    var width = gridTw.reduce(function (a, b) { return a + b; }, 0);
    var cols = gridTw.map(function (w) { return '<col style="width:' + mm(w) + '">'; }).join('');
    var body = rows.map(function (r) {
      return '<tr style="height:' + r.h + 'mm">' + r.cells.map(function (c) {
        return '<td' + (c.span ? ' colspan="' + c.span + '"' : '') + (c.cls ? ' class="' + c.cls + '"' : '') + '>' + (c.html || '') + '</td>';
      }).join('') + '</tr>';
    }).join('');
    return '<div class="alv-block" style="top:' + topMm + 'mm;width:' + mm(width) + '">' +
      '<div class="alv-label" style="height:' + labelMm + 'mm' + (labelDropMm ? ';transform:translateY(' + labelDropMm + 'mm)' : '') + '">' + label + '</div>' +
      '<table class="alv-t" style="width:' + mm(width) + '"><colgroup>' + cols + '</colgroup>' + body + '</table></div>';
  }
  function C(html, extra) { var o = { html: html }; for (var k in extra) o[k] = extra[k]; return o; }

  function sheetHtml() {
    var typeSel = '<select class="alv-sel" id="asaasLeaveType">' +
      LEAVE_TYPES.map(function (t) { return '<option>' + t + '</option>'; }).join('') + '</select>';
    var ent = ['Annual Leave', 'Sick leave', 'Unpaid Leave', 'Bereavement', 'Marriage Leave', 'Other'];
    var entRows = [{ h: 7.43, cells: ['Type of Leave', 'Annual Balance', 'Available balance', 'Days requested', 'Remaining Balance'].map(function (t) { return C(t, { cls: 'c' }); }) }]
      .concat(ent.map(function (t) { return { h: 7.43, cells: [C(t), C(f()), C(f()), C(f()), C(f())] }; }));

    return '' +
      '<img class="alv-logo" src="assets/asaas-logo.png" alt="A.S.A.A.S">' +
      '<div class="alv-title">Leave Request</div>' +
      block(40.64, 'Employees’ Detail:', 9.56, [2396, 2644, 2520, 2429], [
        { h: 7.87, cells: [C('Name'), C(f()), C('Ref. No.'), C(f())] },
        { h: 7.87, cells: [C('Code'), C(f()), C('Department'), C(f())] },
        { h: 7.87, cells: [C('Job Title'), C(f()), C('Replacement'), C(f())] }
      ]) +
      block(77.95, 'Absence Detail:', 8.49, [3420, 3060, 3510], [
        { h: 6.53, cells: [C('Start Date', { cls: 'c' }), C('End Date', { cls: 'c' }), C('Number of days out of the office', { cls: 'c' })] },
        { h: 6.53, cells: [C(date('asaasLeaveStart'), { cls: 'c' }), C(date('asaasLeaveEnd'), { cls: 'c' }), C('<div class="alv-f" id="asaasLeaveDays" contenteditable="true"></div>', { cls: 'c' })] },
        { h: 6.53, cells: [C('Type of Leave'), C(typeSel, { span: 2 })] },
        { h: 10.55, cells: [C('Employee Signature'), C('', { span: 2 })] }
      ]) +
      block(120.9, 'Approvals:', 8.01, [1710, 3240, 1620, 3420], [
        { h: 11.58, cells: [C('Line Manager', { cls: 'c' }), C(''), C('Director', { cls: 'c' }), C('')] }
      ]) +
      block(146.57, 'Leave Entitlement Detail:', 8.78, [1637, 1983, 2173, 1901, 2260], entRows) +
      block(219.93, 'Human Resources Dept. Comment:', 8.78, [4950, 5040], [
        { h: 23.17, cells: [C(f('alv-comment'), { span: 2, cls: 'top' })] },
        { h: 9.06, cells: [C('Signature'), C('Date', { cls: 'solid-l' })] }
      ], -2.4);
  }

  function fit() {
    var stage = document.getElementById('asaasLeaveStage');
    var scaleEl = document.getElementById('asaasLeaveScale');
    if (!stage || !scaleEl || !stage.offsetParent) return;
    var sheet = scaleEl.firstElementChild;
    var s = Math.min(1, stage.clientWidth / sheet.offsetWidth);
    scaleEl.style.transform = 'scale(' + s + ')';
    stage.style.height = (sheet.offsetHeight * s) + 'px';
  }
  window.asaasLeaveFit_ = fit;

  window.asaasLeavePrint_ = function () {
    if (document.activeElement) document.activeElement.blur();
    document.body.classList.add('alv-printing');
    window.print();
  };
  window.addEventListener('afterprint', function () { document.body.classList.remove('alv-printing'); });

  window.asaasLeaveClear_ = function () {
    if (!confirm('Clear everything on this form?')) return;
    render();
  };

  function render() {
    var sheet = document.getElementById('asaasLeaveSheet');
    if (!sheet) return;
    sheet.innerHTML = sheetHtml();
    fit();
  }

  window.addEventListener('resize', fit);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();
