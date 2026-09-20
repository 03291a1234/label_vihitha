import { Component, Input, forwardRef, inject, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { SettingsService } from '../core/services/settings.service';
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Money field with a USD/INR toggle. The form value is always the canonical USD amount;
 * the user can type in either currency (INR is converted at ₹95 = $1) and a live
 * equivalent is shown. Supports null (empty) for optional amounts.
 *
 * Usage: <app-money-input formControlName="originalPrice" label="Original price" />
 */
@Component({
  selector: 'app-money-input',
  standalone: true,
  imports: [FormsModule, CurrencyPipe, MatFormFieldModule, MatInputModule, MatButtonToggleModule],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => MoneyInputComponent), multi: true }],
  template: `
    <div class="money">
      <mat-button-toggle-group [value]="currency()" (change)="setCurrency($event.value)" [disabled]="disabled()" aria-label="Currency">
        <mat-button-toggle value="USD">USD</mat-button-toggle>
        <mat-button-toggle value="INR">INR</mat-button-toggle>
      </mat-button-toggle-group>
      <mat-form-field class="amt">
        <mat-label>{{ label }}</mat-label>
        <span matTextPrefix>{{ currency() === 'USD' ? '$' : '₹' }}&nbsp;</span>
        <input matInput type="number" [ngModel]="display()" (ngModelChange)="onInput($event)"
               (blur)="onTouched()" [disabled]="disabled()" [placeholder]="placeholder" />
      </mat-form-field>
    </div>
    @if (usd() !== null) {
      <div class="equiv muted">
        @if (currency() === 'INR') { ≈ {{ usd()! | currency }} }
        @else { ≈ {{ usd()! * rate | currency:'INR':'symbol':'1.0-0' }} }
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .money { display: flex; gap: 10px; align-items: center; }
    .money .amt { flex: 1; min-width: 0; }
    .equiv { font-size: 12px; margin: -10px 0 8px; }
  `]
})
export class MoneyInputComponent implements ControlValueAccessor {
  @Input() label = 'Amount';
  @Input() placeholder = '';

  private settings = inject(SettingsService);
  get rate() { return this.settings.inrPerUsd(); }
  currency = signal<'USD' | 'INR'>('USD');
  usd = signal<number | null>(null);       // canonical value (USD)
  display = signal<number | null>(null);    // value shown in the current currency
  disabled = signal(false);

  private onChange: (v: number | null) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(v: number | null): void {
    const usd = v === null || v === undefined || (v as unknown) === '' ? null : Number(v);
    this.usd.set(usd);
    this.display.set(usd === null ? null : (this.currency() === 'INR' ? round2(usd * this.rate) : usd));
  }
  registerOnChange(fn: (v: number | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  setCurrency(c: 'USD' | 'INR') {
    this.currency.set(c);
    const usd = this.usd();
    this.display.set(usd === null ? null : (c === 'INR' ? round2(usd * this.rate) : round2(usd)));
  }

  onInput(val: number | null | string) {
    if (val === null || val === undefined || val === '') {
      this.display.set(null); this.usd.set(null); this.onChange(null); return;
    }
    const n = Number(val) || 0;
    this.display.set(n);
    const usd = this.currency() === 'INR' ? round2(n / this.rate) : n;
    this.usd.set(usd);
    this.onChange(usd);
  }
}
