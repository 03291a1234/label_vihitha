import { Injectable, effect, signal } from '@angular/core';

/**
 * Privacy mode for the mobile app: masks monetary amounts (shown as "$••••") when on.
 * Per-device, persisted in localStorage. Mirrors the web app's PrivacyService.
 */
@Injectable({ providedIn: 'root' })
export class PrivacyService {
  private static readonly KEY = 'lv_hide_amounts';
  readonly hidden = signal<boolean>(this.read());

  constructor() {
    effect(() => {
      try { localStorage.setItem(PrivacyService.KEY, this.hidden() ? '1' : '0'); } catch { /* private mode */ }
    });
  }

  toggle() { this.hidden.update(v => !v); }

  private read(): boolean {
    try { return localStorage.getItem(PrivacyService.KEY) === '1'; } catch { return false; }
  }
}
