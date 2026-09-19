import { Component, Inject, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { OwnerApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { Owner, OwnerTransaction, OwnerTransactionType } from '../../core/models';
import { DateInputComponent } from '../../shared/date-input.component';
import { MoneyInputComponent } from '../../shared/money-input.component';

@Component({
  selector: 'app-owner-transactions',
  standalone: true,
  imports: [DateInputComponent, 
    CurrencyPipe, DatePipe, FormsModule, MatDialogModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatButtonModule, MatIconModule, MoneyInputComponent
  ],
  template: `
    <h2 mat-dialog-title>Capital ledger · {{ data.name }}</h2>
    <mat-dialog-content>
      <div class="add">
        <div class="add-top">
          <mat-form-field class="grow">
            <mat-label>Type</mat-label>
            <mat-select [(ngModel)]="type">
              <mat-option value="Contribution">Contribution</mat-option>
              <mat-option value="Withdrawal">Withdrawal</mat-option>
            </mat-select>
          </mat-form-field>
          <app-date-input class="grow" label="Date" [(ngModel)]="date" [ngModelOptions]="{standalone:true}" />
        </div>
        <app-money-input [(ngModel)]="amount" label="Amount" />
        <button mat-raised-button color="primary" class="add-btn" (click)="add()" [disabled]="!amount || busy()">
          <mat-icon>add</mat-icon> Add movement
        </button>
      </div>

      @if (rows().length === 0) { <div class="muted empty">No capital movements yet.</div> }
      <div class="rows">
        @for (t of rows(); track t.id) {
          <div class="trow">
            <span class="badge" [class.contrib]="t.type === 'Contribution'" [class.withdraw]="t.type === 'Withdrawal'">
              {{ t.type === 'Contribution' ? 'In' : 'Out' }}
            </span>
            <div class="info">
              <strong>{{ (t.type === 'Withdrawal' ? -t.amount : t.amount) | currency }}</strong>
              <span class="muted">{{ t.date | date:'mediumDate' }}@if (t.notes) { · {{ t.notes }} }</span>
            </div>
            <button mat-icon-button color="warn" (click)="remove(t)"><mat-icon>delete</mat-icon></button>
          </div>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close(changed)">Done</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .add { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
    .add-top { display: flex; gap: 8px; }
    .add-top .grow { flex: 1; }
    .add-btn { align-self: flex-start; margin-top: 4px; }
    .empty { padding: 14px 4px; }
    .trow { display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #f0f0f0; padding: 8px 0; }
    .info { flex: 1; display: flex; flex-direction: column; }
    .info .muted { font-size: 12px; }
    .badge { font-size: 11px; font-weight: 700; border-radius: 999px; padding: 2px 10px; }
    .badge.contrib { background: #e7f4ea; color: #1e7d3a; }
    .badge.withdraw { background: #fdecec; color: #b3261e; }
  `]
})
export class OwnerTransactionsDialog {
  private api = inject(OwnerApi);
  private notify = inject(Notify);
  ref = inject(MatDialogRef<OwnerTransactionsDialog>);

  rows = signal<OwnerTransaction[]>([]);
  busy = signal(false);
  changed = false;

  type: OwnerTransactionType = 'Contribution';
  amount: number | null = null;
  date = new Date().toISOString().slice(0, 10);

  constructor(@Inject(MAT_DIALOG_DATA) public data: Owner) { this.load(); }

  load() { this.api.transactions(this.data.id).subscribe(t => this.rows.set(t)); }

  add() {
    if (!this.amount) return;
    this.busy.set(true);
    this.api.addTransaction(this.data.id, {
      date: new Date(this.date).toISOString(), type: this.type, amount: this.amount, notes: null
    }).subscribe({
      next: () => { this.amount = null; this.busy.set(false); this.changed = true; this.notify.success('Saved'); this.load(); },
      error: (e) => { this.busy.set(false); this.notify.error(e); }
    });
  }

  remove(t: OwnerTransaction) {
    this.api.removeTransaction(this.data.id, t.id).subscribe({
      next: () => { this.changed = true; this.notify.success('Removed'); this.load(); },
      error: (e) => this.notify.error(e)
    });
  }
}
