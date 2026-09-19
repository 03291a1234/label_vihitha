import { Component, ElementRef, EventEmitter, Input, Output, ViewChild, booleanAttribute, computed, forwardRef, input, signal } from '@angular/core';
import { FormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelect, MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';

/**
 * A Material select with an in-panel search box. Filtering kicks in once the query is at least
 * `minChars` long (default 3); below that all options show. Works as a ControlValueAccessor, so
 * it's a drop-in for `<mat-select [(ngModel)]>` / `formControlName`. Pass the raw list via
 * `[items]` with `valueField`/`labelField` (default id/name).
 */
@Component({
  selector: 'app-search-select',
  standalone: true,
  imports: [FormsModule, MatFormFieldModule, MatSelectModule, MatIconModule],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SearchSelectComponent), multi: true }],
  template: `
    <mat-form-field class="ss">
      <mat-label>{{ label }}</mat-label>
      <mat-select #sel [value]="value()" (selectionChange)="onSelect($event.value)"
                  [disabled]="isDisabled()" (openedChange)="onOpened($event)" panelClass="ss-panel">
        <mat-option class="ss-search-opt" [value]="SEARCH" (click)="$event.stopPropagation()">
          <span class="ss-search">
            <mat-icon>search</mat-icon>
            <input #search type="text" [ngModel]="query()" (ngModelChange)="query.set($event)"
                   (keydown)="onSearchKey($event)" (click)="$event.stopPropagation()"
                   [placeholder]="searchPlaceholder" autocomplete="off" />
          </span>
        </mat-option>
        @if (nullOption) { <mat-option [value]="null">{{ nullLabel }}</mat-option> }
        @for (o of visible(); track o.value) { <mat-option [value]="o.value">{{ o.label }}</mat-option> }
        @if (visible().length === 0 && query().trim().length >= minChars()) {
          <div class="ss-empty">No matches for “{{ query() }}”</div>
        }
      </mat-select>
      @if (hint) { <mat-hint>{{ hint }}</mat-hint> }
    </mat-form-field>
  `,
  styles: [`
    .ss { width: 100%; }
    .ss-search-opt { position: sticky; top: 0; z-index: 2; background: #fff !important;
      border-bottom: 1px solid var(--lv-line, #eadfe3); }
    .ss-search { display: flex; align-items: center; gap: 6px; width: 100%; }
    .ss-search mat-icon { color: var(--lv-wine, #6e1f3e); font-size: 18px; height: 18px; width: 18px; flex: 0 0 auto; }
    .ss-search input { flex: 1; border: none; outline: none; font-size: 14px; background: transparent; color: inherit; padding: 4px 0; }
    .ss-empty { padding: 10px 16px; color: #888; font-size: 13px; }
  `]
})
export class SearchSelectComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() hint = '';
  @Input({ transform: booleanAttribute }) nullOption = false;
  @Input() nullLabel = '— None —';
  @Input() searchPlaceholder = 'Type to search…';

  items = input<any[]>([]);
  valueField = input('id');
  labelField = input('name');
  minChars = input(3);
  disabled = input(false);

  @Output() selectionChange = new EventEmitter<any>();
  @ViewChild('search') searchEl?: ElementRef<HTMLInputElement>;
  @ViewChild('sel') sel?: MatSelect;

  /** Sentinel value for the non-selectable search row. */
  readonly SEARCH = Symbol('ss-search');

  value = signal<any>(null);
  query = signal('');
  private disabledByForm = signal(false);

  isDisabled = computed(() => this.disabled() || this.disabledByForm());

  private options = computed(() =>
    (this.items() ?? []).map(i => ({ value: i[this.valueField()], label: String(i[this.labelField()] ?? '') })));

  /** Options to render: filtered once the query reaches minChars; the selected one is always kept
   * present so the trigger can still show its label. */
  visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.options();
    let list = q.length >= this.minChars() ? all.filter(o => o.label.toLowerCase().includes(q)) : all;
    const v = this.value();
    if (v != null && !list.some(o => o.value === v)) {
      const sel = all.find(o => o.value === v);
      if (sel) list = [sel, ...list];
    }
    return list;
  });

  private onChange: (v: any) => void = () => {};
  onTouched: () => void = () => {};

  onSelect(v: any) {
    if (v === this.SEARCH) {
      // Clicking the search row itself must never become the value — restore the real
      // selection so mat-select doesn't display the sentinel option.
      if (this.sel) this.sel.value = this.value();
      return;
    }
    this.value.set(v); this.onChange(v); this.selectionChange.emit(v);
  }

  onOpened(opened: boolean) {
    if (opened) setTimeout(() => this.searchEl?.nativeElement.focus(), 0);
    else { this.query.set(''); this.onTouched(); }
  }

  /** Keep typing local (so mat-select's letter typeahead doesn't hijack it), but let the panel's
   * own navigation/close keys through. */
  onSearchKey(e: KeyboardEvent) {
    // Keep typing local so the select's built-in letter-typeahead doesn't hijack it; only let
    // Escape/Tab through to close/leave the panel.
    if (!['Escape', 'Tab'].includes(e.key)) e.stopPropagation();
  }

  writeValue(v: any): void { this.value.set(v ?? null); }
  registerOnChange(fn: (v: any) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabledByForm.set(d); }
}
