const API_BASE = '/api';

const API = {
  token: localStorage.getItem('token') || null,

  setToken(t) { this.token = t; localStorage.setItem('token', t); },
  clearToken() { this.token = null; localStorage.removeItem('token'); },
  setUser(u) { localStorage.setItem('user', JSON.stringify(u)); },
  getUser() {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); }
    catch { return null; }
  },
  clearUser() { localStorage.removeItem('user'); },
  logout() { this.clearToken(); this.clearUser(); },

  async request(method, path, body = null) {
    const headers = {};
    if (this.token) headers['Authorization'] = 'Bearer ' + this.token;
    if (body !== null) headers['Content-Type'] = 'application/json';

    const opts = { method, headers };
    if (body !== null) opts.body = JSON.stringify(body);

    const res = await fetch(API_BASE + path, opts);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { error: text }; }

    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  },

  get(p) { return this.request('GET', p); },
  post(p, b) { return this.request('POST', p, b); },
  put(p, b) { return this.request('PUT', p, b); },
  del(p, b) { return this.request('DELETE', p, b); }
};
