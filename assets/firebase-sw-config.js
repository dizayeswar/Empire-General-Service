/* Firebase config for service worker — config.js is imported first in service-worker.js */
var FIREBASE_SW_CONFIG = (typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG) ? FIREBASE_CONFIG : {
  apiKey: '',
  authDomain: '',
  projectId: '',
  messagingSenderId: '',
  appId: ''
};
