import { Component, Inject, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { PromoCodeApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { PromoCode } from '../../core/models';

@Component({
  selector: 'app-promo-code-edit',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatSlideToggleModule
  ],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Edit promo code' : 'New promo code' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <div class="form-row">
          <mat-form-field>
            <mat-label>Code</mat-label>
            <input matInput formControlName="code" placeholder="e.g. DIWALI25" (input)="upper()" />
            <mat-hint>What customers type at checkout</mat-hint>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Discount type</mat-label>
            <mat-select formControlName="discountType">
              <mat-option value="Percentage">% off</mat-option>
              <mat-option value="FixedAmount">$ off</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
        <div class="form-row">
          <mat-form-field>
            <mat-label>{{ form.value.discountType === 'Percentage' ? 'Percent off' : 'Amount off (USD)' }}</mat-label>
            <input matInput type="number" formControlName="value" />
            <span matTextSuffix>{{ form.value.discountType === 'Percentage' ? '%' : '$' }}</span>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Minimum order (optional)</mat-label>
            <input matInput type="number" formControlName="minOrderAmount" />
            <span matTextPrefix>$&nbsp;</span>
          </mat-form-field>
        </div>
        <mat-form-field>
          <mat-label>Description (optional)</mat-label>
          <input matInput formControlName="description" placeholder="e.g. Diwali festival offer" />
        </mat-form-field>
        <div class="form-row">
          <mat-form-field><mat-label>Valid from (optional)</mat-label><input matInput type="date" formControlName="validFrom" /></mat-form-field>
          <mat-form-field><mat-label>Valid to (optional)</mat-label><input matInput type="date" formControlName="validTo" /></mat-form-field>
        </div>
        <div class="form-row">
          <mat-form-field>
            <mat-label>Max total uses (optional)</mat-label>
            <input matInput type="number" formControlName="maxUses" />
            <mat-hint>Leave blank for unlimited</mat-hint>
          </mat-form-field>
          @if (data) {
            <div class="active-toggle"><mat-slide-toggle formControlName="isActive">Active</mat-slide-toggle></div>
          }
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close(false)">Cancel</button>
      <button mat-raised-button color="primary" (click)="save()" [disabled]="form.invalid || saving()">Save</button>
    </mat-dialog-actions>
  `,
  styles: [`.active-toggle { display: flex; align-items: center; }`]
})
export class PromoCodeEditDialog {
  private fb = inject(FormBuilder);
  private api = inject(PromoCodeApi);
  private notify = inject(Notify);
  ref = inject(MatDialogRef<PromoCodeEditDialog>);
  saving = signal(false);

  form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(40)]],
    description: [''],
    discountType: ['Percentage' as 'Percentage' | 'FixedAmount', Validators.required],
    value: [10, [Validators.required, Validators.min(0)]],
    minOrderAmount: [null as number | null],
    validFrom: [''],
    validTo: [''],
    maxUses: [null as number | null],
    isActive: [true]
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: PromoCode | null) {
    if (data) {
      this.form.patchValue({
        code: data.code, description: data.description ?? '', discountType: data.discountType,
        value: data.value, minOrderAmount: data.minOrderAmount ?? null,
        validFrom: data.validFrom ? data.validFrom.substring(0, 10) : '',
        validTo: data.validTo ? data.validTo.substring(0, 10) : '',
        maxUses: data.maxUses ?? null, isActive: data.isActive
      });
    }
  }

  upper() {
    const c = this.form.controls.code;
    c.setValue((c.value || '').toUpperCase(), { emitEvent: false });
  }

  save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    const body: Partial<PromoCode> = {
      code: v.code.trim(),
      description: v.description || null,
      discountType: v.discountType,
      value: Number(v.value),
      minOrderAmount: v.minOrderAmount != null && v.minOrderAmount !== ('' as unknown) ? Number(v.minOrderAmount) : null,
      validFrom: v.validFrom ? new Date(v.validFrom).toISOString() : null,
      validTo: v.validTo ? new Date(v.validTo).toISOString() : null,
      maxUses: v.maxUses != null && v.maxUses !== ('' as unknown) ? Number(v.maxUses) : null,
      isActive: v.isActive
    };
    const req = this.data ? this.api.update(this.data.id, body) : this.api.create(body);
    req.subscribe({
      next: () => { this.notify.success('Promo code saved'); this.ref.close(true); },
      error: (e) => { this.saving.set(false); this.notify.error(e); }
    });
  }
}
