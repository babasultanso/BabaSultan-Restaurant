import fs from 'node:fs';
import path from 'node:path';

console.log('[BUILD-VERIFICATION] Checking build configuration & environment security...');

// 1. Identify public frontend configuration vs server secrets
const REQUIRED_FRONTEND_KEYS = [
  'projectId',
  'apiKey',
  'authDomain',
  'storageBucket',
  'messagingSenderId',
  'appId'
];

let appletConfig = {};
const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
if (fs.existsSync(configPath)) {
  try {
    appletConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    console.warn('[BUILD-VERIFICATION] Warning: Could not parse firebase-applet-config.json:', e.message);
  }
}

const resolvedConfig = {
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId || '',
  apiKey: process.env.VITE_FIREBASE_API_KEY || appletConfig.apiKey || '',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain || '',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket || '',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId || '',
  appId: process.env.VITE_FIREBASE_APP_ID || appletConfig.appId || '',
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || appletConfig.measurementId || ''
};

// Check for missing frontend public config
const missingKeys = REQUIRED_FRONTEND_KEYS.filter((key) => !resolvedConfig[key] || String(resolvedConfig[key]).trim() === '');

if (missingKeys.length > 0) {
  console.error('[BUILD-VERIFICATION] FATAL: Production build failed. Missing required Firebase frontend configuration:');
  missingKeys.forEach((key) => {
    console.error(`  - VITE_FIREBASE_${key.replace(/[A-Z]/g, (l) => '_' + l).toUpperCase()} or firebase-applet-config.json.${key}`);
  });
  console.error('Frontend build cannot proceed without these client configuration values.');
  process.exit(1);
}

// 2. Security Check: Prevent server secrets from leaking into client-side VITE_ bundle
const FORBIDDEN_SECRET_PATTERNS = [
  /SECRET/i,
  /PRIVATE_KEY/i,
  /SERVICE_ACCOUNT/i,
  /CREDENTIALS/i,
  /SERVER_KEY/i,
  /ADMIN_KEY/i,
  /PASSWORD/i,
  /GEMINI_API_KEY/i
];

const leakingKeys = Object.keys(process.env).filter((envKey) => {
  if (!envKey.startsWith('VITE_')) return false;
  return FORBIDDEN_SECRET_PATTERNS.some((pattern) => pattern.test(envKey));
});

if (leakingKeys.length > 0) {
  console.error('[BUILD-VERIFICATION] CRITICAL SECURITY VIOLATION: Server secrets detected with VITE_ prefix:');
  leakingKeys.forEach((k) => console.error(`  - ${k}`));
  console.error('Never expose server secrets to Vite client bundle! Build aborted.');
  process.exit(1);
}

// 3. Project ID Guard: Ensure GCP_PROJECT_ID is decoupled from FIREBASE_PROJECT_ID
const gcpProject = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID;
if (gcpProject && appletConfig.projectId && process.env.VITE_FIREBASE_PROJECT_ID) {
  if (process.env.VITE_FIREBASE_PROJECT_ID === gcpProject && gcpProject !== appletConfig.projectId) {
    console.error(`[BUILD-VERIFICATION] FATAL: VITE_FIREBASE_PROJECT_ID was set to GCP project ID ("${gcpProject}"), which differs from the Firebase project ID ("${appletConfig.projectId}").`);
    console.error('Decouple GCP_PROJECT_ID from FIREBASE_PROJECT_ID using explicit build args.');
    process.exit(1);
  }
}

console.log('[BUILD-VERIFICATION] Configuration Summary:');
console.log('  - Public Frontend Config: VALID (projectId:', resolvedConfig.projectId, ')');
console.log('  - Server Secrets: ISOLATED (no secrets prefixed with VITE_)');
console.log('  - Build-time Variables: VITE_FIREBASE_* ready for bundle injection');
console.log('  - Runtime Variables: PORT, NODE_ENV handled server-side at runtime');
console.log('[BUILD-VERIFICATION] Verification passed successfully!\n');
