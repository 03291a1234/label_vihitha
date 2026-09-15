import { Component, Inject, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { VendorApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { Vendor } from '../../core/models';

@Component({
  selector: 'app-vendor-edit',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatSlideToggleModule
  ],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Edit vendor' : 'New vendor' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field>
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" placeholder="e.g. Shanthi NX" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>Contact person</mat-label>
          <input matInput formControlName="contactPerson" />
        </mat-form-field>
        <div class="form-row">
          <mat-form-field>
            <mat-label>Phone</mat-label>
            <input matInput formControlName="phone" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Email</mat-label>
            <input matInput type="email" formControlName="email" />
          </mat-form-field>
        </div>
        <mat-form-field>
          <mat-label>Notes</mat-label>
          <textarea matInput rows="2" formControlName="notes"></textarea>
        </mat-form-field>
        @if (data) {
          <mat-slide-toggle formControlName="isActive">Active</mat-slide-toggle>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close(false)">Cancel</button>
      <button mat-raised-button color="primary" (click)="save()" [disabled]="form.invalid || saving()">Save</button>
    </mat-dialog-actions>
  `
})
export class VendorEditDialog {
  private fb = inject(FormBuilder);
  private api = inject(VendorApi);
  private notify = inject(Notify);
  ref = inject(MatDialogRef<VendorEditDialog>);
  saving = signal(false);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    contactPerson: [''],
    phone: [''],
    email: ['', [Validators.email]],
    notes: [''],
    isActive: [true]
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: Vendor | null) {
    if (data) {
      this.form.patchValue({
        name: data.name,
        contactPerson: data.contactPerson ?? '',
        phone: data.phone ?? '',
        email: data.email ?? '',
        notes: data.notes ?? '',
        isActive: data.isActive
      });
    }
  }

  save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    const body = {
      name: v.name,
      contactPerson: v.contactPerson || null,
      phone: v.phone || null,
      email: v.email || null,
      notes: v.notes || null,
      isActive: v.isActive
    };
    const req = this.data ? this.api.update(this.data.id, body) : this.api.create(body);
    req.subscribe({
      next: () => { this.notify.success('Vendor saved'); this.ref.close(true); },
      error: (e) => { this.saving.set(false); this.notify.error(e); }
    });
  }
}
