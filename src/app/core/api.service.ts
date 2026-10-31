import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { apiUrl } from './api-url';
import {
  ApplicationEvent,
  ApplicationEventWithJob,
  ApplicationStatus,
  Cv,
  DashboardSummary,
  EventType,
  ExtractedJob,
  Job,
  JobFilters,
  JobInput,
  JobListItem,
  Page,
  Preferences,
} from './models';

@Injectable({ providedIn: 'root' })
export class JobsApi {
  private readonly http = inject(HttpClient);

  list(filters: JobFilters, pageSize = 20) {
    let params = new HttpParams().set('sort', filters.sort).set('page', filters.page).set('page_size', pageSize);
    if (filters.q.trim()) {
      params = params.set('q', filters.q.trim());
    }
    for (const status of filters.status) {
      params = params.append('status', status);
    }
    return this.http.get<Page<JobListItem>>(apiUrl('/jobs'), { params });
  }

  get(id: string) {
    return this.http.get<Job>(apiUrl(`/jobs/${id}`));
  }

  create(body: JobInput) {
    return this.http.post<Job>(apiUrl('/jobs'), body);
  }

  update(id: string, body: Partial<JobInput>) {
    return this.http.patch<Job>(apiUrl(`/jobs/${id}`), body);
  }

  remove(id: string) {
    return this.http.delete<void>(apiUrl(`/jobs/${id}`));
  }

  changeStatus(id: string, status: ApplicationStatus, note: string | null) {
    return this.http.patch<Job>(apiUrl(`/jobs/${id}/status`), { status, note });
  }

  events(id: string) {
    return this.http.get<ApplicationEvent[]>(apiUrl(`/jobs/${id}/events`));
  }

  addNote(id: string, note: string) {
    return this.http.post<ApplicationEvent>(apiUrl(`/jobs/${id}/events`), { note });
  }

  removeNote(id: string, eventId: string) {
    return this.http.delete<void>(apiUrl(`/jobs/${id}/events/${eventId}`));
  }

  uploadPoster(id: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<Job>(apiUrl(`/jobs/${id}/poster`), form);
  }

  poster(id: string) {
    return this.http.get(apiUrl(`/jobs/${id}/poster`), { responseType: 'blob' });
  }

  removePoster(id: string) {
    return this.http.delete<Job>(apiUrl(`/jobs/${id}/poster`));
  }

  /** Reads company, title and description from a copied job post. */
  extractFromText(text: string) {
    return this.http.post<ExtractedJob>(apiUrl('/jobs/extract/text'), { text });
  }

  /** Same, from a screenshot (read on the server with OCR). */
  extractFromScreenshot(file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<ExtractedJob>(apiUrl('/jobs/extract/screenshot'), form);
  }
}

@Injectable({ providedIn: 'root' })
export class CvsApi {
  private readonly http = inject(HttpClient);

  list() {
    return this.http.get<Cv[]>(apiUrl('/cvs'));
  }

  upload(file: File, label: string | null) {
    const form = new FormData();
    form.append('file', file);
    if (label) {
      form.append('label', label);
    }
    return this.http.post<Cv>(apiUrl('/cvs'), form);
  }

  update(id: string, body: { label?: string; is_default?: true }) {
    return this.http.patch<Cv>(apiUrl(`/cvs/${id}`), body);
  }

  file(id: string) {
    return this.http.get(apiUrl(`/cvs/${id}/file`), { responseType: 'blob' });
  }

  remove(id: string) {
    return this.http.delete<void>(apiUrl(`/cvs/${id}`));
  }
}

@Injectable({ providedIn: 'root' })
export class PreferencesApi {
  private readonly http = inject(HttpClient);

  get() {
    return this.http.get<Preferences>(apiUrl('/preferences'));
  }

  save(body: Preferences) {
    return this.http.put<Preferences>(apiUrl('/preferences'), body);
  }
}

@Injectable({ providedIn: 'root' })
export class InsightsApi {
  private readonly http = inject(HttpClient);

  dashboard() {
    return this.http.get<DashboardSummary>(apiUrl('/dashboard/summary'));
  }

  history(page: number, eventType: EventType | null, pageSize = 30) {
    let params = new HttpParams().set('page', page).set('page_size', pageSize);
    if (eventType) {
      params = params.set('event_type', eventType);
    }
    return this.http.get<Page<ApplicationEventWithJob>>(apiUrl('/history'), { params });
  }
}
