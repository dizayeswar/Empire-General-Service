/**
 * Cleaning supervisor mobile — English / Sorani (ckb).
 */
(function () {
  var STORAGE_KEY = 'empire_cleaning_lang';
  var _lang = 'en';

  var STRINGS = {
    en: {
      langToggle: 'کوردی',
      langToggleAria: 'Switch to Kurdish',
      appTitle: 'Cleaning Tasks',
      appSub: 'Supervisor',
      logout: 'Logout',
      logoutConfirmTitle: 'Log out?',
      logoutConfirmLead: 'Enter your login password to confirm logout.',
      logoutPasswordLabel: 'Password',
      logoutPasswordPlaceholder: 'Your login password',
      logoutCancel: 'Cancel',
      logoutConfirmBtn: 'Log out',
      logoutNeedPassword: 'Enter your password.',
      logoutWrongPassword: 'Wrong password. Try again.',
      logoutChecking: 'Checking password…',
      logoutVerifyFailed: 'Could not verify password. Check your signal and try again.',
      loginTitle: 'Cleaning Supervisor',
      loginUser: 'Username',
      loginPass: 'Password',
      loginBtn: 'Sign in',
      signingIn: 'Signing in…',
      myProjects: 'My projects',
      tasks: 'Tasks',
      analytics: 'Analytics',
      monthly: 'Monthly',
      back: 'Back',
      week: function (p) { return 'Week ' + (p.n || 1); },
      weekProgress: function (p) { return (p.done || 0) + '/' + (p.total || 0); },
      weekLocked: 'Finish the previous week first',
      weekComplete: 'Week complete',
      weekUnlockedPush: function (p) { return 'Week ' + (p.n || '') + ' unlocked'; },
      takePhoto: 'Take photo',
      addPhoto: 'Add photo',
      cameraOnly: 'Camera only — max 3 photos',
      cameraOrUpload: 'Camera or gallery — max 3 photos',
      sourceTaken: 'Taken',
      sourceUploaded: 'Uploaded',
      photosReady: function (p) {
        return (p.count || 0) + ' photo' + ((p.count || 0) === 1 ? '' : 's') + ' ready';
      },
      photoMax: 'Maximum 3 photos. Remove one to add another.',
      confirmSave: 'Confirm & save',
      saving: 'Saving…',
      uploading: 'Uploading…',
      savedOffline: 'Saved on this device. Will upload when you have signal.',
      synced: function (p) {
        return (p.count || 0) + ' offline upload' + ((p.count || 0) === 1 ? '' : 's') + ' synced.';
      },
      offlineWaiting: function (p) {
        return (p.count || 0) + ' photo upload' + ((p.count || 0) === 1 ? '' : 's') + ' waiting';
      },
      noConnection: 'No connection — photos will sync when you are back online.',
      taskDoneHint: 'A task is done only when it has a saved photo',
      gpsOn: 'GPS on',
      gpsOff: 'GPS off — enable location',
      gpsDenied: 'Location permission needed for GPS tracking',
      pushEnable: 'Allow notifications',
      pushHint: 'Get alerts for weeks, sync, reminders, and daily tasks',
      pushReady: 'Notifications on',
      noProjects: 'No projects assigned to this account.',
      loadError: 'Could not load data. Check your signal.',
      removePhoto: 'Remove',
      openPhoto: 'Open photo',
      dailyTasks: 'Daily Tasks',
      otherTasks: 'Other tasks',
      monthLabel: 'Month',
      generate: 'Generate',
      noPhotosYet: 'No photos yet',
      progress: 'Progress',
      refresh: 'Refresh',
      installHint: 'Add to Home Screen for the full app',
      notSupervisor: 'This account is not a cleaning supervisor.',
      needPhotoGps: 'Waiting for GPS…',
      photosCount: function (p) {
        var n = p.count || 0;
        return '✓ ' + n + ' photo' + (n === 1 ? '' : 's');
      }
    },
    ckb: {
      langToggle: 'English',
      langToggleAria: 'Switch to English',
      appTitle: 'کارەکانی خاوێنکردنەوە',
      appSub: 'سەرپەرشتیار',
      logout: 'دەرچوون',
      logoutConfirmTitle: 'دەرچوون؟',
      logoutConfirmLead: 'وشەی نهێنی بنووسە بۆ دڵنیابوون لە دەرچوون.',
      logoutPasswordLabel: 'وشەی نهێنی',
      logoutPasswordPlaceholder: 'وشەی نهێنیی چوونەژوورەوە',
      logoutCancel: 'پاشگەزبوونەوە',
      logoutConfirmBtn: 'دەرچوون',
      logoutNeedPassword: 'وشەی نهێنی بنووسە.',
      logoutWrongPassword: 'وشەی نهێنی هەڵەیە. دووبارە هەوڵ بدە.',
      logoutChecking: 'پشکنینی وشەی نهێنی…',
      logoutVerifyFailed: 'نەتوانرا پشتڕاست بکرێتەوە. سەیری ئینتەرنێت بکە.',
      loginTitle: 'سەرپەرشتیاری خاوێنکردنەوە',
      loginUser: 'ناوی بەکارهێنەر',
      loginPass: 'وشەی نهێنی',
      loginBtn: 'چوونەژوورەوە',
      signingIn: 'چوونەژوورەوە…',
      myProjects: 'پڕۆژەکانم',
      tasks: 'ئەرکەکان',
      analytics: 'شیکاری',
      monthly: 'مانگانە',
      back: 'گەڕانەوە',
      week: function (p) { return 'هەفتەی ' + (p.n || 1); },
      weekProgress: function (p) { return (p.done || 0) + '/' + (p.total || 0); },
      weekLocked: 'سەرەتا هەفتەی پێشوو تەواو بکە',
      weekComplete: 'هەفتە تەواو بوو',
      weekUnlockedPush: function (p) { return 'هەفتەی ' + (p.n || '') + ' کرایەوە'; },
      takePhoto: 'وێنە بگرە',
      addPhoto: 'وێنە زیادبکە',
      cameraOnly: 'تەنها کامێرا — زۆرترین ٣ وێنە',
      cameraOrUpload: 'کامێرا یان گالەری — زۆرترین ٣ وێنە',
      sourceTaken: 'گیراو',
      sourceUploaded: 'بارکراو',
      photosReady: function (p) {
        return (p.count || 0) + ' وێنە ئامادەیە';
      },
      photoMax: 'زۆرترین ٣ وێنە. یەکێک بسڕەوە بۆ زیادکردن.',
      confirmSave: 'دڵنیابوون و پاشەکەوت',
      saving: 'پاشەکەوت…',
      uploading: 'بارکردن…',
      savedOffline: 'لەسەر ئەم ئامێرە پاشەکەوت کرا. کاتێک ئینتەرنێت هەبوو بار دەکرێت.',
      synced: function (p) {
        return (p.count || 0) + ' بارکردنی ئۆفلاین سینک بوو.';
      },
      offlineWaiting: function (p) {
        return (p.count || 0) + ' وێنە چاوەڕوانی بارکردنە';
      },
      noConnection: 'ئینتەرنێت نییە — وێنەکان دواتر سینک دەبن.',
      taskDoneHint: 'ئەرک تەنها کاتێک تەواوە کە وێنەی هەبێت',
      gpsOn: 'GPS کارا',
      gpsOff: 'GPS ناکارا — شوێن چالاک بکە',
      gpsDenied: 'مۆڵەتی شوێن پێویستە',
      pushEnable: 'ڕێگەدان بە ئاگادارکردنەوە',
      pushHint: 'ئاگادارکردنەوە بۆ هەفتە، سینک، بیرخستنەوە و کارەکانی ڕۆژانە',
      pushReady: 'ئاگادارکردنەوە کارا',
      noProjects: 'هیچ پڕۆژەیەک بۆ ئەم هەژمارە دیاری نەکراوە.',
      loadError: 'زانیاری بار نەبوو. سەیری ئینتەرنێت بکە.',
      removePhoto: 'سڕینەوە',
      openPhoto: 'کردنەوەی وێنە',
      dailyTasks: 'کارەکانی ڕۆژانە',
      otherTasks: 'کارەکانی تر',
      monthLabel: 'مانگ',
      generate: 'دروستکردن',
      noPhotosYet: 'هێشتا وێنە نییە',
      progress: 'پێشکەوتن',
      refresh: 'نوێکردنەوە',
      installHint: 'زیادی بکە بۆ سکرینی سەرەکی',
      notSupervisor: 'ئەم هەژمارە سەرپەرشتیاری خاوێنکردنەوە نییە.',
      needPhotoGps: 'چاوەڕوانی GPS…',
      photosCount: function (p) {
        return '✓ ' + (p.count || 0) + ' وێنە';
      }
    }
  };

  /** English task names stay as storage keys; Kurdish is display-only. */
  var TASK_CKB = {
    'Cleaning garden': 'خاوێنکردنەوەی باخچە',
    'Cleaning area': 'خاوێنکردنەوەی ناوچە',
    'Cleaning road': 'خاوێنکردنەوەی ڕێگا',
    'Floor mopping': 'مۆپکردنی نهۆم',
    'Elevator mopping': 'مۆپکردنی لیفت',
    'Cleaning basement': 'خاوێنکردنەوەی ژێرزەمین',
    'Ground mopping': 'مۆپکردنی زەوی',
    'Around building cleaning (ride-on scrubber dryer)': 'خاوێنکردنەوەی دەوروبەری بینا (ئامێری سواربوون)',
    'Walk-behind scrubber dryer': 'ئامێری پاککردنەوەی پاشەوەڕۆ',
    'Rooftops cleaning': 'خاوێنکردنەوەی بان',
    'Floor cleaning (floor scrubber machine)': 'خاوێنکردنەوەی نهۆم (ئامێری نهۆم)',
    'Cleaning balcony': 'خاوێنکردنەوەی باڵکۆن',
    'Ground cleaning (ride-on scrubber dryer)': 'خاوێنکردنەوەی زەوی (ئامێری سواربوون)',
    'Basement 1 & Basement 2 (ride-on scrubber dryer)': 'ژێرزەمینی ١ و ٢ (ئامێری سواربوون)',
    'Restaurant floor cleaning (ride-on scrubber dryer)': 'خاوێنکردنەوەی نهۆمی چێشتخانە (ئامێری سواربوون)',
    'Washing garbage room': 'شوشتنی ژووری زبڵ',
    'Cleaning glass': 'خاوێنکردنەوەی شووشە',
    'Washing all floors': 'شوشتنی هەموو نهۆمەکان',
    'Washing trash container': 'شوشتنی سەبەتەی زبڵ',
    'Ground mopping and washing': 'مۆپکردن و شوشتنی زەوی',
    'Basement mopping and washing': 'مۆپکردن و شوشتنی ژێرزەمین',
    'Cleaning trash can': 'خاوێنکردنەوەی زبڵدان',
    'Washing stairs': 'شوشتنی پلەکان',
    'Gates between properties': 'دەروازەکانی نێوان موڵکەکان',
    'Basement garbage room washing (WW12-WW15)': 'شوشتنی ژووری زبڵی ژێرزەمین (WW12-WW15)',
    'Area washing': 'شوشتنی ناوچە',
    'Washing around building': 'شوشتنی دەوروبەری بینا'
  };

  var FREQ_CKB = {
    'Once a Week': 'جارێک لە هەفتەیەکدا',
    'Once Every 2 Weeks': 'جارێک لە هەر ٢ هەفتەیەکدا',
    'Once or Twice a Week': 'جارێک یان دووجار لە هەفتەیەکدا',
    'Once or Twice a Month': 'جارێک یان دووجار لە مانگێکدا',
    'Once a Month': 'جارێک لە مانگێکدا'
  };

  function cleaningTaskLabel(englishName) {
    var name = String(englishName || '');
    if (_lang !== 'ckb') return name;
    return TASK_CKB[name] || name;
  }

  function cleaningGroupLabel(englishLabel) {
    var name = String(englishLabel || '');
    if (_lang !== 'ckb') return name;
    return FREQ_CKB[name] || name;
  }

  function detectLang() {
    try {
      var s = localStorage.getItem(STORAGE_KEY);
      if (s === 'ckb' || s === 'en') return s;
    } catch (e) {}
    return 'en';
  }

  function cleaningSetLang(lang) {
    _lang = lang === 'ckb' ? 'ckb' : 'en';
    try { localStorage.setItem(STORAGE_KEY, _lang); } catch (e) {}
    document.documentElement.lang = _lang === 'ckb' ? 'ckb' : 'en';
    document.documentElement.dir = 'ltr';
    document.body && document.body.classList.toggle('lang-ckb', _lang === 'ckb');
  }

  function cleaningGetLang() { return _lang; }

  function cleaningT(key, params) {
    var pack = STRINGS[_lang] || STRINGS.en;
    var v = pack[key];
    if (v == null) v = (STRINGS.en || {})[key];
    if (typeof v === 'function') return v(params || {});
    return v != null ? v : key;
  }

  function cleaningApplyI18n(root) {
    root = root || document;
    root.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (key) el.textContent = cleaningT(key);
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-placeholder');
      if (key) el.setAttribute('placeholder', cleaningT(key));
    });
    root.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-aria');
      if (key) el.setAttribute('aria-label', cleaningT(key));
    });
  }

  _lang = detectLang();
  window.cleaningT = cleaningT;
  window.cleaningSetLang = cleaningSetLang;
  window.cleaningGetLang = cleaningGetLang;
  window.cleaningApplyI18n = cleaningApplyI18n;
  window.cleaningTaskLabel = cleaningTaskLabel;
  window.cleaningGroupLabel = cleaningGroupLabel;
})();
