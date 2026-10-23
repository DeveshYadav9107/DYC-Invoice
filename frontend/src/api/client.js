// ─────────────────────────────────────────────────────────────────
// API Client — Centralized fetch client with credential cookies
// ─────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export function getApiUrl(endpoint) {
  if (endpoint.startsWith('http')) return endpoint;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE}${cleanEndpoint}`;
}

export async function request(endpoint, options = {}) {
  const url = getApiUrl(endpoint);

  const defaultHeaders = {};
  if (!(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const config = {
    ...options,
    credentials: 'include', // Send HTTP-only session cookie automatically
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  const response = await fetch(url, config);

  // If response is a file download (like CSV or blob)
  const contentType = response.headers.get('content-type') || '';
  if (
    contentType.includes('text/csv') ||
    contentType.includes('application/octet-stream') ||
    contentType.includes('application/pdf') ||
    contentType.includes('image/')
  ) {
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    return response.blob();
  }

  let data;
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const errorMsg = data.error || data.message || `Request failed with status ${response.status}`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  get: (endpoint) => request(endpoint, { method: 'GET' }),
  post: (endpoint, body) =>
    request(endpoint, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  patch: (endpoint, body) =>
    request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  delete: (endpoint) => request(endpoint, { method: 'DELETE' }),
};

export default api;
