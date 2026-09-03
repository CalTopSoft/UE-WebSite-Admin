// js/core/api.js
const API = (() => {
  function getToken() {
    return localStorage.getItem('uzx_admin_token');
  }

  async function request(method, path, body = null, auth = false, extraHeaders = {}) {
    const headers = { 'Content-Type': 'application/json', ...extraHeaders };
    if (auth) {
      const token = getToken();
      if (!token) throw new Error('No autenticado');
      headers['Authorization'] = `Bearer ${token}`;
    }

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(CONFIG.API_BASE + path, opts);
    const data = await res.json();

    if (!res.ok || !data.success) {
      if (auth && res.status === 401) {
        localStorage.removeItem('uzx_admin_token');
        window.location.href = 'index.html';
      }
      throw new Error(data.message || `Error ${res.status}`);
    }
    return data;
  }

  return {
    get:    (path, auth = false)       => request('GET',    path, null, auth),
    post:   (path, body, auth = false) => request('POST',   path, body, auth),
    put:    (path, body, auth = false) => request('PUT',    path, body, auth),
    patch:  (path, body, auth = false) => request('PATCH',  path, body, auth),
    delete: (path, auth = false)       => request('DELETE', path, null, auth),

    // Authenticated shortcuts
    aGet:    (path)       => request('GET',    path, null, true),
    aPost:   (path, body) => request('POST',   path, body, true),
    aPut:    (path, body) => request('PUT',    path, body, true),
    aPatch:  (path, body) => request('PATCH',  path, body, true),
    aDelete: (path)       => request('DELETE', path, null, true),

    // Authenticated shortcuts CON headers extra (ej: x-backup-key)
    aPostH: (path, body, extraHeaders) => request('POST', path, body, true, extraHeaders),
    aGetH:  (path, extraHeaders)       => request('GET',  path, null, true, extraHeaders),
  };
})();