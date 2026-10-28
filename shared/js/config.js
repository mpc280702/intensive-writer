/* Public runtime configuration. Keep secrets exclusively on the API server.
 * Leave apiBaseUrl empty on a demo-only GitHub Pages deployment. When an HTTPS API
 * is deployed, set it here (for example https://api.example.com). Registration is
 * intentionally opt-in in both this file and the API service. */
window.IW_CONFIG = window.IW_CONFIG || {
  apiBaseUrl: '',
  allowStudentSignup: false,
  googleClientId: '509797338497-8rmk6lsn7u65dlnkqqf404pqdjd09ja1.apps.googleusercontent.com'
};
