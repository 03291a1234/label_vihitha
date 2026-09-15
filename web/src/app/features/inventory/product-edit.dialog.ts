import { Component, Inject, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { CategoryApi, ProductApi, SubCategoryApi, InventoryApi, VendorApi, resolveImageUrl } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { Category, SubCategory, Inventory, Vendor, Product } from '../../core/models';

@Component({
  selector: 'app-product-edit',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatSlideToggleModule
  ],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Edit product' : 'New product' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <div class="form-row">
          <mat-form-field>
            <mat-label>Category</mat-label>
            <mat-select formControlName="categoryId" (selectionChange)="onCategoryChange($event.value)">
              @for (c of categories(); track c.id) {
                <mat-option [value]="c.id">{{ c.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Subcategory</mat-label>
            <mat-select formControlName="subCategoryId" [disabled]="!form.controls.categoryId.value"
                        (selectionChange)="updateSizeOptions()">
              <mat-option [value]="null">— None —</mat-option>
              @for (s of subCategories(); track s.id) {
                <mat-option [value]="s.id">{{ s.name }}</mat-option>
              }
            </mat-select>
            <mat-hint>Optional</mat-hint>
          </mat-form-field>
        </div>
        <div class="form-row">
          <mat-form-field>
            <mat-label>Inventory</mat-label>
            <mat-select formControlName="inventoryId">
              <mat-option [value]="null">— None —</mat-option>
              @for (i of inventories(); track i.id) { <mat-option [value]="i.id">{{ i.name }}</mat-option> }
            </mat-select>
            <mat-hint>Collection this product belongs to (optional)</mat-hint>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Vendor</mat-label>
            <mat-select formControlName="vendorId">
              <mat-option [value]="null">— None —</mat-option>
              @for (v of vendors(); track v.id) { <mat-option [value]="v.id">{{ v.name }}</mat-option> }
            </mat-select>
            <mat-hint>Supplier this product came from (optional)</mat-hint>
          </mat-form-field>
        </div>
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
          @if (sizeOptions().length) {
            <mat-form-field>
              <mat-label>Size</mat-label>
              <mat-select formControlName="size">
                <mat-option [value]="''">—</mat-option>
                @for (z of sizeOptions(); track z) { <mat-option [value]="z">{{ z }}</mat-option> }
              </mat-select>
              <mat-hint>From the subcategory</mat-hint>
            </mat-form-field>
          } @else {
            <mat-form-field><mat-label>Size</mat-label><input matInput formControlName="size" /></mat-form-field>
          }
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
        <div class="photo">
          <div class="thumb">
            @if (previewUrl()) {
              <img [src]="previewUrl()" alt="Product photo" />
            } @else {
              <mat-icon>image</mat-icon>
            }
          </div>
          <div class="photo-actions">
            <input #fileInput type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden
                   (change)="onFileSelected($event)" />
            <button mat-stroked-button type="button" (click)="fileInput.click()" [disabled]="uploading()">
              @if (uploading()) { <mat-spinner diameter="18"></mat-spinner> }
              @else { <mat-icon>upload</mat-icon> }
              {{ previewUrl() ? 'Replace photo' : 'Upload photo' }}
            </button>
            @if (previewUrl()) {
              <button mat-button type="button" color="warn" (click)="removePhoto()">Remove</button>
            }
            <div class="muted photo-hint">JPEG, PNG, WebP or GIF · max 5 MB</div>
          </div>
        </div>
        @if (data) {
          <mat-slide-toggle formControlName="isActive">Active</mat-slide-toggle>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close(false)">Cancel</button>
      <button mat-raised-button color="primary" (click)="save()" [disabled]="form.invalid || saving() || uploading()">Save</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .photo { display: flex; gap: 16px; align-items: center; margin: 8px 0; }
    .thumb {
      width: 96px; height: 96px; border-radius: 10px; background: #f0f0f3;
      display: grid; place-items: center; overflow: hidden; flex: 0 0 auto;
    }
    .thumb img { width: 100%; height: 100%; object-fit: cover; }
    .thumb mat-icon { color: #b0b0b8; font-size: 40px; height: 40px; width: 40px; }
    .photo-actions { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
    .photo-actions button mat-spinner { display: inline-block; margin-right: 6px; }
    .photo-hint { font-size: 12px; }
  `]
})
export class ProductEditDialog {
  private fb = inject(FormBuilder);
  private api = inject(ProductApi);
  private catApi = inject(CategoryApi);
  private subApi = inject(SubCategoryApi);
  private invApi = inject(InventoryApi);
  private vendorApi = inject(VendorApi);
  private notify = inject(Notify);
  ref = inject(MatDialogRef<ProductEditDialog>);

  categories = signal<Category[]>([]);
  subCategories = signal<SubCategory[]>([]);
  inventories = signal<Inventory[]>([]);
  vendors = signal<Vendor[]>([]);
  sizeOptions = signal<string[]>([]);
  saving = signal(false);
  uploading = signal(false);
  previewUrl = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    categoryId: [null as number | null, Validators.required],
    subCategoryId: [null as number | null],
    inventoryId: [null as number | null],
    vendorId: [null as number | null],
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
    this.invApi.list(false).subscribe(inv => this.inventories.set(inv));
    this.vendorApi.list(false).subscribe(vs => this.vendors.set(vs));
    if (data) {
      this.form.patchValue({
        categoryId: data.categoryId, subCategoryId: data.subCategoryId ?? null,
        inventoryId: data.inventoryId ?? null,
        vendorId: data.vendorId ?? null,
        sku: data.sku, name: data.name,
        size: data.size ?? '', color: data.color ?? '', material: data.material ?? '',
        originalPrice: data.originalPrice, salePrice: data.salePrice,
        quantityOnHand: data.quantityOnHand, reorderThreshold: data.reorderThreshold,
        imageUrl: data.imageUrl ?? '', isActive: data.isActive
      });
      this.previewUrl.set(resolveImageUrl(data.imageUrl));
      this.loadSubCategories(data.categoryId);
    }
  }

  private loadSubCategories(catId: number | null) {
    if (!catId) { this.subCategories.set([]); this.sizeOptions.set([]); return; }
    this.subApi.list(catId, false).subscribe(s => { this.subCategories.set(s); this.updateSizeOptions(); });
  }

  /** Size options come from the selected subcategory; keep the current value if it's not listed. */
  updateSizeOptions() {
    const subId = this.form.controls.subCategoryId.value;
    const sizes = this.subCategories().find(s => s.id === subId)?.sizes ?? [];
    const current = this.form.controls.size.value;
    this.sizeOptions.set(current && !sizes.includes(current) ? [current, ...sizes] : sizes);
  }

  /** On create, prefill prices from the category's defaults; always refresh subcategories. */
  onCategoryChange(catId: number) {
    // Category changed → the previously chosen subcategory no longer applies.
    this.form.controls.subCategoryId.setValue(null);
    this.loadSubCategories(catId);

    if (this.data) return;
    const cat = this.categories().find(c => c.id === catId);
    if (!cat) return;
    if (!this.form.controls.originalPrice.value && cat.defaultOriginalPrice != null)
      this.form.controls.originalPrice.setValue(cat.defaultOriginalPrice);
    if (!this.form.controls.salePrice.value && cat.defaultSalePrice != null)
      this.form.controls.salePrice.setValue(cat.defaultSalePrice);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { this.notify.error(null, 'Image exceeds the 5 MB limit'); return; }

    this.uploading.set(true);
    this.api.uploadImage(file).subscribe({
      next: (res) => {
        this.form.controls.imageUrl.setValue(res.url);
        this.previewUrl.set(resolveImageUrl(res.url));
        this.uploading.set(false);
        input.value = ''; // allow re-selecting the same file
      },
      error: (e) => { this.uploading.set(false); input.value = ''; this.notify.error(e); }
    });
  }

  removePhoto() {
    this.form.controls.imageUrl.setValue('');
    this.previewUrl.set(null);
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
