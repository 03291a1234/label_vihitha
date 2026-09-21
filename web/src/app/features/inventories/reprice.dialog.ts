import { Component, Inject, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { InventoryApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';

export interface RepriceData { inventoryId: number; inventoryName: string; }

@Component({
  selector: 'app-reprice-dialog',
  standalone: true,
  imports: [DecimalPipe, FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Re-price · {{ data.inventoryName }}</h2>
    <mat-dialog-content>
      <p class="muted lead">Resets every product's sale price to the markup below over its <strong>current cost</strong>.
        Cost is not changed — no shipping is added.</p>
      <mat-form-field class="full">
        <mat-label>Markup over cost</mat-label>
        <input matInput type="number" min="0" step="1" [(ngModel)]="markup" />
        <span matSuffix>%</span>
        <mat-hint>Sale price = cost × {{ (1 + (markup || 0) / 100) | number:'1.0-2' }} (100% = double the cost)</mat-hint>
      </mat-form-field>
      <p class="warn"><mat-icon>info</mat-icon> Overwrites current sale prices for every product in this batch.</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close(false)">Cancel</button>
      <button mat-raised-button color="primary" (click)="apply()" [disabled]="markup < 0 || busy()">Re-price</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .lead { margin: 0 0 14px; }
    .full { width: 100%; }
    .warn { display: flex; align-items: center; gap: 6px; color: #8a5a12; font-size: 13px; margin: 12px 0 0; }
    .warn mat-icon { font-size: 18px; height: 18px; width: 18px; }
  `]
})
export class RepriceDialog {
  private api = inject(InventoryApi);
  private notify = inject(Notify);
  ref = inject(MatDialogRef<RepriceDialog>);

  markup = 100;
  busy = signal(false);

  constructor(@Inject(MAT_DIALOG_DATA) public data: RepriceData) {}

  apply() {
    if (this.markup < 0) return;
    this.busy.set(true);
    this.api.reprice(this.data.inventoryId, this.markup || 0).subscribe({
      next: (r) => { this.notify.success(`Re-priced ${r.productsUpdated} product${r.productsUpdated === 1 ? '' : 's'} at ${r.markupPercent}% markup.`); this.ref.close(true); },
      error: (e) => { this.busy.set(false); this.notify.error(e); }
    });
  }
}
