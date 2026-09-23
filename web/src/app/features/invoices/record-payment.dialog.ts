import { Component, Inject, inject, signal } from '@angular/core';
import { MoneyPipe } from '../../shared/money.pipe';

import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { InvoiceApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { Invoice, PaymentMethod } from '../../core/models';

@Component({
  selector: 'app-record-payment',
  standalone: true,
  imports: [MoneyPipe, ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Record payment</h2>
    <mat-dialog-content>
      <p class="muted">Outstanding balance: <strong>{{ data.amountRemaining | currency }}</strong></p>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field>
          <mat-label>Amount</mat-label>
          <span matTextPrefix>$&nbsp;</span>
          <input matInput type="number" formControlName="amount" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>Method</mat-label>
          <mat-select formControlName="method">
            <mat-option value="Zelle">Zelle</mat-option>
            <mat-option value="Cash">Cash</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Reference (Zelle confirmation #)</mat-label>
          <input matInput formControlName="referenceNumber" />
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close(false)">Cancel</button>
      <button mat-raised-button color="primary" (click)="save()" [disabled]="form.invalid || saving()">Record</button>
    </mat-dialog-actions>
  `
})
export class RecordPaymentDialog {
  private fb = inject(FormBuilder);
  private api = inject(InvoiceApi);
  private notify = inject(Notify);
  ref = inject(MatDialogRef<RecordPaymentDialog>);
  saving = signal(false);

  form = this.fb.nonNullable.group({
    amount: [0, [Validators.required, Validators.min(0.01)]],
    method: ['Zelle' as PaymentMethod, Validators.required],
    referenceNumber: ['']
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: Invoice) {
    this.form.patchValue({ amount: data.amountRemaining, method: data.paymentMethod });
  }

  save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    this.api.recordPayment(this.data.id, { amount: v.amount, method: v.method, referenceNumber: v.referenceNumber || null }).subscribe({
      next: () => { this.notify.success('Payment recorded'); this.ref.close(true); },
      error: (e) => { this.saving.set(false); this.notify.error(e); }
    });
  }
}
