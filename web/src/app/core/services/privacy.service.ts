import { Injectable, effect, signal } from '@angular/core';

/**
 * Privacy mode: when on, monetary amounts are masked across the app (shown as "$••••").
 * Per-device — persisted in localStorage, reflected on <body class="privacy-hide"> for any
 * CSS hooks. Toggle it from the header. Values are only hidden in the UI; data is untouched.
 */
@Injectable({ providedIn: 'root' })
export class PrivacyService {
  private static readonly KEY = 'lv_hide_amounts';
  readonly hidden = signal<boolean>(this.read());

  constructor() {
    effect(() => {
      const on = this.hidden();
      try { localStorage.setItem(PrivacyService.KEY, on ? '1' : '0'); } catch { /* private mode */ }
      try { document.body.classList.toggle('privacy-hide', on); } catch { /* SSR */ }
    });
  }

  toggle() { this.hidden.update(v => !v); }

  private read(): boolean {
    try { return localStorage.getItem(PrivacyService.KEY) === '1'; } catch { return false; }
  }
}
