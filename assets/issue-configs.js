/* Empire World EGS — per-department issue tracker config (Phase 2 Step 2.5) */
var ISSUE_CONFIGS = {
  civil: {
    prefix: 'civ',
    dept: 'civil issue',
    workerMode: true,
    engineerCanMarkFixed: false,
    shareDept: 'Civil Issue',
    sharePrefix: 'Empire World — Civil Issue',
    requireFixByName: false,
    reportBtnId: 'dlCivilBtn',
    excelBtnId: 'xlCivilBtn',
    reportTitle: 'Empire World — Civil Issues Report',
    reportPageTitle: 'Empire Civil Issues Report',
    reportFilePrefix: 'Empire-Civil-Issues-',
    resetSuccessMsg: 'All civil issue data has been deleted.',
    maxAssignWorkers: 4,
    gpsTrades: ['wood', 'tiles', 'plumber', 'painting'],
    jobPage: 'civil-issue.html',
    routedDisposition: 'not_civil',
    ui: {
      routedBadge: 'Not Civil Dept',
      notDeptTabLabel: 'Not Civil Dept',
      notDeptPageTitle: 'Not Civil Department',
      notDeptHint: 'Issues that were reviewed and do not belong in Civil. Re-create them in Electric, Fire, or the correct department.',
      routeConfirm: 'Move this issue out of Civil?\n\nIt will go to the "Not Civil Department" section. You can re-create it in Electric, Fire, or the correct department.',
      routeSuccess: 'Issue moved to Not Civil Department.',
      restoreConfirm: 'Restore this issue to the Civil queue?',
      restoreSuccess: 'Issue restored to Civil queue.',
      routedBanner: 'Not Civil Department — this issue was routed out of the Civil queue. Re-create it in the correct department (Electric, Fire, etc.).',
      routeButton: 'Not Civil Department',
      restoreButton: 'Restore to Civil queue',
      emptyIssues: 'No civil issues match.',
      routedListSummary: 'issue(s) routed away from Civil',
      routedListEmpty: 'No issues here yet. Use the orange button on a civil issue card to move misfiled reports here.',
      routedCountLabel: 'in Not Civil Dept',
      deptShortName: 'Civil'
    },
    tradeGroups: [
      { id: 'wood', label: 'Carpentry' },
      { id: 'tiles', label: 'Tiles' },
      { id: 'plumber', label: 'Plumber' },
      { id: 'painting', label: 'Painting' }
    ],
    civilWorkers: {
      wood: [
        { id: 'mohammed_luqman', name: 'Mohammed Luqman' },
        { id: 'saeed_shahuth', name: 'Saeed Shahuth' },
        { id: 'shakhwan_dilshad', name: 'Shakhwan Dilshad' },
        { id: 'abdulsamad_sulaiaman', name: 'Abdulsamad Sulaiaman' }
      ],
      tiles: [
        { id: 'mohammed_qasim', name: 'Mohammed Qasim' },
        { id: 'rayan_hazhar', name: 'Rayan Hazhar' },
        { id: 'farman_ahmed', name: 'Farman Ahmed' }
      ],
      plumber: [
        { id: 'sear_samad', name: 'Sear Samad' },
        { id: 'aram_majid', name: 'Aram Majid' },
        { id: 'dlawar_kamal', name: 'Dlawar Kamal' },
        { id: 'shwan_ali', name: 'Shwan Ali' },
        { id: 'abdulsamad_sulaiaman', name: 'Abdulsamad Sulaiaman' }
      ],
      painting: [
        { id: 'halmat_abozaid', name: 'Halmat Abozaid' },
        { id: 'sardam_sardar', name: 'Sardam Sardar' },
        { id: 'farman_ahmed', name: 'Farman Ahmed' },
        { id: 'rayan_hazhar', name: 'Rayan Hazhar' }
      ]
    },
    actions: {
      get: 'getCivilIssues',
      add: 'addCivilIssue',
      delete: 'deleteCivilIssue',
      markFixed: 'markCivilFixed',
      clear: 'clearCivilIssues',
      assign: 'assignCivilIssue',
      routeNotCivil: 'markCivilNotDept',
      restoreCivil: 'restoreCivilIssue',
      setFixDelay: 'setCivilFixDelay',
      reportLocation: 'reportWorkerLocation',
      getLocations: 'getWorkerLocations',
      savePushToken: 'saveWorkerPushToken',
      testPush: 'testWorkerPush',
      debugPush: 'debugWorkerPush'
    },
    spots: ['Service stairs','Main stairs','Service door','Rooftop door','Exit door','Elevator','Wall','Ceiling','Corridor','Basement','Rooftop','Garden','Parking','Other'],
    issueTypes: ['Water leakage','Broken tiles','Door is broken','Door handle is broken','Wall needs repainting','No rooftop door','No service door','Mold / damp','Cracked wall','Other']
  },
  fire: {
    prefix: 'fire',
    dept: 'fire',
    shareDept: 'Fire / Mechanical Issue',
    sharePrefix: 'Empire World — Fire / Mechanical Issue',
    requireFixByName: false,
    reportBtnId: 'dlFireBtn',
    excelBtnId: 'xlFireBtn',
    reportTitle: 'Empire World — Fire Fighting & Mechanical Report',
    reportPageTitle: 'Empire Fire Fighting & Mechanical Report',
    reportFilePrefix: 'Empire-Fire-Mechanical-Issues-',
    resetSuccessMsg: 'All fire fighting & mechanical issue data has been deleted.',
    actions: {
      get: 'getFireIssues',
      add: 'addFireIssue',
      delete: 'deleteFireIssue',
      markFixed: 'markFireFixed',
      clear: 'clearFireIssues'
    },
    spots: ['Service stairs','Main stairs','Service door','Rooftop door','Exit door','Elevator','Wall','Ceiling','Corridor','Basement','Rooftop','Garden','Parking','Pump room','Generator room','Other'],
    issueTypes: ['Fire extinguisher expired','Fire extinguisher missing','Fire extinguisher discharged','Fire alarm malfunction','Sprinkler head damaged','Sprinkler pipe leaking','Fire hose reel damaged','Smoke detector missing','Smoke detector malfunction','Fire door damaged','Emergency exit blocked','Pump room issue','HVAC / AC issue','Generator issue','Other']
  },
  electric: {
    prefix: 'elec',
    dept: 'electric issue',
    workerMode: true,
    engineerCanMarkFixed: false,
    shareDept: 'Electric Issue',
    sharePrefix: 'Empire World — Electric Issue',
    requireFixByName: false,
    reportBtnId: 'dlElecBtn',
    excelBtnId: 'xlElecBtn',
    reportTitle: 'Empire World — Electric Issues Report',
    reportPageTitle: 'Empire Electric Issues Report',
    reportFilePrefix: 'Empire-Electric-Issues-',
    resetSuccessMsg: 'All electric issue data has been deleted.',
    maxAssignWorkers: 4,
    gpsTrades: ['electric'],
    jobPage: 'electric-issue.html',
    routedDisposition: 'not_electric',
    ui: {
      routedBadge: 'Not Electric Dept',
      notDeptTabLabel: 'Not Electric Dept',
      notDeptPageTitle: 'Not Electric Department',
      notDeptHint: 'Issues that were reviewed and do not belong in Electric. Re-create them in Civil, Fire, or the correct department.',
      routeConfirm: 'Move this issue out of Electric?\n\nIt will go to the "Not Electric Department" section. You can re-create it in Civil, Fire, or the correct department.',
      routeSuccess: 'Issue moved to Not Electric Department.',
      restoreConfirm: 'Restore this issue to the Electric queue?',
      restoreSuccess: 'Issue restored to Electric queue.',
      routedBanner: 'Not Electric Department — this issue was routed out of the Electric queue. Re-create it in the correct department (Civil, Fire, etc.).',
      routeButton: 'Not Electric Department',
      restoreButton: 'Restore to Electric queue',
      emptyIssues: 'No electric issues match.',
      routedListSummary: 'issue(s) routed away from Electric',
      routedListEmpty: 'No issues here yet. Use the orange button on an electric issue card to move misfiled reports here.',
      routedCountLabel: 'in Not Electric Dept',
      deptShortName: 'Electric'
    },
    tradeGroups: [
      { id: 'electric', label: 'Electricians' }
    ],
    civilWorkers: {
      electric: [
        { id: 'hashim_omar', name: 'Hashim Omar' },
        { id: 'ibrahim_sadi', name: 'Ibrahim Sadi' },
        { id: 'ahmad_sadullah', name: 'Ahmad Sadullah' },
        { id: 'mariwan_saeed', name: 'Mariwan Saeed' },
        { id: 'soran_ibrahim', name: 'Soran Ibrahim' },
        { id: 'darbaz_majid', name: 'Darbaz Majid' },
        { id: 'jasim_muhammad', name: 'Jasim Muhammad' },
        { id: 'chia_mustafa', name: 'Chia Mustafa' },
        { id: 'wrya_muhammad', name: 'Wrya Muhammad' },
        { id: 'ibrahim_muhammad', name: 'Ibrahim Muhammad' },
        { id: 'muhammad_hassan', name: 'Muhammad Hassan' },
        { id: 'harim_sarkawt', name: 'Harim Sarkawt' }
      ]
    },
    actions: {
      get: 'getElectricIssues',
      add: 'addElectricIssue',
      delete: 'deleteElectricIssue',
      markFixed: 'markElectricFixed',
      clear: 'clearElectricIssues',
      assign: 'assignElectricIssue',
      routeNotCivil: 'markElectricNotDept',
      restoreCivil: 'restoreElectricIssue',
      setFixDelay: 'setElectricFixDelay',
      reportLocation: 'reportWorkerLocation',
      getLocations: 'getWorkerLocations',
      savePushToken: 'saveWorkerPushToken',
      testPush: 'testWorkerPush',
      debugPush: 'debugWorkerPush'
    },
    spots: ['Service stairs','Main stairs','Service door','Rooftop door','Exit door','Elevator','Wall','Ceiling','Corridor','Basement','Rooftop','Garden','Parking','Other'],
    issueTypes: ['Power outage','Broken light','Flickering light','Faulty socket / outlet','Broken switch','Exposed / loose wire','Tripped breaker','Burnt smell','No power in area','Generator issue','Distribution panel issue','Other'],
    workerFieldReport: {
      enabled: true,
      photoFolder: 'issues/electric-field',
      voiceDraftId: 'electric-field-report',
      actions: {
        add: 'addElectricWorkerReport',
        get: 'getElectricWorkerReports'
      },
      ui: {
        jobsTab: 'Assigned jobs',
        reportTab: 'Add report',
        deptTabLabel: 'Field Reports',
        deptTabHint: 'Reports submitted by electric field workers from their phones (photo, place, note, voice).',
        submitSuccess: 'Report sent to Electrical Department.',
        placePlaceholder: 'Where? e.g. WW-12 corridor, ES-4 parking…',
        notePlaceholder: 'What did you find or do?',
        amountPlaceholder: 'IQD — leave empty for maintenance',
        amountHint: 'Leave empty for maintenance. Enter an amount for refundable work.'
      }
    }
  }
};
