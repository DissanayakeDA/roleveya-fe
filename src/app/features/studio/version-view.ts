import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { CvsApi, StudioApi } from '../../core/api.service';
import { fileName, saveFile } from '../../core/format';
import { errorMessage } from '../../core/http';
import { CvVersion } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { Icon } from '../../shared/icon';
import { RoleTitlePipe } from '../../shared/role-title.pipe';
import { CompileState } from './compile-state';
import { LatexEditor } from './latex-editor';
import { PdfPane } from './pdf-pane';

/** A saved version: its PDF and the LaTeX it was made from, read-only. */
@Component({
  selector: 'app-version-view',
  imports: [DatePipe, RouterLink, Icon, LatexEditor, PdfPane, RoleTitlePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './version-view.html',
  styleUrl: './studio-shared.scss',
})
export class VersionView {
  private readonly api = inject(StudioApi);
  private readonly cvsApi = inject(CvsApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly id = input.required<string>();

  // Holds the stored PDF; nothing is compiled on this page.
  protected readonly preview = new CompileState();
  protected readonly version = signal<CvVersion | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly makingWord = signal(false);
  protected readonly copying = signal(false);

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
  }

  private load(id: string): void {
    this.api.version(id).subscribe({
      next: (version) => {
        this.version.set(version);
        this.cvsApi.file(version.cv_id).subscribe({
          next: (blob) => this.preview.show(blob, version.latex),
          error: () => {
            this.preview.issues.set([{ line: null, message: "The PDF couldn't be loaded. Refresh to try again." }]);
            this.preview.status.set('failed');
          },
        });
      },
      error: (err) => this.loadError.set(errorMessage(err, "This version couldn't be loaded.")),
    });
  }

  protected downloadPdf(version: CvVersion): void {
    const pdf = this.preview.pdf();
    if (pdf) {
      saveFile(pdf, fileName(version.name, 'pdf'));
    }
  }

  protected downloadWord(version: CvVersion): void {
    this.makingWord.set(true);
    this.api.versionWord(version.id).subscribe({
      next: (blob) => {
        this.makingWord.set(false);
        saveFile(blob, fileName(version.name, 'docx'));
      },
      error: (err) => {
        this.makingWord.set(false);
        this.toast.error(errorMessage(err, "The Word file couldn't be made."));
      },
    });
  }

  protected copyLatex(version: CvVersion): void {
    navigator.clipboard.writeText(version.latex).then(
      () => this.toast.show('LaTeX copied.'),
      () => this.toast.error("Copying didn't work. Select the text and copy it instead."),
    );
  }

  /** Starts a new master CV from this version's LaTeX (the version itself stays as it is). */
  protected makeMaster(version: CvVersion): void {
    this.copying.set(true);
    this.api.createDocument({ name: `${version.name} (copy)`.slice(0, 120), latex: version.latex }).subscribe({
      next: (document) => {
        this.toast.show('Master CV created from this version.');
        this.router.navigate(['/studio', document.id]);
      },
      error: (err) => {
        this.copying.set(false);
        this.toast.error(errorMessage(err));
      },
    });
  }
}
