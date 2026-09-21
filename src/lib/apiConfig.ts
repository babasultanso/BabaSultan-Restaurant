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

  // When deployed externally as a standalone static bundle (not on same origin),
  // VITE_API_BASE_URL is required for production frontends.
  if ((import.meta as any).env?.PROD && typeof window !== 'undefined' && window.location.origin.includes('vercel.app') && !envUrl) {
    throw new Error('VITE_API_BASE_URL is required for production frontends.');
  }

  // 2. Relative API paths for unified same-origin fullstack server
  return '';
}

export function getApiUrl(endpoint: string): string {
  const base = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (!base) {
    return cleanEndpoint;
  }
  // Prevent duplicate `/api` prefix when base ends with `/api` and endpoint begins with `/api`
  if (base.endsWith('/api') && (cleanEndpoint === '/api' || cleanEndpoint.startsWith('/api/'))) {
    return `${base}${cleanEndpoint.slice(4)}`;
  }
  return `${base}${cleanEndpoint}`;
}
