const DEFAULT_TIMEOUT = 15000;
const MAX_RETRIES = 3;

export async function fetchWithRetry(url: string, options: RequestInit = {}, retries = MAX_RETRIES): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

  const headers = new Headers(options.headers);
  if (!headers.has('User-Agent')) {
    headers.set('User-Agent', '(WXHQ, contact@example.com)');
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, { ...options, headers, signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok && attempt < retries - 1) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500));
        continue;
      }
      return response;
    } catch (err) {
      clearTimeout(timeout);
      if (attempt === retries - 1) throw err;
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500));
    }
  }
  throw new Error(`Failed after ${retries} retries: ${url}`);
}
