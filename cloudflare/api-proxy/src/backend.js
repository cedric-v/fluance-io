// Shared upstream call helper. Firebase Cloud Functions remain the source of
// truth; the Worker only proxies and shapes responses.

export const DEFAULT_BACKEND_ORIGIN =
  'https://europe-west1-fluance-protected-content.cloudfunctions.net';

/**
 * Call a Firebase Cloud Function by name.
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 */
export async function callBackend(env, functionName, {method = 'GET', query, body} = {}) {
  const origin = (env && env.BACKEND_ORIGIN) || DEFAULT_BACKEND_ORIGIN;
  const url = new URL(`${origin}/${functionName}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }

  const init = {method, headers: {}};
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const response = await fetch(url, init);
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return {ok: response.ok, status: response.status, data};
}
