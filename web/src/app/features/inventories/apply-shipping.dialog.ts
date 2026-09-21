import { Component, Inject, inject, signal, computed } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { InventoryApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { SettingsService } from '../../core/services/settings.service';
import { InrAmountPipe } from '../../shared/inr-amount.pipe';

export interface ApplyShippingData { inventoryId: number; inventoryName: string; totalUnits: number; }

@Component({
  selector: 'app-apply-shipping-dialog',
  standalone: true,
  imports: [CurrencyPipe, DecimalPipe, FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatButtonToggleModule, MatIconModule, InrAmountPipe],
  template: `
    <h2 mat-dialog-title>Add shipping · {{ data.inventoryName }}</h2>
    <mat-dialog-content>
      <p class="muted lead">Splits the shipping cost evenly across the <strong>{{ data.totalUnits }}</strong> unit{{ data.totalUnits === 1 ? '' : 's' }}
        on hand, adds each unit's share to its product cost, then re-prices sale = cost + markup.</p>

      <div class="amount-row">
        <mat-form-field class="grow">
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

      @if (usd() > 0 && data.totalUnits > 0) {
        <div class="preview">
          <div class="prow"><span>Shipping (USD)</span><strong>{{ usd() | currency }}</strong></div>
          <div class="prow"><span>Per unit ({{ data.totalUnits }} units)</span><strong>{{ perUnit() | currency:'USD':'symbol':'1.2-4' }}</strong></div>
          <div class="prow muted"><span>≈ per unit in INR</span><span>{{ perUnit() | inrAmount | currency:'INR':'symbol':'1.0-2' }}</span></div>
        </div>
        <p class="warn"><mat-icon>info</mat-icon> This updates cost &amp; sale price for every product in this batch and can't be auto-undone.</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close(false)">Cancel</button>
      <button mat-raised-button color="primary" (click)="apply()" [disabled]="usd() <= 0 || data.totalUnits < 1 || busy()">
        Apply shipping
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .lead { margin: 0 0 14px; }
    .amount-row { display: flex; gap: 10px; align-items: flex-start; }
    .grow { width: 100%; }
    .preview { background: var(--lv-cream-2); border: 1px solid var(--lv-line); border-radius: 10px; padding: 10px 14px; margin-top: 6px; }
    .prow { display: flex; justify-content: space-between; padding: 3px 0; }
    .warn { display: flex; align-items: center; gap: 6px; color: #8a5a12; font-size: 13px; margin: 12px 0 0; }
    .warn mat-icon { font-size: 18px; height: 18px; width: 18px; }
  `]
})
export class ApplyShippingDialog {
  private api = inject(InventoryApi);
  private notify = inject(Notify);
  private settings = inject(SettingsService);
  ref = inject(MatDialogRef<ApplyShippingDialog>);

  amount: number | null = null;
  currency: 'USD' | 'INR' = 'USD';
  markup = 100;
  busy = signal(false);
  private v = signal(0);

  constructor(@Inject(MAT_DIALOG_DATA) public data: ApplyShippingData) {}

  bump() { this.v.update(n => n + 1); }
  usd = computed(() => {
    this.v();
    const a = this.amount || 0;
    return this.currency === 'INR' ? a / this.settings.inrPerUsd() : a;
  });
  perUnit = computed(() => this.data.totalUnits > 0 ? this.usd() / this.data.totalUnits : 0);

  apply() {
    if (this.usd() <= 0) return;
    this.busy.set(true);
    this.api.applyShipping(this.data.inventoryId, { amountUsd: +this.usd().toFixed(4), markupPercent: this.markup || 0 }).subscribe({
      next: (r) => {
        this.notify.success(`Shipping applied to ${r.productsUpdated} product${r.productsUpdated === 1 ? '' : 's'} (${r.unitsCovered} units).`);
        this.ref.close(true);
      },
      error: (e) => { this.busy.set(false); this.notify.error(e); }
    });
  }
}
