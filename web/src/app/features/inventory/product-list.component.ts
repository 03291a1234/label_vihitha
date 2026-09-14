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
import { ActivatedRoute } from '@angular/router';
import { CategoryApi, ProductApi, SubCategoryApi, InventoryApi, resolveImageUrl } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { AuthService } from '../../core/auth/auth.service';
import { Category, SubCategory, Inventory, Product } from '../../core/models';
import { ProductEditDialog } from './product-edit.dialog';
import { ConfirmDialog } from '../../shared/confirm.dialog';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [
    CurrencyPipe, FormsModule, MatTableModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule,
    MatPaginatorModule, MatProgressBarModule, MatSortModule
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Products</h1>
        @if (auth.canManageInventory()) {
          <button mat-raised-button color="primary" (click)="openEdit(null)">
            <mat-icon>add</mat-icon> New product
          </button>
        }
      </div>

      <div class="toolbar-row">
        <mat-form-field>
          <mat-label>Search</mat-label>
          <input matInput [(ngModel)]="search" (keyup.enter)="reload()" placeholder="Name or SKU" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>Category</mat-label>
          <mat-select [(ngModel)]="categoryId" (selectionChange)="onCategoryFilter()">
            <mat-option [value]="null">All</mat-option>
            @for (c of categories(); track c.id) { <mat-option [value]="c.id">{{ c.name }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Subcategory</mat-label>
          <mat-select [(ngModel)]="subCategoryId" (selectionChange)="reload()" [disabled]="!categoryId">
            <mat-option [value]="null">All</mat-option>
            @for (s of subCategories(); track s.id) { <mat-option [value]="s.id">{{ s.name }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Inventory</mat-label>
          <mat-select [(ngModel)]="inventoryId" (selectionChange)="reload()">
            <mat-option [value]="null">All</mat-option>
            @for (i of inventories(); track i.id) { <mat-option [value]="i.id">{{ i.name }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-slide-toggle [(ngModel)]="lowStockOnly" (change)="reload()">Low stock only</mat-slide-toggle>
        <button mat-button (click)="reload()"><mat-icon>search</mat-icon> Apply</button>
      </div>

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
                  @if (p.inventoryName) { <div class="muted"><mat-icon class="inv-icon">inventory</mat-icon> {{ p.inventoryName }}</div> }
                </div>
              </div>
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
            <td mat-cell *matCellDef="let p" class="text-right mono" [class.low-stock]="p.isLowStock">
              {{ p.quantityOnHand }}
              @if (p.isLowStock) { <mat-icon class="warn-icon" title="At/under reorder threshold">warning</mat-icon> }
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
    .product-cell { display: flex; align-items: center; gap: 12px; padding: 6px 0; }
    .product-cell .thumb {
      width: 44px; height: 44px; border-radius: 8px; background: #f0f0f3;
      display: grid; place-items: center; overflow: hidden; flex: 0 0 auto;
    }
    .product-cell .thumb img { width: 100%; height: 100%; object-fit: cover; }
    .product-cell .thumb mat-icon { color: #b8b8c0; font-size: 22px; height: 22px; width: 22px; }
    .inv-icon { font-size: 14px; height: 14px; width: 14px; vertical-align: -2px; }
  `]
})
export class ProductListComponent {
  private api = inject(ProductApi);
  private catApi = inject(CategoryApi);
  private subApi = inject(SubCategoryApi);
  private invApi = inject(InventoryApi);
  private route = inject(ActivatedRoute);
  private dialog = inject(MatDialog);
  private notify = inject(Notify);
  auth = inject(AuthService);

  /** USD → INR conversion rate for the displayed Indian cost. */
  readonly inrRate = 95;

  rows = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  subCategories = signal<SubCategory[]>([]);
  inventories = signal<Inventory[]>([]);
  total = signal(0);
  loading = signal(false);

  search = '';
  categoryId: number | null = null;
  subCategoryId: number | null = null;
  inventoryId: number | null = null;
  lowStockOnly = false;
  sortBy: string | null = null;
  sortDir: string | null = null;
  page = 1;
  pageSize = 25;
  cols = ['sku', 'name', 'costInr', 'originalPrice', 'salePrice', 'quantityOnHand', 'actions'];

  constructor() {
    this.catApi.list(false).subscribe(cs => this.categories.set(cs));
    this.invApi.list(false).subscribe(inv => this.inventories.set(inv));
    // Preselect the inventory filter when navigated from the Inventories screen.
    const invParam = this.route.snapshot.queryParamMap.get('inventoryId');
    if (invParam) this.inventoryId = Number(invParam);
    this.load();
  }

  onCategoryFilter() {
    // Reset subcategory and reload its options when the category filter changes.
    this.subCategoryId = null;
    if (this.categoryId) this.subApi.list(this.categoryId, false).subscribe(s => this.subCategories.set(s));
    else this.subCategories.set([]);
    this.reload();
  }

  load() {
    this.loading.set(true);
    this.api.list({
      search: this.search || undefined,
      categoryId: this.categoryId,
      subCategoryId: this.subCategoryId,
      inventoryId: this.inventoryId,
      lowStockOnly: this.lowStockOnly,
      sortBy: this.sortBy, sortDir: this.sortDir,
      page: this.page, pageSize: this.pageSize
    }).subscribe({
      next: (r) => { this.rows.set(r.items); this.total.set(r.totalCount); this.loading.set(false); },
      error: (e) => { this.loading.set(false); this.notify.error(e); }
    });
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
      .subscribe(ok => { if (ok) this.load(); });
  }

  remove(p: Product) {
    this.dialog.open(ConfirmDialog, {
      data: { title: 'Delete product', message: `Deactivate "${p.name}"?`, confirmText: 'Delete', danger: true }
    }).afterClosed().subscribe(ok => {
      if (!ok) return;
      this.api.remove(p.id).subscribe({
        next: () => { this.notify.success('Product deleted'); this.load(); },
        error: (e) => this.notify.error(e)
      });
    });
  }
}
