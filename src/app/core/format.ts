import { ApplicationEvent, STATUS_LABELS } from './models';

export function salaryRange(min: number | null, max: number | null, currency: string | null): string | null {
  if (min === null && max === null) {
    return null;
  }
  const format = (value: number) => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: currency ? 'currency' : 'decimal',
        currency: currency ?? undefined,
        maximumFractionDigits: 0,
        notation: value >= 100_000 ? 'compact' : 'standard',
      }).format(value);
    } catch {
      return `${currency ?? ''} ${value.toLocaleString()}`.trim();
    }
  };
  if (min !== null && max !== null) {
    return min === max ? format(min) : `${format(min)} – ${format(max)}`;
  }
  return min !== null ? `From ${format(min)}` : `Up to ${format(max!)}`;
}

/** Jobs can be saved without a title (just the company and description). */
export function roleTitle(title: string | null | undefined): string {
  return title?.trim() || 'Untitled role';
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function percent(value: number | null): string {
  return value === null ? '–' : `${Math.round(value * 100)}%`;
}

/** Today's date in the user's time zone, as the API's yyyy-mm-dd. */
export function today(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/** Days from today until a yyyy-mm-dd date (negative when past). */
export function daysUntil(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

export function dueLabel(isoDate: string): string {
  const days = daysUntil(isoDate);
  if (days < 0) return 'Closed';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

/** One-line description of a history entry, without the job name. */
export function describeEvent(event: ApplicationEvent): string {
  switch (event.event_type) {
    case 'created':
      return event.to_status && event.to_status !== 'saved'
        ? `Added as ${STATUS_LABELS[event.to_status].toLowerCase()}`
        : 'Saved to your list';
    case 'status_changed':
      return `Moved from ${STATUS_LABELS[event.from_status!]} to ${STATUS_LABELS[event.to_status!]}`;
    default:
      return 'Note';
  }
}
