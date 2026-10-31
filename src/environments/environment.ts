/**
 * Production build settings.
 *
 * Everything in this file is compiled into the JavaScript bundle and is readable by anyone using the
 * site. Only public settings belong here, never secrets (API keys, client secrets, passwords). Those stay
 * in roleveya-be/.env.
 */
export const environment = {
  production: true,
  /**
   * Where the browser sends API calls. Keep it relative ("/api") so the web server forwards the calls and
   * the backend's real address never reaches the browser (see nginx.conf.template). An absolute URL such
   * as "https://api.example.com/api" also works, but it exposes that host and needs CORS_ORIGINS on the
   * API, with both sites under the same parent domain.
   */
  apiBaseUrl: '/api',
};
