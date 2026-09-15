import { Component, Inject, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { CategoryApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { Category } from '../../core/models';
import { MoneyInputComponent } from '../../shared/money-input.component';

@Component({
  selector: 'app-category-edit',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatSlideToggleModule, MoneyInputComponent
  ],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Edit category' : 'New category' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field>
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>Description</mat-label>
          <textarea matInput rows="2" formControlName="description"></textarea>
        </mat-form-field>
        <div class="form-row">
          <app-money-input formControlName="defaultOriginalPrice" label="Default cost" placeholder="optional" />
          <app-money-input formControlName="defaultSalePrice" label="Default sale" placeholder="optional" />
        </div>
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
export class CategoryEditDialog {
  private fb = inject(FormBuilder);
  private api = inject(CategoryApi);
  private notify = inject(Notify);
  ref = inject(MatDialogRef<CategoryEditDialog>);
  saving = signal(false);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: [''],
    defaultOriginalPrice: [null as number | null],
    defaultSalePrice: [null as number | null],
    isActive: [true]
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: Category | null) {
    if (data) {
      this.form.patchValue({
        name: data.name,
        description: data.description ?? '',
        defaultOriginalPrice: data.defaultOriginalPrice ?? null,
        defaultSalePrice: data.defaultSalePrice ?? null,
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
      description: v.description || null,
      defaultOriginalPrice: v.defaultOriginalPrice,
      defaultSalePrice: v.defaultSalePrice,
      isActive: v.isActive
    };
    const req = this.data
      ? this.api.update(this.data.id, body)
      : this.api.create(body);
    req.subscribe({
      next: () => { this.notify.success('Category saved'); this.ref.close(true); },
      error: (e) => { this.saving.set(false); this.notify.error(e); }
    });
  }
}
