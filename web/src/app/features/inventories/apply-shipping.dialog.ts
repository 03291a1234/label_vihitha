import { Component, Inject, inject, signal, computed } from '@angular/core';
import { Observable } from 'rxjs';
import { CurrencyPipe, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { InventoryApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { SettingsService } from '../../core/services/settings.service';
import { InrAmountPipe } from '../../shared/inr-amount.pipe';
import { ConfirmDialog } from '../../shared/confirm.dialog';
import { Shipping } from '../../core/models';

export interface ApplyShippingData { inventoryId: number; inventoryName: string; totalUnits: number; }

@Component({
  selector: 'app-apply-shipping-dialog',
  standalone: true,
  imports: [CurrencyPipe, DecimalPipe, DatePipe, FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatButtonToggleModule, MatIconModule, InrAmountPipe],
  template: `
    <h2 mat-dialog-title>Shipping · {{ data.inventoryName }}</h2>
    <mat-dialog-content>
      <!-- Applied shipping charges -->
      @if (shippings().length) {
        <div class="applied">
          <div class="sec">Applied shipping</div>
          @for (s of shippings(); track s.id) {
            <div class="srow" [class.editing]="editingId() === s.id">
              <div class="sinfo">
                <strong>{{ s.amountUsd | currency }}</strong>
                <span class="muted">{{ s.perUnitUsd | currency:'USD':'symbol':'1.2-4' }}/unit · {{ s.markupPercent }}% markup · {{ s.productsAffected }} product{{ s.productsAffected === 1 ? '' : 's' }}</span>
                <span class="muted date">{{ s.appliedAt | date:'mediumDate' }}@if (s.note) { · {{ s.note }} }</span>
              </div>
              <div class="sactions">
                <button mat-icon-button (click)="startEdit(s)" title="Edit"><mat-icon>edit</mat-icon></button>
                <button mat-icon-button color="warn" (click)="remove(s)" title="Remove (reverses the cost)"><mat-icon>delete</mat-icon></button>
              </div>
            </div>
          }
        </div>
      }

      <div class="sec">{{ editingId() ? 'Edit shipping' : 'Add shipping' }}</div>
      <p class="muted lead">Splits the amount evenly across the <strong>{{ data.totalUnits }}</strong> unit{{ data.totalUnits === 1 ? '' : 's' }}
        on hand, adds each unit's share to product cost, then re-prices sale = cost × markup.</p>

      <div class="amount-row">
        <mat-form-field class="amt">
          <mat-label>Shipping amount</mat-label>
          <span matPrefix>{{ currency === 'USD' ? '$' : '₹' }}&nbsp;</span>
          <input matInput type="number" min="0" step="0.01" [(ngModel)]="amount" (ngModelChange)="bump()" />
        </mat-form-field>
        <mat-button-toggle-group [(ngModel)]="currency" (change)="bump()">
          <mat-button-toggle value="USD">USD</mat-button-toggle>
          <mat-button-toggle value="INR">INR</mat-button-toggle>
        </mat-button-toggle-group>
      </div>

      <mat-form-field class="grow">
        <mat-label>Markup over cost</mat-label>
        <input matInput type="number" min="0" step="1" [(ngModel)]="markup" (ngModelChange)="bump()" />
        <span matSuffix>%</span>
        <mat-hint>Sale price = cost × {{ (1 + (markup || 0) / 100) | number:'1.0-2' }} (100% = double the cost)</mat-hint>
      </mat-form-field>
      <mat-form-field class="grow">
        <mat-label>Note (optional)</mat-label>
        <input matInput [(ngModel)]="note" placeholder="e.g. DHL air freight" />
      </mat-form-field>

      @if (usd() > 0 && data.totalUnits > 0) {
        <div class="preview">
          <div class="prow"><span>Shipping (USD)</span><strong>{{ usd() | currency }}</strong></div>
          <div class="prow"><span>Per unit ({{ data.totalUnits }} units)</span><strong>{{ perUnit() | currency:'USD':'symbol':'1.2-4' }}</strong></div>
        </div>
      }
      @if (editingId()) { <button mat-button (click)="cancelEdit()">Cancel edit</button> }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close(changed)">Done</button>
      <button mat-raised-button color="primary" (click)="save()" [disabled]="usd() <= 0 || data.totalUnits < 1 || busy()">
        {{ editingId() ? 'Update shipping' : 'Apply shipping' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .sec { font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: rgba(58,37,48,.55); font-weight: 700; margin: 6px 0 6px; }
    .applied { margin-bottom: 10px; }
    .srow { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid var(--lv-line); border-radius: 10px; margin-bottom: 6px; }
    .srow.editing { border-color: var(--lv-wine); background: var(--lv-rose-soft); }
    .sinfo { display: flex; flex-direction: column; }
    .sinfo .muted { font-size: 12px; }
    .sinfo .date { font-size: 11px; }
    .lead { margin: 0 0 14px; }
    .amount-row { display: flex; gap: 10px; align-items: flex-start; flex-wrap: wrap; }
    .amount-row .amt { flex: 1 1 160px; min-width: 0; }
    .amount-row mat-button-toggle-group { flex: 0 0 auto; }
    .grow { width: 100%; }
    .preview { background: var(--lv-cream-2); border: 1px solid var(--lv-line); border-radius: 10px; padding: 10px 14px; margin-top: 6px; }
    .prow { display: flex; justify-content: space-between; padding: 3px 0; }
  `]
})
export class ApplyShippingDialog {
  private api = inject(InventoryApi);
  private notify = inject(Notify);
  private settings = inject(SettingsService);
  private dialog = inject(MatDialog);
  ref = inject(MatDialogRef<ApplyShippingDialog>);

  amount: number | null = null;
  currency: 'USD' | 'INR' = 'USD';
  markup = 100;
  note = '';
  busy = signal(false);
  shippings = signal<Shipping[]>([]);
  editingId = signal<number | null>(null);
  changed = false;
  private v = signal(0);

  constructor(@Inject(MAT_DIALOG_DATA) public data: ApplyShippingData) { this.load(); }

  load() { this.api.getShipping(this.data.inventoryId).subscribe(s => this.shippings.set(s)); }

  bump() { this.v.update(n => n + 1); }
  usd = computed(() => {
    this.v();
    const a = this.amount || 0;
    return this.currency === 'INR' ? a / this.settings.inrPerUsd() : a;
  });
  perUnit = computed(() => this.data.totalUnits > 0 ? this.usd() / this.data.totalUnits : 0);

  startEdit(s: Shipping) {
    this.editingId.set(s.id);
    this.amount = s.amountUsd;
    this.currency = 'USD';
    this.markup = s.markupPercent;
    this.note = s.note ?? '';
    this.bump();
  }
  cancelEdit() { this.editingId.set(null); this.amount = null; this.markup = 100; this.note = ''; this.bump(); }

  save() {
    if (this.usd() <= 0) return;
    this.busy.set(true);
    const body = { amountUsd: +this.usd().toFixed(4), markupPercent: this.markup || 0, note: this.note.trim() || null };
    const id = this.editingId();
    const req: Observable<unknown> = id
      ? this.api.updateShipping(this.data.inventoryId, id, body)
      : this.api.applyShipping(this.data.inventoryId, body);
    req.subscribe({
      next: () => {
        this.notify.success(id ? 'Shipping updated' : 'Shipping applied');
        this.changed = true; this.busy.set(false); this.cancelEdit(); this.load();
      },
      error: (e: unknown) => { this.busy.set(false); this.notify.error(e); }
    });
  }

  remove(s: Shipping) {
    this.dialog.open(ConfirmDialog, { data: {
      title: 'Remove shipping', danger: true, confirmText: 'Remove',
      message: `Remove this ${s.amountUsd.toFixed(2)} shipping? Its ${s.perUnitUsd.toFixed(4)}/unit is subtracted back off the ${s.productsAffected} product${s.productsAffected === 1 ? '' : 's'} and they're re-priced.`
    } }).afterClosed().subscribe(ok => {
      if (!ok) return;
      this.api.deleteShipping(this.data.inventoryId, s.id).subscribe({
        next: () => { this.notify.success('Shipping removed'); this.changed = true; this.load(); },
        error: (e) => this.notify.error(e)
      });
    });
  }
}
