const AUTH = {
  isLoggedIn() { return !!localStorage.getItem('uzx_admin_token'); },
  getUser()    { return localStorage.getItem('uzx_admin_user') || 'admin'; },
  getToken()   { return localStorage.getItem('uzx_admin_token'); },
  requireAuth() {
    if (!this.isLoggedIn()) window.location.href = 'index.html';
  },
  logout() {
    localStorage.removeItem('uzx_admin_token');
    localStorage.removeItem('uzx_admin_user');
    localStorage.removeItem('uzx_active_squad');
    window.location.href = 'index.html';
  },
};