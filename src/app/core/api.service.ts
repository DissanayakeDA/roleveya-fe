import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { apiUrl } from './api-url';
import {
  ApplicationEvent,
  ApplicationEventWithJob,
  ApplicationStatus,
  CompileResult,
  Cv,
  CvAnalysis,
  CvDocument,
  CvDocumentSummary,
  CvVersion,
  CvVersionSummary,
  DashboardSummary,
  EventType,
  ExtractedJob,
  Job,
  JobFilters,
  JobInput,
  JobListItem,
  Page,
  Preferences,
  StudioStatus,
  Tailoring,
  TemplateId,
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

@Injectable({ providedIn: 'root' })
export class StudioApi {
  private readonly http = inject(HttpClient);

  status() {
    return this.http.get<StudioStatus>(apiUrl('/studio/status'));
  }

  /** Master CVs (not the per-job working copies). */
  documents() {
    return this.http.get<CvDocumentSummary[]>(apiUrl('/cv-documents'));
  }

  document(id: string) {
    return this.http.get<CvDocument>(apiUrl(`/cv-documents/${id}`));
  }

  createDocument(body: { name: string; template?: TemplateId; latex?: string }) {
    return this.http.post<CvDocument>(apiUrl('/cv-documents'), body);
  }

  updateDocument(id: string, body: { name?: string; latex?: string }) {
    return this.http.patch<CvDocument>(apiUrl(`/cv-documents/${id}`), body);
  }

  removeDocument(id: string) {
    return this.http.delete<void>(apiUrl(`/cv-documents/${id}`));
  }

  /** Reads a CV PDF (an upload or one of the user's CVs) into a template. Uses the AI. */
  convertPdf(source: { file: File } | { cvId: string }, template: TemplateId, name: string | null) {
    const form = new FormData();
    if ('file' in source) {
      form.append('file', source.file);
    } else {
      form.append('cv_id', source.cvId);
    }
    form.append('template', template);
    if (name) {
      form.append('name', name);
    }
    return this.http.post<CvDocument>(apiUrl('/cv-documents/convert'), form);
  }

  /** Saves a master CV as it is now as a PDF CV (an unchangeable version). */
  snapshot(id: string, name: string) {
    return this.http.post<CvVersionSummary>(apiUrl(`/cv-documents/${id}/versions`), { name });
  }

  compile(latex: string) {
    return this.http.post<CompileResult>(apiUrl('/latex/compile'), { latex });
  }

  word(latex: string, filename: string) {
    return this.http.post(apiUrl('/latex/docx'), { latex, filename }, { responseType: 'blob' });
  }

  versions(jobId?: string) {
    const params = jobId ? new HttpParams().set('job_id', jobId) : undefined;
    return this.http.get<CvVersionSummary[]>(apiUrl('/cv-versions'), { params });
  }

  version(id: string) {
    return this.http.get<CvVersion>(apiUrl(`/cv-versions/${id}`));
  }

  versionWord(id: string) {
    return this.http.get(apiUrl(`/cv-versions/${id}/docx`), { responseType: 'blob' });
  }

  tailoring(jobId: string) {
    return this.http.get<Tailoring>(apiUrl(`/jobs/${jobId}/tailoring`));
  }

  /** Starts (or restarts) the job's working copy from a master CV. */
  startDraft(jobId: string, masterId: string) {
    return this.http.post<CvDocument>(apiUrl(`/jobs/${jobId}/tailoring/draft`), { master_id: masterId });
  }

  analyse(jobId: string, latex: string, refresh = false) {
    return this.http.post<CvAnalysis>(apiUrl(`/jobs/${jobId}/tailoring/analysis`), { latex, refresh });
  }

  saveVersion(jobId: string, body: { name: string; latex: string; use_for_job: boolean }) {
    return this.http.post<CvVersionSummary>(apiUrl(`/jobs/${jobId}/tailoring/versions`), body);
  }
}
