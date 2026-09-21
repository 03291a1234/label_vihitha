import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DateInputComponent } from './date-input.component';

export type DateRangePreset = 'all' | 'today' | 'yesterday' | '3m' | '6m' | 'ytd' | 'custom';
export interface DateRange { from: string | null; to: string | null; }

const PRESET_LABELS: Record<DateRangePreset, string> = {
  all: 'All time', today: 'Today', yesterday: 'Yesterday',
  '3m': 'Last 3 months', '6m': 'Last 6 months', ytd: 'YTD', custom: 'Custom',
};

/**
 * A date-range picker used by the report and list screens: preset chips plus two
 * calendar inputs when Custom is chosen. Which chips show is configurable via
 * [presets] (defaults to the report set). Emits {from, to} as yyyy-mm-dd strings
 * (or null for open-ended) on every change — no Apply button; the parent reloads.
 */
@Component({
  selector: 'app-date-range',
  standalone: true,
  imports: [FormsModule, DateInputComponent],
  template: `
    <div class="dr">
      <div class="presets">
        @for (p of presets; track p) {
          <button type="button" [class.on]="preset() === p" (click)="setPreset(p)">{{ labels[p] }}</button>
        }
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
  @Input() presets: DateRangePreset[] = ['all', '3m', '6m', 'ytd', 'custom'];

  labels = PRESET_LABELS;
  preset = signal<DateRangePreset>('all');
  today = new Date().toISOString().slice(0, 10);
  fromStr: string | null = null;
  toStr: string | null = null;

  private fmt(d: Date): string {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  private monthsAgo(n: number): string { const d = new Date(); d.setMonth(d.getMonth() - n); return this.fmt(d); }
  private daysAgo(n: number): string { const d = new Date(); d.setDate(d.getDate() - n); return this.fmt(d); }

  setPreset(p: DateRangePreset) {
    this.preset.set(p);
    switch (p) {
      case 'all': this.emit(null, null); break;
      case 'today': this.emit(this.today, this.today); break;
      case 'yesterday': { const y = this.daysAgo(1); this.emit(y, y); break; }
      case '3m': this.emit(this.monthsAgo(3), this.today); break;
      case '6m': this.emit(this.monthsAgo(6), this.today); break;
      case 'ytd': this.emit(`${new Date().getFullYear()}-01-01`, this.today); break;
      case 'custom': this.onCustom(); break;   // emit whatever's already picked
    }
  }

  onCustom() { this.emit(this.fromStr || null, this.toStr || null); }

  private emit(from: string | null, to: string | null) { this.rangeChange.emit({ from, to }); }
}
