import { Component, inject, signal } from '@angular/core';
import { MoneyPipe } from '../../shared/money.pipe';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, map } from 'rxjs';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSortModule, Sort } from '@angular/material/sort';
import { OrderApi, OrderSummary, OrderStatusCount } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { AuthService } from '../../core/auth/auth.service';
import { OrderListItem, OrderStatus } from '../../core/models';
import { DateRangeComponent, DateRange, DateRangePreset } from '../../shared/date-range.component';

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [
    MoneyPipe, DatePipe, FormsModule, RouterLink, MatTableModule, MatButtonModule,
    MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatPaginatorModule, MatProgressBarModule, MatSortModule, DateRangeComponent
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
        <mat-form-field class="search-field">
          <mat-label>Search</mat-label>
          <input matInput [(ngModel)]="search" (ngModelChange)="onSearchInput()"
                 (keyup.enter)="reload()" placeholder="Order # or customer (3+ chars)" />
          <mat-hint>Searches order # &amp; customer after 3 characters</mat-hint>
        </mat-form-field>
      </div>

      <div class="status-chips">
        <button type="button" class="schip" [class.on]="selectedStatuses.length === 0" (click)="showAll()">
          All <span class="cnt">{{ totalCount() }}</span>
        </button>
        @for (s of statuses; track s) {
          <button type="button" class="schip {{s}}" [class.on]="isSelected(s)" (click)="toggleStatus(s)">
            {{ s }} <span class="cnt">{{ countFor(s) }}</span>
          </button>
        }
      </div>

      <div class="toolbar-row date-row">
        <app-date-range [presets]="datePresets" (rangeChange)="onRange($event)" />
      </div>

      <div class="totals">
        <div class="stat">
          <span class="label">Total orders</span>
          <span class="value">{{ summary().totalOrders }}</span>
        </div>
        <div class="stat">
          <span class="label">Total amount</span>
          <span class="value">{{ summary().totalAmount | currency }}</span>
        </div>
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
          <tr mat-row *matRowDef="let row; columns: cols" class="clickable"
              [routerLink]="['/orders', row.id]" [queryParams]="{ status: statusParam() || null }"></tr>
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
    .search-field { width: 320px; max-width: 100%; }
    .status-chips { display: flex; gap: 8px; flex-wrap: wrap; margin: 0 0 12px; }
    .status-chips .schip { display: inline-flex; align-items: center; gap: 7px; border: 1px solid var(--lv-line);
      background: #fff; border-radius: 999px; padding: 6px 12px 6px 14px; cursor: pointer; font: inherit;
      font-size: 13px; color: var(--lv-wine); transition: background .12s, border-color .12s; }
    .status-chips .schip:hover { background: var(--lv-rose-soft); }
    .status-chips .schip.on { background: var(--lv-wine); color: #fff; border-color: var(--lv-wine); }
    .status-chips .cnt { display: inline-flex; align-items: center; justify-content: center; min-width: 20px;
      height: 20px; padding: 0 6px; border-radius: 999px; background: var(--lv-rose-soft); color: var(--lv-wine);
      font-size: 12px; font-weight: 700; }
    .status-chips .schip.on .cnt { background: rgba(255,255,255,.24); color: #fff; }
    .date-row { margin-top: -4px; }
    .totals { display: flex; gap: 12px; flex-wrap: wrap; margin: 4px 0 12px; }
    .totals .stat { flex: 1 1 160px; min-width: 140px; border: 1px solid var(--lv-line); border-radius: 12px;
      padding: 12px 16px; background: var(--lv-cream-2); }
    .totals .label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .5px;
      color: rgba(58,37,48,.55); font-weight: 700; }
    .totals .value { display: block; font-size: 22px; font-weight: 800; color: var(--lv-wine); margin-top: 2px; }
  `]
})
export class OrderListComponent {
  private api = inject(OrderApi);
  private notify = inject(Notify);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  auth = inject(AuthService);

  rows = signal<OrderListItem[]>([]);
  total = signal(0);
  summary = signal<OrderSummary>({ totalOrders: 0, totalAmount: 0 });
  statusCounts = signal<OrderStatusCount[]>([]);
  loading = signal(false);
  search = '';
  selectedStatuses: OrderStatus[] = [];
  fromDate: string | null = null;
  toDate: string | null = null;
  statuses: OrderStatus[] = ['Pending', 'Confirmed', 'Fulfilled', 'Cancelled'];
  datePresets: DateRangePreset[] = ['all', 'today', 'yesterday', '3m', '6m', 'ytd', 'custom'];
  sortBy: string | null = null;
  sortDir: string | null = null;
  page = 1;
  pageSize = 25;
  cols = ['orderNumber', 'customerName', 'orderDate', 'status', 'itemCount', 'grandTotal', 'invoice'];
  private searchInput$ = new Subject<string>();

  constructor() {
    // Restore the status filter from the URL (so returning from an order keeps the pending view).
    const st = this.route.snapshot.queryParamMap.get('status');
    if (st) this.selectedStatuses = st.split(',').filter(Boolean) as OrderStatus[];
    // Search as you type: fire once there are 3+ characters, or when cleared (reset to all).
    this.searchInput$.pipe(
      map(s => s.trim()),
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed()
    ).subscribe(term => {
      if (term.length >= 3 || term.length === 0) this.reload();
    });
    this.load();
  }

  onSearchInput() { this.searchInput$.next(this.search); }

  /** Keep the status filter in the URL so opening an order and returning preserves it. */
  statusParam(): string { return this.selectedStatuses.join(','); }
  private syncStatusUrl() {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { status: this.selectedStatuses.length ? this.statusParam() : null },
      queryParamsHandling: 'merge', replaceUrl: true
    });
  }

  private filters() {
    return {
      search: this.search || undefined,
      statuses: this.selectedStatuses.length ? this.selectedStatuses : undefined,
      fromDate: this.fromDate, toDate: this.toDate,
    };
  }

  load() {
    this.loading.set(true);
    const f = this.filters();
    this.api.list({ ...f, sortBy: this.sortBy, sortDir: this.sortDir, page: this.page, pageSize: this.pageSize })
      .subscribe({
        next: (r) => { this.rows.set(r.items); this.total.set(r.totalCount); this.loading.set(false); },
        error: (e) => { this.loading.set(false); this.notify.error(e); }
      });
    // Totals span the whole filtered set (all pages), so they use the same filters without paging.
    this.api.summary(f).subscribe({
      next: (s) => this.summary.set(s),
      error: (e) => this.notify.error(e)
    });
    // Per-status counts ignore the status selection (backend), so chips show every bucket.
    this.api.statusCounts(f).subscribe({
      next: (c) => this.statusCounts.set(c),
      error: (e) => this.notify.error(e)
    });
  }

  countFor(s: OrderStatus): number { return this.statusCounts().find(x => x.status === s)?.count ?? 0; }
  totalCount(): number { return this.statusCounts().reduce((sum, x) => sum + x.count, 0); }
  isSelected(s: OrderStatus): boolean { return this.selectedStatuses.includes(s); }
  showAll() { if (this.selectedStatuses.length) { this.selectedStatuses = []; this.syncStatusUrl(); this.reload(); } }
  toggleStatus(s: OrderStatus) {
    this.selectedStatuses = this.isSelected(s)
      ? this.selectedStatuses.filter(x => x !== s)
      : [...this.selectedStatuses, s];
    this.syncStatusUrl();
    this.reload();
  }

  onRange(r: DateRange) { this.fromDate = r.from; this.toDate = r.to; this.reload(); }

  reload() { this.page = 1; this.load(); }
  onPage(e: PageEvent) { this.page = e.pageIndex + 1; this.pageSize = e.pageSize; this.load(); }
  onSort(s: Sort) {
    this.sortBy = s.direction ? s.active : null;
    this.sortDir = s.direction || null;
    this.reload();
  }
}
