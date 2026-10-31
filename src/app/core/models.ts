export type ApplicationStatus =
  | 'saved'
  | 'applied'
  | 'screening'
  | 'interviewing'
  | 'offer'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'ghosted';

export type WorkMode = 'remote' | 'hybrid' | 'onsite';
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'internship' | 'freelance' | 'temporary';
export type Priority = 'low' | 'medium' | 'high';
export type EventType = 'created' | 'status_changed' | 'note';
export type JobSort = 'updated' | 'created' | 'deadline' | 'applied' | 'company';
export type ExperienceLevel = 'entry' | 'junior' | 'mid' | 'senior' | 'lead' | 'principal' | 'executive';

/** The main line an application travels along, in order. */
export const ROUTE_STATUSES: ApplicationStatus[] = ['saved', 'applied', 'screening', 'interviewing', 'offer', 'accepted'];
/** Ways an application can leave the route. */
export const EXIT_STATUSES: ApplicationStatus[] = ['rejected', 'withdrawn', 'ghosted'];
export const ALL_STATUSES: ApplicationStatus[] = [...ROUTE_STATUSES, ...EXIT_STATUSES];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  screening: 'Screening',
  interviewing: 'Interviewing',
  offer: 'Offer',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  ghosted: 'No response',
};

export type StatusTone = 'idle' | 'progress' | 'win' | 'loss' | 'closed';

export const STATUS_TONES: Record<ApplicationStatus, StatusTone> = {
  saved: 'idle',
  applied: 'progress',
  screening: 'progress',
  interviewing: 'progress',
  offer: 'win',
  accepted: 'win',
  rejected: 'loss',
  withdrawn: 'closed',
  ghosted: 'closed',
};

export const WORK_MODE_LABELS: Record<WorkMode, string> = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' };

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
  freelance: 'Freelance',
  temporary: 'Temporary',
};

export const PRIORITY_LABELS: Record<Priority, string> = { low: 'Low', medium: 'Medium', high: 'High' };

export const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  entry: 'Entry level',
  junior: 'Junior',
  mid: 'Mid level',
  senior: 'Senior',
  lead: 'Lead',
  principal: 'Principal',
  executive: 'Executive',
};

export const JOB_SOURCES = ['LinkedIn', 'Company website', 'Referral', 'Recruiter', 'Indeed', 'Glassdoor', 'Job board'];

export interface User {
  id: string;
  email: string;
  phone_number: string | null;
  full_name: string | null;
  created_at: string;
}

export interface Session {
  authenticated: boolean;
  user: User | null;
}

export interface SignUpResult {
  requires_confirmation: boolean;
  message: string;
}

export interface Message {
  message: string;
}

export interface CvSummary {
  id: string;
  label: string;
  original_filename: string;
  /** Set when the CV is a version saved from the CV studio. */
  version_id: string | null;
}

export interface Cv extends CvSummary {
  size_bytes: number;
  is_default: boolean;
  created_at: string;
}

export interface JobInput {
  title: string;
  company: string;
  location: string | null;
  work_mode: WorkMode | null;
  employment_type: EmploymentType | null;
  job_url: string | null;
  source: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  description: string | null;
  notes: string | null;
  contact_name: string | null;
  contact_email: string | null;
  priority: Priority;
  deadline: string | null;
  applied_on: string | null;
  cv_id: string | null;
  status?: ApplicationStatus;
}

/** Details read from a job post (screenshot or pasted text). Anything not found is null. */
export interface ExtractedJob {
  found_text: boolean;
  company: string | null;
  title: string | null;
  location: string | null;
  work_mode: WorkMode | null;
  employment_type: EmploymentType | null;
  job_url: string | null;
  source: string | null;
  description: string | null;
}

export interface Job extends Omit<JobInput, 'cv_id' | 'status'> {
  id: string;
  status: ApplicationStatus;
  cv: CvSummary | null;
  has_poster: boolean;
  poster_kind: 'image' | 'pdf' | null;
  poster_filename: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobListItem {
  id: string;
  title: string;
  company: string;
  location: string | null;
  work_mode: WorkMode | null;
  status: ApplicationStatus;
  priority: Priority;
  deadline: string | null;
  applied_on: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  has_poster: boolean;
  updated_at: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface JobFilters {
  status: ApplicationStatus[];
  q: string;
  sort: JobSort;
  page: number;
}

export interface JobRef {
  id: string;
  title: string;
  company: string;
}

export interface ApplicationEvent {
  id: string;
  job_id: string;
  event_type: EventType;
  from_status: ApplicationStatus | null;
  to_status: ApplicationStatus | null;
  note: string | null;
  occurred_at: string;
}

export interface ApplicationEventWithJob extends ApplicationEvent {
  job: JobRef;
}

export interface Preferences {
  desired_titles: string[];
  preferred_locations: string[];
  work_modes: WorkMode[];
  employment_types: EmploymentType[];
  industries: string[];
  key_skills: string[];
  experience_level: ExperienceLevel | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  open_to_relocation: boolean;
  notes: string | null;
  updated_at?: string | null;
}

export interface DashboardSummary {
  total_jobs: number;
  by_status: Record<ApplicationStatus, number>;
  active_applications: number;
  applied_last_30_days: number;
  response_rate: number | null;
  interview_rate: number | null;
  weekly_applications: { week_start: string; count: number }[];
  upcoming_deadlines: (JobRef & { deadline: string })[];
  recent_activity: ApplicationEventWithJob[];
}

// -- CV studio ----------------------------------------------------------------------------------

export type TemplateId = 'classic' | 'modern';

export interface CvTemplateInfo {
  id: TemplateId;
  name: string;
  description: string;
}

/** What the server can do; features that aren't set up are explained instead of failing. */
export interface StudioStatus {
  ai: boolean;
  compiler: boolean;
  word: boolean;
  templates: CvTemplateInfo[];
}

/** A master CV (job_id null) or the working copy being tailored for a job. */
export interface CvDocumentSummary {
  id: string;
  name: string;
  template: TemplateId | null;
  job_id: string | null;
  based_on_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CvDocument extends CvDocumentSummary {
  latex: string;
}

export interface LatexIssue {
  line: number | null;
  message: string;
}

export interface CompileResult {
  ok: boolean;
  pdf_base64: string | null;
  issues: LatexIssue[];
}

/** A saved CV that can't be changed: the exact LaTeX and its PDF (a CV with this version's cv_id). */
export interface CvVersionSummary {
  id: string;
  name: string;
  cv_id: string;
  job: JobRef | null;
  document_id: string | null;
  created_at: string;
}

export interface CvVersion extends CvVersionSummary {
  latex: string;
}

export interface SkillGap {
  skill: string;
  importance: 'required' | 'nice_to_have';
  advice: string;
}

export interface CvEdit {
  kind: 'reword' | 'add_if_true';
  section: string;
  reason: string;
  find: string;
  replace: string;
}

export interface CvAnalysis {
  id: string;
  created_at: string;
  model: string;
  /** False once the CV or the job post changed after the analysis was made. */
  current: boolean;
  summary: string;
  matched_skills: string[];
  missing_skills: SkillGap[];
  edits: CvEdit[];
  keywords: string[];
}

export interface Tailoring {
  draft: CvDocument | null;
  analysis: CvAnalysis | null;
  versions: CvVersionSummary[];
}

/** The shortest job description the API compares a CV with. */
export const MIN_DESCRIPTION_TO_COMPARE = 80;
