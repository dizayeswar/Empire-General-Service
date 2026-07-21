/** A.S.A.A.S mobile — English / Sorani (ckb) */
(function () {
  var STORAGE_KEY = 'empire_asaas_lang';
  var _lang = 'en';
  var STRINGS = {
    en: {
      langToggle: 'کوردی',
      langToggleAria: 'Switch to Kurdish',
      logout: 'Logout',
      loading: 'Loading…',
      refreshAria: 'Refresh',
      tabLog: 'Log item',
      tabList: 'In warehouse',
      tabAll: 'All items',
      tabAdd: 'Log item',
      tabAnalytics: 'Analytics',
      titleMobile: 'A.S.A.A.S',
      titleOffice: 'A.S.A.A.S',
      subtitle: 'West Wing — corridor storage',
      countInWarehouse: function (p) { return (p.count || 0) + ' in warehouse'; },
      building: 'Building',
      floor: 'Floor',
      spot: 'Spot / location',
      item: 'Item description',
      itemPlaceholder: 'e.g. Red electric scooter, bicycle…',
      apartment: 'Apartment (optional)',
      apartmentPlaceholder: 'e.g. 1204 — if known',
      photo: 'Corridor photo',
      addPhoto: 'Add photo — camera or gallery',
      submit: 'Save to warehouse',
      sending: 'Saving…',
      submitSuccess: function (p) { return (p.ref ? (p.ref + ' — ') : '') + 'Item logged in warehouse.'; },
      needPhoto: 'A corridor photo is required.',
      needLocation: 'Building and floor are required.',
      needDescription: 'Add a description or photo.',
      recentTitle: 'Your recent items',
      warehouseListTitle: 'Items in warehouse',
      searchRef: 'Search reference',
      searchRefPlaceholder: 'Search A#…',
      mobileReturnHint: 'Details cannot be changed. Add return information below.',
      noItems: 'No items yet.',
      noWarehouseItems: 'No items in warehouse.',
      inWarehouse: 'In warehouse',
      returned: 'Returned',
      tapToView: 'Tap to view',
      tapToReturn: 'Tap to add return',
      viewItem: 'View item',
      daysInWarehouse: function (p) { return (p.days || 0) + ' days in warehouse'; },
      warehouseNote: 'Warehouse note',
      warehouseNotePlaceholder: 'e.g. Shelf B-3',
      saveNote: 'Save note',
      markReturned: 'Mark as returned',
      returnedTo: 'Returned to (name)',
      returnApartment: 'Apartment / unit',
      signedPaperPhoto: 'Photo of signed paper',
      returnNote: 'Note (optional)',
      returnSuccess: 'Item marked as returned.',
      needReturnName: 'Collector name is required.',
      needReturnPhoto: 'Photo of signed paper is required.',
      readOnlyReturned: 'This item was returned and is read-only.',
      reference: 'Reference',
      status: 'Status',
      date: 'Date',
      removedBy: 'Logged by',
      returnDetails: 'Return details',
      notReturned: 'Not returned yet',
      filterStatus: 'Status',
      filterAll: 'All',
      filterWarehouse: 'In warehouse',
      filterReturned: 'Returned',
      searchPlaceholder: 'Search A#, building, item…',
      exportExcel: 'Export to Excel',
      downloadReport: 'Download report',
      photoTitle: 'Corridor photo',
      photoTitleReturn: 'Signed paper photo',
      photoTakeCamera: 'Take photo (camera)',
      photoChooseGallery: 'Choose from gallery',
      photoCancel: 'Cancel',
      back: 'Back',
      yourReport: 'Item details',
      uploadFailed: 'Upload failed — try again',
      uploading: 'Uploading…',
      photoReady: 'Photo ready — tap to replace'
    },
    ckb: {
      langToggle: 'EN',
      langToggleAria: 'گۆڕین بۆ ئینگلیزی',
      logout: 'چوونەدەرەوە',
      loading: 'بارکردن…',
      refreshAria: 'نوێکردنەوە',
      tabLog: 'تۆمارکردنی شت',
      tabList: 'لە کۆگا',
      tabAll: 'هەموو شتەکان',
      tabAdd: 'تۆمارکردنی شت',
      tabAnalytics: 'ڕاپۆرت',
      titleMobile: 'A.S.A.A.S',
      titleOffice: 'A.S.A.A.S',
      subtitle: 'West Wing — کۆگای ڕێڕەو',
      countInWarehouse: function (p) { return (p.count || 0) + ' لە کۆگا'; },
      building: ' بینا',
      floor: 'نهۆم',
      spot: 'شوێن / جێگا',
      item: 'وەسفی شت',
      itemPlaceholder: 'بۆ نموونە سکووتەری سوور، پاسکیل…',
      apartment: 'شوقە (ئارەزوومەندانە)',
      apartmentPlaceholder: 'بۆ نموونە 1204 — ئەگەر دەزانی',
      photo: 'وێنەی ڕێڕەو',
      addPhoto: 'وێنە زیاد بکە — کامێرا یان گالەری',
      submit: 'پاشەکەوت لە کۆگا',
      sending: 'پاشەکەوتکردن…',
      submitSuccess: function (p) { return (p.ref ? (p.ref + ' — ') : '') + 'شت لە کۆگا تۆمار کرا.'; },
      needPhoto: 'وێنەی ڕێڕەو پێویستە.',
      needLocation: 'بینا و نهۆم پێویستن.',
      needDescription: 'وەسف یان وێنە زیاد بکە.',
      recentTitle: 'شتە نوێیەکانت',
      warehouseListTitle: 'شتەکان لە کۆگا',
      searchRef: 'گەڕان بە ژمارەی ئاماژە',
      searchRefPlaceholder: 'گەڕان A#…',
      mobileReturnHint: 'وردەکارییەکان ناگۆڕدرێن. زانیاری گەڕاندنەوە لە خوارەوە زیاد بکە.',
      noItems: 'هێشتا شت نییە.',
      noWarehouseItems: 'شت لە کۆگا نییە.',
      inWarehouse: 'لە کۆگا',
      returned: 'گەڕێندرایەوە',
      tapToView: 'بۆ بینین دابگرە',
      tapToReturn: 'بۆ زیادکردنی گەڕاندنەوە دابگرە',
      viewItem: 'وردەکاری شت',
      daysInWarehouse: function (p) { return (p.days || 0) + ' ڕۆژ لە کۆگا'; },
      warehouseNote: 'تێبینی کۆگا',
      warehouseNotePlaceholder: 'بۆ نموونە Shelf B-3',
      saveNote: 'پاشەکەوتکردنی تێبینی',
      markReturned: 'وەک گەڕێندراوە نیشان بکە',
      returnedTo: 'گەڕێندرایەوە بۆ (ناو)',
      returnApartment: 'شوقە / یەکە',
      signedPaperPhoto: 'وێنەی کاغەزی واژۆکراو',
      returnNote: 'تێبینی (ئارەزوومەندانە)',
      returnSuccess: 'شت وەک گەڕێندراوە نیشان کرا.',
      needReturnName: 'ناوی وەرگر پێویستە.',
      needReturnPhoto: 'وێنەی کاغەزی واژۆکراو پێویستە.',
      readOnlyReturned: 'ئەم شتە گەڕێندرایەوە و تەنها خوێندنەوەیە.',
      reference: 'ژمارەی ئاماژە',
      status: 'دۆخ',
      date: 'بەروار',
      removedBy: 'تۆمارکراو لەلایەن',
      returnDetails: 'وردەکاری گەڕاندنەوە',
      notReturned: 'هێشتا نەگەڕێندراوەتەوە',
      filterStatus: 'دۆخ',
      filterAll: 'هەموو',
      filterWarehouse: 'لە کۆگا',
      filterReturned: 'گەڕێندراوە',
      searchPlaceholder: 'گەڕان A#، بینا، شت…',
      exportExcel: 'هەناردن بۆ Excel',
      downloadReport: 'داگرتنی ڕاپۆرت',
      photoTitle: 'وێنەی ڕێڕەو',
      photoTitleReturn: 'وێنەی کاغەزی واژۆکراو',
      photoTakeCamera: 'وێنە بگرە (کامێرا)',
      photoChooseGallery: 'لە گالەری هەڵبژێرە',
      photoCancel: 'هەڵوەشاندنەوە',
      back: 'گەڕانەوە',
      yourReport: 'وردەکاری شت',
      uploadFailed: 'بارکردن سەرنەکەوت — دووبارە هەوڵ بدەرەوە',
      uploading: 'بارکردن…',
      photoReady: 'وێنە ئامادەیە — بۆ گۆڕین دابگرە'
    }
  };

  function workerLangLoad_() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'ckb' || saved === 'en') return saved;
    } catch (e) {}
    return 'en';
  }
  function workerLangSave_(lang) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
  }
  function asaasT(key, params) {
    var pack = STRINGS[_lang] || STRINGS.en;
    var val = pack[key];
    if (val == null) val = STRINGS.en[key];
    if (typeof val === 'function') return val(params || {});
    return val != null ? String(val) : (key || '');
  }
  function asaasIsRtl() { return _lang === 'ckb'; }
  function asaasApplyRtl_() {
    var app = document.getElementById('asaasMobileApp');
    if (app) app.classList.toggle('worker-rtl', asaasIsRtl());
    if (document.body.classList.contains('asaas-mobile-mode')) {
      document.documentElement.setAttribute('dir', asaasIsRtl() ? 'rtl' : 'ltr');
      document.documentElement.setAttribute('lang', asaasIsRtl() ? 'ckb' : 'en');
    }
  }
  function asaasApplyStaticLang_() {
    document.querySelectorAll('[data-asaas-i18n]').forEach(function (el) {
      el.textContent = asaasT(el.getAttribute('data-asaas-i18n'));
    });
    document.querySelectorAll('[data-asaas-i18n-placeholder]').forEach(function (el) {
      el.placeholder = asaasT(el.getAttribute('data-asaas-i18n-placeholder'));
    });
    var langBtn = document.getElementById('asaasLangBtn');
    if (langBtn) {
      langBtn.textContent = asaasT('langToggle');
      langBtn.setAttribute('aria-label', asaasT('langToggleAria'));
    }
  }
  function asaasSetLang(lang) {
    lang = lang === 'ckb' ? 'ckb' : 'en';
    _lang = lang;
    workerLangSave_(lang);
    asaasApplyRtl_();
    asaasApplyStaticLang_();
    if (typeof asaasRefreshUi_ === 'function') asaasRefreshUi_();
  }
  function asaasToggleLang() { asaasSetLang(_lang === 'ckb' ? 'en' : 'ckb'); }
  function asaasInitLang_() {
    _lang = workerLangLoad_();
    asaasApplyRtl_();
    asaasApplyStaticLang_();
  }
  window.asaasT = asaasT;
  window.asaasIsRtl = asaasIsRtl;
  window.asaasSetLang = asaasSetLang;
  window.asaasToggleLang = asaasToggleLang;
  window.asaasApplyStaticLang = asaasApplyStaticLang_;
  window.asaasInitLang = asaasInitLang_;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', asaasInitLang_);
  else asaasInitLang_();
})();
