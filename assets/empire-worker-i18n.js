/**
 * Electric worker mobile UI — English / Sorani (ckb) / Arabic (ar) translations.
 * Loaded on electric-issue.html only.
 */
(function () {
  var STORAGE_KEY = 'empire_worker_lang';
  var LANGS = ['en', 'ckb', 'ar'];
  var _lang = 'en';

  var STRINGS = {
    en: {
      langToggle: 'کوردی',
      langToggleAria: 'Switch language',
      logout: 'Logout',
      logoutConfirmTitle: 'Log out?',
      logoutConfirmLead: 'Enter your login password to confirm logout.',
      logoutPasswordLabel: 'Password',
      logoutPasswordPlaceholder: 'Your login password',
      logoutCancel: 'Cancel',
      logoutConfirmBtn: 'Log out',
      logoutNeedPassword: 'Enter your password.',
      logoutWrongPassword: 'Wrong password. Try again.',
      logoutChecking: 'Checking password\u2026',
      logoutVerifyFailed: 'Could not verify password. Check your signal and try again.',
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
      wfrJobPhoto: 'Job photos',
      wfrJobPhotos: 'Job photos',
      wfrJobPhotoHint: 'Up to 3 photos — camera or gallery',
      wfrAddPhoto: 'Add photo — camera or gallery',
      wfrInvoicePhoto: 'Invoice photo',
      wfrSubmit: 'Send to Electrical Department',
      wfrSubmitOffline: 'Save on device — retry later',
      wfrSavingOnDevice: 'Saving on this device…',
      wfrSavedWillRetry: 'Saved on this device. Upload when you have signal — tap Retry upload.',
      wfrWaitingSignal: 'Waiting to upload when you have signal.',
      wfrOnDevice: 'on device',
      wfrPhotoSavedOnDevice: 'Photo saved on this device. It will upload when you have signal.',
      wfrInvoiceSavedOnDevice: 'Invoice saved on this device — will upload with report',
      wfrBannerTitle: function (p) {
        var n = p.count || 0;
        return n + ' report' + (n === 1 ? '' : 's') + ' waiting to upload';
      },
      wfrBannerSubtitle: 'Saved on this phone — tap Retry when you have signal.',
      wfrBannerRetry: 'Retry upload',
      wfrPendingTitle: function (p) {
        var n = p.count || 0;
        return n + ' report' + (n === 1 ? '' : 's') + ' waiting to upload';
      },
      wfrPendingHint: 'Saved on this phone. Tap Retry when you have signal.',
      wfrRecentReports: 'Your recent reports',
      wfrNoReports: 'No reports yet.',
      wfrNoReportsSubmitted: 'No reports submitted yet.',
      wfrCouldNotLoad: 'Could not load your reports.',
      wfrSubmitSuccess: 'Report sent to Electrical Department.',
      wfrUploading: 'Uploading…',
      wfrJobPhotoReady: 'Job photo ready — tap to replace',
      wfrJobPhotosReady: function (p) {
        var n = p.count || 0;
        return n + ' photo' + (n === 1 ? '' : 's') + ' ready';
      },
      wfrPhotoMaxReached: function (p) {
        return 'You can add up to ' + (p.max || 3) + ' job photos. Remove one to add another.';
      },
      wfrPhotoN: function (p) { return 'Photo ' + (p.index || 1); },
      wfrRemovePhotoAria: 'Remove photo',
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
      voicePlay: 'Play voice note',
      voicePause: 'Pause',
      voiceLoading: 'Loading\u2026',
      voiceTapPlay: 'Tap Play',
      voicePlayFailed: 'Could not play this voice note. Check your signal, or open the report again.',
      voiceMicDeniedHelp: 'Microphone is blocked.\n\nOn Android Chrome:\n1) Tap the lock icon left of the website address\n2) Permissions → Microphone → Allow\n3) Reload the page and tap Record again.\n\nIf the app is on your Home screen: Chrome menu → Settings → Site settings → Microphone → Allow for this site.',
      voiceNeedsHttps: 'Voice notes need a secure (https) connection. Open the app from the Empire website link.',
      voiceNeedsBrowser: 'Voice notes need microphone access. Use Chrome or Safari on your phone.',
      voiceNoMic: 'No microphone found on this device.',
      voiceMicBusy: 'Microphone is busy. Close other apps using the mic, then try again.',
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
      fixPhotoMaxHint: function (p) {
        return 'Up to ' + (p.max || 3) + ' photos — camera or gallery';
      },
      fixPhotoMaxReached: function (p) {
        return 'You can add up to ' + (p.max || 3) + ' photos. Remove one to add another.';
      },
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
      fixRetryUpload: 'Retry upload now',
      fixRetryHint: 'When you have better signal, tap Retry upload. Your photos and notes are already saved on this phone.',
      fixBannerTitle: function (p) {
        var n = p.count || 0;
        return n + ' job fix' + (n === 1 ? '' : 'es') + ' waiting to upload';
      },
      fixBannerSubtitle: 'Saved on this phone — tap Retry when you have signal.',
      fixBannerRetry: 'Retry upload',
      fixSavedWillRetry: 'Saved on this device. Upload when you have signal — tap Retry upload.',
      fixSaveOnDevice: function (p) {
        var n = p.count || 0;
        return 'Save on device (' + n + ' photo' + (n === 1 ? '' : 's') + ') — retry later';
      },
      fixSaving: 'Saving\u2026',
      fixSavingOnDevice: 'Saving on this device\u2026',
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
      langToggle: 'عربي',
      langToggleAria: 'گۆڕینی زمان',
      logout: 'چوونەدەرەوە',
      logoutConfirmTitle: 'دەتەوێت بچیتە دەرەوە؟',
      logoutConfirmLead: 'وشەی نهێنی چوونەژوورەوە بنووسە بۆ دڵنیابوون.',
      logoutPasswordLabel: 'وشەی نهێنی',
      logoutPasswordPlaceholder: 'وشەی نهێنی چوونەژوورەوە',
      logoutCancel: 'هەڵوەشاندنەوە',
      logoutConfirmBtn: 'چوونەدەرەوە',
      logoutNeedPassword: 'وشەی نهێنی بنووسە.',
      logoutWrongPassword: 'وشەی نهێنی هەڵەیە. دووبارە هەوڵ بدەرەوە.',
      logoutChecking: 'پشکنینی وشەی نهێنی\u2026',
      logoutVerifyFailed: 'نەتوانرا وشەی نهێنی بپشکنرێت. ئینتەرنێت بپشکنە و دووبارە هەوڵ بدەرەوە.',
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
      wfrJobPhoto: 'وێنەکانی کار',
      wfrJobPhotos: 'وێنەکانی کار',
      wfrJobPhotoHint: 'تا ٣ وێنە — کامێرا یان گالەری',
      wfrAddPhoto: 'وێنە زیاد بکە — کامێرا یان گالەری',
      wfrInvoicePhoto: 'وێنەی پسوولە',
      wfrSubmit: 'ناردن بۆ بەشی کارەبا',
      wfrSubmitOffline: 'پاشەکەوت لەسەر ئامێر — دواتر دووبارە',
      wfrSavingOnDevice: 'پاشەکەوتکردن لەسەر ئەم ئامێرە…',
      wfrSavedWillRetry: 'لەسەر ئەم ئامێرە پاشەکەوت کرا. کاتێک سیگنال هەبوو دووبارە بارکردن دابگرە.',
      wfrWaitingSignal: 'چاوەڕێی ئینتەرنێتە بۆ بارکردن.',
      wfrOnDevice: 'لەسەر ئامێر',
      wfrPhotoSavedOnDevice: 'وێنە لەسەر ئەم ئامێرە پاشەکەوت کرا. کاتێک سیگنال هەبوو باردەکرێت.',
      wfrInvoiceSavedOnDevice: 'پسوولە لەسەر ئامێر پاشەکەوت کرا — لەگەڵ ڕاپۆرت باردەکرێت',
      wfrBannerTitle: function (p) {
        return (p.count || 0) + ' ڕاپۆرت چاوەڕێی بارکردنە';
      },
      wfrBannerSubtitle: 'لەسەر مۆبایل پاشەکەوت کرا — کاتێک سیگنال هەبوو Retry دابگرە.',
      wfrBannerRetry: 'دووبارە بارکردن',
      wfrPendingTitle: function (p) {
        return (p.count || 0) + ' ڕاپۆرت چاوەڕێی بارکردنە';
      },
      wfrPendingHint: 'لەسەر مۆبایل پاشەکەوت کرا. کاتێک سیگنال هەبوو Retry دابگرە.',
      wfrRecentReports: 'ڕاپۆرتە نوێیەکانت',
      wfrNoReports: 'هێشتا ڕاپۆرت نییە.',
      wfrNoReportsSubmitted: 'هێشتا ڕاپۆرت نەنێردراوە.',
      wfrCouldNotLoad: 'نەتوانرا ڕاپۆرتەکانت بار بکرێن.',
      wfrSubmitSuccess: 'ڕاپۆرت نێردرا بۆ بەشی کارەبا.',
      wfrUploading: 'بارکردن…',
      wfrJobPhotoReady: 'وێنەی کار ئامادەیە — بۆ گۆڕین دابگرە',
      wfrJobPhotosReady: function (p) {
        return (p.count || 0) + ' وێنە ئامادەیە';
      },
      wfrPhotoMaxReached: function (p) {
        return 'تەنها تا ' + (p.max || 3) + ' وێنەی کار دەتوانیت زیاد بکەیت. یەکێک بسڕەوە بۆ زیادکردنی نوێ.';
      },
      wfrPhotoN: function (p) { return 'وێنە ' + (p.index || 1); },
      wfrRemovePhotoAria: 'وێنە بسڕەوە',
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
      voicePlay: 'لێدانی تێبینی دەنگی',
      voicePause: 'وەستان',
      voiceLoading: 'بارکردن\u2026',
      voiceTapPlay: 'لێدان دابگرە',
      voicePlayFailed: 'نەتوانرا ئەم تێبینییە دەنگییە لێبدرێت. ئینتەرنێت بپشکنە یان ڕاپۆرتەکە دووبارە بکەرەوە.',
      voiceMicDeniedHelp: 'مایکڕۆفۆن قەدەغە کراوە.\n\nلە Chrome لە ئەندرۆید:\n1) ئایکۆنی قوفڵ لە تەنیشت ناونیشانی ماڵپەڕەکە دابگرە\n2) Permissions → Microphone → Allow\n3) پەڕەکە نوێ بکەرەوە و دووبارە Record دابگرە.\n\nئەگەر ئەپەکە لە Home screen ـە: لە Chrome → Settings → Site settings → Microphone → Allow بکە بۆ ئەم ماڵپەڕە.',
      voiceNeedsHttps: 'تێبینی دەنگی پێویستی بە پەیوەندی https هەیە. ئەپەکە لە لینکی ماڵپەڕی ئێمپایەر بکەرەوە.',
      voiceNeedsBrowser: 'تێبینی دەنگی پێویستی بە مایکڕۆفۆن هەیە. Chrome یان Safari بەکاربهێنە.',
      voiceNoMic: 'هیچ مایکڕۆفۆنێک لەم ئامێرە نەدۆزرایەوە.',
      voiceMicBusy: 'مایکڕۆفۆن سەرقاڵە. ئەپەکانی تر دابخە و دووبارە هەوڵ بدەرەوە.',
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
      fixPhotoMaxHint: function (p) {
        return 'تا ' + (p.max || 3) + ' وێنە — کامێرا یان گالەری';
      },
      fixPhotoMaxReached: function (p) {
        return 'تەنها تا ' + (p.max || 3) + ' وێنە دەتوانیت زیاد بکەیت. یەکێک بسڕەوە بۆ زیادکردنی نوێ.';
      },
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
      fixRetryUpload: 'ئێستا دووبارە بارکردن',
      fixRetryHint: 'کاتێک سیگنال باشتر بوو، دووبارە بارکردن دابگرە. وێنە و تێبینییەکانت لەسەر ئەم مۆبایلە پاشەکەوت کراون.',
      fixBannerTitle: function (p) {
        return (p.count || 0) + ' چاکسازی چاوەڕێی بارکردنە';
      },
      fixBannerSubtitle: 'لەسەر مۆبایل پاشەکەوت کرا — کاتێک سیگنال هەبوو Retry دابگرە.',
      fixBannerRetry: 'دووبارە بارکردن',
      fixSavedWillRetry: 'لەسەر ئەم ئامێرە پاشەکەوت کرا. کاتێک سیگنال هەبوو دووبارە بارکردن دابگرە.',
      fixSaveOnDevice: function (p) {
        return 'پاشەکەوت لەسەر ئامێر (' + (p.count || 0) + ' وێنە) — دواتر دووبارە';
      },
      fixSaving: 'پاشەکەوتکردن\u2026',
      fixSavingOnDevice: 'پاشەکەوتکردن لەسەر ئەم ئامێرە\u2026',
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
    },
    ar: {
      langToggle: 'EN',
      langToggleAria: 'تغيير اللغة',
      logout: 'تسجيل الخروج',
      logoutConfirmTitle: 'تسجيل الخروج؟',
      logoutConfirmLead: 'أدخل كلمة مرور الدخول لتأكيد تسجيل الخروج.',
      logoutPasswordLabel: 'كلمة المرور',
      logoutPasswordPlaceholder: 'كلمة مرور الدخول',
      logoutCancel: 'إلغاء',
      logoutConfirmBtn: 'تسجيل الخروج',
      logoutNeedPassword: 'أدخل كلمة المرور.',
      logoutWrongPassword: 'كلمة المرور غير صحيحة. حاول مرة أخرى.',
      logoutChecking: 'جارٍ التحقق من كلمة المرور\u2026',
      logoutVerifyFailed: 'تعذّر التحقق من كلمة المرور. تحقق من الاتصال وحاول مرة أخرى.',
      loading: 'جارٍ التحميل…',
      refreshAria: 'تحديث',
      tabJobs: 'المهام المعينة',
      tabReport: 'إضافة تقرير',
      jobsOpenCount: function (p) {
        var n = p.count || 0;
        return n + ' مهمة مفتوحة معينة لك';
      },
      jobsUnavailable: 'المهام غير متاحة',
      jobsTryAgain: 'حاول مرة أخرى',
      jobsNoOpen: 'لا توجد مهام مفتوحة حالياً.',
      jobsNoOpenHint: 'اسحب للأسفل أو اضغط تحديث عندما يعيّن المهندس عملاً جديداً.',
      jobsPendingUpload: function (p) {
        var n = p.count || 0;
        return n + ' إصلاح بانتظار الرفع عند توفر الإشارة.';
      },
      jobsNoPhoto: 'لا توجد صورة',
      jobsSearchLabel: 'البحث بالموقع',
      jobsSearchPlaceholder: 'مثال: WW-10-8',
      jobsNoSearchMatch: 'لا توجد مهام تطابق بحثك.',
      wfrPlaceLabel: 'المكان / الموقع',
      wfrPlacePlaceholder: 'أين؟ مثال: ممر WW-12، موقف ES-4…',
      wfrNoteLabel: 'ملاحظة',
      wfrNotePlaceholder: 'ماذا وجدت أو ماذا فعلت؟',
      wfrRefundable: 'عمل قابل للاسترداد',
      wfrRefundableHint: 'اتركه بدون تحديد لـ<strong>الصيانة</strong>. عند التحديد، أضف <strong>صورة العمل</strong> و<strong>صورة الفاتورة</strong>.',
      wfrRefundableNote: 'العمل القابل للاسترداد يحتاج إلى <strong>صورة العمل</strong> و<strong>صورة الفاتورة</strong> قبل الإرسال.',
      wfrJobPhoto: 'صور العمل',
      wfrJobPhotos: 'صور العمل',
      wfrJobPhotoHint: 'حتى ٣ صور — الكاميرا أو المعرض',
      wfrAddPhoto: 'إضافة صورة — الكاميرا أو المعرض',
      wfrInvoicePhoto: 'صورة الفاتورة',
      wfrSubmit: 'إرسال إلى قسم الكهرباء',
      wfrSubmitOffline: 'حفظ على الجهاز — أعد المحاولة لاحقاً',
      wfrSavingOnDevice: 'جارٍ الحفظ على هذا الجهاز…',
      wfrSavedWillRetry: 'تم الحفظ على هذا الجهاز. ارفع عند توفر الإشارة — اضغط إعادة الرفع.',
      wfrWaitingSignal: 'بانتظار الرفع عند توفر الإشارة.',
      wfrOnDevice: 'على الجهاز',
      wfrPhotoSavedOnDevice: 'تم حفظ الصورة على هذا الجهاز. ستُرفع عند توفر الإشارة.',
      wfrInvoiceSavedOnDevice: 'تم حفظ الفاتورة على الجهاز — ستُرفع مع التقرير',
      wfrBannerTitle: function (p) {
        var n = p.count || 0;
        return n + ' تقرير بانتظار الرفع';
      },
      wfrBannerSubtitle: 'محفوظ على هذا الهاتف — اضغط إعادة المحاولة عند توفر الإشارة.',
      wfrBannerRetry: 'إعادة الرفع',
      wfrPendingTitle: function (p) {
        var n = p.count || 0;
        return n + ' تقرير بانتظار الرفع';
      },
      wfrPendingHint: 'محفوظ على هذا الهاتف. اضغط إعادة المحاولة عند توفر الإشارة.',
      wfrRecentReports: 'تقاريرك الأخيرة',
      wfrNoReports: 'لا توجد تقارير بعد.',
      wfrNoReportsSubmitted: 'لم يُرسل أي تقرير بعد.',
      wfrCouldNotLoad: 'تعذّر تحميل تقاريرك.',
      wfrSubmitSuccess: 'تم إرسال التقرير إلى قسم الكهرباء.',
      wfrUploading: 'جارٍ الرفع…',
      wfrJobPhotoReady: 'صورة العمل جاهزة — اضغط للاستبدال',
      wfrJobPhotosReady: function (p) {
        var n = p.count || 0;
        return n + ' صورة جاهزة';
      },
      wfrPhotoMaxReached: function (p) {
        return 'يمكنك إضافة حتى ' + (p.max || 3) + ' صور عمل. احذف واحدة لإضافة أخرى.';
      },
      wfrPhotoN: function (p) { return 'صورة ' + (p.index || 1); },
      wfrRemovePhotoAria: 'إزالة الصورة',
      wfrInvoicePhotoReady: 'صورة الفاتورة جاهزة — اضغط للاستبدال',
      wfrInvoicePhotoReadyShort: 'صورة الفاتورة جاهزة',
      wfrUploadFailed: 'فشل الرفع — حاول مرة أخرى',
      wfrSending: 'جارٍ الإرسال…',
      wfrNeedJobPhoto: 'تقارير الاسترداد تحتاج إلى صورة عمل قبل الإرسال.',
      wfrNeedInvoicePhoto: 'تقارير الاسترداد تحتاج إلى صورة فاتورة قبل الإرسال.',
      wfrNeedContent: 'أضف مكاناً أو ملاحظة أو صورة أو تسجيلاً صوتياً.',
      wfrWaitUpload: 'يرجى الانتظار حتى ينتهي رفع الصورة.',
      wfrRefundableBadge: 'قابل للاسترداد',
      wfrMaintenanceBadge: 'صيانة',
      wfrVoiceBadge: 'صوت',
      wfrInvoiceAdded: 'تمت إضافة الفاتورة',
      wfrInvoiceMissing: 'صورة الفاتورة مفقودة',
      wfrNoJobPhoto: 'لا توجد صورة عمل',
      wfrTapToView: 'اضغط للعرض',
      wfrViewReportAria: 'عرض تفاصيل التقرير',
      wfrReadOnlyLead: 'للقراءة فقط — لا يمكنك تعديل تقرير مُرسل.',
      wfrReference: 'المرجع',
      wfrType: 'النوع',
      wfrDate: 'التاريخ',
      wfrStatus: 'الحالة',
      wfrStatusTransferred: 'أُضيف إلى التقرير الشهري',
      wfrStatusPending: 'بانتظار مراجعة القسم',
      wfrPlace: 'المكان',
      wfrMaterials: 'المواد',
      wfrAmount: 'المبلغ',
      wfrNotSubmitted: 'غير مُرسل',
      wfrVoiceNote: 'ملاحظة صوتية',
      wfrModalTitle: 'تقريرك',
      wfrInvoiceModalTitle: 'إضافة صورة الفاتورة',
      wfrInvoiceModalLead: 'يمكنك إضافة صورة الفاتورة فقط هنا. لا يمكن تعديل التفاصيل الأخرى.',
      wfrInvoiceModalPick: 'الكاميرا / المعرض — الفاتورة',
      wfrSaveInvoice: 'حفظ صورة الفاتورة',
      wfrSaving: 'جارٍ الحفظ…',
      wfrInvoiceSaved: 'تم حفظ صورة الفاتورة.',
      wfrChooseInvoiceFirst: 'اختر صورة الفاتورة أولاً.',
      wfrBack: 'رجوع',
      voiceLabel: 'ملاحظة صوتية <span class="assign-voice-optional">(اختياري)</span>',
      voiceRecord: 'تسجيل',
      voiceStop: 'إيقاف',
      voiceRecording: 'جارٍ التسجيل',
      voiceStatusWorker: 'اضغط تسجيل ووصف ما وجدته.',
      voiceDelete: 'حذف التسجيل',
      voicePlay: 'تشغيل الملاحظة الصوتية',
      voicePause: 'إيقاف مؤقت',
      voiceLoading: 'جارٍ التحميل\u2026',
      voiceTapPlay: 'اضغط تشغيل',
      voicePlayFailed: 'تعذر تشغيل هذه الملاحظة الصوتية. تحقق من الإشارة أو افتح التقرير مرة أخرى.',
      voiceMicDeniedHelp: 'الميكروفون محظور.\n\nفي Chrome على أندرويد:\n1) اضغط أيقونة القفل بجانب عنوان الموقع\n2) Permissions → Microphone → Allow\n3) أعد تحميل الصفحة ثم اضغط تسجيل مرة أخرى.\n\nإذا كان التطبيق على الشاشة الرئيسية: قائمة Chrome → Settings → Site settings → Microphone → Allow لهذا الموقع.',
      voiceNeedsHttps: 'الملاحظات الصوتية تحتاج اتصال https آمن. افتح التطبيق من رابط موقع Empire.',
      voiceNeedsBrowser: 'الملاحظات الصوتية تحتاج إذن الميكروفون. استخدم Chrome أو Safari على هاتفك.',
      voiceNoMic: 'لم يتم العثور على ميكروفون في هذا الجهاز.',
      voiceMicBusy: 'الميكروفون مشغول. أغلق التطبيقات الأخرى التي تستخدمه ثم حاول مرة أخرى.',
      photoTitleJob: 'صورة العمل',
      photoTitleInvoice: 'صورة الفاتورة',
      photoTitleCompletion: 'صورة الإنجاز',
      photoTitleAdd: 'إضافة صورة',
      photoTakeCamera: 'التقاط صورة (الكاميرا)',
      photoChooseGallery: 'اختيار من المعرض',
      photoCancel: 'إلغاء',
      fixNoteOptional: 'ملاحظة (اختياري)',
      fixMaterialsOptional: 'المواد المستخدمة (اختياري)',
      fixAddPhoto: 'إضافة صورة',
      fixCameraOrGallery: 'الكاميرا أو المعرض',
      fixAddPhotoAria: 'إضافة صورة الإنجاز',
      fixPhotoMaxHint: function (p) {
        return 'حتى ' + (p.max || 3) + ' صور — الكاميرا أو المعرض';
      },
      fixPhotoMaxReached: function (p) {
        return 'يمكنك إضافة حتى ' + (p.max || 3) + ' صور. احذف واحدة لإضافة أخرى.';
      },
      fixMarkFixed: 'تحديد كمُصلح',
      fixMarkFixedPhotos: function (p) {
        var n = p.count || 0;
        return 'تحديد كمُصلح (' + n + ' صورة)';
      },
      fixUploading: 'جارٍ رفع الصورة…',
      fixNoteLabel: 'ملاحظة:',
      fixJobNeedsWorkers: function (p) {
        var need = p.need || 2;
        var done = p.done || 0;
        var s = 'هذه المهمة تحتاج إلى <strong>' + need + ' عمال</strong> ليأخذ كل منهم صوراً.';
        if (done) s += ' <span>(' + done + '/' + need + ' مكتمل)</span>';
        return s;
      },
      fixSavedOnDevice: 'تم الحفظ على هذا الجهاز',
      fixPendingSync: 'بانتظار الإنترنت لرفع صورك وتحديد هذه المهمة كمُصلحة. أبقِ هذه الصفحة مفتوحة أو عد لاحقاً.',
      fixRetryUpload: 'إعادة الرفع الآن',
      fixRetryHint: 'عند تحسّن الإشارة، اضغط إعادة الرفع. صورك وملاحظاتك محفوظة بالفعل على هذا الهاتف.',
      fixBannerTitle: function (p) {
        var n = p.count || 0;
        return n + ' إصلاح مهمة بانتظار الرفع';
      },
      fixBannerSubtitle: 'محفوظ على هذا الهاتف — اضغط إعادة المحاولة عند توفر الإشارة.',
      fixBannerRetry: 'إعادة الرفع',
      fixSavedWillRetry: 'تم الحفظ على هذا الجهاز. ارفع عند توفر الإشارة — اضغط إعادة الرفع.',
      fixSaveOnDevice: function (p) {
        var n = p.count || 0;
        return 'حفظ على الجهاز (' + n + ' صورة) — أعد المحاولة لاحقاً';
      },
      fixSaving: 'جارٍ الحفظ\u2026',
      fixSavingOnDevice: 'جارٍ الحفظ على هذا الجهاز\u2026',
      fixYourPhotosPending: 'صورك (لم تُرفع بعد)',
      fixPhotoN: function (p) { return 'صورة ' + (p.index || 1); },
      fixOnDevice: 'على الجهاز',
      fixWaitingSignal: 'بانتظار الرفع عند توفر الإشارة.',
      fixLoadingSaved: 'جارٍ تحميل الإصلاح المحفوظ…',
      fixAlreadyFixed: 'لقد حددت هذه المهمة كمُصلحة مسبقاً.',
      fixNoMorePhotos: 'لا يمكنك إضافة المزيد من الصور لهذه المشكلة.',
      fixYourSubmittedPhotos: 'صورك المُرسلة',
      fixYourVoiceNote: 'ملاحظتك الصوتية',
      fixWaitingOthers: function (p) {
        return 'بانتظار العمال الآخرين لإكمال هذه المهمة (' + (p.done || 0) + '/' + (p.need || 0) + ' مكتمل).';
      },
      fixRemovePhotoAria: 'إزالة الصورة',
      modalJob: 'مهمة',
      locEnable: 'تفعيل الموقع',
      locTryAgain: 'حاول مرة أخرى'
    }
  };

  function workerNormalizeLang_(lang) {
    lang = String(lang || '').toLowerCase();
    if (lang === 'ckb' || lang === 'ar') return lang;
    return 'en';
  }

  function workerLangLoad_() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'ckb' || saved === 'en' || saved === 'ar') return saved;
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
    return _lang === 'ckb' || _lang === 'ar';
  }

  function workerApplyRtl_() {
    var app = document.getElementById('workerApp');
    if (app) app.classList.toggle('worker-rtl', workerIsRtl());
    if (document.body.classList.contains('civil-worker-mode')) {
      document.documentElement.setAttribute('dir', workerIsRtl() ? 'rtl' : 'ltr');
      document.documentElement.setAttribute('lang', _lang === 'ar' ? 'ar' : (_lang === 'ckb' ? 'ckb' : 'en'));
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
    lang = workerNormalizeLang_(lang);
    _lang = lang;
    workerLangSave_(lang);
    workerApplyRtl_();
    workerApplyStaticLang_();
    workerRefreshDynamicLang_();
  }

  function workerToggleLang() {
    var i = LANGS.indexOf(_lang);
    if (i < 0) i = 0;
    workerSetLang(LANGS[(i + 1) % LANGS.length]);
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
