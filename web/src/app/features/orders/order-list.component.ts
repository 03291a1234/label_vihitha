import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSortModule, Sort } from '@angular/material/sort';
import { OrderApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { AuthService } from '../../core/auth/auth.service';
import { OrderListItem, OrderStatus } from '../../core/models';

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [
    CurrencyPipe, DatePipe, FormsModule, RouterLink, MatTableModule, MatButtonModule,
    MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatPaginatorModule, MatProgressBarModule, MatSortModule
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Orders</h1>
        @if (auth.canManageSales()) {
          <button mat-raised-button color="primary" routerLink="/orders/new"><mat-icon>add</mat-icon> New order</button>
        }
      </div>

      <div class="toolbar-row">
        <mat-form-field>
          <mat-label>Search</mat-label>
          <input matInput [(ngModel)]="search" (keyup.enter)="reload()" placeholder="Order # or customer" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>Status</mat-label>
          <mat-select [(ngModel)]="status" (selectionChange)="reload()">
            <mat-option [value]="null">All</mat-option>
            @for (s of statuses; track s) { <mat-option [value]="s">{{ s }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <button mat-button (click)="reload()"><mat-icon>search</mat-icon> Apply</button>
      </div>

      @if (loading()) { <mat-progress-bar mode="indeterminate" /> }

      <div class="card">
        <table mat-table [dataSource]="rows()" class="full" matSort (matSortChange)="onSort($event)">
          <ng-container matColumnDef="orderNumber">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Order #</th>
            <td mat-cell *matCellDef="let o" class="mono"><strong>{{ o.orderNumber }}</strong></td>
          </ng-container>
          <ng-container matColumnDef="customerName">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Customer</th>
            <td mat-cell *matCellDef="let o">{{ o.customerName }}</td>
          </ng-container>
          <ng-container matColumnDef="orderDate">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Date</th>
            <td mat-cell *matCellDef="let o">{{ o.orderDate | date:'mediumDate' }}</td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Status</th>
            <td mat-cell *matCellDef="let o"><span class="chip {{o.status}}">{{ o.status }}</span></td>
          </ng-container>
          <ng-container matColumnDef="itemCount">
            <th mat-header-cell *matHeaderCellDef class="text-right">Items</th>
            <td mat-cell *matCellDef="let o" class="text-right mono">{{ o.itemCount }}</td>
          </ng-container>
          <ng-container matColumnDef="grandTotal">
            <th mat-header-cell *matHeaderCellDef mat-sort-header class="text-right">Total</th>
            <td mat-cell *matCellDef="let o" class="text-right mono">{{ o.grandTotal | currency }}</td>
          </ng-container>
          <ng-container matColumnDef="invoice">
            <th mat-header-cell *matHeaderCellDef>Invoice</th>
            <td mat-cell *matCellDef="let o">
              @if (o.hasInvoice) { <mat-icon class="ok" title="Invoiced">receipt</mat-icon> }
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="cols"></tr>
          <tr mat-row *matRowDef="let row; columns: cols" class="clickable" [routerLink]="['/orders', row.id]"></tr>
        </table>
        @if (!loading() && rows().length === 0) { <div class="empty-state">No orders yet.</div> }
        <mat-paginator [length]="total()" [pageSize]="pageSize" [pageIndex]="page - 1"
          [pageSizeOptions]="[10,25,50]" (page)="onPage($event)" />
      </div>
    </div>
  `,
  styles: [`
    .clickable { cursor: pointer; }
    .clickable:hover { background: #fafafa; }
    .ok { color: #2e7d32; }
  `]
})
export class OrderListComponent {
  private api = inject(OrderApi);
  private notify = inject(Notify);
  auth = inject(AuthService);

  rows = signal<OrderListItem[]>([]);
  total = signal(0);
  loading = signal(false);
  search = '';
  status: OrderStatus | null = null;
  statuses: OrderStatus[] = ['Pending', 'Confirmed', 'Fulfilled', 'Cancelled'];
  sortBy: string | null = null;
  sortDir: string | null = null;
  page = 1;
  pageSize = 25;
  cols = ['orderNumber', 'customerName', 'orderDate', 'status', 'itemCount', 'grandTotal', 'invoice'];

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.list({
      search: this.search || undefined, status: this.status,
      sortBy: this.sortBy, sortDir: this.sortDir,
      page: this.page, pageSize: this.pageSize
    }).subscribe({
      next: (r) => { this.rows.set(r.items); this.total.set(r.totalCount); this.loading.set(false); },
      error: (e) => { this.loading.set(false); this.notify.error(e); }
    });
  }

  reload() { this.page = 1; this.load(); }
  onPage(e: PageEvent) { this.page = e.pageIndex + 1; this.pageSize = e.pageSize; this.load(); }
  onSort(s: Sort) {
    this.sortBy = s.direction ? s.active : null;
    this.sortDir = s.direction || null;
    this.reload();
  }
}
