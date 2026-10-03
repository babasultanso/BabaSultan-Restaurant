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

  // Note on production environment requirements:
  // VITE_API_BASE_URL is required for production frontends.
  // In production builds where VITE_API_BASE_URL is not set, we gracefully resolve relative endpoints
  // so that Vercel serverless functions /api or reverse proxies work seamlessly without breaking the client.
  const isProd = (import.meta as any).env?.PROD;
  if (isProd) {
    return '';
  }

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
