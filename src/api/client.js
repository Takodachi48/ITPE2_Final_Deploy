// src/api/client.js
// Fetch wrapper for the LMS API. See specs/04-frontend.md for the contract.

const configuredBase = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
const API_BASE = configuredBase.replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(status, code, message, details = undefined, requestId = undefined) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.message = message;
    this.details = details;
    this.requestId = requestId;
  }
}

// Single-flight refresh: only one /auth/refresh call at a time.
let refreshPromise = null;

async function doRefresh() {
  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new ApiError(
      response.status,
      'SESSION_EXPIRED',
      'Your session has expired. Sign in again.',
    );
  }

  const payload = await response.json().catch(() => null);
  return payload?.data ?? null;
}

function getRefreshPromise() {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function isAuthPath(path) {
  return path.startsWith('/auth/');
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function request(path, options = {}) {
  const { method = 'GET', body, signal, headers: extraHeaders, skipRefresh = false } = options;

  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;

  const headers = {
    Accept: 'application/json',
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...extraHeaders,
  };

  let response;
  try {
    response = await fetch(url, {
      method,
      credentials: 'include',
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK_ERROR', 'The API is unreachable. Check your connection.');
  }

  const payload = await parseResponse(response);

  if (response.ok) {
    // Unwrap { data, meta }
    if (payload && typeof payload === 'object' && 'data' in payload) {
      return payload.data;
    }
    return payload;
  }

  const errorPayload = payload?.error ?? {};
  const apiError = new ApiError(
    response.status,
    errorPayload.code || 'REQUEST_FAILED',
    errorPayload.message || 'The request failed.',
    errorPayload.details,
    payload?.requestId,
  );

  // 401 handling: attempt a single refresh (unless this is an auth endpoint or already retried).
  if (
    response.status === 401 &&
    !skipRefresh &&
    !isAuthPath(path)
  ) {
    try {
      await getRefreshPromise();
      // Retry the original request once.
      return await request(path, { ...options, skipRefresh: true });
    } catch (refreshError) {
      // Refresh failed: clear state and redirect to login.
      if (typeof window !== 'undefined') {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/login?next=${next}`;
      }
      throw refreshError;
    }
  }

  throw apiError;
}

export function get(path, options = {}) {
  return request(path, { ...options, method: 'GET' });
}

export function post(path, body, options = {}) {
  return request(path, { ...options, method: 'POST', body });
}

export function patch(path, body, options = {}) {
  return request(path, { ...options, method: 'PATCH', body });
}

export function put(path, body, options = {}) {
  return request(path, { ...options, method: 'PUT', body });
}

export function del(path, options = {}) {
  return request(path, { ...options, method: 'DELETE' });
}

// Upload a file to a signed URL with progress reporting.
export function uploadToSignedUrl(url, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && typeof onProgress === 'function') {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new ApiError(xhr.status, 'UPLOAD_FAILED', 'Upload failed.'));
      }
    };

    xhr.onerror = () => {
      reject(new ApiError(0, 'NETWORK_ERROR', 'Upload failed. Check your connection.'));
    };

    xhr.send(file);
  });
}