import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSortModule, Sort } from '@angular/material/sort';
import { FormsModule } from '@angular/forms';
import { CategoryApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { AuthService } from '../../core/auth/auth.service';
import { Category } from '../../core/models';
import { sortRows } from '../../shared/sort';
import { CategoryEditDialog } from './category-edit.dialog';
import { SubCategoryManageDialog } from './subcategory-manage.dialog';
import { ConfirmDialog } from '../../shared/confirm.dialog';

@Component({
  selector: 'app-category-list',
  standalone: true,
  imports: [
    CurrencyPipe, FormsModule, MatTableModule, MatButtonModule, MatIconModule,
    MatDialogModule, MatProgressBarModule, MatSlideToggleModule, MatSortModule
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Categories</h1>
        <div class="toolbar-row">
          <mat-slide-toggle [(ngModel)]="includeInactive" (change)="load()">Show inactive</mat-slide-toggle>
          @if (auth.canManageInventory()) {
            <button mat-raised-button color="primary" (click)="openEdit(null)">
              <mat-icon>add</mat-icon> New category
            </button>
          }
        </div>
      </div>

      @if (loading()) { <mat-progress-bar mode="indeterminate" /> }

      <div class="card">
        <table mat-table [dataSource]="rows()" class="full" matSort (matSortChange)="onSort($event)">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Name</th>
            <td mat-cell *matCellDef="let c">
              <strong>{{ c.name }}</strong>
              @if (!c.isActive) { <span class="chip Cancelled">inactive</span> }
              <div class="muted">{{ c.description }}</div>
            </td>
          </ng-container>
          <ng-container matColumnDef="defaultOriginalPrice">
            <th mat-header-cell *matHeaderCellDef mat-sort-header class="text-right">Default cost</th>
            <td mat-cell *matCellDef="let c" class="text-right mono">{{ c.defaultOriginalPrice | currency }}</td>
          </ng-container>
          <ng-container matColumnDef="defaultSalePrice">
            <th mat-header-cell *matHeaderCellDef mat-sort-header class="text-right">Default sale</th>
            <td mat-cell *matCellDef="let c" class="text-right mono">{{ c.defaultSalePrice | currency }}</td>
          </ng-container>
          <ng-container matColumnDef="productCount">
            <th mat-header-cell *matHeaderCellDef mat-sort-header class="text-right">Products</th>
            <td mat-cell *matCellDef="let c" class="text-right mono">{{ c.productCount }}</td>
          </ng-container>
          <ng-container matColumnDef="subcategories">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let c">
              <button mat-stroked-button (click)="manageSubs(c)">
                <mat-icon>account_tree</mat-icon> Subcategories
              </button>
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let c" class="text-right">
              @if (auth.canManageInventory()) {
                <button mat-icon-button (click)="openEdit(c)"><mat-icon>edit</mat-icon></button>
                <button mat-icon-button color="warn" (click)="remove(c)"><mat-icon>delete</mat-icon></button>
              }
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="cols"></tr>
          <tr mat-row *matRowDef="let row; columns: cols"></tr>
        </table>
        @if (!loading() && rows().length === 0) { <div class="empty-state">No categories yet.</div> }
      </div>
    </div>
  `
})
export class CategoryListComponent {
  private api = inject(CategoryApi);
  private dialog = inject(MatDialog);
  private notify = inject(Notify);
  auth = inject(AuthService);

  rows = signal<Category[]>([]);
  loading = signal(false);
  includeInactive = false;
  cols = ['name', 'defaultOriginalPrice', 'defaultSalePrice', 'productCount', 'subcategories', 'actions'];

  private data: Category[] = [];
  private sort: Sort = { active: '', direction: '' };

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.list(this.includeInactive).subscribe({
      next: (r) => { this.data = r; this.applyView(); this.loading.set(false); },
      error: (e) => { this.loading.set(false); this.notify.error(e); }
    });
  }

  onSort(s: Sort) { this.sort = s; this.applyView(); }
  private applyView() { this.rows.set(sortRows(this.data, this.sort)); }

  openEdit(c: Category | null) {
    this.dialog.open(CategoryEditDialog, { data: c }).afterClosed().subscribe(ok => { if (ok) this.load(); });
  }

  manageSubs(c: Category) {
    this.dialog.open(SubCategoryManageDialog, {
      data: { categoryId: c.id, categoryName: c.name }, width: '480px'
    }).afterClosed().subscribe(changed => { if (changed) this.load(); });
  }

  remove(c: Category) {
    this.dialog.open(ConfirmDialog, {
      data: { title: 'Delete category', message: `Deactivate "${c.name}"?`, confirmText: 'Delete', danger: true }
    }).afterClosed().subscribe(ok => {
      if (!ok) return;
      this.api.remove(c.id).subscribe({
        next: () => { this.notify.success('Category deleted'); this.load(); },
        error: (e) => this.notify.error(e)
      });
    });
  }
}
