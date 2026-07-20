/* Empire Electrical Department — materials catalog + picker UI */
(function () {
  var CATALOG = [
    { name: 'Main Sensor', variants: ['63a', '40a'] },
    { name: 'Main Circuit 1p', variants: ['16a', '20a', '25a'] },
    { name: 'Base Light', variants: [] },
    { name: 'Single Box', variants: [] },
    { name: 'Dual Box', variants: [] },
    { name: 'TV Outlet', variants: [] },
    { name: 'Street Floodlight 150w', variants: [] },
    { name: 'Floodlight', variants: ['100w', '150w'] },
    { name: 'Cable Single', variants: ['2x1.5', '3x1.5', '0.75x2', '4x10', '3x2.5', '4x4', '2x2.5'] },
    { name: 'TV Wire', variants: [] },
    { name: 'Heat/Join Cable', variants: ['10mm', '16mm', '25mm', '35mm', '50mm'] },
    { name: 'Cable Tie', variants: [] },
    { name: 'Main Circuit 2p', variants: ['40a', '20a'] },
    { name: 'Connecter Cold', variants: [] },
    { name: 'Connecter Join', variants: [] },
    { name: 'Cover Wire 16x16mm', variants: [] },
    { name: 'Spotlight 18w', variants: [] },
    { name: 'Earthline Rod', variants: [] },
    { name: 'Striplight', variants: [] },
    { name: 'LED linner', variants: [] },
    { name: 'Contacter', variants: ['18a', '32a'] },
    { name: 'LED 60x60', variants: [] },
    { name: 'Bulb 9w', variants: ['white', 'yellow'] },
    { name: 'LED Tube Light 120cm', variants: [] },
    { name: 'Breaker', variants: ['63a', '100a'] },
    { name: 'Light sensor', variants: [] },
    { name: 'Circuit 3phase', variants: ['63a', '40a'] },
    { name: 'Photocell', variants: [] },
    { name: 'Red pipe', variants: ['20mm', '25mm', '32mm'] },
    { name: 'Headplug', variants: ['dual', 'triple'] },
    { name: 'Timer 24h', variants: [] },
    { name: 'Signal Light', variants: [] },
    { name: 'Single Wire', variants: ['1.5mm', '2.5mm'] },
    { name: 'Switch Bell', variants: [] },
    { name: 'Switch Plug Single Dual', variants: [] },
    { name: 'Switch Plug Dual Turkish', variants: [] },
    { name: 'Switch Plug Joker', variants: [] },
    { name: 'Switch Plug Roundly', variants: [] },
    { name: 'Switch Plug Heater', variants: [] },
    { name: 'Rus Cable', variants: ['10mm', '16mm', '25mm', '35mm', '50mm'] },
    { name: 'Ventilate fan', variants: ['4in', '5in', '6in'] },
    { name: 'Point Cover', variants: [] },
    { name: 'Garden Light Cover', variants: [] },
    { name: 'Electric Meter Remote Control', variants: [] },
    { name: 'Board', variants: ['25x35', '30x40', '40x50'] },
    { name: 'Flexiable Metalic Conduit', variants: ['20mm', '25mm'] },
    { name: 'Power Supply', variants: ['12v', '18v', '24v'] },
    { name: 'Main Circuit 4p', variants: ['63a', '100a'] },
    { name: 'Exit sign', variants: [] },
    { name: 'Busbar', variants: ['2p', '3p'] },
    { name: 'HD box Device', variants: [] }
  ];

  function formatSelection(name, variant) {
    var v = String(variant || '').trim();
    return v ? (name + ' ' + v) : name;
  }

  function appendToInput(input, text) {
    if (!input || !text) return;
    var cur = String(input.value || '').trim();
    input.value = cur ? (cur + ', ' + text) : text;
    try {
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (e) {}
    input.focus();
  }

  function buildPickerHtml() {
    var rows = CATALOG.map(function (item, idx) {
      var hasVar = item.variants && item.variants.length > 0;
      var hint = hasVar ? ('<span class="mat-hint">' + item.variants.join(', ') + '</span>') : '';
      var variantsHtml = hasVar
        ? item.variants.map(function (v) {
          return '<button type="button" class="empire-mat-variant" data-name="' + escAttr(item.name) + '" data-variant="' + escAttr(v) + '">' + escHtml(v) + '</button>';
        }).join('')
        : '';
      return '<div class="empire-mat-row' + (hasVar ? ' has-variants' : '') + '" data-search="' + escAttr((idx + 1) + ' ' + item.name + ' ' + (item.variants || []).join(' ')) + '">'
        + '<button type="button" class="empire-mat-name"' + (hasVar ? '' : ' data-name="' + escAttr(item.name) + '" data-variant=""') + '>'
        + '<span>' + escHtml((idx + 1) + '. ' + item.name) + '</span>' + hint + '</button>'
        + (hasVar ? ('<div class="empire-mat-variants">' + variantsHtml + '</div>') : '')
        + '</div>';
    }).join('');
    return '<button type="button" class="empire-materials-picker-toggle" aria-expanded="false">'
      + '<span>Add material from list</span><span class="chev" aria-hidden="true">&#9662;</span></button>'
      + '<div class="empire-materials-picker-panel">'
      + '<input type="search" class="empire-materials-search" placeholder="Search materials…" autocomplete="off">'
      + '<div class="empire-materials-list">' + rows + '</div>'
      + '<p class="empire-materials-picker-hint">Tap a material to add it. Items with options expand on tap (mobile) or hover (desktop).</p>'
      + '</div>';
  }

  function escHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escAttr(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function bindPicker(picker, input) {
    var toggle = picker.querySelector('.empire-materials-picker-toggle');
    var search = picker.querySelector('.empire-materials-search');
    if (toggle) {
      toggle.addEventListener('click', function () {
        var open = picker.classList.toggle('open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open && search) search.focus();
      });
    }
    if (search) {
      search.addEventListener('input', function () {
        var q = String(search.value || '').trim().toLowerCase();
        picker.querySelectorAll('.empire-mat-row').forEach(function (row) {
          var hay = String(row.getAttribute('data-search') || '').toLowerCase();
          row.classList.toggle('hidden', q && hay.indexOf(q) === -1);
        });
      });
    }
    picker.querySelectorAll('.empire-mat-name').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.empire-mat-row');
        if (row && row.classList.contains('has-variants')) {
          var wasOpen = row.classList.contains('expanded');
          picker.querySelectorAll('.empire-mat-row.expanded').forEach(function (r) {
            if (r !== row) r.classList.remove('expanded');
          });
          row.classList.toggle('expanded', !wasOpen);
          return;
        }
        appendToInput(input, formatSelection(btn.getAttribute('data-name'), btn.getAttribute('data-variant')));
      });
    });
    picker.querySelectorAll('.empire-mat-variant').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        appendToInput(input, formatSelection(btn.getAttribute('data-name'), btn.getAttribute('data-variant')));
        var row = btn.closest('.empire-mat-row');
        if (row) row.classList.remove('expanded');
      });
    });
  }

  function mount(inputId, opts) {
    opts = opts || {};
    var input = document.getElementById(inputId);
    if (!input || input.dataset.empireMaterialsPicker === '1') return null;
    input.dataset.empireMaterialsPicker = '1';
    var picker = document.createElement('div');
    picker.className = 'empire-materials-picker';
    picker.innerHTML = buildPickerHtml();
    if (input.nextSibling) input.parentNode.insertBefore(picker, input.nextSibling);
    else input.parentNode.appendChild(picker);
    bindPicker(picker, input);
    if (opts.autoOpen) {
      picker.classList.add('open');
      var toggle = picker.querySelector('.empire-materials-picker-toggle');
      if (toggle) toggle.setAttribute('aria-expanded', 'true');
    }
    return picker;
  }

  window.EMPIRE_ELECTRICAL_MATERIALS = CATALOG;
  window.empireMaterialsPickerMount = mount;
  window.empireMaterialsFormatSelection = formatSelection;
})();
