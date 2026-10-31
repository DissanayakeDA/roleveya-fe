// Dev server proxy for `npm start`. Runs in Node on your machine; nothing here is sent to the browser.
// The backend address comes from API_PROXY_TARGET in roleveya-fe/.env (see .env.example), or from the
// shell environment, which takes precedence.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const envFile = fileURLToPath(new URL('./.env', import.meta.url));
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const target = process.env.API_PROXY_TARGET || 'http://127.0.0.1:8000';

// The path must match apiBaseUrl in src/environments/environment.development.ts.
export default {
  '/api': {
    target,
    changeOrigin: true,
    secure: true,
    logLevel: 'warn',
  },
};
