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
import { MatDialog } from '@angular/material/dialog';
import { CategoryApi, ProductApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { AuthService } from '../../core/auth/auth.service';
import { Category, Product } from '../../core/models';
import { ProductEditDialog } from './product-edit.dialog';
import { ConfirmDialog } from '../../shared/confirm.dialog';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [
    CurrencyPipe, FormsModule, MatTableModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule,
    MatPaginatorModule, MatProgressBarModule
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Inventory</h1>
        @if (auth.canManage()) {
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
          <mat-select [(ngModel)]="categoryId" (selectionChange)="reload()">
            <mat-option [value]="null">All</mat-option>
            @for (c of categories(); track c.id) { <mat-option [value]="c.id">{{ c.name }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-slide-toggle [(ngModel)]="lowStockOnly" (change)="reload()">Low stock only</mat-slide-toggle>
        <button mat-button (click)="reload()"><mat-icon>search</mat-icon> Apply</button>
      </div>

      @if (loading()) { <mat-progress-bar mode="indeterminate" /> }

      <div class="card">
        <table mat-table [dataSource]="rows()" class="full">
          <ng-container matColumnDef="sku">
            <th mat-header-cell *matHeaderCellDef>SKU</th>
            <td mat-cell *matCellDef="let p" class="mono">{{ p.sku }}</td>
          </ng-container>
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Product</th>
            <td mat-cell *matCellDef="let p">
              <strong>{{ p.name }}</strong>
              @if (!p.isActive) { <span class="chip Cancelled">inactive</span> }
              <div class="muted">{{ p.categoryName }}@if (p.color) { · {{ p.color }} }</div>
            </td>
          </ng-container>
          <ng-container matColumnDef="originalPrice">
            <th mat-header-cell *matHeaderCellDef class="text-right">Cost</th>
            <td mat-cell *matCellDef="let p" class="text-right mono">{{ p.originalPrice | currency }}</td>
          </ng-container>
          <ng-container matColumnDef="salePrice">
            <th mat-header-cell *matHeaderCellDef class="text-right">Sale</th>
            <td mat-cell *matCellDef="let p" class="text-right mono">{{ p.salePrice | currency }}</td>
          </ng-container>
          <ng-container matColumnDef="quantityOnHand">
            <th mat-header-cell *matHeaderCellDef class="text-right">Stock</th>
            <td mat-cell *matCellDef="let p" class="text-right mono" [class.low-stock]="p.isLowStock">
              {{ p.quantityOnHand }}
              @if (p.isLowStock) { <mat-icon class="warn-icon" title="At/under reorder threshold">warning</mat-icon> }
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let p" class="text-right">
              @if (auth.canManage()) {
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
  styles: [`.warn-icon { font-size: 16px; height: 16px; width: 16px; vertical-align: middle; }`]
})
export class ProductListComponent {
  private api = inject(ProductApi);
  private catApi = inject(CategoryApi);
  private dialog = inject(MatDialog);
  private notify = inject(Notify);
  auth = inject(AuthService);

  rows = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  total = signal(0);
  loading = signal(false);

  search = '';
  categoryId: number | null = null;
  lowStockOnly = false;
  page = 1;
  pageSize = 25;
  cols = ['sku', 'name', 'originalPrice', 'salePrice', 'quantityOnHand', 'actions'];

  constructor() {
    this.catApi.list(false).subscribe(cs => this.categories.set(cs));
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.list({
      search: this.search || undefined,
      categoryId: this.categoryId,
      lowStockOnly: this.lowStockOnly,
      page: this.page, pageSize: this.pageSize
    }).subscribe({
      next: (r) => { this.rows.set(r.items); this.total.set(r.totalCount); this.loading.set(false); },
      error: (e) => { this.loading.set(false); this.notify.error(e); }
    });
  }

  reload() { this.page = 1; this.load(); }
  onPage(e: PageEvent) { this.page = e.pageIndex + 1; this.pageSize = e.pageSize; this.load(); }

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
