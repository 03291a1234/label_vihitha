import { Component, Inject, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { OwnerApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { Owner } from '../../core/models';

@Component({
  selector: 'app-owner-edit',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatSlideToggleModule
  ],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Edit owner' : 'New owner' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <div class="form-row">
          <mat-form-field>
            <mat-label>Name</mat-label>
            <input matInput formControlName="name" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Profit share</mat-label>
            <span matTextSuffix>&nbsp;%</span>
            <input matInput type="number" formControlName="profitSharePercent" />
          </mat-form-field>
        </div>
        <div class="form-row">
          <mat-form-field>
            <mat-label>Email</mat-label>
            <input matInput type="email" formControlName="email" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Phone</mat-label>
            <input matInput formControlName="phone" />
          </mat-form-field>
        </div>
        <mat-form-field>
          <mat-label>Notes</mat-label>
          <textarea matInput rows="2" formControlName="notes"></textarea>
        </mat-form-field>
        @if (data) { <mat-slide-toggle formControlName="isActive">Active</mat-slide-toggle> }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close(false)">Cancel</button>
      <button mat-raised-button color="primary" (click)="save()" [disabled]="form.invalid || saving()">Save</button>
    </mat-dialog-actions>
  `
})
export class OwnerEditDialog {
  private fb = inject(FormBuilder);
  private api = inject(OwnerApi);
  private notify = inject(Notify);
  ref = inject(MatDialogRef<OwnerEditDialog>);
  saving = signal(false);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    profitSharePercent: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
    email: ['', [Validators.email]],
    phone: [''],
    notes: [''],
    isActive: [true]
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: Owner | null) {
    if (data) {
      this.form.patchValue({
        name: data.name, profitSharePercent: data.profitSharePercent,
        email: data.email ?? '', phone: data.phone ?? '', notes: data.notes ?? '', isActive: data.isActive
      });
    }
  }

  save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    const body = {
      name: v.name, profitSharePercent: v.profitSharePercent,
      email: v.email || null, phone: v.phone || null, notes: v.notes || null, isActive: v.isActive
    };
    const req = this.data ? this.api.update(this.data.id, body) : this.api.create(body);
    req.subscribe({
      next: () => { this.notify.success('Owner saved'); this.ref.close(true); },
      error: (e) => { this.saving.set(false); this.notify.error(e); }
    });
  }
}
