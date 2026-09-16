import { Component, Inject, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { OwnerApi } from '../../core/services/api.services';
import { Owner, BulkSetPaidByRequest } from '../../core/models';

export interface BulkPaidByData {
  filter: Omit<BulkSetPaidByRequest, 'paidByOwnerId' | 'recordOwnerContribution'>;
  /** How many products the current filter matches (for the confirmation copy). */
  count: number;
  /** Human-readable summary of the active filters, e.g. "Inventory 1 · Rupkamal". */
  scope: string;
}

@Component({
  selector: 'app-bulk-paid-by',
  standalone: true,
  imports: [
    FormsModule, MatDialogModule, MatFormFieldModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatSlideToggleModule
  ],
  template: `
    <h2 mat-dialog-title>Set “Paid by” in bulk</h2>
    <mat-dialog-content>
      <p class="scope">
        Applies to <strong>{{ data.count }}</strong> product{{ data.count === 1 ? '' : 's' }}
        @if (data.scope) { matching <span class="chip">{{ data.scope }}</span> }
        @else { <span class="warn">— the whole catalog (no filters applied)</span> }
      </p>

      <mat-form-field class="full">
        <mat-label>Paid by</mat-label>
        <mat-select [(ngModel)]="ownerId">
          <mat-option [value]="null">— None (clear / jointly funded) —</mat-option>
          @for (o of owners(); track o.id) { <mat-option [value]="o.id">{{ o.name }}</mat-option> }
        </mat-select>
        <mat-hint>Funder recorded on each of these products (overrides the inventory’s owner)</mat-hint>
      </mat-form-field>

      @if (ownerId) {
        <div class="contrib">
          <mat-slide-toggle [(ngModel)]="recordContribution">Also record one capital contribution</mat-slide-toggle>
          <div class="muted contrib-hint">Posts this owner a single contribution = total cost of the affected stock.
            Use only if they paid out-of-pocket, not from the shared account.</div>
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close(false)">Cancel</button>
      <button mat-raised-button color="primary" (click)="apply()" [disabled]="data.count === 0">Apply</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .scope { margin: 0 0 14px; line-height: 1.5; }
    .full { width: 100%; }
    .chip { display: inline-block; background: var(--lv-rose-soft, #f7ebf0); color: var(--lv-wine);
      border-radius: 999px; padding: 2px 10px; font-size: 12px; font-weight: 600; }
    .warn { color: #8a5a00; }
    .contrib { margin-top: 4px; }
    .contrib-hint { font-size: 11px; line-height: 1.3; margin-top: 2px; }
  `]
})
export class BulkPaidByDialog {
  private ownerApi = inject(OwnerApi);
  ref = inject(MatDialogRef<BulkPaidByDialog, BulkSetPaidByRequest | false>);

  owners = signal<Owner[]>([]);
  ownerId: number | null = null;
  recordContribution = false;

  constructor(@Inject(MAT_DIALOG_DATA) public data: BulkPaidByData) {
    this.ownerApi.list(false).subscribe(os => this.owners.set(os));
  }

  apply() {
    const body: BulkSetPaidByRequest = {
      ...this.data.filter,
      paidByOwnerId: this.ownerId,
      recordOwnerContribution: this.ownerId ? this.recordContribution : false
    };
    this.ref.close(body);
  }
}
