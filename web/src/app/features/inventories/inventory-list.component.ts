import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSortModule, Sort } from '@angular/material/sort';
import { InventoryApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { AuthService } from '../../core/auth/auth.service';
import { Inventory } from '../../core/models';
import { InventoryEditDialog } from './inventory-edit.dialog';
import { ConfirmDialog } from '../../shared/confirm.dialog';
import { sortRows } from '../../shared/sort';

@Component({
  selector: 'app-inventory-list',
  standalone: true,
  imports: [
    FormsModule, RouterLink, MatTableModule, MatButtonModule, MatIconModule,
    MatDialogModule, MatProgressBarModule, MatSlideToggleModule, MatSortModule
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Inventories</h1>
        <div class="toolbar-row">
          <mat-slide-toggle [(ngModel)]="includeInactive" (change)="load()">Show inactive</mat-slide-toggle>
          @if (auth.canManage()) {
            <button mat-raised-button color="primary" (click)="openEdit(null)">
              <mat-icon>add</mat-icon> New inventory
            </button>
          }
        </div>
      </div>

      <p class="muted intro">Group your stock into named collections (Inventory 1…n) — a batch of sarees or dresses.</p>

      @if (loading()) { <mat-progress-bar mode="indeterminate" /> }

      <div class="card">
        <table mat-table [dataSource]="rows()" class="full" matSort (matSortChange)="onSort($event)">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Name</th>
            <td mat-cell *matCellDef="let i">
              <strong>{{ i.name }}</strong>
              @if (!i.isActive) { <span class="chip Cancelled">inactive</span> }
              <div class="muted">{{ i.description }}</div>
            </td>
          </ng-container>
          <ng-container matColumnDef="productCount">
            <th mat-header-cell *matHeaderCellDef mat-sort-header class="text-right">Products</th>
            <td mat-cell *matCellDef="let i" class="text-right mono">{{ i.productCount }}</td>
          </ng-container>
          <ng-container matColumnDef="view">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let i">
              <button mat-stroked-button [routerLink]="['/products']" [queryParams]="{ inventoryId: i.id }">
                <mat-icon>inventory_2</mat-icon> View products
              </button>
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let i" class="text-right">
              @if (auth.canManage()) {
                <button mat-icon-button (click)="openEdit(i)"><mat-icon>edit</mat-icon></button>
                <button mat-icon-button color="warn" (click)="remove(i)"><mat-icon>delete</mat-icon></button>
              }
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="cols"></tr>
          <tr mat-row *matRowDef="let row; columns: cols"></tr>
        </table>
        @if (!loading() && rows().length === 0) { <div class="empty-state">No inventories yet.</div> }
      </div>
    </div>
  `,
  styles: [`.intro { margin: -8px 0 16px; }`]
})
export class InventoryListComponent {
  private api = inject(InventoryApi);
  private dialog = inject(MatDialog);
  private notify = inject(Notify);
  auth = inject(AuthService);

  rows = signal<Inventory[]>([]);
  loading = signal(false);
  includeInactive = false;
  cols = ['name', 'productCount', 'view', 'actions'];

  private data: Inventory[] = [];
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

  openEdit(i: Inventory | null) {
    this.dialog.open(InventoryEditDialog, { data: i, width: '420px' }).afterClosed()
      .subscribe(ok => { if (ok) this.load(); });
  }

  remove(i: Inventory) {
    this.dialog.open(ConfirmDialog, {
      data: { title: 'Delete inventory', message: `Delete "${i.name}"? Its products are kept but unassigned.`, confirmText: 'Delete', danger: true }
    }).afterClosed().subscribe(ok => {
      if (!ok) return;
      this.api.remove(i.id).subscribe({
        next: () => { this.notify.success('Inventory deleted'); this.load(); },
        error: (e) => this.notify.error(e)
      });
    });
  }
}
