import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

const base = environment.apiUrl;

/** One source of truth for client-side settings. The INR/USD rate is fetched once at
 *  app start (via APP_INITIALIZER) so every conversion uses the same, config-driven value. */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private http = inject(HttpClient);

  /** Rupees per US dollar. Defaults to 95 until the server value loads. */
  readonly inrPerUsd = signal(95);

  /** Called at bootstrap; never rejects so a settings hiccup can't block the app. */
  async load(): Promise<void> {
    try {
      const s = await firstValueFrom(this.http.get<{ inrPerUsd: number }>(`${base}/settings`));
      if (s?.inrPerUsd && s.inrPerUsd > 0) this.inrPerUsd.set(s.inrPerUsd);
    } catch {
      /* keep the default */
    }
  }

  usdToInr(usd: number): number { return usd * this.inrPerUsd(); }
  inrToUsd(inr: number): number { return inr / this.inrPerUsd(); }
}
