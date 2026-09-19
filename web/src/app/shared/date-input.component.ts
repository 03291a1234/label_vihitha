import { Component, Input, forwardRef, signal } from '@angular/core';
import { FormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';

/**
 * A Material datepicker (with the calendar toggle) that reads and writes a plain
 * `yyyy-mm-dd` string via ControlValueAccessor — a drop-in replacement for
 * `<input matInput type="date" [(ngModel)]/formControlName>` so the surrounding
 * code keeps its string date contract while users get a real calendar.
 */
@Component({
  selector: 'app-date-input',
  standalone: true,
  imports: [FormsModule, MatFormFieldModule, MatInputModule, MatDatepickerModule],
  providers: [
    provideNativeDateAdapter(),
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DateInputComponent), multi: true }
  ],
  template: `
    <mat-form-field class="di">
      <mat-label>{{ label }}</mat-label>
      <input matInput [matDatepicker]="dp" [ngModel]="model()" (ngModelChange)="onPick($event)"
             [min]="minDate()" [max]="maxDate()" [disabled]="isDisabled()"
             [placeholder]="placeholder" (blur)="onTouched()" />
      <mat-datepicker-toggle matIconSuffix [for]="dp" />
      <mat-datepicker #dp />
      @if (hint) { <mat-hint>{{ hint }}</mat-hint> }
    </mat-form-field>
  `,
  styles: [`.di { width: 100%; }`]
})
export class DateInputComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() hint = '';
  @Input() placeholder = '';
  @Input() set min(v: string | null | undefined) { this.minDate.set(this.parse(v ?? null)); }
  @Input() set max(v: string | null | undefined) { this.maxDate.set(this.parse(v ?? null)); }

  model = signal<Date | null>(null);
  minDate = signal<Date | null>(null);
  maxDate = signal<Date | null>(null);
  isDisabled = signal(false);

  private onChange: (v: string | null) => void = () => {};
  onTouched: () => void = () => {};

  private parse(s: string | null): Date | null {
    if (!s) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    const d = new Date(s);
    return isNaN(+d) ? null : d;
  }
  private format(d: Date | null): string | null {
    if (!d || isNaN(+d)) return null;
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${day}`;
  }

  onPick(d: Date | null) { this.model.set(d); this.onChange(this.format(d)); }

  writeValue(v: string | null): void { this.model.set(this.parse(v)); }
  registerOnChange(fn: (v: string | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.isDisabled.set(d); }
}
