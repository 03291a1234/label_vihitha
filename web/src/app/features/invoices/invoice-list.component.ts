import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSortModule, Sort } from '@angular/material/sort';
import { InvoiceApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { InvoiceListItem, PaymentMethod, PaymentStatus } from '../../core/models';

@Component({
  selector: 'app-invoice-list',
  standalone: true,
  imports: [
    CurrencyPipe, DatePipe, FormsModule, RouterLink, MatTableModule, MatButtonModule,
    MatIconModule, MatFormFieldModule, MatSelectModule, MatPaginatorModule, MatProgressBarModule, MatSortModule
  ],
  template: `
    <div class="page">
      <div class="page-header"><h1>Invoicing</h1></div>

      <div class="toolbar-row">
        <mat-form-field>
          <mat-label>Payment status</mat-label>
          <mat-select [(ngModel)]="status" (selectionChange)="reload()">
            <mat-option [value]="null">All</mat-option>
            @for (s of statuses; track s) { <mat-option [value]="s">{{ s }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Method</mat-label>
          <mat-select [(ngModel)]="method" (selectionChange)="reload()">
            <mat-option [value]="null">All</mat-option>
            <mat-option value="Zelle">Zelle</mat-option>
            <mat-option value="Cash">Cash</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      @if (loading()) { <mat-progress-bar mode="indeterminate" /> }

      <div class="card">
        <table mat-table [dataSource]="rows()" class="full" matSort (matSortChange)="onSort($event)">
          <ng-container matColumnDef="invoiceNumber">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Invoice #</th>
            <td mat-cell *matCellDef="let i" class="mono"><strong>{{ i.invoiceNumber }}</strong></td>
          </ng-container>
          <ng-container matColumnDef="orderNumber">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Order</th>
            <td mat-cell *matCellDef="let i" class="mono">
              <a class="order-link" [routerLink]="['/orders', i.orderId]" (click)="$event.stopPropagation()">
                <mat-icon>receipt_long</mat-icon>{{ i.orderNumber }}
              </a>
            </td>
          </ng-container>
          <ng-container matColumnDef="customerName">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Customer</th>
            <td mat-cell *matCellDef="let i">{{ i.customerName }}</td>
          </ng-container>
          <ng-container matColumnDef="invoiceDate">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Date</th>
            <td mat-cell *matCellDef="let i">{{ i.invoiceDate | date:'mediumDate' }}</td>
          </ng-container>
          <ng-container matColumnDef="paymentMethod">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Method</th>
            <td mat-cell *matCellDef="let i">{{ i.paymentMethod }}</td>
          </ng-container>
          <ng-container matColumnDef="amountDue">
            <th mat-header-cell *matHeaderCellDef mat-sort-header class="text-right">Due</th>
            <td mat-cell *matCellDef="let i" class="text-right mono">{{ i.amountDue | currency }}</td>
          </ng-container>
          <ng-container matColumnDef="amountPaid">
            <th mat-header-cell *matHeaderCellDef mat-sort-header class="text-right">Paid</th>
            <td mat-cell *matCellDef="let i" class="text-right mono">{{ i.amountPaid | currency }}</td>
          </ng-container>
          <ng-container matColumnDef="paymentStatus">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Status</th>
            <td mat-cell *matCellDef="let i"><span class="chip {{i.paymentStatus}}">{{ i.paymentStatus }}</span></td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="cols"></tr>
          <tr mat-row *matRowDef="let row; columns: cols" class="clickable" [routerLink]="['/invoices', row.id]"></tr>
        </table>
        @if (!loading() && rows().length === 0) { <div class="empty-state">No invoices yet.</div> }
        <mat-paginator [length]="total()" [pageSize]="pageSize" [pageIndex]="page - 1"
          [pageSizeOptions]="[10,25,50]" (page)="onPage($event)" />
      </div>
    </div>
  `,
  styles: [`
    .clickable { cursor: pointer; } .clickable:hover { background: #fafafa; }
    .order-link { display: inline-flex; align-items: center; gap: 4px; color: var(--lv-wine); font-weight: 600;
      text-decoration: none; padding: 2px 8px; border-radius: 999px; background: var(--lv-rose-soft); transition: background .12s; }
    .order-link:hover { background: #ecd4de; }
    .order-link mat-icon { font-size: 16px; height: 16px; width: 16px; }
  `]
})
export class InvoiceListComponent {
  private api = inject(InvoiceApi);
  private notify = inject(Notify);

  rows = signal<InvoiceListItem[]>([]);
  total = signal(0);
  loading = signal(false);
  status: PaymentStatus | null = null;
  method: PaymentMethod | null = null;
  statuses: PaymentStatus[] = ['Unpaid', 'PartiallyPaid', 'Paid', 'Refunded'];
  sortBy: string | null = null;
  sortDir: string | null = null;
  page = 1;
  pageSize = 25;
  cols = ['invoiceNumber', 'orderNumber', 'customerName', 'invoiceDate', 'paymentMethod', 'amountDue', 'amountPaid', 'paymentStatus'];

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.list({
      paymentStatus: this.status, paymentMethod: this.method,
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
