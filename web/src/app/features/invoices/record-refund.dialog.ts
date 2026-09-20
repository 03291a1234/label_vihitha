import { Component, Inject, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { InvoiceApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { Invoice, PaymentMethod } from '../../core/models';

/** Record a refund (money returned) against an invoice, optionally returning items to stock. */
@Component({
  selector: 'app-record-refund',
  standalone: true,
  imports: [CurrencyPipe, ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatSlideToggleModule],
  template: `
    <h2 mat-dialog-title>Record refund</h2>
    <mat-dialog-content>
      <p class="muted">Collected on this invoice: <strong>{{ data.amountPaid | currency }}</strong> — the most you can refund.</p>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field>
          <mat-label>Refund amount</mat-label>
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
          <mat-label>Reason</mat-label>
          <input matInput formControlName="reason" placeholder="e.g. size exchange, damaged" />
        </mat-form-field>
        <mat-slide-toggle formControlName="restock">Return items to stock (this order)</mat-slide-toggle>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close(false)">Cancel</button>
      <button mat-raised-button color="warn" (click)="save()" [disabled]="form.invalid || saving()">Refund</button>
    </mat-dialog-actions>
  `
})
export class RecordRefundDialog {
  private fb = inject(FormBuilder);
  private api = inject(InvoiceApi);
  private notify = inject(Notify);
  ref = inject(MatDialogRef<RecordRefundDialog>);
  saving = signal(false);

  form = this.fb.nonNullable.group({
    amount: [0, [Validators.required, Validators.min(0.01)]],
    method: ['Zelle' as PaymentMethod, Validators.required],
    reason: [''],
    restock: [false]
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: Invoice) {
    this.form.patchValue({ amount: data.amountPaid, method: data.paymentMethod });
  }

  save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    this.api.recordRefund(this.data.id, { amount: v.amount, method: v.method, reason: v.reason || null, restock: v.restock }).subscribe({
      next: () => { this.notify.success('Refund recorded'); this.ref.close(true); },
      error: (e) => { this.saving.set(false); this.notify.error(e); }
    });
  }
}
