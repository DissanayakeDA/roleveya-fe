/**
 * Development build settings (`npm start`). Public values only, as in environment.ts.
 *
 * The backend address the dev server forwards `/api` to is not set here. It is API_PROXY_TARGET in
 * roleveya-fe/.env, read by proxy.conf.mjs on your machine and never sent to the browser.
 */
export const environment = {
  production: false,
  apiBaseUrl: '/api',
};
