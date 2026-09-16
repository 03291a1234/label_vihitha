import { Component, Inject, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { MoneyInputComponent } from '../../shared/money-input.component';

@Component({
  selector: 'app-product-edit',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatSlideToggleModule,
    MoneyInputComponent
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
            <mat-hint>Collection (optional)</mat-hint>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Vendor</mat-label>
            <mat-select formControlName="vendorId">
              <mat-option [value]="null">— None —</mat-option>
              @for (v of vendors(); track v.id) { <mat-option [value]="v.id">{{ v.name }}</mat-option> }
            </mat-select>
            <mat-hint>Supplier (optional)</mat-hint>
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
          <mat-form-field><mat-label>Color</mat-label><input matInput formControlName="color" /></mat-form-field>
          <mat-form-field><mat-label>Material</mat-label><input matInput formControlName="material" /></mat-form-field>
        </div>
        <div class="form-row">
          <app-money-input formControlName="originalPrice" label="Cost price" />
          <app-money-input formControlName="salePrice" label="Sale price" />
        </div>
        <div class="variants">
          <div class="variants-head">
            <span class="v-label">Sizes &amp; stock</span>
            <span class="muted">Total: <strong>{{ totalQty() }}</strong> units</span>
          </div>
          @if (suggestions().length) {
            <div class="quick">
              <span class="muted">Quick add:</span>
              @for (z of suggestions(); track z) {
                <button type="button" class="chip-btn" (click)="addVariant(z)" [disabled]="hasSize(z)">{{ z }}</button>
              }
            </div>
          }
          <div formArrayName="variants">
            @for (row of variants.controls; track row; let i = $index) {
              <div class="vrow" [formGroupName]="i">
                <mat-form-field class="v-size"><mat-label>Size</mat-label>
                  <input matInput formControlName="size" placeholder="e.g. M or 2*6" /></mat-form-field>
                <mat-form-field class="v-qty"><mat-label>Qty</mat-label>
                  <input matInput type="number" formControlName="quantityOnHand" /></mat-form-field>
                <button mat-icon-button type="button" color="warn" (click)="removeVariant(i)"
                        [disabled]="variants.length === 1" title="Remove size"><mat-icon>close</mat-icon></button>
              </div>
            }
          </div>
          <button mat-stroked-button type="button" (click)="addVariant('')"><mat-icon>add</mat-icon> Add size</button>
        </div>
        <div class="form-row">
          <mat-form-field>
            <mat-label>Reorder threshold</mat-label>
            <input matInput type="number" formControlName="reorderThreshold" />
            <mat-hint>Low-stock alert when total ≤ this</mat-hint>
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
    .variants { border: 1px solid var(--lv-line); border-radius: 10px; padding: 12px 14px; margin: 6px 0 12px; }
    .variants-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
    .v-label { font-weight: 600; color: var(--lv-wine); }
    .quick { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 10px; font-size: 12px; }
    .chip-btn { border: 1px solid var(--lv-rose-soft, #ecd4de); background: var(--lv-rose-soft, #f7ebf0); color: var(--lv-wine);
      border-radius: 999px; padding: 3px 11px; font-weight: 600; cursor: pointer; font-size: 12px; }
    .chip-btn:disabled { opacity: .4; cursor: default; }
    .vrow { display: flex; align-items: center; gap: 8px; }
    .vrow .v-size { flex: 1; }
    .vrow .v-qty { width: 110px; }
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
  /** Suggested sizes for quick-add: the subcategory's own sizes, else standard S–XXXL. */
  suggestions = signal<string[]>([]);
  private readonly standardSizes = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  saving = signal(false);
  uploading = signal(false);
  previewUrl = signal<string | null>(null);

  /** Per-size stock rows (each: { size, quantityOnHand }). */
  variants = this.fb.array<FormGroup>([]);

  form = this.fb.nonNullable.group({
    categoryId: [null as number | null, Validators.required],
    subCategoryId: [null as number | null],
    inventoryId: [null as number | null],
    vendorId: [null as number | null],
    sku: ['', [Validators.required, Validators.maxLength(50)]],
    name: ['', [Validators.required, Validators.maxLength(200)]],
    color: [''], material: [''],
    originalPrice: [0, [Validators.min(0)]],
    salePrice: [0, [Validators.min(0)]],
    reorderThreshold: [0, [Validators.min(0)]],
    imageUrl: [''],
    isActive: [true],
    variants: this.variants
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
        color: data.color ?? '', material: data.material ?? '',
        originalPrice: data.originalPrice, salePrice: data.salePrice,
        reorderThreshold: data.reorderThreshold,
        imageUrl: data.imageUrl ?? '', isActive: data.isActive
      });
      for (const v of data.variants ?? []) this.variants.push(this.makeVariant(v.size, v.quantityOnHand));
      this.previewUrl.set(resolveImageUrl(data.imageUrl));
      this.loadSubCategories(data.categoryId);
    }
    if (this.variants.length === 0) this.variants.push(this.makeVariant('', 0));
    this.updateSizeOptions();
  }

  private makeVariant(size: string, qty: number): FormGroup {
    return this.fb.group({
      size: this.fb.nonNullable.control(size, Validators.required),
      quantityOnHand: this.fb.nonNullable.control(qty, [Validators.min(0)])
    });
  }

  addVariant(size: string) {
    if (size && this.hasSize(size)) return;
    this.variants.push(this.makeVariant(size, 0));
  }

  removeVariant(i: number) { this.variants.removeAt(i); }

  hasSize(z: string): boolean {
    const t = z.trim().toLowerCase();
    return this.variants.controls.some(c => String(c.value.size ?? '').trim().toLowerCase() === t);
  }

  totalQty(): number {
    return this.variants.controls.reduce((s, c) => s + (Number(c.value.quantityOnHand) || 0), 0);
  }

  private loadSubCategories(catId: number | null) {
    if (!catId) { this.subCategories.set([]); this.updateSizeOptions(); return; }
    this.subApi.list(catId, false).subscribe(s => { this.subCategories.set(s); this.updateSizeOptions(); });
  }

  /**
   * Size options: the chosen subcategory's own sizes if it defines any, otherwise the
   * standard S–XXXL list. The current value is kept selectable even when it isn't listed
   * (e.g. legacy or subcategory-specific values like "2.6").
   */
  updateSizeOptions() {
    const subId = this.form.controls.subCategoryId.value;
    const subSizes = this.subCategories().find(s => s.id === subId)?.sizes ?? [];
    this.suggestions.set(subSizes.length ? subSizes : this.standardSizes);
  }

  /** Category changed → the previously chosen subcategory no longer applies; refresh subcategories. */
  onCategoryChange(catId: number) {
    this.form.controls.subCategoryId.setValue(null);
    this.loadSubCategories(catId);
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
    const variants = this.variants.controls
      .map(c => ({ size: String(c.value.size ?? '').trim(), quantityOnHand: Number(c.value.quantityOnHand) || 0 }))
      .filter(x => x.size.length > 0);
    if (variants.length === 0) { this.notify.error(null, 'Add at least one size with stock.'); return; }

    this.saving.set(true);
    const { variants: _omit, ...scalars } = this.form.getRawValue() as Record<string, unknown>;
    const body = { ...scalars, quantityOnHand: this.totalQty(), variants };
    if (this.data) {
      this.api.update(this.data.id, { ...body, rowVersion: this.data.rowVersion }).subscribe({
        next: () => { this.notify.success('Product saved'); this.ref.close(true); },
        error: (e) => { this.saving.set(false); this.notify.error(e); }
      });
    } else {
      this.api.create(body).subscribe({
        next: () => { this.notify.success('Product created'); this.ref.close(true); },
        error: (e) => { this.saving.set(false); this.notify.error(e); }
      });
    }
  }
}
