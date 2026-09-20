import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { OwnerApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { Owner } from '../../core/models';
import { SearchSelectComponent } from '../../shared/search-select.component';
import { MoneyInputComponent } from '../../shared/money-input.component';
import { DateInputComponent } from '../../shared/date-input.component';

/** Record a deposit (owner contribution) into the common account, from the finance page. */
@Component({
  selector: 'app-record-contribution',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatIconModule, SearchSelectComponent, MoneyInputComponent, DateInputComponent],
  template: `
    <h2 mat-dialog-title>Record contribution to joint account</h2>
    <mat-dialog-content>
      <div class="form">
        <app-search-select label="Owner (who deposited)" [items]="owners()" [(ngModel)]="ownerId" [ngModelOptions]="{standalone:true}" />
        <app-money-input label="Amount" [(ngModel)]="amount" [ngModelOptions]="{standalone:true}" />
        <app-date-input label="Date" [max]="today" [(ngModel)]="date" [ngModelOptions]="{standalone:true}" />
        <input class="note" [(ngModel)]="notes" placeholder="Note (optional)" />
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close(false)">Cancel</button>
      <button mat-raised-button color="primary" (click)="save()" [disabled]="saving() || !ownerId || !amount">
        <mat-icon>savings</mat-icon> Record deposit
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .form { display: flex; flex-direction: column; gap: 4px; min-width: min(380px, 82vw); }
    .note { border: 1px solid var(--lv-line); border-radius: 6px; padding: 10px; font: inherit; }
  `]
})
export class RecordContributionDialog {
  private ownerApi = inject(OwnerApi);
  private notify = inject(Notify);
  ref = inject(MatDialogRef<RecordContributionDialog>);

  owners = signal<Owner[]>([]);
  saving = signal(false);
  today = new Date().toISOString().slice(0, 10);
  ownerId: number | null = null;
  amount: number | null = null;
  date = this.today;
  notes = '';

  constructor() { this.ownerApi.list(false).subscribe(os => this.owners.set(os)); }

  save() {
    if (!this.ownerId || !this.amount || this.amount <= 0) return;
    this.saving.set(true);
    this.ownerApi.addTransaction(this.ownerId, {
      date: new Date((this.date || this.today) + 'T00:00:00Z').toISOString(),
      type: 'Contribution',
      amount: this.amount,
      notes: this.notes.trim() || null
    }).subscribe({
      next: () => { this.notify.success('Contribution recorded'); this.ref.close(true); },
      error: (e) => { this.saving.set(false); this.notify.error(e); }
    });
  }
}
