import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSortModule, Sort } from '@angular/material/sort';
import { FormsModule } from '@angular/forms';
import { VendorApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { AuthService } from '../../core/auth/auth.service';
import { Vendor } from '../../core/models';
import { sortRows } from '../../shared/sort';
import { VendorEditDialog } from './vendor-edit.dialog';
import { ConfirmDialog } from '../../shared/confirm.dialog';

@Component({
  selector: 'app-vendor-list',
  standalone: true,
  imports: [
    RouterLink, FormsModule, MatTableModule, MatButtonModule, MatIconModule,
    MatDialogModule, MatProgressBarModule, MatSlideToggleModule, MatSortModule
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Vendors</h1>
        <div class="toolbar-row">
          <mat-slide-toggle [(ngModel)]="includeInactive" (change)="load()">Show inactive</mat-slide-toggle>
          @if (auth.canManageInventory()) {
            <button mat-raised-button color="primary" (click)="openEdit(null)">
              <mat-icon>add</mat-icon> New vendor
            </button>
          }
        </div>
      </div>

      @if (loading()) { <mat-progress-bar mode="indeterminate" /> }

      <div class="card">
        <table mat-table [dataSource]="rows()" class="full" matSort (matSortChange)="onSort($event)">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Vendor</th>
            <td mat-cell *matCellDef="let v">
              <strong>{{ v.name }}</strong>
              @if (!v.isActive) { <span class="chip Cancelled">inactive</span> }
              @if (v.contactPerson) { <div class="muted">{{ v.contactPerson }}</div> }
            </td>
          </ng-container>
          <ng-container matColumnDef="contact">
            <th mat-header-cell *matHeaderCellDef>Contact</th>
            <td mat-cell *matCellDef="let v">
              @if (v.phone) { <div>{{ v.phone }}</div> }
              @if (v.email) { <div class="muted">{{ v.email }}</div> }
              @if (!v.phone && !v.email) { <span class="muted">—</span> }
            </td>
          </ng-container>
          <ng-container matColumnDef="productCount">
            <th mat-header-cell *matHeaderCellDef mat-sort-header class="text-right">Products</th>
            <td mat-cell *matCellDef="let v" class="text-right mono">{{ v.productCount }}</td>
          </ng-container>
          <ng-container matColumnDef="totalUnits">
            <th mat-header-cell *matHeaderCellDef mat-sort-header class="text-right">Units</th>
            <td mat-cell *matCellDef="let v" class="text-right mono">{{ v.totalUnits }}</td>
          </ng-container>
          <ng-container matColumnDef="products">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let v">
              <button mat-stroked-button [routerLink]="['/products']" [queryParams]="{ vendorId: v.id }">
                <mat-icon>inventory_2</mat-icon> View products
              </button>
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let v" class="text-right">
              @if (auth.canManageInventory()) {
                <button mat-icon-button (click)="openEdit(v)"><mat-icon>edit</mat-icon></button>
                <button mat-icon-button color="warn" (click)="remove(v)"><mat-icon>delete</mat-icon></button>
              }
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="cols"></tr>
          <tr mat-row *matRowDef="let row; columns: cols"></tr>
        </table>
        @if (!loading() && rows().length === 0) { <div class="empty-state">No vendors yet.</div> }
      </div>
    </div>
  `
})
export class VendorListComponent {
  private api = inject(VendorApi);
  private dialog = inject(MatDialog);
  private notify = inject(Notify);
  auth = inject(AuthService);

  rows = signal<Vendor[]>([]);
  loading = signal(false);
  includeInactive = false;
  cols = ['name', 'contact', 'productCount', 'totalUnits', 'products', 'actions'];

  private data: Vendor[] = [];
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

  openEdit(v: Vendor | null) {
    this.dialog.open(VendorEditDialog, { data: v, width: '460px' })
      .afterClosed().subscribe(ok => { if (ok) this.load(); });
  }

  remove(v: Vendor) {
    const msg = v.productCount > 0
      ? `Deactivate "${v.name}"? Its ${v.productCount} product${v.productCount === 1 ? '' : 's'} will be kept but unlinked from this vendor.`
      : `Deactivate "${v.name}"?`;
    this.dialog.open(ConfirmDialog, {
      data: { title: 'Delete vendor', message: msg, confirmText: 'Delete', danger: true }
    }).afterClosed().subscribe(ok => {
      if (!ok) return;
      this.api.remove(v.id).subscribe({
        next: () => { this.notify.success('Vendor deleted'); this.load(); },
        error: (e) => this.notify.error(e)
      });
    });
  }
}
