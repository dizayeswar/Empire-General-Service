/** A.S.A.A.S — Excel export */
function asaasDownloadExcel() {
  var rows = (typeof _asaasItems !== 'undefined' ? _asaasItems : []).slice();
  if (!rows.length) { alert('No items to export.'); return; }
  var aoa = [['Reference','Date','Building','Floor','Spot','Item','Apartment','Status','Warehouse note','Logged by','Days in warehouse','Returned to','Return apartment','Returned at']];
  rows.forEach(function (r) {
    aoa.push([
      asaasRef_(r.num),
      r.date || '',
      r.building || '',
      r.floor || '',
      r.spot || '',
      r.itemDescription || '',
      r.apartment || '',
      r.status === 'returned' ? 'Returned' : 'In warehouse',
      r.warehouseNote || '',
      r.removedByName || r.removedBy || '',
      r.status !== 'returned' ? asaasDaysSince_(r.createdAt || r.date) : '',
      r.returnedTo || '',
      r.returnApartment || '',
      r.returnedAt || ''
    ]);
  });
  var load = typeof loadXlsxLib === 'function' ? loadXlsxLib() : Promise.resolve(window.XLSX);
  load.then(function (XLSX) {
    if (!XLSX) { alert('Excel library not loaded.'); return; }
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ASAAS Items');
    XLSX.writeFile(wb, 'Empire-ASAAS-Items-' + new Date().toISOString().slice(0, 10) + '.xlsx');
  }).catch(function (e) {
    alert(String((e && e.message) || e || 'Could not load Excel library.'));
  });
}

function asaasDownloadReport() {
  var rows = (typeof _asaasItems !== 'undefined' ? _asaasItems : []).slice();
  var warehouse = rows.filter(function (r) { return r.status !== 'returned'; });
  var returned = rows.filter(function (r) { return r.status === 'returned'; });
  var logo = '';
  var le = document.querySelector('img.worker-logo, img.sidebar-logo, img[alt="Empire World"]');
  if (le) logo = le.src;
  var gen = new Date().toLocaleString('en-GB');
  var cards = function (list) {
    return list.map(function (r) {
      return '<div style="border:1px solid #ddd;border-radius:10px;padding:12px;margin-bottom:12px;display:flex;gap:12px;">'
        + (r.photo ? ('<img src="' + r.photo + '" style="width:90px;height:90px;object-fit:cover;border-radius:8px;">') : '')
        + '<div><strong>' + asaasRef_(r.num) + '</strong> — ' + (r.itemDescription || '') + '<br>'
        + asaasLocStr_(r) + '<br>Status: ' + (r.status === 'returned' ? 'Returned' : 'In warehouse')
        + (r.apartment ? (' · Apt ' + r.apartment) : '') + '</div></div>';
    }).join('') || '<p>No items.</p>';
  };
  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>A.S.A.A.S Report</title></head><body style="font-family:Segoe UI,sans-serif;padding:24px;max-width:900px;margin:0 auto;">'
    + (logo ? ('<img src="' + logo + '" style="height:44px;margin-bottom:16px;">') : '')
    + '<h1>A.S.A.A.S — West Wing corridor storage</h1><p>Generated ' + gen + '</p>'
    + '<p><strong>' + warehouse.length + '</strong> in warehouse · <strong>' + returned.length + '</strong> returned · <strong>' + rows.length + '</strong> total</p>'
    + '<h2>In warehouse</h2>' + cards(warehouse)
    + '<h2>Returned</h2>' + cards(returned)
    + '</body></html>';
  var blob = new Blob([html], { type: 'text/html' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Empire-ASAAS-Report-' + new Date().toISOString().slice(0, 10) + '.html';
  a.click();
}
