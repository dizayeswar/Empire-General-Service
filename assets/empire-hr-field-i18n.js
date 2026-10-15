/**
 * Line manager and employee leave page — English, Arabic, Sorani Kurdish.
 * The HR-F-06 paper stays in its locked English layout.
 */
(function () {
  var STORAGE_KEY = 'empire_hr_field_lang';
  var LANGS = ['en', 'ar', 'ckb'];
  var _lang = 'en';

  var STR = {
    en: {
      navSaved: 'Leave requests',
      navSigned: 'Archive',
      navTeam: 'My employees',
      navRefresh: 'Refresh',
      navSettings: 'Settings',
      navHub: 'Hub',
      navLogout: 'Logout',
      themeLight: 'Light Mode',
      themeDark: 'Dark Mode',
      deptTitle: 'HR Department',
      deptSub: 'Leave request — HR-F-06',
      loggedIn: function (p) { return 'Logged in as: ' + (p.name || ''); },
      listTitle: 'Leave requests',
      signedTitle: 'Archive',
      teamTitle: 'My employees',
      listHelpDual: 'Select papers and <strong>Confirm selected</strong>. Choose <strong>Employee box</strong> or <strong>Line Manager box</strong> — only that box gets your stamp. Confirmed papers are kept in <strong>Archive</strong>.',
      listHelpEmp: 'Your leave papers, and papers HR assigned to you. Stamp the <strong>Employee box</strong> on your own paper. After you confirm, the paper is kept in <strong>Archive</strong>.',
      listHelpLine: 'Papers HR assigned to you. <strong>Confirm selected</strong> puts your e-signature in the Line Manager box, then each paper is kept in <strong>Archive</strong> and goes to the director.',
      listEmptyDual: 'Your leave requests and papers waiting for you as line manager appear here. Confirm selected asks Employee box or Line Manager box.',
      listEmptyEmp: 'When HR saves a leave paper with your name, it appears here. Stamp the Employee box only.',
      listEmptyLine: 'When HR assigns a paper to you, it appears here to sign. After you confirm, it goes to the director.',
      listEmpty: 'No leave requests yet.',
      signedHelp: 'Papers you confirmed with your e-signature. <strong>Pending</strong> means the director has not signed yet. <strong>Director confirmed</strong> means the director signed.',
      teamHelp: 'Your own row is first, then the people assigned to you as line manager, with code, job title, department, division, days left, joining date, and the e-signature on the account.',
      status: 'Status',
      search: 'Search',
      all: 'All',
      pending: 'Pending',
      directorConfirmed: 'Director confirmed',
      searchSigned: 'Name, ID, type…',
      searchTeam: 'Name, code, job…',
      select: 'Select',
      confirmSelected: 'Confirm selected',
      cancel: 'Cancel',
      view: 'View',
      printPdf: 'Print / PDF',
      confirm: 'Confirm',
      colHash: '#',
      colEmployee: 'Employee',
      colDepartment: 'Department',
      colType: 'Type',
      colDates: 'Dates',
      colDays: 'Days',
      colStatus: 'Status',
      colCode: 'Code',
      colName: 'Name',
      colJob: 'Job title',
      colDivision: 'Division',
      colSig: 'E-signature',
      colDaysLeft: 'Days left',
      colJoining: 'Joining',
      id: 'ID',
      signedAs: 'Signed as',
      signedOn: 'Signed on',
      replacement: 'Replacement',
      directorSigned: 'Director signed',
      slotEmp: 'Employee',
      slotLine: 'Line Manager',
      slotBoth: 'Employee / Line Manager',
      slotDirector: 'Director',
      slotSig: 'E-signature',
      savedCount: function (p) {
        var n = p.n || 0;
        return n + ' leave request' + (n === 1 ? '' : 's');
      },
      selectedCount: function (p) {
        var n = p.n || 0;
        return n ? (n + ' selected') : 'Select papers';
      },
      stageSaved: function (p) { return 'Leave requests (' + (p.n || 0) + ')'; },
      signedSummary: function (p) {
        if (!p.n) return 'No signed papers yet.';
        return p.n + ' signed paper' + (p.n === 1 ? '' : 's') + ' · ' + (p.pending || 0) + ' pending · ' + (p.confirmed || 0) + ' director confirmed';
      },
      signedEmpty: 'When you confirm a paper, it is kept here in Archive with the ID, dates, days, and whether the director has confirmed.',
      signedHead: function (p) { return 'Archive (' + (p.n || 0) + ')'; },
      teamCount: function (p) {
        var n = p.n || 0;
        return n + ' employee' + (n === 1 ? '' : 's');
      },
      teamEmpty: 'No employees are assigned to you.',
      loading: 'Loading…',
      waitingFor: function (p) { return 'Waiting for ' + (p.name || ''); },
      st_submitted: 'Submitted',
      st_pending_line: 'Pending line manager',
      st_line_approved: 'Line manager approved',
      st_pending_director: 'Pending Director',
      st_director_approved: 'Completed',
      st_completed: 'Completed',
      st_processed: 'Completed',
      st_rejected: 'Rejected',
      typeLateness: 'Lateness',
      typeAnnual: 'Annual leave',
      typeSick: 'Sick leave',
      typeUnpaid: 'Unpaid Leave',
      typeBereavement: 'Bereavement',
      typeMarriage: 'Marriage Leave',
      typeOther: 'Other',
      whichBox: 'Which box?',
      boxHelp: 'Choose one box. Your e-signature goes only there, then the paper goes to the director.',
      empBox: 'Employee box',
      empBoxHint: 'Stamp the Employee box only, then send to the director.',
      lineBox: 'Line Manager box',
      lineBoxHint: 'Stamp the Line Manager box only, then send to the director.',
      printTitle: 'Print or PDF?',
      printHelp: 'Choose one. Print sends the papers to the printer. PDF saves a file on this computer.',
      print: 'Print',
      printHint: 'Open the print window and send to the printer.',
      savePdf: 'Save as PDF',
      savePdfHint: 'Download the papers as a PDF file.',
      returnSaved: 'Return to leave requests',
      returnSigned: 'Return to archive',
      signedLine: function (p) { return 'Signed ' + (p.n || 0) + '. Sent to the director.'; },
      signedEmp: function (p) { return 'Employee e-signature placed on ' + (p.n || 0) + '.'; },
      signedEmpDirector: function (p) { return 'Employee e-signature placed on ' + (p.n || 0) + '. Sent to the director.'; },
      selectFirst: 'Select papers first.',
      selectEmpFirst: 'Select papers first, then choose Employee box or Line Manager box.',
      selectLineFirst: 'Select papers waiting for you as line manager.',
      openFailed: 'Could not open this paper.',
      confirmFailed: 'Confirm failed',
      partialSigned: function (p) { return (p.ok || 0) + ' signed, ' + (p.bad || 0) + ' could not be signed.'; },
      needSig: 'Your e-signature is not on this account yet. Ask admin to upload it on Users, or open a paper and upload it once.',
      langLabel: 'Language',
      settingsHelp: 'Language, appearance, and account.'
    },
    ar: {
      navSaved: 'طلبات الإجازة',
      navSigned: 'الأرشيف',
      navTeam: 'موظفيني',
      navRefresh: 'تحديث',
      navSettings: 'الإعدادات',
      navHub: 'الرئيسية',
      navLogout: 'خروج',
      themeLight: 'الوضع الفاتح',
      themeDark: 'الوضع الداكن',
      deptTitle: 'الموارد البشرية',
      deptSub: 'طلب إجازة — HR-F-06',
      loggedIn: function (p) { return 'مسجّل الدخول: ' + (p.name || ''); },
      listTitle: 'طلبات الإجازة',
      signedTitle: 'الأرشيف',
      teamTitle: 'موظفيني',
      listHelpDual: 'حدّد الأوراق ثم <strong>تأكيد المحدد</strong>. اختر <strong>خانة الموظف</strong> أو <strong>خانة المدير المباشر</strong> — الختم يذهب إلى تلك الخانة فقط. الأوراق المؤكدة تُحفظ في <strong>الأرشيف</strong>.',
      listHelpEmp: 'أوراق إجازتك، والأوراق التي عيّنتها لك الموارد البشرية. ضع الختم في <strong>خانة الموظف</strong> على ورقتك. بعد التأكيد تُحفظ في <strong>الأرشيف</strong>.',
      listHelpLine: 'أوراق عيّنتها لك الموارد البشرية. <strong>تأكيد المحدد</strong> يضع توقيعك في خانة المدير المباشر، ثم تُحفظ كل ورقة في <strong>الأرشيف</strong> وتذهب إلى المدير.',
      listEmptyDual: 'طلبات إجازتك والأوراق التي تنتظرك كمدير مباشر تظهر هنا. تأكيد المحدد يسألك: خانة الموظف أو خانة المدير المباشر.',
      listEmptyEmp: 'عندما تحفظ الموارد البشرية ورقة إجازة باسمك، تظهر هنا. الختم في خانة الموظف فقط.',
      listEmptyLine: 'عندما تعيّن لك الموارد البشرية ورقة، تظهر هنا للتوقيع. بعد التأكيد تذهب إلى المدير.',
      listEmpty: 'لا توجد طلبات إجازة بعد.',
      signedHelp: 'الأوراق التي أكّدتها بتوقيعك. <strong>قيد الانتظار</strong> يعني أن المدير لم يوقّع بعد. <strong>أكدها المدير</strong> يعني أن المدير وقّع.',
      teamHelp: 'صفك أولاً، ثم الأشخاص المعيّنون لك كمدير مباشر، مع الرمز والمسمى والقسم والشعبة والأيام المتبقية وتاريخ المباشرة والتوقيع.',
      status: 'الحالة',
      search: 'بحث',
      all: 'الكل',
      pending: 'قيد الانتظار',
      directorConfirmed: 'أكدها المدير',
      searchSigned: 'الاسم، الرمز، النوع…',
      searchTeam: 'الاسم، الرمز، الوظيفة…',
      select: 'تحديد',
      confirmSelected: 'تأكيد المحدد',
      cancel: 'إلغاء',
      view: 'عرض',
      printPdf: 'طباعة / PDF',
      confirm: 'تأكيد',
      colHash: '#',
      colEmployee: 'الموظف',
      colDepartment: 'القسم',
      colType: 'النوع',
      colDates: 'التواريخ',
      colDays: 'الأيام',
      colStatus: 'الحالة',
      colCode: 'الرمز',
      colName: 'الاسم',
      colJob: 'المسمى الوظيفي',
      colDivision: 'الشعبة',
      colSig: 'التوقيع',
      colDaysLeft: 'الأيام المتبقية',
      colJoining: 'تاريخ المباشرة',
      id: 'الرمز',
      signedAs: 'وُقّع بصفة',
      signedOn: 'تاريخ التوقيع',
      replacement: 'البديل',
      directorSigned: 'توقيع المدير',
      slotEmp: 'الموظف',
      slotLine: 'المدير المباشر',
      slotBoth: 'الموظف / المدير المباشر',
      slotDirector: 'المدير',
      slotSig: 'توقيع',
      savedCount: function (p) {
        var n = p.n || 0;
        if (n === 1) return 'طلب إجازة واحد';
        if (n === 2) return 'طلبا إجازة';
        return n + ' طلبات إجازة';
      },
      selectedCount: function (p) {
        var n = p.n || 0;
        return n ? (n + ' محدد') : 'حدّد الأوراق';
      },
      stageSaved: function (p) { return 'طلبات الإجازة (' + (p.n || 0) + ')'; },
      signedSummary: function (p) {
        if (!p.n) return 'لا توجد أوراق موقّعة بعد.';
        return p.n + ' ورقة موقّعة · ' + (p.pending || 0) + ' قيد الانتظار · ' + (p.confirmed || 0) + ' أكدها المدير';
      },
      signedEmpty: 'عندما تؤكد التوقيع، تُحفظ الورقة هنا مع الرمز والتواريخ والأيام وهل أكدها المدير.',
      signedHead: function (p) { return 'الأرشيف (' + (p.n || 0) + ')'; },
      teamCount: function (p) {
        var n = p.n || 0;
        if (n === 1) return 'موظف واحد';
        if (n === 2) return 'موظفان';
        return n + ' موظفين';
      },
      teamEmpty: 'لا يوجد موظفون معيّنون لك.',
      loading: 'جارٍ التحميل…',
      waitingFor: function (p) { return 'بانتظار ' + (p.name || ''); },
      st_submitted: 'مُرسل',
      st_pending_line: 'بانتظار المدير المباشر',
      st_line_approved: 'وافق المدير المباشر',
      st_pending_director: 'بانتظار المدير',
      st_director_approved: 'مكتمل',
      st_completed: 'مكتمل',
      st_processed: 'مكتمل',
      st_rejected: 'مرفوض',
      typeLateness: 'تأخير',
      typeAnnual: 'إجازة سنوية',
      typeSick: 'إجازة مرضية',
      typeUnpaid: 'إجازة بدون راتب',
      typeBereavement: 'إجازة وفاة',
      typeMarriage: 'إجازة زواج',
      typeOther: 'أخرى',
      whichBox: 'أي خانة؟',
      boxHelp: 'اختر خانة واحدة. توقيعك يذهب إليها فقط، ثم تذهب الورقة إلى المدير.',
      empBox: 'خانة الموظف',
      empBoxHint: 'الختم في خانة الموظف فقط، ثم الإرسال إلى المدير.',
      lineBox: 'خانة المدير المباشر',
      lineBoxHint: 'الختم في خانة المدير المباشر فقط، ثم الإرسال إلى المدير.',
      printTitle: 'طباعة أم PDF؟',
      printHelp: 'اختر واحداً. الطباعة ترسل الأوراق إلى الطابعة. PDF يحفظ ملفاً.',
      print: 'طباعة',
      printHint: 'فتح نافذة الطباعة والإرسال إلى الطابعة.',
      savePdf: 'حفظ PDF',
      savePdfHint: 'تنزيل الأوراق كملف PDF.',
      returnSaved: 'العودة إلى طلبات الإجازة',
      returnSigned: 'العودة إلى الأرشيف',
      signedLine: function (p) { return 'تم توقيع ' + (p.n || 0) + '. أُرسلت إلى المدير.'; },
      signedEmp: function (p) { return 'وُضع توقيع الموظف على ' + (p.n || 0) + '.'; },
      signedEmpDirector: function (p) { return 'وُضع توقيع الموظف على ' + (p.n || 0) + '. أُرسلت إلى المدير.'; },
      selectFirst: 'حدّد الأوراق أولاً.',
      selectEmpFirst: 'حدّد الأوراق أولاً، ثم اختر خانة الموظف أو خانة المدير المباشر.',
      selectLineFirst: 'حدّد الأوراق التي تنتظرك كمدير مباشر.',
      openFailed: 'تعذّر فتح هذه الورقة.',
      confirmFailed: 'فشل التأكيد',
      partialSigned: function (p) { return (p.ok || 0) + ' وُقّعت، و' + (p.bad || 0) + ' تعذّر توقيعها.'; },
      needSig: 'توقيعك غير موجود على هذا الحساب بعد. اطلب من المسؤول رفعه، أو ارفعه مرة واحدة من ورقة.',
      langLabel: 'اللغة',
      settingsHelp: 'اللغة والمظهر والحساب.'
    },
    ckb: {
      navSaved: 'داواکاری مۆڵەت',
      navSigned: 'ئەرشیف',
      navTeam: 'کارمەندەکانم',
      navRefresh: 'نوێکردنەوە',
      navSettings: 'ڕێکخستن',
      navHub: 'سەرەکی',
      navLogout: 'چوونەدەرەوە',
      themeLight: 'دۆخی ڕووناک',
      themeDark: 'دۆخی تاریک',
      deptTitle: 'سەرچاوە مرۆییەکان',
      deptSub: 'داواکاری مۆڵەت — HR-F-06',
      loggedIn: function (p) { return 'چوویتە ژوورەوە: ' + (p.name || ''); },
      listTitle: 'داواکارییەکانی مۆڵەت',
      signedTitle: 'ئەرشیف',
      teamTitle: 'کارمەندەکانم',
      listHelpDual: 'کاغەزەکان هەڵبژێرە و <strong>پەسەندکردنی هەڵبژێردراو</strong> دابگرە. <strong>خانەی کارمەند</strong> یان <strong>خانەی بەڕێوەبەری ڕاستەوخۆ</strong> هەڵبژێرە — مۆرەکە تەنها دەچێتە ئەو خانەیە. کاغەزە پەسەندکراوەکان لە <strong>ئەرشیف</strong> دەمێننەوە.',
      listHelpEmp: 'کاغەزی مۆڵەتی خۆت، و ئەوانەی سەرچاوە مرۆییەکان بۆ تۆی دیاری کردووە. مۆر لە <strong>خانەی کارمەند</strong> دابنێ. دوای پەسەندکردن لە <strong>ئەرشیف</strong> دەمێنێتەوە.',
      listHelpLine: 'کاغەزەکان کە سەرچاوە مرۆییەکان بۆ تۆی دیاری کردووە. <strong>پەسەندکردنی هەڵبژێردراو</strong> واژۆکەت دەخاتە خانەی بەڕێوەبەری ڕاستەوخۆ، پاشان هەر کاغەزێک لە <strong>ئەرشیف</strong> دەمێنێتەوە و دەچێتە لای بەڕێوەبەر.',
      listEmptyDual: 'داواکارییەکانی مۆڵەتی خۆت و کاغەزەکان کە وەک بەڕێوەبەری ڕاستەوخۆ چاوەڕێتن لێرە دەردەکەون. پەسەندکردنی هەڵبژێردراو دەپرسێت: خانەی کارمەند یان خانەی بەڕێوەبەری ڕاستەوخۆ.',
      listEmptyEmp: 'کاتێک سەرچاوە مرۆییەکان کاغەزێک بە ناوی تۆ دەپارێزن، لێرە دەردەکەوێت. مۆر تەنها لە خانەی کارمەند.',
      listEmptyLine: 'کاتێک کاغەزێکت بۆ دەنێردرێت، لێرە دەردەکەوێت بۆ واژۆ. دوای پەسەندکردن دەچێتە لای بەڕێوەبەر.',
      listEmpty: 'هێشتا هیچ داواکارییەک نییە.',
      signedHelp: 'ئەو کاغەزانەی بە واژۆی خۆت پەسەندت کردوون. <strong>چاوەڕوان</strong> واتە بەڕێوەبەر هێشتا واژۆی نەکردووە. <strong>بەڕێوەبەر پەسەندی کرد</strong> واتە بەڕێوەبەر واژۆی کردووە.',
      teamHelp: 'ڕیزی خۆت یەکەمە، پاشان ئەو کەسانەی وەک بەڕێوەبەری ڕاستەوخۆ بۆت دیاری کراون، لەگەڵ کۆد و ناونیشانی کار و بەش و یەکە و ڕۆژی ماوە و بەرواری دەستبەکاربوون و واژۆ.',
      status: 'دۆخ',
      search: 'گەڕان',
      all: 'هەموو',
      pending: 'چاوەڕوان',
      directorConfirmed: 'بەڕێوەبەر پەسەندی کرد',
      searchSigned: 'ناو، کۆد، جۆر…',
      searchTeam: 'ناو، کۆد، کار…',
      select: 'هەڵبژاردن',
      confirmSelected: 'پەسەندکردنی هەڵبژێردراو',
      cancel: 'پاشگەزبوونەوە',
      view: 'بینین',
      printPdf: 'چاپ / PDF',
      confirm: 'پەسەندکردن',
      colHash: '#',
      colEmployee: 'کارمەند',
      colDepartment: 'بەش',
      colType: 'جۆر',
      colDates: 'بەروارەکان',
      colDays: 'ڕۆژ',
      colStatus: 'دۆخ',
      colCode: 'کۆد',
      colName: 'ناو',
      colJob: 'ناونیشانی کار',
      colDivision: 'یەکە',
      colSig: 'واژۆ',
      colDaysLeft: 'ڕۆژی ماوە',
      colJoining: 'دەستبەکاربوون',
      id: 'کۆد',
      signedAs: 'واژۆ وەک',
      signedOn: 'بەرواری واژۆ',
      replacement: 'جێگر',
      directorSigned: 'واژۆی بەڕێوەبەر',
      slotEmp: 'کارمەند',
      slotLine: 'بەڕێوەبەری ڕاستەوخۆ',
      slotBoth: 'کارمەند / بەڕێوەبەری ڕاستەوخۆ',
      slotDirector: 'بەڕێوەبەر',
      slotSig: 'واژۆ',
      savedCount: function (p) {
        var n = p.n || 0;
        return n + ' داواکاری مۆڵەت';
      },
      selectedCount: function (p) {
        var n = p.n || 0;
        return n ? (n + ' هەڵبژێردراو') : 'کاغەزەکان هەڵبژێرە';
      },
      stageSaved: function (p) { return 'داواکارییەکانی مۆڵەت (' + (p.n || 0) + ')'; },
      signedSummary: function (p) {
        if (!p.n) return 'هێشتا هیچ کاغەزێکی واژۆکراو نییە.';
        return p.n + ' کاغەزی واژۆکراو · ' + (p.pending || 0) + ' چاوەڕوان · ' + (p.confirmed || 0) + ' بەڕێوەبەر پەسەندی کرد';
      },
      signedEmpty: 'کاتێک واژۆیەک پەسەند دەکەیت، کاغەزەکە لێرە دەمێنێتەوە لەگەڵ کۆد و بەروار و ڕۆژ و ئەوەی بەڕێوەبەر پەسەندی کردووە یان نا.',
      signedHead: function (p) { return 'ئەرشیف (' + (p.n || 0) + ')'; },
      teamCount: function (p) {
        var n = p.n || 0;
        return n + ' کارمەند';
      },
      teamEmpty: 'هیچ کارمەندێک بۆ تۆ دیاری نەکراوە.',
      loading: 'بارکردن…',
      waitingFor: function (p) { return 'چاوەڕوانی ' + (p.name || ''); },
      st_submitted: 'نێردراو',
      st_pending_line: 'چاوەڕوانی بەڕێوەبەری ڕاستەوخۆ',
      st_line_approved: 'بەڕێوەبەری ڕاستەوخۆ پەسەندی کرد',
      st_pending_director: 'چاوەڕوانی بەڕێوەبەر',
      st_director_approved: 'تەواو',
      st_completed: 'تەواو',
      st_processed: 'تەواو',
      st_rejected: 'ڕەتکرایەوە',
      typeLateness: 'درەنگکەوتن',
      typeAnnual: 'مۆڵەتی ساڵانە',
      typeSick: 'مۆڵەتی نەخۆشی',
      typeUnpaid: 'مۆڵەتی بێ مووچە',
      typeBereavement: 'مۆڵەتی مەرگ',
      typeMarriage: 'مۆڵەتی هاوسەرگیری',
      typeOther: 'هیتر',
      whichBox: 'کام خانە؟',
      boxHelp: 'یەک خانە هەڵبژێرە. واژۆکەت تەنها دەچێتە ئەوێ، پاشان کاغەزەکە دەچێتە لای بەڕێوەبەر.',
      empBox: 'خانەی کارمەند',
      empBoxHint: 'مۆر تەنها لە خانەی کارمەند، پاشان ناردن بۆ بەڕێوەبەر.',
      lineBox: 'خانەی بەڕێوەبەری ڕاستەوخۆ',
      lineBoxHint: 'مۆر تەنها لە خانەی بەڕێوەبەری ڕاستەوخۆ، پاشان ناردن بۆ بەڕێوەبەر.',
      printTitle: 'چاپ یان PDF؟',
      printHelp: 'یەکێک هەڵبژێرە. چاپ کاغەزەکان دەنێرێت بۆ چاپکەر. PDF فایلێک دەپارێزێت.',
      print: 'چاپ',
      printHint: 'پەنجەرەی چاپ بکەرەوە و بنێرە بۆ چاپکەر.',
      savePdf: 'پاشەکەوت وەک PDF',
      savePdfHint: 'کاغەزەکان وەک فایلی PDF دابگرە.',
      returnSaved: 'گەڕانەوە بۆ داواکارییەکانی مۆڵەت',
      returnSigned: 'گەڕانەوە بۆ ئەرشیف',
      signedLine: function (p) { return (p.n || 0) + ' واژۆ کرا. نێردرا بۆ بەڕێوەبەر.'; },
      signedEmp: function (p) { return 'واژۆی کارمەند دانرا لەسەر ' + (p.n || 0) + '.'; },
      signedEmpDirector: function (p) { return 'واژۆی کارمەند دانرا لەسەر ' + (p.n || 0) + '. نێردرا بۆ بەڕێوەبەر.'; },
      selectFirst: 'سەرەتا کاغەزەکان هەڵبژێرە.',
      selectEmpFirst: 'سەرەتا کاغەزەکان هەڵبژێرە، پاشان خانەی کارمەند یان خانەی بەڕێوەبەری ڕاستەوخۆ.',
      selectLineFirst: 'ئەو کاغەزانە هەڵبژێرە کە وەک بەڕێوەبەری ڕاستەوخۆ چاوەڕێتن.',
      openFailed: 'نەتوانرا ئەم کاغەزە بکرێتەوە.',
      confirmFailed: 'پەسەندکردن سەرنەکەوت',
      partialSigned: function (p) { return (p.ok || 0) + ' واژۆ کرا، ' + (p.bad || 0) + ' نەتوانرا واژۆ بکرێت.'; },
      needSig: 'واژۆکەت هێشتا لەسەر ئەم هەژمارە نییە. داوا لە بەڕێوەبەر بکە باری بکات، یان جارێک لەسەر کاغەزێک باری بکە.',
      langLabel: 'زمان',
      settingsHelp: 'زمان، ڕووکار، و هەژمار.'
    }
  };

  function loadLang() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (LANGS.indexOf(saved) >= 0) return saved;
    } catch (e) {}
    return 'en';
  }

  function saveLang(lang) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
  }

  function fieldOn() {
    return document.body.classList.contains('hr-field-nav');
  }

  function hrFieldT(key, fallback, params) {
    if (!fieldOn()) {
      if (typeof fallback === 'function') return fallback(params || {});
      return fallback != null ? String(fallback) : String(key || '');
    }
    var lang = _lang;
    var pack = STR[lang] || STR.en;
    var val = pack[key];
    if (val == null && lang !== 'en') val = STR.en[key];
    if (typeof val === 'function') return val(params || {});
    if (val != null) return String(val);
    if (typeof fallback === 'function') return fallback(params || {});
    return fallback != null ? String(fallback) : String(key || '');
  }

  function applyStatic() {
    document.querySelectorAll('[data-hr-i18n]').forEach(function (el) {
      el.textContent = hrFieldT(el.getAttribute('data-hr-i18n'), el.textContent);
    });
    document.querySelectorAll('[data-hr-i18n-html]').forEach(function (el) {
      el.innerHTML = hrFieldT(el.getAttribute('data-hr-i18n-html'), el.innerHTML);
    });
    document.querySelectorAll('[data-hr-i18n-placeholder]').forEach(function (el) {
      el.placeholder = hrFieldT(el.getAttribute('data-hr-i18n-placeholder'), el.placeholder);
    });
    var signed = document.getElementById('hrSignedFilter');
    if (signed) {
      Array.prototype.forEach.call(signed.options, function (opt) {
        if (opt.value === '') opt.textContent = hrFieldT('all', 'All');
        else if (opt.value === 'pending') opt.textContent = hrFieldT('pending', 'Pending');
        else if (opt.value === 'confirmed') opt.textContent = hrFieldT('directorConfirmed', 'Director confirmed');
      });
    }
    var who = document.getElementById('whoLabel');
    if (who && fieldOn() && typeof empireGetUser === 'function') {
      who.textContent = hrFieldT('loggedIn', 'Logged in as: ' + (empireGetUser() || ''), { name: empireGetUser() || '' });
    }
    var themeLbl = document.querySelector('#hrSettingsPanel .theme-btn .lbl');
    if (themeLbl && fieldOn()) {
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      themeLbl.textContent = hrFieldT(dark ? 'themeDark' : 'themeLight', dark ? 'Dark Mode' : 'Light Mode');
    }
    var ret = document.getElementById('hrReturnBtn');
    var ret2 = document.getElementById('hrReturnBtn2');
    if (typeof hrReturnBtnLabel_ === 'function' && fieldOn()) {
      var label = hrReturnBtnLabel_();
      if (ret && ret.style.display !== 'none') ret.textContent = label;
      if (ret2 && ret2.style.display !== 'none') ret2.textContent = label;
    }
  }

  function markPicker() {
    var pick = document.getElementById('hrLangPick');
    if (!pick) return;
    pick.hidden = !fieldOn();
    Array.prototype.forEach.call(pick.querySelectorAll('[data-hr-lang]'), function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-hr-lang') === _lang);
    });
  }

  function hrApplyFieldLang() {
    var rtl = fieldOn() && (_lang === 'ar' || _lang === 'ckb');
    document.body.classList.toggle('hr-lang-rtl', rtl);
    if (fieldOn()) {
      document.documentElement.setAttribute('lang', _lang === 'ar' ? 'ar' : (_lang === 'ckb' ? 'ckb' : 'en'));
    }
    markPicker();
    if (!fieldOn()) return;
    applyStatic();
    if (typeof hrListHelp_ === 'function') hrListHelp_();
    if (typeof hrRefreshLists_ === 'function') hrRefreshLists_();
    if (typeof hrRenderTeam_ === 'function' && window._hrTeamLoaded) hrRenderTeam_();
  }

  function hrSetFieldLang(lang) {
    if (LANGS.indexOf(lang) < 0) lang = 'en';
    _lang = lang;
    saveLang(lang);
    hrApplyFieldLang();
  }

  window.hrFieldT = hrFieldT;
  window.hrFieldLang = function () { return fieldOn() ? _lang : 'en'; };
  window.hrSetFieldLang = hrSetFieldLang;
  window.hrApplyFieldLang = hrApplyFieldLang;

  _lang = loadLang();
})();
