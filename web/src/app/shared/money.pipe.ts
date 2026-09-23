import { Pipe, PipeTransform, inject, LOCALE_ID } from '@angular/core';
import { CurrencyPipe, getCurrencySymbol } from '@angular/common';
import { PrivacyService } from '../core/services/privacy.service';

/**
 * Drop-in replacement for Angular's `currency` pipe that honours {@link PrivacyService}.
 * Same name and signature as the built-in, so templates keep using `| currency` unchanged;
 * when privacy mode is on it masks the amount (e.g. "$••••") while keeping the symbol so the
 * layout and currency context are preserved. Impure so it re-renders when the toggle flips.
 */
@Pipe({ name: 'currency', standalone: true, pure: false })
export class MoneyPipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);
  private readonly cp = new CurrencyPipe(this.locale);
  private readonly privacy = inject(PrivacyService);

  transform(
    value: unknown,
    currencyCode = 'USD',
    display: string | boolean = 'symbol',
    digitsInfo?: string,
    locale?: string,
  ): string | null {
    // Keep genuinely empty values empty (blank cells stay blank, even masked).
    if (value == null || value === '') return null;
    if (this.privacy.hidden()) {
      let prefix = '';
      if (display === 'code') prefix = currencyCode + ' ';
      else if (display !== false && display !== '') prefix = getCurrencySymbol(currencyCode, 'narrow', locale ?? this.locale);
      return prefix + '••••';
    }
    return this.cp.transform(value as string | number, currencyCode, display, digitsInfo, locale);
  }
}
