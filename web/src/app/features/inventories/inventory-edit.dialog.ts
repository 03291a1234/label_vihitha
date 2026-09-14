import { Component, Inject, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { InventoryApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { Inventory } from '../../core/models';

@Component({
  selector: 'app-inventory-edit',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatSlideToggleModule
  ],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Edit inventory' : 'New inventory' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field>
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" placeholder="e.g. Inventory 2" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>Description</mat-label>
          <textarea matInput rows="2" formControlName="description" placeholder="Batch / collection details"></textarea>
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
export class InventoryEditDialog {
  private fb = inject(FormBuilder);
  private api = inject(InventoryApi);
  private notify = inject(Notify);
  ref = inject(MatDialogRef<InventoryEditDialog>);
  saving = signal(false);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: [''],
    isActive: [true]
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: Inventory | null) {
    if (data) this.form.patchValue({ name: data.name, description: data.description ?? '', isActive: data.isActive });
  }

  save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    const req = this.data
      ? this.api.update(this.data.id, { name: v.name, description: v.description || null, isActive: v.isActive })
      : this.api.create({ name: v.name, description: v.description || null });
    req.subscribe({
      next: () => { this.notify.success('Inventory saved'); this.ref.close(true); },
      error: (e) => { this.saving.set(false); this.notify.error(e); }
    });
  }
}
