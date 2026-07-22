/**
 * Electric worker mobile UI — English / Sorani (ckb) translations.
 * Loaded on electric-issue.html only.
 */
(function () {
  var STORAGE_KEY = 'empire_worker_lang';
  var _lang = 'en';

  var STRINGS = {
    en: {
      langToggle: 'کوردی',
      langToggleAria: 'Switch to Kurdish',
      logout: 'Logout',
      loading: 'Loading…',
      refreshAria: 'Refresh',
      tabJobs: 'Assigned jobs',
      tabReport: 'Add report',
      jobsOpenCount: function (p) {
        var n = p.count || 0;
        return n + ' open job' + (n === 1 ? '' : 's') + ' assigned to you';
      },
      jobsUnavailable: 'Jobs unavailable',
      jobsTryAgain: 'Try again',
      jobsNoOpen: 'No open jobs right now.',
      jobsNoOpenHint: 'Pull down or tap refresh when the engineer assigns new work.',
      jobsPendingUpload: function (p) {
        var n = p.count || 0;
        return n + ' fix' + (n === 1 ? '' : 'es') + ' waiting to upload when you have signal.';
      },
      jobsNoPhoto: 'No photo',
      jobsSearchLabel: 'Search location',
      jobsSearchPlaceholder: 'e.g. WW-10-8',
      jobsNoSearchMatch: 'No jobs match your search.',
      wfrPlaceLabel: 'Place / location',
      wfrPlacePlaceholder: 'Where? e.g. WW-12 corridor, ES-4 parking…',
      wfrNoteLabel: 'Note',
      wfrNotePlaceholder: 'What did you find or do?',
      wfrRefundable: 'Refundable work',
      wfrRefundableHint: 'Leave unchecked for <strong>maintenance</strong>. When checked, add a <strong>job photo</strong> and an <strong>invoice photo</strong>.',
      wfrRefundableNote: 'Refundable work needs a <strong>job photo</strong> and an <strong>invoice photo</strong> before sending.',
      wfrJobPhoto: 'Job photo',
      wfrAddPhoto: 'Add photo — camera or gallery',
      wfrInvoicePhoto: 'Invoice photo',
      wfrSubmit: 'Send to Electrical Department',
      wfrRecentReports: 'Your recent reports',
      wfrNoReports: 'No reports yet.',
      wfrNoReportsSubmitted: 'No reports submitted yet.',
      wfrCouldNotLoad: 'Could not load your reports.',
      wfrSubmitSuccess: 'Report sent to Electrical Department.',
      wfrUploading: 'Uploading…',
      wfrJobPhotoReady: 'Job photo ready — tap to replace',
      wfrInvoicePhotoReady: 'Invoice photo ready — tap to replace',
      wfrInvoicePhotoReadyShort: 'Invoice photo ready',
      wfrUploadFailed: 'Upload failed — try again',
      wfrSending: 'Sending…',
      wfrNeedJobPhoto: 'Refundable reports need a job photo before sending.',
      wfrNeedInvoicePhoto: 'Refundable reports need an invoice photo before sending.',
      wfrNeedContent: 'Add a place, note, photo, or voice recording.',
      wfrWaitUpload: 'Please wait for the photo to finish uploading.',
      wfrRefundableBadge: 'Refundable',
      wfrMaintenanceBadge: 'Maintenance',
      wfrVoiceBadge: 'Voice',
      wfrInvoiceAdded: 'Invoice added',
      wfrInvoiceMissing: 'Invoice photo missing',
      wfrNoJobPhoto: 'No job photo',
      wfrTapToView: 'Tap to view',
      wfrViewReportAria: 'View report details',
      wfrReadOnlyLead: 'Read only — you cannot edit a submitted report.',
      wfrReference: 'Reference',
      wfrType: 'Type',
      wfrDate: 'Date',
      wfrStatus: 'Status',
      wfrStatusTransferred: 'Added to monthly report',
      wfrStatusPending: 'Waiting for department review',
      wfrPlace: 'Place',
      wfrMaterials: 'Materials',
      wfrAmount: 'Amount',
      wfrNotSubmitted: 'Not submitted',
      wfrVoiceNote: 'Voice note',
      wfrModalTitle: 'Your report',
      wfrInvoiceModalTitle: 'Add invoice photo',
      wfrInvoiceModalLead: 'You can only add the invoice photo here. Other details cannot be edited.',
      wfrInvoiceModalPick: 'Camera / gallery — invoice',
      wfrSaveInvoice: 'Save invoice photo',
      wfrSaving: 'Saving…',
      wfrInvoiceSaved: 'Invoice photo saved.',
      wfrChooseInvoiceFirst: 'Choose an invoice photo first.',
      wfrBack: 'Back',
      voiceLabel: 'Voice note <span class="assign-voice-optional">(optional)</span>',
      voiceRecord: 'Record',
      voiceStop: 'Stop',
      voiceRecording: 'Recording',
      voiceStatusWorker: 'Tap Record and describe what you found.',
      voiceDelete: 'Delete recording',
      photoTitleJob: 'Job photo',
      photoTitleInvoice: 'Invoice photo',
      photoTitleCompletion: 'Completion photo',
      photoTitleAdd: 'Add photo',
      photoTakeCamera: 'Take photo (camera)',
      photoChooseGallery: 'Choose from gallery',
      photoCancel: 'Cancel',
      fixNoteOptional: 'Note (optional)',
      fixMaterialsOptional: 'Materials used (optional)',
      fixAddPhoto: 'Add photo',
      fixCameraOrGallery: 'Camera or gallery',
      fixAddPhotoAria: 'Add completion photo',
      fixMarkFixed: 'Mark as fixed',
      fixMarkFixedPhotos: function (p) {
        var n = p.count || 0;
        return 'Mark as fixed (' + n + ' photo' + (n === 1 ? '' : 's') + ')';
      },
      fixUploading: 'Uploading photo…',
      fixNoteLabel: 'Note:',
      fixJobNeedsWorkers: function (p) {
        var need = p.need || 2;
        var done = p.done || 0;
        var s = 'This job needs <strong>' + need + ' workers</strong> to each take photos.';
        if (done) s += ' <span>(' + done + '/' + need + ' already done)</span>';
        return s;
      },
      fixSavedOnDevice: 'Saved on this device',
      fixPendingSync: 'Waiting for internet to upload your photos and mark this job fixed. Keep this page open or come back later.',
      fixYourPhotosPending: 'Your photos (not uploaded yet)',
      fixPhotoN: function (p) { return 'Photo ' + (p.index || 1); },
      fixOnDevice: 'on device',
      fixWaitingSignal: 'Waiting to upload when you have signal.',
      fixLoadingSaved: 'Loading saved fix…',
      fixAlreadyFixed: 'You already marked this job as fixed.',
      fixNoMorePhotos: 'You cannot add more photos for this issue.',
      fixYourSubmittedPhotos: 'Your submitted photos',
      fixYourVoiceNote: 'Your voice note',
      fixWaitingOthers: function (p) {
        return 'Waiting for other workers to complete this job (' + (p.done || 0) + '/' + (p.need || 0) + ' done).';
      },
      fixRemovePhotoAria: 'Remove photo',
      modalJob: 'Job',
      locEnable: 'Enable location',
      locTryAgain: 'Try again'
    },
    ckb: {
      langToggle: 'EN',
      langToggleAria: 'گۆڕین بۆ ئینگلیزی',
      logout: 'چوونەدەرەوە',
      loading: 'بارکردن…',
      refreshAria: 'نوێکردنەوە',
      tabJobs: 'کارە دیاریکراوەکان',
      tabReport: 'زیادکردنی ڕاپۆرت',
      jobsOpenCount: function (p) {
        return (p.count || 0) + ' کارێکی کراوە دیاریکراوە بۆ تۆ';
      },
      jobsUnavailable: 'کارەکان بەردەست نین',
      jobsTryAgain: 'دووبارە هەوڵ بدەرەوە',
      jobsNoOpen: 'ئێستا هیچ کارێکی کراوە نییە.',
      jobsNoOpenHint: 'کاتێک ئەندازیار کارێکی نوێ دیاری کرد، ڕاکێشە بۆ خوارەوە یان دوگمەی نوێکردنەوە دابگرە.',
      jobsPendingUpload: function (p) {
        return (p.count || 0) + ' چاکسازی چاوەڕێی ئینتەرنێتە بۆ بارکردن.';
      },
      jobsNoPhoto: 'وێنە نییە',
      jobsSearchLabel: 'گەڕان بە شوێن',
      jobsSearchPlaceholder: 'بۆ نموونە WW-10-8',
      jobsNoSearchMatch: 'هیچ کارێک لەگەڵ گەڕانەکەت ناگونجێت.',
      wfrPlaceLabel: 'شوێن / جێگا',
      wfrPlacePlaceholder: 'لە کوێ؟ بۆ نموونە WW-12 ڕێڕەو، ES-4 پارکینگ…',
      wfrNoteLabel: 'تێبینی',
      wfrNotePlaceholder: 'چی دۆزییەوە یان چی کرد؟',
      wfrRefundable: 'کاری گەڕانەوەی پارە',
      wfrRefundableHint: 'بە بەتاڵی بهێڵە بۆ <strong>چاکسازی</strong>. کاتێک نیشانەکراوە، <strong>وێنەی کار</strong> و <strong>وێنەی پسوولە</strong> زیاد بکە.',
      wfrRefundableNote: 'کاری گەڕانەوەی پارە پێویستی بە <strong>وێنەی کار</strong> و <strong>وێنەی پسوولە</strong> هەیە پێش ناردن.',
      wfrJobPhoto: 'وێنەی کار',
      wfrAddPhoto: 'وێنە زیاد بکە — کامێرا یان گالەری',
      wfrInvoicePhoto: 'وێنەی پسوولە',
      wfrSubmit: 'ناردن بۆ بەشی کارەبا',
      wfrRecentReports: 'ڕاپۆرتە نوێیەکانت',
      wfrNoReports: 'هێشتا ڕاپۆرت نییە.',
      wfrNoReportsSubmitted: 'هێشتا ڕاپۆرت نەنێردراوە.',
      wfrCouldNotLoad: 'نەتوانرا ڕاپۆرتەکانت بار بکرێن.',
      wfrSubmitSuccess: 'ڕاپۆرت نێردرا بۆ بەشی کارەبا.',
      wfrUploading: 'بارکردن…',
      wfrJobPhotoReady: 'وێنەی کار ئامادەیە — بۆ گۆڕین دابگرە',
      wfrInvoicePhotoReady: 'وێنەی پسوولە ئامادەیە — بۆ گۆڕین دابگرە',
      wfrInvoicePhotoReadyShort: 'وێنەی پسوولە ئامادەیە',
      wfrUploadFailed: 'بارکردن سەرنەکەوت — دووبارە هەوڵ بدەرەوە',
      wfrSending: 'ناردن…',
      wfrNeedJobPhoto: 'ڕاپۆرتی گەڕانەوەی پارە پێویستی بە وێنەی کار هەیە پێش ناردن.',
      wfrNeedInvoicePhoto: 'ڕاپۆرتی گەڕانەوەی پارە پێویستی بە وێنەی پسوولە هەیە پێش ناردن.',
      wfrNeedContent: 'شوێن، تێبینی، وێنە، یان تۆمارکردنی دەنگ زیاد بکە.',
      wfrWaitUpload: 'تکایە چاوەڕێ بکە وێنەکە تەواو بار ببێت.',
      wfrRefundableBadge: 'گەڕانەوەی پارە',
      wfrMaintenanceBadge: 'چاکسازی',
      wfrVoiceBadge: 'دەنگ',
      wfrInvoiceAdded: 'پسوولە زیادکرا',
      wfrInvoiceMissing: 'وێنەی پسوولە نییە',
      wfrNoJobPhoto: 'وێنەی کار نییە',
      wfrTapToView: 'بۆ بینین دابگرە',
      wfrViewReportAria: 'وردەکاری ڕاپۆرت ببینە',
      wfrReadOnlyLead: 'تەنها خوێندنەوە — ناتوانیت ڕاپۆرتی نێردراو دەستکاری بکەیت.',
      wfrReference: 'ژمارەی ڕاپۆرت',
      wfrType: 'جۆر',
      wfrDate: 'بەروار',
      wfrStatus: 'دۆخ',
      wfrStatusTransferred: 'زیادکرا بۆ ڕاپۆرتی مانگانە',
      wfrStatusPending: 'چاوەڕێی پێداچوونەوەی بەش',
      wfrPlace: 'شوێن',
      wfrMaterials: 'کەرەستەکان',
      wfrAmount: 'بڕ',
      wfrNotSubmitted: 'نەنێردراوە',
      wfrVoiceNote: 'تێبینی دەنگی',
      wfrModalTitle: 'ڕاپۆرتەکەت',
      wfrInvoiceModalTitle: 'وێنەی پسوولە زیاد بکە',
      wfrInvoiceModalLead: 'لێرە تەنها دەتوانیت وێنەی پسوولە زیاد بکەیت. وردەکارییەکانی تر ناگۆڕدرێن.',
      wfrInvoiceModalPick: 'کامێرا / گالەری — پسوولە',
      wfrSaveInvoice: 'وێنەی پسوولە پاشەکەوت بکە',
      wfrSaving: 'پاشەکەوتکردن…',
      wfrInvoiceSaved: 'وێنەی پسوولە پاشەکەوت کرا.',
      wfrChooseInvoiceFirst: 'سەرەتا وێنەی پسوولە هەڵبژێرە.',
      wfrBack: 'گەڕانەوە',
      voiceLabel: 'تێبینی دەنگی <span class="assign-voice-optional">(ئارەزوومەندانە)</span>',
      voiceRecord: 'تۆمارکردن',
      voiceStop: 'وەستان',
      voiceRecording: 'تۆمارکردن',
      voiceStatusWorker: 'دەست لێ بدە بە تۆمارکردن و ئەوەی دۆزیوتەوە باس بکە.',
      voiceDelete: 'سڕینەوەی تۆمار',
      photoTitleJob: 'وێنەی کار',
      photoTitleInvoice: 'وێنەی پسوولە',
      photoTitleCompletion: 'وێنەی تەواوکردن',
      photoTitleAdd: 'وێنە زیاد بکە',
      photoTakeCamera: 'وێنە بگرە (کامێرا)',
      photoChooseGallery: 'لە گالەری هەڵبژێرە',
      photoCancel: 'هەڵوەشاندنەوە',
      fixNoteOptional: 'تێبینی (ئارەزوومەندانە)',
      fixMaterialsOptional: 'کەرەستەی بەکارهاتوو (ئارەزوومەندانە)',
      fixAddPhoto: 'وێنە زیاد بکە',
      fixCameraOrGallery: 'کامێرا یان گالەری',
      fixAddPhotoAria: 'وێنەی تەواوکردن زیاد بکە',
      fixMarkFixed: 'وەک چارەسەرکراو نیشان بکە',
      fixMarkFixedPhotos: function (p) {
        return 'وەک چارەسەرکراو نیشان بکە (' + (p.count || 0) + ' وێنە)';
      },
      fixUploading: 'بارکردنی وێنە…',
      fixNoteLabel: 'تێبینی:',
      fixJobNeedsWorkers: function (p) {
        var need = p.need || 2;
        var done = p.done || 0;
        var s = 'ئەم کارە پێویستی بە <strong>' + need + ' کارمەند</strong> هەیە هەر یەکێک وێنە بگرێت.';
        if (done) s += ' <span>(' + done + '/' + need + ' تەواو بوو)</span>';
        return s;
      },
      fixSavedOnDevice: 'لەسەر ئەم ئامێرە پاشەکەوت کرا',
      fixPendingSync: 'چاوەڕێی ئینتەرنێتە بۆ بارکردنی وێنەکانت و نیشانکردنی کار وەک چارەسەرکراو. ئەم پەڕەیە کراوە بهێڵە یان دواتر بگەڕێرەوە.',
      fixYourPhotosPending: 'وێنەکانت (هێشتا بارنەکراون)',
      fixPhotoN: function (p) { return 'وێنە ' + (p.index || 1); },
      fixOnDevice: 'لەسەر ئامێر',
      fixWaitingSignal: 'چاوەڕێی ئینتەرنێتە بۆ بارکردن.',
      fixLoadingSaved: 'بارکردنی چاکسازی پاشەکەوتکراو…',
      fixAlreadyFixed: 'پێشتر ئەم کارەت وەک چارەسەرکراو نیشان کرد.',
      fixNoMorePhotos: 'ناتوانیت وێنەی زیاتر زیاد بکەیت بۆ ئەم کێشەیە.',
      fixYourSubmittedPhotos: 'وێنە نێردراوەکانت',
      fixYourVoiceNote: 'تێبینی دەنگییەکەت',
      fixWaitingOthers: function (p) {
        return 'چاوەڕێی کارمەندانی تر بۆ تەواوکردنی ئەم کارە (' + (p.done || 0) + '/' + (p.need || 0) + ' تەواو بوو).';
      },
      fixRemovePhotoAria: 'لابردنی وێنە',
      modalJob: 'کار',
      locEnable: 'چالاککردنی شوێن',
      locTryAgain: 'دووبارە هەوڵ بدەرەوە'
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

  function workerT(key, params) {
    var pack = STRINGS[_lang] || STRINGS.en;
    var val = pack[key];
    if (val == null) val = STRINGS.en[key];
    if (typeof val === 'function') return val(params || {});
    return val != null ? String(val) : (key || '');
  }

  function workerIsRtl() {
    return _lang === 'ckb';
  }

  function workerApplyRtl_() {
    var app = document.getElementById('workerApp');
    if (app) app.classList.toggle('worker-rtl', workerIsRtl());
    if (document.body.classList.contains('civil-worker-mode')) {
      document.documentElement.setAttribute('dir', workerIsRtl() ? 'rtl' : 'ltr');
      document.documentElement.setAttribute('lang', workerIsRtl() ? 'ckb' : 'en');
    }
  }

  function workerApplyStaticLang_() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = workerT(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      el.innerHTML = workerT(el.getAttribute('data-i18n-html'));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      el.placeholder = workerT(el.getAttribute('data-i18n-placeholder'));
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      el.setAttribute('aria-label', workerT(el.getAttribute('data-i18n-aria')));
    });
    var langBtn = document.getElementById('workerLangBtn');
    if (langBtn) {
      langBtn.textContent = workerT('langToggle');
      langBtn.setAttribute('aria-label', workerT('langToggleAria'));
    }
    var bar = document.getElementById('workerCountBar');
    if (bar && bar.dataset.i18nLoading === '1') bar.textContent = workerT('loading');
    var list = document.getElementById('workerJobList');
    if (list && list.dataset.i18nLoading === '1') {
      list.innerHTML = '<p class="worker-empty">' + workerT('loading') + '</p>';
    }
  }

  function workerRefreshDynamicLang_() {
    if (typeof renderWorkerJobs === 'function') renderWorkerJobs(true);
    if (typeof workerFieldReportInit_ === 'function') workerFieldReportInit_();
    if (typeof workerFieldReportRenderMine_ === 'function') workerFieldReportRenderMine_();
    var modal = document.getElementById('workerJobModal');
    if (modal && modal.classList.contains('show') && _workerFixId && typeof openWorkerJob === 'function') {
      openWorkerJob(_workerFixId);
    }
    var viewModal = document.getElementById('wfrViewModal');
    if (viewModal && viewModal.classList.contains('show') && typeof workerFieldReportCloseView_ === 'function') {
      workerFieldReportCloseView_();
    }
  }

  function workerSetLang(lang) {
    lang = lang === 'ckb' ? 'ckb' : 'en';
    _lang = lang;
    workerLangSave_(lang);
    workerApplyRtl_();
    workerApplyStaticLang_();
    workerRefreshDynamicLang_();
  }

  function workerToggleLang() {
    workerSetLang(_lang === 'ckb' ? 'en' : 'ckb');
  }

  function workerInitLang_() {
    _lang = workerLangLoad_();
    workerApplyRtl_();
    workerApplyStaticLang_();
  }

  window.workerT = workerT;
  window.workerLang = function () { return _lang; };
  window.workerIsRtl = workerIsRtl;
  window.workerSetLang = workerSetLang;
  window.workerToggleLang = workerToggleLang;
  window.workerApplyStaticLang = workerApplyStaticLang_;
  window.workerInitLang = workerInitLang_;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', workerInitLang_);
  } else {
    workerInitLang_();
  }
})();
