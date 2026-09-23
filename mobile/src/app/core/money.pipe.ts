import { Pipe, PipeTransform, inject, LOCALE_ID } from '@angular/core';
import { CurrencyPipe, getCurrencySymbol } from '@angular/common';
import { PrivacyService } from './privacy.service';

/**
 * Drop-in `currency` pipe that honours {@link PrivacyService}. Same name/signature as the
 * built-in, so templates keep `| currency`; masks the amount (e.g. "$••••") when privacy is on.
 * Impure so it re-renders when the toggle flips.
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
