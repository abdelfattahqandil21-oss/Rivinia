import { MenuRootDirective, MenuTriggerDirective, MenuPanelDirective, MenuItemDefDirective, MenuActionDirective, MenuLabelDirective } from '@rivinia/menu/ui';
import { MenuRouterLinkDirective } from '@rivinia/menu/router';
import type { MenuActivation } from '@rivinia/menu';
import { Component, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { form, FormField } from '@angular/forms/signals';
import { RiviniaSelectComboboxComponent } from '@rivinia/select/ui';

@Component({
  imports: [RiviniaSelectComboboxComponent, ReactiveFormsModule, FormsModule, FormField, MenuRootDirective, MenuTriggerDirective, MenuPanelDirective, MenuItemDefDirective, MenuActionDirective, MenuLabelDirective, MenuRouterLinkDirective],
  template: `
    <h1>Composed Select</h1>
    <div rvMenuRoot rvMenuRootId="composed-menu">
      <button rvMenuTrigger type="button">Composed actions</button>
      <div rvMenuPanel rvMenuLabel="Composed actions">
        <ng-template rvMenuItem="usage" rvMenuLabel="Usage" [rvMenuAction]="runUsage">Usage</ng-template>
        <ng-template rvMenuItem="disabled" rvMenuLabel="Unavailable" [disabled]="true" [rvMenuAction]="runUsage">Unavailable</ng-template>
        <ng-template rvMenuItem="grid" rvMenuLabel="Grid" kind="checkbox" [checked]="grid()" [rvMenuAction]="setGrid">Grid</ng-template>
        <ng-template rvMenuItem="github" rvMenuLabel="GitHub" href="https://github.com/example" target="_blank">GitHub</ng-template>
        <ng-template rvMenuItem="basic" rvMenuLabel="Basic page" [rvMenuLink]="['/basic']">Basic page</ng-template>
      </div>
    </div>
    <output id="usage-count">{{ usage() }}</output>
    <div style="width:320px">
      <rv-select-combobox rvSelectRootId="cities" labelText="Egyptian cities"
        [rvSelectOptions]="cities" [formControl]="selected" />
    </div>
    <output id="city-value">{{ selected.value }}</output>
    <rv-select-combobox rvSelectRootId="template-city" labelText="Template city"
      [rvSelectOptions]="smallCities" [(ngModel)]="templateValue" />
    <output id="template-value">{{ templateValue }}</output>
    <rv-select-combobox rvSelectRootId="signal-city" labelText="Signal city"
      [rvSelectOptions]="smallCities" [formField]="fields" />
    <output id="signal-value">{{ model() }}</output>
    <button type="button" id="disable" (click)="selected.disable()">Disable</button>
  `,
})
export class ComboboxPage {
  readonly cities = Array.from({ length: 500 }, (_, index) => ({
    key: index + 1, value: index + 1, label: `Egyptian city ${index + 1}`,
  }));
  readonly usage = signal(0);
  readonly grid = signal(false);
  readonly runUsage = () => this.usage.update(value => value + 1);
  readonly setGrid = (activation: MenuActivation) => {
    if (activation.type === 'checked-change') this.grid.set(activation.checked);
  };
  readonly smallCities = this.cities.slice(0, 5);
  templateValue: number | null = 1;
  readonly model = signal<number | null>(1);
  readonly fields = form(this.model);
  readonly selected = new FormControl<number | null>(140);
}
