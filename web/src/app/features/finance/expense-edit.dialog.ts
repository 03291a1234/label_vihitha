import { Component, Inject, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CurrencyPipe } from '@angular/common';
import { ExpenseApi, ExpenseCategoryApi, OwnerApi, resolveImageUrl } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { Expense, ExpenseCategory, Owner } from '../../core/models';
import { SearchSelectComponent } from '../../shared/search-select.component';

const INR_RATE = 95;

@Component({
  selector: 'app-expense-edit',
  standalone: true,
  imports: [
    ReactiveFormsModule, CurrencyPipe, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatButtonToggleModule, MatIconModule, MatProgressSpinnerModule,
    SearchSelectComponent
  ],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Edit expense' : 'New expense' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <div class="form-row">
          <app-search-select label="Category" [items]="categories()" formControlName="expenseCategoryId" />
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
        <app-search-select label="Paid by" [items]="owners()" formControlName="paidByOwnerId"
          nullOption nullLabel="— Company / unspecified —"
          [hint]="owners().length === 0 ? 'Add owners on the Owners page to attribute who paid' : ''" />
        <mat-form-field>
          <mat-label>Notes</mat-label>
          <textarea matInput rows="2" formControlName="notes"></textarea>
        </mat-form-field>

        <div class="receipt">
          <span class="r-label">Receipt</span>
          <input #fileInput type="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" hidden
                 (change)="onReceiptSelected($event)" />
          @if (receiptUrl()) {
            <a class="r-link" [href]="receiptHref()" target="_blank" rel="noopener"><mat-icon>description</mat-icon> View receipt</a>
            <button mat-button type="button" color="warn" (click)="removeReceipt()">Remove</button>
          } @else {
            <button mat-stroked-button type="button" (click)="fileInput.click()" [disabled]="uploading()">
              @if (uploading()) { <mat-spinner diameter="18"></mat-spinner> } @else { <mat-icon>attach_file</mat-icon> }
              Attach receipt
            </button>
            <span class="muted r-hint">Image or PDF · max 10 MB</span>
          }
        </div>
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
    .receipt { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 4px 0; }
    .r-label { font-weight: 600; color: var(--lv-wine); }
    .r-link { display: inline-flex; align-items: center; gap: 4px; color: var(--lv-wine); text-decoration: none; font-weight: 600; }
    .r-link mat-icon { font-size: 18px; height: 18px; width: 18px; }
    .receipt button mat-spinner { display: inline-block; margin-right: 6px; }
    .r-hint { font-size: 12px; }
  `]
})
export class ExpenseEditDialog {
  private fb = inject(FormBuilder);
  private api = inject(ExpenseApi);
  private catApi = inject(ExpenseCategoryApi);
  private ownerApi = inject(OwnerApi);
  private notify = inject(Notify);
  ref = inject(MatDialogRef<ExpenseEditDialog>);

  readonly rate = INR_RATE;
  categories = signal<ExpenseCategory[]>([]);
  owners = signal<Owner[]>([]);
  currency = signal<'USD' | 'INR'>('USD');
  saving = signal(false);
  uploading = signal(false);
  receiptUrl = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    expenseCategoryId: [null as number | null, Validators.required],
    date: [new Date().toISOString().slice(0, 10), Validators.required],
    amount: [0, [Validators.required, Validators.min(0)]],
    description: [''],
    notes: [''],
    paidByOwnerId: [null as number | null]
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: Expense | null) {
    this.catApi.list(false).subscribe(cs => this.categories.set(cs));
    this.ownerApi.list(false).subscribe(os => this.owners.set(os));
    if (data) {
      this.form.patchValue({
        expenseCategoryId: data.expenseCategoryId,
        date: data.date.slice(0, 10),
        amount: data.amount,
        description: data.description ?? '',
        notes: data.notes ?? '',
        paidByOwnerId: data.paidByOwnerId ?? null
      });
      this.receiptUrl.set(data.receiptUrl ?? null);
    }
  }

  receiptHref() { return resolveImageUrl(this.receiptUrl()); }

  onReceiptSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { this.notify.error(null, 'Receipt exceeds the 10 MB limit'); return; }
    this.uploading.set(true);
    this.api.uploadReceipt(file).subscribe({
      next: (res) => { this.receiptUrl.set(res.url); this.uploading.set(false); input.value = ''; },
      error: (e) => { this.uploading.set(false); input.value = ''; this.notify.error(e); }
    });
  }

  removeReceipt() { this.receiptUrl.set(null); }

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
      notes: v.notes || null,
      paidByOwnerId: v.paidByOwnerId ?? null,
      receiptUrl: this.receiptUrl()
    };
    const req = this.data ? this.api.update(this.data.id, body) : this.api.create(body);
    req.subscribe({
      next: () => { this.notify.success('Expense saved'); this.ref.close(true); },
      error: (e) => { this.saving.set(false); this.notify.error(e); }
    });
  }
}
