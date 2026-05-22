import { requireEnv } from './env.mjs';

export function createKommoClient() {
  const subdomain = requireEnv('KOMMO_SUBDOMAIN');
  const token = requireEnv('KOMMO_ACCESS_TOKEN');
  const timeoutMs = Number(process.env.KOMMO_REQUEST_TIMEOUT_MS || 20000);
  const baseUrl = `https://${subdomain}.kommo.com`;

  async function get(path, params = {}) {
    const url = new URL(path, baseUrl);

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      }
    });

    const text = await response.text();
    let body = null;

    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = {
          raw: text.slice(0, 300)
        };
      }
    }

    if (!response.ok) {
      const detail = body?.detail || body?.title || body?.raw || response.statusText;
      throw new Error(`Kommo GET ${url.pathname} falhou (${response.status}): ${detail}`);
    }

    return body;
  }

  async function getAll(path, params = {}) {
    const items = [];
    let page = 1;

    while (true) {
      const body = await get(path, {
        ...params,
        page,
        limit: params.limit || 250
      });
      const embedded = body?._embedded || {};
      const firstCollection = Object.values(embedded).find(Array.isArray);

      if (!firstCollection?.length) {
        break;
      }

      items.push(...firstCollection);

      if (!body?._links?.next?.href) {
        break;
      }

      page += 1;
    }

    return items;
  }

  return {
    get,
    getAll
  };
}
