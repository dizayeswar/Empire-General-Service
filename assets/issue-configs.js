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
    shareDept: 'Electric Issue',
    sharePrefix: 'Empire World — Electric Issue',
    requireFixByName: false,
    reportBtnId: 'dlElecBtn',
    excelBtnId: 'xlElecBtn',
    reportTitle: 'Empire World — Electric Issues Report',
    reportPageTitle: 'Empire Electric Issues Report',
    reportFilePrefix: 'Empire-Electric-Issues-',
    resetSuccessMsg: 'All electric issue data has been deleted.',
    actions: {
      get: 'getElectricIssues',
      add: 'addElectricIssue',
      delete: 'deleteElectricIssue',
      markFixed: 'markElectricFixed',
      clear: 'clearElectricIssues'
    },
    spots: ['Service stairs','Main stairs','Service door','Rooftop door','Exit door','Elevator','Wall','Ceiling','Corridor','Basement','Rooftop','Garden','Parking','Other'],
    issueTypes: ['Power outage','Broken light','Flickering light','Faulty socket / outlet','Broken switch','Exposed / loose wire','Tripped breaker','Burnt smell','No power in area','Generator issue','Distribution panel issue','Other']
  }
};
