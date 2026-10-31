# Roleveya web app (roleveya-fe)

Angular 21 frontend for the Roleveya job tracker: sign-up and sign-in, dashboard, jobs, the status route on
each job, application history, CVs and preferences.

## Run it

Start the API first (see `../roleveya-be`), then:

```powershell
copy .env.example .env   # set API_PROXY_TARGET if the API isn't on http://127.0.0.1:8000
npm install
npm start                # http://localhost:4200
```

```powershell
npm run build            # output in dist/roleveya-fe/browser
```

## Configuration

Two kinds of settings, kept apart on purpose:

| Setting | Where | Reaches the browser? |
|---|---|---|
| `apiBaseUrl`: where the app sends API calls (default `/api`) | `src/environments/environment.ts` (production) and `environment.development.ts` (`npm start`) | Yes, it's compiled into the bundle |
| `API_PROXY_TARGET`: the backend address the dev server forwards `/api` to | `.env` (gitignored; copy from `.env.example`) or a shell variable, which takes precedence. Read by `proxy.conf.mjs` | No |
| `API_UPSTREAM`: the backend address nginx forwards `/api` to in production | environment variable for `nginx.conf.template` | No |

**No secrets in the frontend.** Everything the Angular app uses ends up in JavaScript that anyone can read,
so environment files only hold public values. Cognito and Cloudinary secrets stay in `roleveya-be/.env`,
and the app never needs them because the API handles sign-in and file storage.

Keep `apiBaseUrl` relative. If you set it to an absolute URL (e.g. `https://api.example.com/api`), the
API's host becomes visible in the bundle and in requests. You'd also need to add the app's origin to
`CORS_ORIGINS` on the API, and both sites must share a parent domain for the sign-in cookies to work.

## Deploying

Serve the build and the API from the same origin, with the web server forwarding `/api/` to the backend.
`nginx.conf.template` is a working example that also sets a strict Content Security Policy. The backend
address comes from `API_UPSTREAM`: the official nginx Docker image fills it in when the file is mounted at
`/etc/nginx/templates/default.conf.template`, or you can render it yourself with `envsubst` (see the file's
header). The production build doesn't inline critical CSS, so it runs without `'unsafe-inline'` scripts.

## What stays out of the browser

- **The backend's address.** The app only calls relative `/api/...` paths. The real host is set in `.env`
  (dev) or `API_UPSTREAM` (production), outside the bundle, so it never appears in code, requests or the
  console.
- **Tokens.** Auth uses HttpOnly cookies set by the API. No token is ever in JavaScript, `localStorage`
  or a request header.
- **File storage URLs.** CVs and posters are fetched through the API as blobs and shown from local
  `blob:` URLs. Cloudinary links never reach the page.
- **Console output.** The app writes nothing to the console in production: `QuietErrorHandler` replaces
  Angular's default handler, which would otherwise print failed requests with their URLs. Production
  builds ship without source maps.
- **Expected "no" answers.** Checking the session returns 200 with `authenticated: false` instead of a 401,
  and expired sessions are refreshed server-side, so normal use doesn't produce failed requests.

The browser's own developer tools still list every request in the Network tab, and Chrome prints a
line for any request that fails (for example a wrong password returning 401). No web app can hide those.
What matters is that they show only same-origin `/api` paths and carry nothing secret.

## Layout

```
src/app
  core/       models, API services (URLs built by api-url.ts), auth service and guards, HTTP interceptor
              and error handler
  layout/     the signed-in shell with the road-sign navigation
  shared/     icon, status badge, tag input, file viewer, toasts
  features/   auth, dashboard, jobs (list, form, detail, status route), history, cvs, preferences
```

Design: navigation is styled as a road sign and the type is Overpass, which is based on highway signage
lettering. The one bold element is the status route on each job, where stations run from Saved to
Accepted and the current stage is marked. Shared styles and tokens are in `src/styles.scss`.
