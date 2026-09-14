import { Component, Inject, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { CategoryApi, ProductApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { Category, Product } from '../../core/models';

@Component({
  selector: 'app-product-edit',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatSlideToggleModule
  ],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Edit product' : 'New product' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field>
          <mat-label>Category</mat-label>
          <mat-select formControlName="categoryId" (selectionChange)="onCategoryChange($event.value)">
            @for (c of categories(); track c.id) {
              <mat-option [value]="c.id">{{ c.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <div class="form-row">
          <mat-form-field>
            <mat-label>SKU</mat-label>
            <input matInput formControlName="sku" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Name</mat-label>
            <input matInput formControlName="name" />
          </mat-form-field>
        </div>
        <div class="form-row">
          <mat-form-field><mat-label>Size</mat-label><input matInput formControlName="size" /></mat-form-field>
          <mat-form-field><mat-label>Color</mat-label><input matInput formControlName="color" /></mat-form-field>
          <mat-form-field><mat-label>Material</mat-label><input matInput formControlName="material" /></mat-form-field>
        </div>
        <div class="form-row">
          <mat-form-field>
            <mat-label>Original price</mat-label>
            <span matTextPrefix>$&nbsp;</span>
            <input matInput type="number" formControlName="originalPrice" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Sale price</mat-label>
            <span matTextPrefix>$&nbsp;</span>
            <input matInput type="number" formControlName="salePrice" />
          </mat-form-field>
        </div>
        <div class="form-row">
          <mat-form-field>
            <mat-label>Quantity on hand</mat-label>
            <input matInput type="number" formControlName="quantityOnHand" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Reorder threshold</mat-label>
            <input matInput type="number" formControlName="reorderThreshold" />
          </mat-form-field>
        </div>
        <mat-form-field>
          <mat-label>Image URL</mat-label>
          <input matInput formControlName="imageUrl" />
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
export class ProductEditDialog {
  private fb = inject(FormBuilder);
  private api = inject(ProductApi);
  private catApi = inject(CategoryApi);
  private notify = inject(Notify);
  ref = inject(MatDialogRef<ProductEditDialog>);

  categories = signal<Category[]>([]);
  saving = signal(false);

  form = this.fb.nonNullable.group({
    categoryId: [null as number | null, Validators.required],
    sku: ['', [Validators.required, Validators.maxLength(50)]],
    name: ['', [Validators.required, Validators.maxLength(200)]],
    size: [''], color: [''], material: [''],
    originalPrice: [0, [Validators.min(0)]],
    salePrice: [0, [Validators.min(0)]],
    quantityOnHand: [0, [Validators.min(0)]],
    reorderThreshold: [0, [Validators.min(0)]],
    imageUrl: [''],
    isActive: [true]
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: Product | null) {
    this.catApi.list(false).subscribe(cs => this.categories.set(cs));
    if (data) {
      this.form.patchValue({
        categoryId: data.categoryId, sku: data.sku, name: data.name,
        size: data.size ?? '', color: data.color ?? '', material: data.material ?? '',
        originalPrice: data.originalPrice, salePrice: data.salePrice,
        quantityOnHand: data.quantityOnHand, reorderThreshold: data.reorderThreshold,
        imageUrl: data.imageUrl ?? '', isActive: data.isActive
      });
    }
  }

  /** On create, prefill prices from the category's defaults when still zero/empty. */
  onCategoryChange(catId: number) {
    if (this.data) return;
    const cat = this.categories().find(c => c.id === catId);
    if (!cat) return;
    if (!this.form.controls.originalPrice.value && cat.defaultOriginalPrice != null)
      this.form.controls.originalPrice.setValue(cat.defaultOriginalPrice);
    if (!this.form.controls.salePrice.value && cat.defaultSalePrice != null)
      this.form.controls.salePrice.setValue(cat.defaultSalePrice);
  }

  save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    if (this.data) {
      this.api.update(this.data.id, { ...v, rowVersion: this.data.rowVersion }).subscribe({
        next: () => { this.notify.success('Product saved'); this.ref.close(true); },
        error: (e) => { this.saving.set(false); this.notify.error(e); }
      });
    } else {
      this.api.create(v).subscribe({
        next: () => { this.notify.success('Product created'); this.ref.close(true); },
        error: (e) => { this.saving.set(false); this.notify.error(e); }
      });
    }
  }
}
