/**
 * Production API Configuration
 *
 * The API can live on a separate backend host (for example Render) while the
 * React/Firebase frontend stays on its existing host. Set VITE_API_BASE_URL
 * at build time in the frontend deployment.
 */

export function getApiBaseUrl(): string {
  // 1. Explicit environment variable
  const envUrl = (import.meta as any).env?.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // 2. Browser runtime fallback: keep relative URLs when frontend and API share a host.

  // 3. Default to relative paths for local development or same-host hosting.
  return '';
}

export function getApiUrl(endpoint: string): string {
  const base = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return base ? `${base}${cleanEndpoint}` : cleanEndpoint;
}
