import { Component, EventEmitter, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DateInputComponent } from './date-input.component';

export type DateRangePreset = 'all' | '3m' | '6m' | 'ytd' | 'custom';
export interface DateRange { from: string | null; to: string | null; }

/**
 * A date-range picker used by the report screens: preset chips (All time — default,
 * Last 3 / 6 months, YTD, Custom) plus two calendar inputs when Custom is chosen.
 * Emits {from, to} as yyyy-mm-dd strings (or null for open-ended) on every change —
 * no Apply button; the parent reloads on each emission.
 */
@Component({
  selector: 'app-date-range',
  standalone: true,
  imports: [FormsModule, DateInputComponent],
  template: `
    <div class="dr">
      <div class="presets">
        <button type="button" [class.on]="preset() === 'all'" (click)="setPreset('all')">All time</button>
        <button type="button" [class.on]="preset() === '3m'" (click)="setPreset('3m')">Last 3 months</button>
        <button type="button" [class.on]="preset() === '6m'" (click)="setPreset('6m')">Last 6 months</button>
        <button type="button" [class.on]="preset() === 'ytd'" (click)="setPreset('ytd')">YTD</button>
        <button type="button" [class.on]="preset() === 'custom'" (click)="setPreset('custom')">Custom</button>
      </div>
      @if (preset() === 'custom') {
        <div class="custom">
          <app-date-input label="From" [(ngModel)]="fromStr" [max]="toStr || today" (ngModelChange)="onCustom()" />
          <app-date-input label="To" [(ngModel)]="toStr" [min]="fromStr" [max]="today" (ngModelChange)="onCustom()" />
        </div>
      }
    </div>
  `,
  styles: [`
    .dr { display: flex; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
    .presets { display: flex; gap: 6px; flex-wrap: wrap; }
    .presets button { border: 1px solid var(--lv-line); background: #fff; border-radius: 999px; padding: 6px 14px;
      cursor: pointer; font: inherit; font-size: 13px; color: var(--lv-wine); transition: background .12s; }
    .presets button:hover { background: var(--lv-rose-soft); }
    .presets button.on { background: var(--lv-wine); color: #fff; border-color: var(--lv-wine); }
    .custom { display: flex; gap: 12px; }
    .custom app-date-input { width: 170px; }
  `]
})
export class DateRangeComponent {
  @Output() rangeChange = new EventEmitter<DateRange>();

  preset = signal<DateRangePreset>('all');
  today = new Date().toISOString().slice(0, 10);
  fromStr: string | null = null;
  toStr: string | null = null;

  private fmt(d: Date): string {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  private monthsAgo(n: number): string { const d = new Date(); d.setMonth(d.getMonth() - n); return this.fmt(d); }

  setPreset(p: DateRangePreset) {
    this.preset.set(p);
    switch (p) {
      case 'all': this.emit(null, null); break;
      case '3m': this.emit(this.monthsAgo(3), this.today); break;
      case '6m': this.emit(this.monthsAgo(6), this.today); break;
      case 'ytd': this.emit(`${new Date().getFullYear()}-01-01`, this.today); break;
      case 'custom': this.onCustom(); break;   // emit whatever's already picked
    }
  }

  onCustom() { this.emit(this.fromStr || null, this.toStr || null); }

  private emit(from: string | null, to: string | null) { this.rangeChange.emit({ from, to }); }
}
