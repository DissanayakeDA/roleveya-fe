import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormArray, FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { PreferencesApi } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/http';
import {
  EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_LABELS,
  EmploymentType,
  ExperienceLevel,
  Preferences,
  WORK_MODE_LABELS,
  WorkMode,
} from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { TagInput } from '../../shared/tag-input';

@Component({
  selector: 'app-preferences',
  imports: [ReactiveFormsModule, TagInput, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './preferences.html',
  styleUrl: './preferences.scss',
})
export class PreferencesPage {
  private readonly api = inject(PreferencesApi);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  protected readonly workModeOptions = Object.entries(WORK_MODE_LABELS) as [WorkMode, string][];
  protected readonly employmentOptions = Object.entries(EMPLOYMENT_TYPE_LABELS) as [EmploymentType, string][];
  protected readonly experienceOptions = Object.entries(EXPERIENCE_LABELS) as [ExperienceLevel, string][];

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly updatedAt = signal<string | null>(null);

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly form = this.fb.group({
    desired_titles: [[] as string[]],
    preferred_locations: [[] as string[]],
    industries: [[] as string[]],
    key_skills: [[] as string[]],
    work_modes: this.fb.array(this.workModeOptions.map(() => new FormControl(false, { nonNullable: true }))),
    employment_types: this.fb.array(this.employmentOptions.map(() => new FormControl(false, { nonNullable: true }))),
    experience_level: ['' as ExperienceLevel | ''],
    salary_min: [null as number | null, Validators.min(0)],
    salary_max: [null as number | null, Validators.min(0)],
    salary_currency: ['', Validators.pattern(/^[A-Za-z]{3}$/)],
    open_to_relocation: [false],
    notes: ['', Validators.maxLength(2000)],
  });

  constructor() {
    this.api.get().subscribe({
      next: (prefs) => {
        this.fill(prefs);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(errorMessage(err, "Your preferences couldn't be loaded. Refresh to try again."));
      },
    });
  }

  protected checks(array: 'work_modes' | 'employment_types'): FormArray<FormControl<boolean>> {
    return this.form.controls[array];
  }

  private fill(prefs: Preferences): void {
    this.form.patchValue({
      desired_titles: prefs.desired_titles,
      preferred_locations: prefs.preferred_locations,
      industries: prefs.industries,
      key_skills: prefs.key_skills,
      work_modes: this.workModeOptions.map(([value]) => prefs.work_modes.includes(value)),
      employment_types: this.employmentOptions.map(([value]) => prefs.employment_types.includes(value)),
      experience_level: prefs.experience_level ?? '',
      salary_min: prefs.salary_min,
      salary_max: prefs.salary_max,
      salary_currency: prefs.salary_currency ?? '',
      open_to_relocation: prefs.open_to_relocation,
      notes: prefs.notes ?? '',
    });
    this.form.markAsPristine();
    this.updatedAt.set(prefs.updated_at ?? null);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Some fields need attention before saving.');
      return;
    }
    const v = this.form.getRawValue();
    const amount = (value: number | null) => (value === null || (value as unknown) === '' ? null : Number(value));
    const body: Preferences = {
      desired_titles: v.desired_titles,
      preferred_locations: v.preferred_locations,
      industries: v.industries,
      key_skills: v.key_skills,
      work_modes: this.workModeOptions.filter((_, i) => v.work_modes[i]).map(([value]) => value),
      employment_types: this.employmentOptions.filter((_, i) => v.employment_types[i]).map(([value]) => value),
      experience_level: v.experience_level || null,
      salary_min: amount(v.salary_min),
      salary_max: amount(v.salary_max),
      salary_currency: v.salary_currency.trim().toUpperCase() || null,
      open_to_relocation: v.open_to_relocation,
      notes: v.notes.trim() || null,
    };
    if (body.salary_min !== null && body.salary_max !== null && body.salary_min > body.salary_max) {
      this.error.set("Minimum salary can't be higher than maximum salary.");
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.api.save(body).subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.fill(saved);
        this.toast.show('Preferences saved.');
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }
}
