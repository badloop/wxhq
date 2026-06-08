import { reportError } from './errorBus';

const DEFAULT_TIMEOUT = 15000;
const MAX_RETRIES = 3;

/** Derive a short, user-friendly source label from a request URL. */
function sourceFromUrl(url: string): string {
  if (url.includes('mesonet.agron.iastate.edu')) return 'IEM';
  if (url.includes('api.weather.gov')) return 'NWS API';
  if (url.includes('opengeo.ncep.noaa.gov')) return 'NCEP Radar';
  if (url.includes('spc.noaa.gov')) return 'SPC';
  if (url.includes('nominatim') || url.includes('geocod')) return 'Geocoder';
  try {
    return new URL(url).hostname;
  } catch {
    return 'API';
  }
}

const backoff = (attempt: number) =>
  new Promise<void>((r) => setTimeout(r, Math.pow(2, attempt) * 500));

export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = MAX_RETRIES,
): Promise<Response> {
  const headers = new Headers(options.headers);
  // Add Accept header for NWS API calls (User-Agent cannot be set in browsers)
  if (url.includes('api.weather.gov') && !headers.has('Accept')) {
    headers.set('Accept', 'application/geo+json');
  }

  const source = sourceFromUrl(url);

  for (let attempt = 0; attempt < retries; attempt++) {
    // A fresh controller + timeout per attempt: a timeout on one attempt must
    // not abort subsequent retries (the previous shared-controller version did).
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    try {
      const response = await fetch(url, { ...options, headers, signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok && attempt < retries - 1) {
        await backoff(attempt);
        continue;
      }
      if (!response.ok) {
        // Server reachable but returned an error status, and retries exhausted.
        reportError({
          source,
          message: `Request failed (${response.status} ${response.statusText || 'error'})`,
          detail: url,
          severity: 'warning',
        });
      }
      return response;
    } catch (err) {
      clearTimeout(timeout);
      if (attempt === retries - 1) {
        const isAbort = err instanceof DOMException && err.name === 'AbortError';
        reportError({
          source,
          message: isAbort
            ? `Request timed out after ${DEFAULT_TIMEOUT / 1000}s`
            : 'Network request failed',
          detail: `${url}${err instanceof Error ? ` — ${err.message}` : ''}`,
          severity: 'error',
        });
        throw err;
      }
      await backoff(attempt);
    }
  }

  // Only reachable when retries <= 0.
  throw new Error(`Failed after ${retries} retries: ${url}`);
}
