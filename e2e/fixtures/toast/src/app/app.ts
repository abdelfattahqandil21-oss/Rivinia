import { Component } from '@angular/core';
import type { Toast } from '@rivinia/toast';
import { RiviniaToastList } from '@rivinia/toast/ui';

function makeToast(id: number, kind: Toast['kind']): Toast {
  return {
    id,
    kind,
    message: kind + ' notification',
    duration: 0,
    remaining: 0,
    paused: false,
    action: { label: 'Undo', onPress: () => {} },
  };
}

@Component({
  selector: 'toast-compat-root',
  imports: [RiviniaToastList],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly statuses = [
    makeToast(1, 'success'),
    makeToast(2, 'error'),
    makeToast(3, 'info'),
    makeToast(4, 'warning'),
  ];
  readonly success = [makeToast(5, 'success')];
}
