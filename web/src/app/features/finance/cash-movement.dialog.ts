import { Component, Inject, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { CashApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { CashAccount, CashMovementKind } from '../../core/models';

export interface CashMovementData { accounts: CashAccount[]; }

@Component({
  selector: 'app-cash-movement-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatButtonToggleModule],
  template: `
    <h2 mat-dialog-title>Record cash movement</h2>
    <mat-dialog-content>
      <mat-button-toggle-group [(ngModel)]="kind" class="kinds">
        <mat-button-toggle value="Transfer">Transfer</mat-button-toggle>
        <mat-button-toggle value="CashIn">Money in</mat-button-toggle>
        <mat-button-toggle value="CashOut">Money out</mat-button-toggle>
        <mat-button-toggle value="Opening">Opening</mat-button-toggle>
      </mat-button-toggle-group>

      @if (needsFrom()) {
        <mat-form-field class="full">
          <mat-label>{{ kind === 'Transfer' ? 'From account' : 'Account' }}</mat-label>
          <mat-select [(ngModel)]="fromId">
            @for (a of data.accounts; track a.id) { <mat-option [value]="a.id">{{ a.name }}</mat-option> }
          </mat-select>
        </mat-form-field>
      }
      @if (needsTo()) {
        <mat-form-field class="full">
          <mat-label>{{ kind === 'Transfer' ? 'To account' : 'Account' }}</mat-label>
          <mat-select [(ngModel)]="toId">
            @for (a of data.accounts; track a.id) { <mat-option [value]="a.id" [disabled]="kind === 'Transfer' && a.id === fromId">{{ a.name }}</mat-option> }
          </mat-select>
        </mat-form-field>
      }

      <mat-form-field class="full">
        <mat-label>Amount (USD)</mat-label>
        <span matPrefix>$&nbsp;</span>
        <input matInput type="number" min="0" step="0.01" [(ngModel)]="amount" />
      </mat-form-field>
      <mat-form-field class="full">
        <mat-label>Date</mat-label>
        <input matInput type="date" [(ngModel)]="date" />
      </mat-form-field>
      <mat-form-field class="full">
        <mat-label>Note (optional)</mat-label>
        <input matInput [(ngModel)]="note" placeholder="e.g. sales cash sent to India for Inventory 3" />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close(false)">Cancel</button>
      <button mat-raised-button color="primary" (click)="save()" [disabled]="!valid() || busy()">Record</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .kinds { display: flex; flex-wrap: wrap; margin-bottom: 14px; }
    .full { width: 100%; }
  `]
})
export class CashMovementDialog {
  private api = inject(CashApi);
  private notify = inject(Notify);
  ref = inject(MatDialogRef<CashMovementDialog>);

  kind: CashMovementKind = 'Transfer';
  fromId: number | null = null;
  toId: number | null = null;
  amount: number | null = null;
  date = new Date().toISOString().slice(0, 10);
  note = '';
  busy = signal(false);

  constructor(@Inject(MAT_DIALOG_DATA) public data: CashMovementData) {}

  needsFrom = () => this.kind === 'Transfer' || this.kind === 'CashOut';
  needsTo = () => this.kind === 'Transfer' || this.kind === 'CashIn' || this.kind === 'Opening';

  valid() {
    if (!this.amount || this.amount <= 0) return false;
    if (this.needsFrom() && !this.fromId) return false;
    if (this.needsTo() && !this.toId) return false;
    if (this.kind === 'Transfer' && this.fromId === this.toId) return false;
    return true;
  }

  save() {
    if (!this.valid()) return;
    this.busy.set(true);
    this.api.recordMovement({
      date: `${this.date}T00:00:00Z`, kind: this.kind, amount: this.amount!,
      fromAccountId: this.needsFrom() ? this.fromId : null,
      toAccountId: this.needsTo() ? this.toId : null,
      note: this.note.trim() || null
    }).subscribe({
      next: () => { this.notify.success('Movement recorded'); this.ref.close(true); },
      error: (e) => { this.busy.set(false); this.notify.error(e); }
    });
  }
}
