import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path, { dirname } from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { defineConfig, Plugin } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

function firebaseBuildVerificationPlugin(): Plugin {
  return {
    name: 'firebase-build-verification',
    buildStart() {
      const isProd = process.env.NODE_ENV === 'production';
      if (!isProd) return;

      let fileConfig: any = {};
      try {
        const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
        if (fs.existsSync(configPath)) {
          fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
      } catch {}

      const apiKey = process.env.VITE_FIREBASE_API_KEY || fileConfig.apiKey;
      const projectId = process.env.VITE_FIREBASE_PROJECT_ID || fileConfig.projectId;
      const authDomain = process.env.VITE_FIREBASE_AUTH_DOMAIN || fileConfig.authDomain;
      const appId = process.env.VITE_FIREBASE_APP_ID || fileConfig.appId;

      const missing: string[] = [];
      if (!apiKey) missing.push('VITE_FIREBASE_API_KEY');
      if (!projectId) missing.push('VITE_FIREBASE_PROJECT_ID');
      if (!authDomain) missing.push('VITE_FIREBASE_AUTH_DOMAIN');
      if (!appId) missing.push('VITE_FIREBASE_APP_ID');

      if (missing.length > 0) {
        throw new Error(
          `[Production Build Verification Failed] Missing required Firebase frontend configuration: ${missing.join(', ')}. ` +
          `Provide them as environment variables (or Docker --build-arg) or populate firebase-applet-config.json.`
        );
      }
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), firebaseBuildVerificationPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
