/** Empire World EGS — shared config (Phase 2) */
const GOOGLE_SCRIPT_URL_LEGACY =
  'https://script.google.com/macros/s/AKfycbz-qxaEXcGH_b8g-k7RmwIV3f16MDHZV-VMUxoYS5YFeGaWlKyURfLwfOoVXQ1ONyYO/exec';

/**
 * After Supabase cutover, set this to the Edge Function URL, e.g.
 * 'https://nobcitpaudeopzfymgzi.supabase.co/functions/v1/empire-api'
 * Leave empty to keep using Google Apps Script (safe default).
 */
const EMPIRE_API_URL = 'https://nobcitpaudeopzfymgzi.supabase.co/functions/v1/empire-api';

/** Active API — used by all pages (legacy name kept for compatibility). */
const GOOGLE_SCRIPT_URL = EMPIRE_API_URL || GOOGLE_SCRIPT_URL_LEGACY;
const EMPIRE_API_ENDPOINT = GOOGLE_SCRIPT_URL;

const APP_VERSION = '2026-08-31-hr-pill';

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
