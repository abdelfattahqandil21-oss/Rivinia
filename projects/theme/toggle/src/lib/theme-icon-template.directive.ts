import { Directive, input, TemplateRef } from '@angular/core';
import { RiviniaThemeMode } from '@rivinia/theme/headless';

/** Marks a consumer-owned icon template for one Theme mode. */
@Directive({ selector: 'ng-template[rvThemeIcon]', standalone: true })
export class RiviniaThemeIconTemplateDirective {
  readonly mode = input.required<RiviniaThemeMode>({ alias: 'rvThemeIcon' });

  constructor(readonly template: TemplateRef<unknown>) {}
}
