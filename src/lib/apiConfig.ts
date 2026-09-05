/**
 * Production API Configuration
 * 
 * Manages dynamic routing between local/Cloud Run environments and external deployments (e.g. Vercel).
 * When running on Vercel or external static hosting, routes trusted backend operations directly to Cloud Run
 * where Google Cloud Application Default Credentials (ADC) and Firebase Admin SDK are initialized.
 */

export function getApiBaseUrl(): string {
  // 1. Explicit environment variable
  const envUrl = (import.meta as any).env?.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // 2. Production frontends must explicitly declare their trusted backend.
  // This avoids accidentally sending a Vercel/custom-domain build to the wrong
  // same-origin path or to an obsolete backend.
  if ((import.meta as any).env?.PROD) {
    throw new Error('VITE_API_BASE_URL is required for production frontends. Configure the intended trusted backend explicitly.');
  }

  // 3. Relative API paths are development-only.
  return '';
}

export function getApiUrl(endpoint: string): string {
  const base = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return base ? `${base}${cleanEndpoint}` : cleanEndpoint;
}
