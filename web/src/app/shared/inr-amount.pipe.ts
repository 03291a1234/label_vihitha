import { Pipe, PipeTransform, inject } from '@angular/core';
import { SettingsService } from '../core/services/settings.service';

/** Converts a USD amount to INR using the configured rate. Chain with the currency pipe:
 *  {{ usd | inrAmount | currency:'INR':'symbol':'1.0-0' }}. Pure — the rate is fixed at bootstrap. */
@Pipe({ name: 'inrAmount', standalone: true })
export class InrAmountPipe implements PipeTransform {
  private settings = inject(SettingsService);
  transform(usd: number | null | undefined): number {
    return (usd ?? 0) * this.settings.inrPerUsd();
  }
}
