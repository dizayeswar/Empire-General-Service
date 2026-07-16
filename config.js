/** Empire World EGS — shared config (Phase 2) */
const GOOGLE_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbz-qxaEXcGH_b8g-k7RmwIV3f16MDHZV-VMUxoYS5YFeGaWlKyURfLwfOoVXQ1ONyYO/exec';
const APP_VERSION = '2026-07-16-voice-v1';

/** Firebase Cloud Messaging — fill in after creating a Firebase project (see DEPLOY.md) */
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAWm3bIX9PQu0xPY-EweFIGXIKWQ4S4vGk',
  authDomain: 'empire-egs.firebaseapp.com',
  projectId: 'empire-egs',
  messagingSenderId: '143673442856',
  appId: '1:143673442856:web:e56c4ac419052b117deb1d'
};
const FIREBASE_VAPID_KEY = 'BBkZTIpFXTarrnHyIErzlZihB4veRsdS7JOu9gBdZjUwS0oOIxj92ELRQXPvz88M4VY40Xu40LB0Um5QqLTinEI';

/** Supabase Storage — fill in after creating a project (see SUPABASE-MIGRATION.md) */
const SUPABASE_CONFIG = {
  url: 'https://nobcitpaudeopzfymgzi.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vYmNpdHBhdWRlb3B6ZnltZ3ppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMjEyNzMsImV4cCI6MjA5OTY5NzI3M30.mI4SBx5klT_FN6EPQNrGYaWKuujaRGADYEkr00zJorQ',       // Project Settings → API → anon public key (paste here)
  bucket: 'empire-photos'
};
