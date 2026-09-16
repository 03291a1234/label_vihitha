import { Component, Inject, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { InventoryApi, OwnerApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { Inventory, Owner } from '../../core/models';

@Component({
  selector: 'app-inventory-edit',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatSlideToggleModule
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
        <mat-form-field>
          <mat-label>Paid by</mat-label>
          <mat-select formControlName="paidByOwnerId">
            <mat-option [value]="null">— None (jointly funded) —</mat-option>
            @for (o of owners(); track o.id) { <mat-option [value]="o.id">{{ o.name }}</mat-option> }
          </mat-select>
          <mat-hint>Owner whose capital funded this whole batch (optional)</mat-hint>
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
  private ownerApi = inject(OwnerApi);
  private notify = inject(Notify);
  ref = inject(MatDialogRef<InventoryEditDialog>);
  saving = signal(false);
  owners = signal<Owner[]>([]);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: [''],
    paidByOwnerId: [null as number | null],
    isActive: [true]
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: Inventory | null) {
    this.ownerApi.list(false).subscribe(os => this.owners.set(os));
    if (data) this.form.patchValue({ name: data.name, description: data.description ?? '',
      paidByOwnerId: data.paidByOwnerId ?? null, isActive: data.isActive });
  }

  save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    const req = this.data
      ? this.api.update(this.data.id, { name: v.name, description: v.description || null, isActive: v.isActive, paidByOwnerId: v.paidByOwnerId })
      : this.api.create({ name: v.name, description: v.description || null, paidByOwnerId: v.paidByOwnerId });
    req.subscribe({
      next: () => { this.notify.success('Inventory saved'); this.ref.close(true); },
      error: (e) => { this.saving.set(false); this.notify.error(e); }
    });
  }
}
