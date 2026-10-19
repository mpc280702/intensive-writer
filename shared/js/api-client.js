(function () {
  function baseUrl() {
    const configured = String((window.IW_CONFIG && window.IW_CONFIG.apiBaseUrl) || '').trim().replace(/\/+$/, '');
    if (configured) return configured;
    if (/\.github\.io$/i.test(window.location.hostname)) return '';
    return window.location.origin;
  }
  async function request(path, options) {
    options = options || {};
    const base = baseUrl();
    if (!base) throw new Error('API_NOT_CONFIGURED');
    const headers = new Headers(options.headers || {});
    if (options.body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const response = await fetch(base + path, { ...options, headers, credentials: 'include', cache: 'no-store' });
    const type = response.headers.get('content-type') || '';
    const payload = type.includes('application/json') ? await response.json().catch(function () { return {}; }) : {};
    if (!response.ok) {
      const error = new Error(payload.message || payload.error || 'REQUEST_FAILED');
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }
  window.IWApi = { baseUrl: baseUrl, isConfigured: function () { return Boolean(baseUrl()); }, request: request };
})();