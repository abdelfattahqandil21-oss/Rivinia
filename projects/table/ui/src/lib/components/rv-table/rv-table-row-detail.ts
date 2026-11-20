import { Directive, inject, TemplateRef } from '@angular/core';
import type { TableUiRow } from '../../models/ui.types';

export interface TableRowDetailContext {
  readonly $implicit: TableUiRow;
  readonly data: unknown;
}

/** Projects the detail content shown below an expanded row. */
@Directive({ selector: 'ng-template[rvTableRowDetail]' })
export class RvTableRowDetail {
  readonly template = inject<TemplateRef<TableRowDetailContext>>(TemplateRef);
}
