import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProductApi, resolveImageUrl } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { AuthService } from '../../core/auth/auth.service';
import { FilterOption, InventorySummary, SubCategoryCount, Product, ProductTotals } from '../../core/models';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ProductEditDialog } from './product-edit.dialog';
import { ImportResultDialog } from './import-result.dialog';
import { BulkPaidByDialog } from './bulk-paid-by.dialog';
import { ConfirmDialog } from '../../shared/confirm.dialog';
import { SearchSelectComponent } from '../../shared/search-select.component';
import { SettingsService } from '../../core/services/settings.service';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [
    CurrencyPipe, FormsModule, RouterLink, MatTableModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule,
    MatPaginatorModule, MatProgressBarModule, MatProgressSpinnerModule, MatSortModule,
    SearchSelectComponent
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Products</h1>
        @if (auth.canManageInventory()) {
          <div class="toolbar-row">
            <input #xlsx type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                   hidden (change)="onImportSelected($event)" />
            <button mat-stroked-button (click)="downloadTemplate()" [disabled]="importing()">
              <mat-icon>download</mat-icon> Template
            </button>
            <button mat-stroked-button (click)="xlsx.click()" [disabled]="importing()">
              @if (importing()) { <mat-spinner diameter="18"></mat-spinner> } @else { <mat-icon>upload_file</mat-icon> }
              Import Excel
            </button>
            <button mat-stroked-button (click)="openBulkPaidBy()" [disabled]="loading()"
                    title="Set who funded the products matching the current filters">
              <mat-icon>account_balance_wallet</mat-icon> Set paid by
            </button>
            <button mat-raised-button color="primary" (click)="openEdit(null)">
              <mat-icon>add</mat-icon> New product
            </button>
          </div>
        }
      </div>

      <!-- Inventory summary by category → subcategory -->
      @if (summary(); as s) {
        <div class="card summary">
          <div class="summary-head" (click)="showSummary.set(!showSummary())">
            <span class="sh-title"><mat-icon>insights</mat-icon> Inventory summary
              @if (anyFilterActive()) { <span class="filtered-tag">(filtered)</span> }
              <span class="sh-stats">— <span class="stat"><strong>{{ s.totalProducts }}</strong> products</span>
                · <span class="stat"><strong>{{ s.totalUnits }}</strong> units in stock</span></span></span>
            <mat-icon class="sh-chevron">{{ showSummary() ? 'expand_less' : 'expand_more' }}</mat-icon>
          </div>
          @if (showSummary()) {
            <div class="summary-body">
              @for (c of s.categories; track c.categoryId) {
                <div class="cat-block">
                  <a class="cat-head" [routerLink]="['/products']" [queryParams]="summaryParams(c.categoryId)" title="Filter to these products">
                    <strong>{{ c.categoryName }}</strong>
                    <span class="muted">{{ c.productCount }} products · {{ c.totalUnits }} units</span>
                  </a>
                  <div class="subs">
                    @for (sub of namedSubs(c.subCategories); track sub.subCategoryName) {
                      <a class="sub-chip" [routerLink]="['/products']"
                         [queryParams]="summaryParams(c.categoryId, sub.subCategoryId)"
                         title="Filter to these products">
                        {{ sub.subCategoryName }} · {{ sub.productCount }}<span class="u"> ({{ sub.totalUnits }} u)</span>
                      </a>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }

      <div class="toolbar-row">
        <mat-form-field>
          <mat-label>Search</mat-label>
          <input matInput [(ngModel)]="search" (keyup.enter)="reload()" placeholder="Name or SKU" />
          <button matSuffix mat-icon-button (click)="reload()" aria-label="Search"><mat-icon>search</mat-icon></button>
        </mat-form-field>
        <app-search-select label="Category" [items]="categories()" [(ngModel)]="categoryId"
          nullOption nullLabel="All" (selectionChange)="onCategoryFilter()" />
        <app-search-select label="Subcategory" [items]="subCategories()" [(ngModel)]="subCategoryId"
          nullOption nullLabel="All" [disabled]="!categoryId" (selectionChange)="reload()" />
        <app-search-select label="Inventory" [items]="inventories()" [(ngModel)]="inventoryId"
          nullOption nullLabel="All" (selectionChange)="reload()" />
        <app-search-select label="Vendor" [items]="vendors()" [(ngModel)]="vendorId"
          nullOption nullLabel="All" (selectionChange)="reload()" />
        <mat-slide-toggle [(ngModel)]="lowStockOnly" (change)="reload()">Low stock only</mat-slide-toggle>
      </div>

      @if (totals(); as t) {
        <div class="filtered-totals">
          <mat-icon>filter_alt</mat-icon>
          <span class="ft-lead">Filtered totals</span>
          <span class="ft-item"><strong>{{ t.productCount }}</strong> products</span>
          <span class="ft-item"><strong>{{ t.totalUnits }}</strong> units</span>
          <span class="ft-item">Cost <strong>{{ t.totalCostUsd * inrRate | currency:'INR':'symbol':'1.0-0' }}</strong>
            <span class="muted">({{ t.totalCostUsd | currency }})</span></span>
          <span class="ft-item">Sale <strong>{{ t.totalSaleUsd | currency }}</strong></span>
          <span class="ft-item muted">Margin {{ t.totalSaleUsd - t.totalCostUsd | currency }}</span>
        </div>
      }

      @if (loading()) { <mat-progress-bar mode="indeterminate" /> }

      <div class="card">
        <table mat-table [dataSource]="rows()" class="full" matSort (matSortChange)="onSort($event)">
          <ng-container matColumnDef="sku">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>SKU</th>
            <td mat-cell *matCellDef="let p" class="mono">{{ p.sku }}</td>
          </ng-container>
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Product</th>
            <td mat-cell *matCellDef="let p">
              <div class="product-cell">
                <div class="thumb">
                  @if (img(p.imageUrl); as src) { <img [src]="src" alt="" /> }
                  @else { <mat-icon>image</mat-icon> }
                </div>
                <div>
                  <strong>{{ p.name }}</strong>
                  @if (!p.isActive) { <span class="chip Cancelled">inactive</span> }
                  <div class="muted">{{ p.categoryName }}@if (p.subCategoryName) { · {{ p.subCategoryName }} }@if (p.color) { · {{ p.color }} }</div>
                  <div class="muted meta">
                    @if (p.inventoryName) { <span><mat-icon class="inv-icon">inventory</mat-icon> {{ p.inventoryName }}</span> }
                    @if (p.vendorName) { <span><mat-icon class="inv-icon">storefront</mat-icon> {{ p.vendorName }}</span> }
                    @if (p.paidByOwnerName) { <span class="paid"><mat-icon class="inv-icon">account_balance_wallet</mat-icon> {{ p.paidByOwnerName }}</span> }
                  </div>
                </div>
              </div>
            </td>
          </ng-container>
          <ng-container matColumnDef="size">
            <th mat-header-cell *matHeaderCellDef>Sizes in stock</th>
            <td mat-cell *matCellDef="let p">
              @if (p.variants?.length) {
                <div class="sizes">
                  @for (v of p.variants; track v.id) {
                    <span class="size-chip" [class.out]="v.quantityOnHand === 0">{{ v.size }}·{{ v.quantityOnHand }}</span>
                  }
                </div>
              } @else { — }
            </td>
          </ng-container>
          <ng-container matColumnDef="costInr">
            <th mat-header-cell *matHeaderCellDef class="text-right">Cost (INR)</th>
            <td mat-cell *matCellDef="let p" class="text-right mono">{{ p.originalPrice * inrRate | currency:'INR':'symbol':'1.0-0' }}</td>
          </ng-container>
          <ng-container matColumnDef="originalPrice">
            <th mat-header-cell *matHeaderCellDef mat-sort-header class="text-right">Cost (USD)</th>
            <td mat-cell *matCellDef="let p" class="text-right mono">{{ p.originalPrice | currency }}</td>
          </ng-container>
          <ng-container matColumnDef="salePrice">
            <th mat-header-cell *matHeaderCellDef mat-sort-header class="text-right">Sale (USD)</th>
            <td mat-cell *matCellDef="let p" class="text-right mono">{{ p.salePrice | currency }}</td>
          </ng-container>
          <ng-container matColumnDef="quantityOnHand">
            <th mat-header-cell *matHeaderCellDef mat-sort-header class="text-right">Stock</th>
            <td mat-cell *matCellDef="let p" class="text-right mono" [class.low-stock]="p.isLowStock" [class.sold-out]="p.quantityOnHand === 0">
              {{ p.quantityOnHand }}
              @if (p.quantityOnHand === 0) { <mat-icon class="warn-icon" title="Sold out">block</mat-icon> }
              @else if (p.isLowStock) { <mat-icon class="warn-icon" title="At/under reorder threshold">warning</mat-icon> }
            </td>
          </ng-container>
          <ng-container matColumnDef="sold">
            <th mat-header-cell *matHeaderCellDef mat-sort-header class="text-right">Sold</th>
            <td mat-cell *matCellDef="let p" class="text-right mono">
              @if (p.unitsSold > 0) { <span class="sold-badge">{{ p.unitsSold }}</span> } @else { <span class="muted">—</span> }
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let p" class="text-right">
              @if (auth.canManageInventory()) {
                <button mat-icon-button (click)="openEdit(p)"><mat-icon>edit</mat-icon></button>
                <button mat-icon-button color="warn" (click)="remove(p)"><mat-icon>delete</mat-icon></button>
              }
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="cols"></tr>
          <tr mat-row *matRowDef="let row; columns: cols"></tr>
        </table>
        @if (!loading() && rows().length === 0) { <div class="empty-state">No products match.</div> }
        <mat-paginator [length]="total()" [pageSize]="pageSize" [pageIndex]="page - 1"
          [pageSizeOptions]="[10,25,50]" (page)="onPage($event)" />
      </div>
    </div>
  `,
  styles: [`
    .warn-icon { font-size: 16px; height: 16px; width: 16px; vertical-align: middle; }
    .sold-out { color: #b3261e; font-weight: 700; }
    .sold-badge { display: inline-block; background: var(--lv-rose-soft, #f7ebf0); color: var(--lv-wine);
      border-radius: 999px; padding: 1px 9px; font-weight: 700; font-size: 12px; }
    .product-cell { display: flex; align-items: center; gap: 12px; padding: 6px 0; }
    .product-cell .thumb {
      width: 44px; height: 44px; border-radius: 8px; background: #f0f0f3;
      display: grid; place-items: center; overflow: hidden; flex: 0 0 auto;
    }
    .product-cell .thumb img { width: 100%; height: 100%; object-fit: cover; }
    .product-cell .thumb mat-icon { color: #b8b8c0; font-size: 22px; height: 22px; width: 22px; }
    .inv-icon { font-size: 14px; height: 14px; width: 14px; vertical-align: -2px; }
    .meta .paid { color: var(--lv-wine); font-weight: 600; }
    .filtered-totals { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 18px;
      background: var(--lv-rose-soft, #f7ebf0); border: 1px solid var(--lv-line); border-radius: 10px;
      padding: 10px 16px; margin-bottom: 12px; color: var(--lv-wine); font-size: 14px; }
    .filtered-totals mat-icon { font-size: 18px; height: 18px; width: 18px; }
    .filtered-totals .ft-lead { font-weight: 700; margin-right: 4px; }
    .filtered-totals strong { font-weight: 700; }
    .filtered-totals .muted { color: rgba(58,37,48,.6); font-weight: 400; }
    .product-cell .meta { display: flex; flex-wrap: wrap; gap: 4px 12px; }
    .sizes { display: flex; flex-wrap: wrap; gap: 4px; max-width: 220px; }
    .size-chip { background: var(--lv-rose-soft, #f7ebf0); color: var(--lv-wine); border-radius: 999px;
      padding: 2px 8px; font-size: 12px; font-weight: 600; }
    .size-chip.out { background: #f0f0f0; color: #999; text-decoration: line-through; }
    .summary { margin-bottom: 16px; padding: 0; overflow: hidden; }
    .summary-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 18px; cursor: pointer; }
    .summary-head .sh-title { color: var(--lv-wine); line-height: 1.5; }
    .summary-head .sh-title mat-icon { vertical-align: middle; margin-right: 4px; }
    .sh-stats { white-space: normal; }
    .sh-stats .stat { white-space: nowrap; }
    .sh-chevron { flex: 0 0 auto; }
    .filtered-tag { color: var(--lv-wine); opacity: .7; font-size: 13px; font-weight: 600; font-style: italic; }
    .summary-body { padding: 4px 18px 16px; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }
    .cat-block { border: 1px solid var(--lv-line); border-radius: 10px; padding: 12px; background: #fffdfb; }
    .cat-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 8px;
      text-decoration: none; color: inherit; border-radius: 6px; padding: 2px 4px; margin: -2px -4px 6px; transition: background .12s; }
    .cat-head:hover { background: var(--lv-rose-soft); }
    .cat-head strong { color: var(--lv-wine); }
    .subs { display: flex; flex-wrap: wrap; gap: 6px; }
    .sub-chip { background: var(--lv-rose-soft); color: var(--lv-wine); border-radius: 999px; padding: 3px 10px; font-size: 12px; font-weight: 600;
      text-decoration: none; cursor: pointer; transition: background .12s, box-shadow .12s; }
    .sub-chip:hover { background: #ecd4de; box-shadow: 0 1px 4px rgba(110,31,62,.15); }
    .sub-chip .u { font-weight: 400; opacity: .75; }
  `]
})
export class ProductListComponent {
  private api = inject(ProductApi);
  private route = inject(ActivatedRoute);
  private dialog = inject(MatDialog);
  private notify = inject(Notify);
  auth = inject(AuthService);

  /** USD → INR conversion rate for the displayed Indian cost. */
  private settings = inject(SettingsService);
  get inrRate() { return this.settings.inrPerUsd(); }

  rows = signal<Product[]>([]);
  // Faceted filter options — each reflects the products matching the OTHER active filters.
  categories = signal<FilterOption[]>([]);
  subCategories = signal<FilterOption[]>([]);
  inventories = signal<FilterOption[]>([]);
  vendors = signal<FilterOption[]>([]);
  summary = signal<InventorySummary | null>(null);
  totals = signal<ProductTotals | null>(null);
  showSummary = signal(true);
  total = signal(0);
  loading = signal(false);
  importing = signal(false);

  search = '';
  categoryId: number | null = null;
  subCategoryId: number | null = null;
  inventoryId: number | null = null;
  vendorId: number | null = null;
  lowStockOnly = false;
  sortBy: string | null = null;
  sortDir: string | null = null;
  page = 1;
  pageSize = 25;
  cols = ['sku', 'name', 'size', 'costInr', 'originalPrice', 'salePrice', 'quantityOnHand', 'sold', 'actions'];

  constructor() {
    // Preselect filters when drilled in from another screen (e.g. Inventories, Vendors).
    this.route.queryParamMap.subscribe(q => {
      const num = (k: string) => (q.get(k) ? Number(q.get(k)) : null);
      this.inventoryId = num('inventoryId');
      this.vendorId = num('vendorId');
      this.categoryId = num('categoryId');
      this.subCategoryId = num('subCategoryId');
      this.page = 1;
      this.load();
    });
  }

  /** The active list/summary filters (no paging or sort). */
  private currentFilters() {
    return {
      search: this.search || undefined,
      categoryId: this.categoryId,
      subCategoryId: this.subCategoryId,
      inventoryId: this.inventoryId,
      vendorId: this.vendorId,
      lowStockOnly: this.lowStockOnly
    };
  }

  loadSummary() {
    this.api.inventorySummary(this.currentFilters()).subscribe({ next: (s) => this.summary.set(s) });
  }

  /** Only real subcategories — the "Unassigned" (null) bucket is not shown as a chip. */
  namedSubs(subs: SubCategoryCount[]): SubCategoryCount[] {
    return subs.filter(s => s.subCategoryId != null);
  }

  /** Category/subcategory chip target that keeps the current vendor/inventory scope. */
  summaryParams(categoryId: number, subCategoryId?: number | null) {
    const p: Record<string, number> = { categoryId };
    if (subCategoryId != null) p['subCategoryId'] = subCategoryId;
    if (this.vendorId) p['vendorId'] = this.vendorId;
    if (this.inventoryId) p['inventoryId'] = this.inventoryId;
    return p;
  }

  onCategoryFilter() {
    // Category changed → the previously chosen subcategory may not belong; clear it and reload.
    this.subCategoryId = null;
    this.reload();
  }

  /** Load the faceted options for every filter dropdown, given the current selections. */
  loadFilterOptions() {
    this.api.filterOptions(this.currentFilters()).subscribe({
      next: (o) => {
        this.categories.set(o.categories);
        this.subCategories.set(o.subCategories);
        this.inventories.set(o.inventories);
        this.vendors.set(o.vendors);
      }
    });
  }

  /** True when the list is narrowed by any filter (so the filtered-totals bar is worth showing). */
  anyFilterActive(): boolean {
    return !!(this.search || this.categoryId || this.subCategoryId || this.inventoryId || this.vendorId || this.lowStockOnly);
  }

  load() {
    this.loading.set(true);
    const filters = this.currentFilters();
    this.api.list({ ...filters, sortBy: this.sortBy, sortDir: this.sortDir, page: this.page, pageSize: this.pageSize })
      .subscribe({
        next: (r) => { this.rows.set(r.items); this.total.set(r.totalCount); this.loading.set(false); },
        error: (e) => { this.loading.set(false); this.notify.error(e); }
      });
    // Keep the inventory summary describing the same (filtered) set as the list.
    this.loadSummary();
    // Refresh the faceted filter options so each dropdown reflects the other active filters.
    this.loadFilterOptions();
    // Overall totals for the filtered set (across all pages) — only when a filter is applied.
    if (this.anyFilterActive()) {
      this.api.totals(filters).subscribe({ next: (t) => this.totals.set(t), error: () => this.totals.set(null) });
    } else {
      this.totals.set(null);
    }
  }

  img(url: string | null | undefined) { return resolveImageUrl(url); }

  reload() { this.page = 1; this.load(); }
  onPage(e: PageEvent) { this.page = e.pageIndex + 1; this.pageSize = e.pageSize; this.load(); }
  onSort(s: Sort) {
    this.sortBy = s.direction ? s.active : null;
    this.sortDir = s.direction || null;
    this.reload();
  }

  openEdit(p: Product | null) {
    this.dialog.open(ProductEditDialog, { data: p, width: '640px' }).afterClosed()
      .subscribe(ok => { if (ok) { this.load(); this.loadSummary(); } });
  }

  /** Bulk-set the "paid by" funder on every product matching the current filters. */
  openBulkPaidBy() {
    const filter = {
      categoryId: this.categoryId,
      subCategoryId: this.subCategoryId,
      inventoryId: this.inventoryId,
      vendorId: this.vendorId,
      lowStockOnly: this.lowStockOnly,
      search: this.search || null
    };
    const parts: string[] = [];
    if (this.inventoryId) parts.push(this.inventories().find(i => i.id === this.inventoryId)?.name ?? 'inventory');
    if (this.vendorId) parts.push(this.vendors().find(v => v.id === this.vendorId)?.name ?? 'vendor');
    if (this.categoryId) parts.push(this.categories().find(c => c.id === this.categoryId)?.name ?? 'category');
    if (this.subCategoryId) parts.push(this.subCategories().find(s => s.id === this.subCategoryId)?.name ?? 'subcategory');
    if (this.lowStockOnly) parts.push('low stock');
    if (this.search) parts.push(`“${this.search}”`);

    this.dialog.open(BulkPaidByDialog, {
      width: '460px',
      data: { filter, count: this.total(), scope: parts.join(' · ') }
    }).afterClosed().subscribe((body) => {
      if (!body) return;
      this.loading.set(true);
      this.api.bulkSetPaidBy(body).subscribe({
        next: (res) => {
          const who = body.paidByOwnerId ? 'set' : 'cleared';
          const contrib = res.contributionPosted ? ` · contribution of $${res.totalCost.toFixed(2)} posted` : '';
          this.notify.success(`Paid by ${who} on ${res.productsUpdated} product(s)${contrib}`);
          this.load();
        },
        error: (e) => { this.loading.set(false); this.notify.error(e); }
      });
    });
  }

  onImportSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.importing.set(true);
    this.api.importExcel(file).subscribe({
      next: (res) => {
        this.importing.set(false); input.value = '';
        this.dialog.open(ImportResultDialog, { data: res, width: '520px' })
          .afterClosed().subscribe(() => { this.load(); this.loadSummary(); });
      },
      error: (e) => { this.importing.set(false); input.value = ''; this.notify.error(e); }
    });
  }

  downloadTemplate() {
    this.api.downloadTemplate().subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'LabelVihitha-Product-Upload-Template.xlsx';
        a.click(); URL.revokeObjectURL(url);
      },
      error: (e) => this.notify.error(e)
    });
  }

  remove(p: Product) {
    this.dialog.open(ConfirmDialog, {
      data: { title: 'Delete product', message: `Deactivate "${p.name}"?`, confirmText: 'Delete', danger: true }
    }).afterClosed().subscribe(ok => {
      if (!ok) return;
      this.api.remove(p.id).subscribe({
        next: () => { this.notify.success('Product deleted'); this.load(); this.loadSummary(); },
        error: (e) => this.notify.error(e)
      });
    });
  }
}