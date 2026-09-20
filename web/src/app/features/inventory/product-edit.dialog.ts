import { Component, Inject, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { CategoryApi, ProductApi, SubCategoryApi, InventoryApi, VendorApi, OwnerApi, resolveImageUrl } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { Category, SubCategory, Inventory, Vendor, Owner, Product } from '../../core/models';
import { MoneyInputComponent } from '../../shared/money-input.component';
import { SearchSelectComponent } from '../../shared/search-select.component';
import { InrAmountPipe } from '../../shared/inr-amount.pipe';
import { SettingsService } from '../../core/services/settings.service';

@Component({
  selector: 'app-product-edit',
  standalone: true,
  imports: [
    InrAmountPipe,
    DecimalPipe, ReactiveFormsModule, FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatSlideToggleModule,
    MatButtonToggleModule, MoneyInputComponent, SearchSelectComponent
  ],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Edit product' : 'New product' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <div class="form-row">
          <app-search-select label="Category" [items]="categories()" formControlName="categoryId"
            (selectionChange)="onCategoryChange($event)" />
          <app-search-select label="Subcategory" [items]="subCategories()" formControlName="subCategoryId"
            nullOption [disabled]="!form.controls.categoryId.value" (selectionChange)="updateSizeOptions(); refreshAutoSku()"
            hint="Optional" />
        </div>
        <div class="form-row">
          <app-search-select label="Inventory" [items]="inventories()" formControlName="inventoryId"
            nullOption hint="Collection (optional)" />
          <app-search-select label="Vendor" [items]="vendors()" formControlName="vendorId"
            nullOption hint="Supplier (optional)" (selectionChange)="refreshAutoSku()" />
        </div>
        <div class="form-row">
          <app-search-select label="Paid by" [items]="owners()" formControlName="paidByOwnerId"
            nullOption hint="Owner who funded this stock (optional)" />
          <div class="contrib">
            @if (!data && form.controls.paidByOwnerId.value) {
              <mat-slide-toggle formControlName="recordOwnerContribution">Record as their capital contribution</mat-slide-toggle>
              <div class="muted contrib-hint">Turn on only if they paid out-of-pocket — not from the shared account.</div>
            }
          </div>
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
        <div class="cost-breakdown">
          <div class="cb-head">
            <span class="cb-label">Cost breakdown by vendor <span class="muted">(optional)</span></span>
            @if (costComponents.length) { <span class="muted">Unit cost: <strong>{{ costTotal() | number:'1.2-2' }} USD</strong></span> }
          </div>
          <div class="quick">
            <span class="muted">Quick add:</span>
            @for (p of costPresets; track p) {
              <button type="button" class="chip-btn" (click)="addComponent(p)">{{ p }}</button>
            }
          </div>
          <div formArrayName="costComponents">
            @for (row of costComponents.controls; track row; let i = $index) {
              <div class="cbrow" [formGroupName]="i">
                <mat-form-field class="cb-item"><mat-label>Item</mat-label>
                  <input matInput formControlName="label" placeholder="e.g. Cloth, Stitching" /></mat-form-field>
                <app-search-select class="cb-vendor" label="Vendor" [items]="vendors()" formControlName="vendorId" nullOption />
                <app-money-input class="cb-amt" formControlName="amount" label="Cost / unit" />
                <button mat-icon-button type="button" color="warn" (click)="removeComponent(i)" title="Remove line"><mat-icon>close</mat-icon></button>
              </div>
            }
          </div>
          <button mat-stroked-button type="button" (click)="addComponent('')"><mat-icon>add</mat-icon> Add cost line</button>
          @if (costComponents.length) {
            <div class="muted cb-hint">Per-unit costs by vendor — they set the product's fallback cost and split “Spend by vendor” (e.g. Cloth → one vendor, Stitching → another). Per-size cost below overrides for valuation.</div>
          }
        </div>
        <div class="variants">
          <div class="variants-head">
            <span class="v-label">Sizes, stock &amp; pricing</span>
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
          <div class="perSize">
            <span class="muted">Enter cost &amp; sale price for each size, in</span>
            <mat-button-toggle-group [value]="priceCurrency()" (change)="setPriceCurrency($event.value)" aria-label="Price currency">
              <mat-button-toggle value="USD">USD</mat-button-toggle>
              <mat-button-toggle value="INR">INR</mat-button-toggle>
            </mat-button-toggle-group>
          </div>
          <div formArrayName="variants">
            @for (row of variants.controls; track row; let i = $index) {
              <div class="vrow" [formGroupName]="i">
                <mat-form-field class="v-size"><mat-label>Size</mat-label>
                  <input matInput formControlName="size" placeholder="e.g. M or 2*6" /></mat-form-field>
                <mat-form-field class="v-qty"><mat-label>Qty</mat-label>
                  <input matInput type="number" formControlName="quantityOnHand" /></mat-form-field>
                <mat-form-field class="v-price"><mat-label>Cost {{ sym() }}</mat-label>
                  <input matInput type="number" min="0" step="0.01" formControlName="costPrice" /></mat-form-field>
                <mat-form-field class="v-price"><mat-label>Sale {{ sym() }}</mat-label>
                  <input matInput type="number" min="0" step="0.01" formControlName="salePrice" /></mat-form-field>
                <button mat-icon-button type="button" color="warn" (click)="removeVariant(i)"
                        [disabled]="variants.length === 1" title="Remove size"><mat-icon>close</mat-icon></button>
              </div>
            }
          </div>
          <button mat-stroked-button type="button" (click)="addVariant('')"><mat-icon>add</mat-icon> Add size</button>
          <div class="ps-totals">
            <span>Stock value — cost <strong>\${{ variantCostUsd() | number:'1.0-2' }}</strong>
              <span class="inr">≈ ₹{{ variantCostUsd() | inrAmount | number:'1.0-0' }}</span></span>
            <span>sale <strong>\${{ variantSaleUsd() | number:'1.0-2' }}</strong>
              <span class="inr">≈ ₹{{ variantSaleUsd() | inrAmount | number:'1.0-0' }}</span></span>
          </div>
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
    .vrow .v-qty { width: 90px; }
    .vrow .v-price { width: 100px; }
    .perSize { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin: 4px 0 12px; }
    .ps-hint { font-size: 11px; }
    .ps-totals { display: flex; gap: 20px; flex-wrap: wrap; margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--lv-line); font-size: 13px; }
    .ps-totals .inr { color: rgba(58,37,48,.55); margin-left: 4px; font-size: 12px; }
    .contrib { display: flex; flex-direction: column; justify-content: center; gap: 4px; }
    .contrib-hint { font-size: 11px; line-height: 1.3; }
    .cost-breakdown { border: 1px solid var(--lv-line); border-radius: 10px; padding: 12px 14px; margin: 0 0 12px; }
    .cb-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
    .cb-label { font-weight: 600; color: var(--lv-wine); }
    .cbrow { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .cbrow .cb-item { flex: 1 1 140px; }
    .cbrow .cb-vendor { flex: 1 1 140px; }
    .cbrow .cb-amt { flex: 0 0 auto; }
    .cb-hint { font-size: 11px; line-height: 1.3; margin-top: 6px; }
  `]
})
export class ProductEditDialog {
  private fb = inject(FormBuilder);
  private api = inject(ProductApi);
  private catApi = inject(CategoryApi);
  private subApi = inject(SubCategoryApi);
  private invApi = inject(InventoryApi);
  private vendorApi = inject(VendorApi);
  private ownerApi = inject(OwnerApi);
  private notify = inject(Notify);
  ref = inject(MatDialogRef<ProductEditDialog>);

  categories = signal<Category[]>([]);
  subCategories = signal<SubCategory[]>([]);
  inventories = signal<Inventory[]>([]);
  vendors = signal<Vendor[]>([]);
  owners = signal<Owner[]>([]);
  /** Suggested sizes for quick-add: the subcategory's own sizes, else standard S–XXXL. */
  suggestions = signal<string[]>([]);
  private readonly standardSizes = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  saving = signal(false);
  uploading = signal(false);
  previewUrl = signal<string | null>(null);
  /** Currency the per-size cost/sale inputs are entered in (stored canonically as USD). */
  priceCurrency = signal<'USD' | 'INR'>('USD');
  private settings = inject(SettingsService);
  private get inrRate() { return this.settings.inrPerUsd(); }
  sym() { return this.priceCurrency() === 'USD' ? '$' : '₹'; }
  /** True once the user types their own SKU, so auto-fill stops overwriting it. */
  skuManual = false;

  /** Per-size stock rows (each: { size, quantityOnHand }). */
  variants = this.fb.array<FormGroup>([]);
  /** Per-unit cost lines by vendor (each: { label, vendorId, amount }). */
  costComponents = this.fb.array<FormGroup>([]);
  readonly costPresets = ['Cloth', 'Stitching', 'Embroidery', 'Dyeing'];

  form = this.fb.nonNullable.group({
    categoryId: [null as number | null, Validators.required],
    subCategoryId: [null as number | null],
    inventoryId: [null as number | null],
    vendorId: [null as number | null],
    paidByOwnerId: [null as number | null],
    recordOwnerContribution: [false],
    sku: ['', [Validators.required, Validators.maxLength(50)]],
    name: ['', [Validators.required, Validators.maxLength(200)]],
    color: [''], material: [''],
    originalPrice: [0, [Validators.min(0)]],
    salePrice: [0, [Validators.min(0)]],
    reorderThreshold: [0, [Validators.min(0)]],
    imageUrl: [''],
    isActive: [true],
    variants: this.variants,
    costComponents: this.costComponents
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: Product | null) {
    this.catApi.list(false).subscribe(cs => this.categories.set(cs));
    this.invApi.list(false).subscribe(inv => this.inventories.set(inv));
    this.vendorApi.list(false).subscribe(vs => this.vendors.set(vs));
    this.ownerApi.list(false).subscribe(os => this.owners.set(os));
    if (data) {
      this.form.patchValue({
        categoryId: data.categoryId, subCategoryId: data.subCategoryId ?? null,
        inventoryId: data.inventoryId ?? null,
        vendorId: data.vendorId ?? null,
        paidByOwnerId: data.paidByOwnerId ?? null,
        sku: data.sku, name: data.name,
        color: data.color ?? '', material: data.material ?? '',
        originalPrice: data.originalPrice, salePrice: data.salePrice,
        reorderThreshold: data.reorderThreshold,
        imageUrl: data.imageUrl ?? '', isActive: data.isActive
      });
      // Pricing lives per-size: pre-fill each size from its own price, falling back to the
      // product-level price so existing products keep their price when re-saved.
      for (const v of data.variants ?? []) this.variants.push(
        this.makeVariant(v.size, v.quantityOnHand, v.costPrice ?? data.originalPrice, v.salePrice ?? data.salePrice));
      for (const c of data.costComponents ?? []) this.costComponents.push(this.makeComponent(c.label, c.vendorId ?? null, c.amount));
      this.previewUrl.set(resolveImageUrl(data.imageUrl));
      this.loadSubCategories(data.categoryId);
    }
    if (this.variants.length === 0) this.variants.push(this.makeVariant('', 0));
    this.updateSizeOptions();
    // Cost lines, when present, are the source of truth for the unit cost.
    this.costComponents.valueChanges.subscribe(() => this.syncCostFromComponents());
    this.syncCostFromComponents();
    // Any user edit to the SKU stops auto-fill from overwriting it (auto-fill uses emitEvent:false).
    this.form.controls.sku.valueChanges.subscribe(() => { this.skuManual = true; });
  }

  private makeComponent(label: string, vendorId: number | null, amount: number): FormGroup {
    return this.fb.group({
      label: this.fb.nonNullable.control(label),
      vendorId: this.fb.control(vendorId as number | null),
      amount: this.fb.nonNullable.control(amount, [Validators.min(0)])
    });
  }

  addComponent(label: string) { this.costComponents.push(this.makeComponent(label, this.form.controls.vendorId.value ?? null, 0)); }
  removeComponent(i: number) { this.costComponents.removeAt(i); }

  costTotal(): number {
    return this.costComponents.controls.reduce((s, c) => s + (Number(c.value.amount) || 0), 0);
  }

  /** When cost lines exist, the Cost price becomes their (read-only) sum; otherwise it's editable. */
  private syncCostFromComponents() {
    const cost = this.form.controls.originalPrice;
    if (this.costComponents.length > 0) {
      cost.setValue(Number(this.costTotal().toFixed(2)), { emitEvent: false });
      if (cost.enabled) cost.disable({ emitEvent: false });
    } else if (cost.disabled) {
      cost.enable({ emitEvent: false });
    }
  }

  private makeVariant(size: string, qty: number, cost: number | null = null, sale: number | null = null): FormGroup {
    return this.fb.group({
      size: this.fb.nonNullable.control(size, Validators.required),
      quantityOnHand: this.fb.nonNullable.control(qty, [Validators.min(0)]),
      costPrice: this.fb.control<number | null>(cost, [Validators.min(0)]),
      salePrice: this.fb.control<number | null>(sale, [Validators.min(0)])
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

  /** Convert an entered (displayed-currency) amount to canonical USD. */
  private toUsd(v: unknown): number {
    const n = Number(v) || 0;
    return this.priceCurrency() === 'INR' ? n / this.inrRate : n;
  }

  /** Switch the price entry currency, converting every size's cost & sale so the numbers keep
   * their real value (e.g. $10 ↔ ₹950). */
  setPriceCurrency(c: 'USD' | 'INR') {
    if (c === this.priceCurrency()) return;
    const factor = c === 'INR' ? this.inrRate : 1 / this.inrRate;
    for (const row of this.variants.controls) {
      for (const field of ['costPrice', 'salePrice']) {
        const ctrl = row.get(field);
        const val = ctrl?.value;
        if (val != null && val !== '') ctrl!.setValue(Number((Number(val) * factor).toFixed(2)), { emitEvent: false });
      }
    }
    this.priceCurrency.set(c);
  }

  /** Stock value from the size rows, in USD (with an INR approximation shown alongside). */
  variantCostUsd(): number {
    return this.variants.controls.reduce((s, c) =>
      s + this.toUsd(c.value.costPrice) * (Number(c.value.quantityOnHand) || 0), 0);
  }
  variantSaleUsd(): number {
    return this.variants.controls.reduce((s, c) =>
      s + this.toUsd(c.value.salePrice) * (Number(c.value.quantityOnHand) || 0), 0);
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
    this.refreshAutoSku();
  }

  /** For NEW products, auto-fill the SKU with the next in the vendor/category series — unless the
   * user has already typed their own SKU. */
  refreshAutoSku() {
    if (this.data || this.skuManual) return;
    const f = this.form.controls;
    if (!f.categoryId.value) return;
    this.api.nextSku(f.categoryId.value, f.subCategoryId.value ?? null, f.vendorId.value ?? null).subscribe({
      next: (r) => { if (!this.skuManual) f.sku.setValue(r.sku, { emitEvent: false }); },
      error: () => {}
    });
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
    // Prices are entered per size (in the chosen currency); store canonically as USD.
    const variants = this.variants.controls
      .map(c => ({
        size: String(c.value.size ?? '').trim(),
        quantityOnHand: Number(c.value.quantityOnHand) || 0,
        costPrice: c.value.costPrice != null && c.value.costPrice !== '' ? Number(this.toUsd(c.value.costPrice).toFixed(2)) : null,
        salePrice: c.value.salePrice != null && c.value.salePrice !== '' ? Number(this.toUsd(c.value.salePrice).toFixed(2)) : null
      }))
      .filter(x => x.size.length > 0);
    if (variants.length === 0) { this.notify.error(null, 'Add at least one size with stock.'); return; }
    if (!variants.some(v => (v.salePrice ?? 0) > 0)) { this.notify.error(null, 'Enter a sale price for at least one size.'); return; }

    const costComponents = this.costComponents.controls
      .map(c => ({ label: String(c.value.label ?? '').trim(), vendorId: c.value.vendorId ?? null, amount: Number(c.value.amount) || 0 }))
      .filter(x => x.label.length > 0);

    // Product-level price is a fallback for display/order defaults — derive it from the first
    // priced size. Cost stays driven by cost-lines when present (kept in sync separately).
    const repCost = variants.find(v => v.costPrice != null)?.costPrice ?? 0;
    const repSale = variants.find(v => v.salePrice != null)?.salePrice ?? 0;
    this.form.controls.salePrice.setValue(repSale, { emitEvent: false });
    if (costComponents.length === 0) this.form.controls.originalPrice.setValue(repCost, { emitEvent: false });

    this.saving.set(true);
    const { variants: _omit, costComponents: _omit2, ...scalars } = this.form.getRawValue() as Record<string, unknown>;
    const body = { ...scalars, quantityOnHand: this.totalQty(), variants, costComponents };
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