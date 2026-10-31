import { Pipe, PipeTransform } from '@angular/core';

import { roleTitle } from '../core/format';

/** Shows a job's title, or "Untitled role" when it was saved without one. */
@Pipe({ name: 'roleTitle' })
export class RoleTitlePipe implements PipeTransform {
  transform(title: string | null | undefined): string {
    return roleTitle(title);
  }
}
