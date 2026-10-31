import { environment } from '../../environments/environment';

/** API base from the environment file, without a trailing slash ("/api" by default). */
export const API_BASE = environment.apiBaseUrl.replace(/\/+$/, '');

/** Builds an API URL from a path such as `/jobs/123`. */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
