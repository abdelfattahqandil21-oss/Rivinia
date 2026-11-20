import { Location } from '@angular/common';
import { computed, Directive, forwardRef, inject, input } from '@angular/core';
import {
  ActivatedRoute,
  Router,
  UrlTree,
  type IsActiveMatchOptions,
  type NavigationBehaviorOptions,
  type UrlCreationOptions,
} from '@angular/router';
import { MENU_ITEM_NAVIGATION, type MenuItemNavigationAdapter } from '@rivinia/menu/ui';

const DEFAULT_ACTIVE_MATCH: IsActiveMatchOptions = {
  paths: 'exact',
  queryParams: 'ignored',
  fragment: 'ignored',
  matrixParams: 'ignored',
};

/** Optional Angular Router adapter for a template-defined action-menu item. */
@Directive({
  selector: 'ng-template[rvMenuItem][rvMenuLink]',
  standalone: true,
  providers: [
    {
      provide: MENU_ITEM_NAVIGATION,
      useExisting: forwardRef(() => MenuRouterLinkDirective),
    },
  ],
})
export class MenuRouterLinkDirective implements MenuItemNavigationAdapter {
  readonly rvMenuLink = input.required<string | readonly any[] | UrlTree>();
  readonly rvMenuLinkOptions = input<UrlCreationOptions>({});
  readonly rvMenuLinkNavigation = input<NavigationBehaviorOptions>({});
  readonly rvMenuLinkActiveOptions = input<Partial<IsActiveMatchOptions>>(DEFAULT_ACTIVE_MATCH);

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);

  private readonly urlTree = computed(() => {
    const target = this.rvMenuLink();
    if (target instanceof UrlTree) return target;
    const commands = typeof target === 'string' ? [target] : target;
    return this.router.createUrlTree(commands, {
      relativeTo: this.route,
      ...this.rvMenuLinkOptions(),
    });
  });

  href(): string | null {
    return this.location.prepareExternalUrl(this.router.serializeUrl(this.urlTree()));
  }

  active(): boolean {
    this.router.lastSuccessfulNavigation();
    return this.router.isActive(this.urlTree(), {
      ...DEFAULT_ACTIVE_MATCH,
      ...this.rvMenuLinkActiveOptions(),
    });
  }

  navigate(_event: MouseEvent): Promise<boolean> {
    return this.router.navigateByUrl(this.urlTree(), this.rvMenuLinkNavigation());
  }
}
