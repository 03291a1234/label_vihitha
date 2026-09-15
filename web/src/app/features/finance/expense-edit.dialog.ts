import { Component, Inject, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { CurrencyPipe } from '@angular/common';
import { ExpenseApi, ExpenseCategoryApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { Expense, ExpenseCategory } from '../../core/models';

const INR_RATE = 95;

@Component({
  selector: 'app-expense-edit',
  standalone: true,
  imports: [
    ReactiveFormsModule, CurrencyPipe, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatButtonToggleModule
  ],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Edit expense' : 'New expense' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <div class="form-row">
          <mat-form-field>
            <mat-label>Category</mat-label>
            <mat-select formControlName="expenseCategoryId">
              @for (c of categories(); track c.id) { <mat-option [value]="c.id">{{ c.name }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Date</mat-label>
            <input matInput type="date" formControlName="date" />
          </mat-form-field>
        </div>
        <div class="amount-row">
          <mat-button-toggle-group [value]="currency()" (change)="currency.set($event.value)" aria-label="Currency">
            <mat-button-toggle value="USD">USD</mat-button-toggle>
            <mat-button-toggle value="INR">INR</mat-button-toggle>
          </mat-button-toggle-group>
          <mat-form-field class="amount">
            <mat-label>Amount ({{ currency() }})</mat-label>
            <span matTextPrefix>{{ currency() === 'USD' ? '$' : '₹' }}&nbsp;</span>
            <input matInput type="number" formControlName="amount" />
          </mat-form-field>
        </div>
        <div class="muted equiv">
          @if (currency() === 'INR') { ≈ {{ (form.controls.amount.value || 0) / rate | currency }} (stored in USD) }
          @else { ≈ {{ (form.controls.amount.value || 0) * rate | currency:'INR':'symbol':'1.0-0' }} }
        </div>
        <mat-form-field>
          <mat-label>Description</mat-label>
          <input matInput formControlName="description" placeholder="e.g. Courier to US - Aug batch" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>Notes</mat-label>
          <textarea matInput rows="2" formControlName="notes"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close(false)">Cancel</button>
      <button mat-raised-button color="primary" (click)="save()" [disabled]="form.invalid || saving()">Save</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .amount-row { display: flex; gap: 12px; align-items: center; }
    .amount-row .amount { flex: 1; }
    .equiv { margin: -6px 0 8px; font-size: 12px; }
  `]
})
export class ExpenseEditDialog {
  private fb = inject(FormBuilder);
  private api = inject(ExpenseApi);
  private catApi = inject(ExpenseCategoryApi);
  private notify = inject(Notify);
  ref = inject(MatDialogRef<ExpenseEditDialog>);

  readonly rate = INR_RATE;
  categories = signal<ExpenseCategory[]>([]);
  currency = signal<'USD' | 'INR'>('USD');
  saving = signal(false);

  form = this.fb.nonNullable.group({
    expenseCategoryId: [null as number | null, Validators.required],
    date: [new Date().toISOString().slice(0, 10), Validators.required],
    amount: [0, [Validators.required, Validators.min(0)]],
    description: [''],
    notes: ['']
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: Expense | null) {
    this.catApi.list(false).subscribe(cs => this.categories.set(cs));
    if (data) {
      this.form.patchValue({
        expenseCategoryId: data.expenseCategoryId,
        date: data.date.slice(0, 10),
        amount: data.amount,
        description: data.description ?? '',
        notes: data.notes ?? ''
      });
    }
  }

  save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    const amountUsd = this.currency() === 'INR' ? Math.round((v.amount / this.rate) * 100) / 100 : v.amount;
    const body = {
      expenseCategoryId: v.expenseCategoryId!,
      date: new Date(v.date).toISOString(),
      amount: amountUsd,
      description: v.description || null,
      notes: v.notes || null
    };
    const req = this.data ? this.api.update(this.data.id, body) : this.api.create(body);
    req.subscribe({
      next: () => { this.notify.success('Expense saved'); this.ref.close(true); },
      error: (e) => { this.saving.set(false); this.notify.error(e); }
    });
  }
}
