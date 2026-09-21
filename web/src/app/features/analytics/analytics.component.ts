import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { ChartConfiguration } from 'chart.js';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ReportsApi } from '../../core/services/reports.api';
import { Notify } from '../../core/services/notify.service';
import {
  DashboardSummary, MarginReport, SalesByCategoryReport,
  InventoryValuationReport, PaymentMethodReport, MoversReport
} from '../../core/reports.models';
import { ChartComponent } from '../../shared/chart.component';
import { DateRangeComponent, DateRange, DateRangePreset } from '../../shared/date-range.component';

const PALETTE = ['#5b5bd6', '#2e7d32', '#e65100', '#1565c0', '#c62828', '#00897b', '#6a1b9a', '#f9a825'];

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [
    CurrencyPipe, DecimalPipe, FormsModule, MatCardModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatTableModule, MatProgressBarModule, ChartComponent, DateRangeComponent
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Analytics</h1>
        <app-date-range [presets]="datePresets" (rangeChange)="onRange($event)" />
      </div>

      @if (loading()) { <mat-progress-bar mode="indeterminate" /> }

      @if (accessDenied()) {
        <div class="card empty-state">
          <mat-icon>lock</mat-icon>
          <h2>Owner access required</h2>
          <p class="muted">Financial reports are visible to the Owner role only.</p>
        </div>
      }

      @if (summary(); as s) {
        <div class="kpis">
          <div class="kpi"><span class="muted">Revenue</span><span class="v">{{ s.totalRevenue | currency }}</span></div>
          <div class="kpi"><span class="muted">Gross margin</span><span class="v">{{ s.grossMargin | currency }}</span>
            <span class="sub">{{ s.marginPercent | number:'1.0-1' }}% margin</span></div>
          <div class="kpi"><span class="muted">Orders</span><span class="v">{{ s.orderCount }}</span>
            <span class="sub">{{ s.unitsSold }} units</span></div>
          <div class="kpi"><span class="muted">Outstanding</span><span class="v">{{ s.outstandingInvoiceAmount | currency }}</span></div>
          <div class="kpi"><span class="muted">Open follow-ups</span><span class="v">{{ s.openFollowUps }}</span>
            @if (s.overdueFollowUps > 0) { <span class="sub overdue">{{ s.overdueFollowUps }} overdue</span> }</div>
          <div class="kpi"><span class="muted">Low stock</span><span class="v" [class.overdue]="s.lowStockCount > 0">{{ s.lowStockCount }}</span></div>
        </div>

        <div class="grid">
          <div class="card">
            <h3>Margin by category</h3>
            @if (marginByCatConfig()) { <app-chart [config]="marginByCatConfig()!" /> }
          </div>
          <div class="card">
            <h3>Revenue share by category</h3>
            @if (salesShareConfig()) { <app-chart [config]="salesShareConfig()!" /> }
          </div>
          <div class="card">
            <h3>Payment method split</h3>
            @if (paymentConfig()) { <app-chart [config]="paymentConfig()!" /> }
            @else { <div class="empty-state">No payments in range.</div> }
          </div>
          <div class="card">
            <h3>Inventory valuation by category</h3>
            @if (inventoryConfig()) { <app-chart [config]="inventoryConfig()!" /> }
          </div>
          <div class="card wide">
            <h3>Margin trend</h3>
            @if (marginTrendConfig()) { <app-chart [config]="marginTrendConfig()!" /> }
          </div>
        </div>

        <div class="grid">
          <div class="card">
            <h3>Top movers</h3>
            <table mat-table [dataSource]="movers()?.topMovers ?? []" class="full">
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Product</th>
                <td mat-cell *matCellDef="let m"><strong>{{ m.sku }}</strong> {{ m.name }}</td>
              </ng-container>
              <ng-container matColumnDef="unitsSold">
                <th mat-header-cell *matHeaderCellDef class="text-right">Units</th>
                <td mat-cell *matCellDef="let m" class="text-right mono">{{ m.unitsSold }}</td>
              </ng-container>
              <ng-container matColumnDef="revenue">
                <th mat-header-cell *matHeaderCellDef class="text-right">Revenue</th>
                <td mat-cell *matCellDef="let m" class="text-right mono">{{ m.revenue | currency }}</td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="moverCols"></tr>
              <tr mat-row *matRowDef="let row; columns: moverCols"></tr>
            </table>
          </div>
          <div class="card">
            <h3>Slow movers</h3>
            <table mat-table [dataSource]="movers()?.slowMovers ?? []" class="full">
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Product</th>
                <td mat-cell *matCellDef="let m"><strong>{{ m.sku }}</strong> {{ m.name }}</td>
              </ng-container>
              <ng-container matColumnDef="unitsSold">
                <th mat-header-cell *matHeaderCellDef class="text-right">Sold</th>
                <td mat-cell *matCellDef="let m" class="text-right mono">{{ m.unitsSold }}</td>
              </ng-container>
              <ng-container matColumnDef="quantityOnHand">
                <th mat-header-cell *matHeaderCellDef class="text-right">In stock</th>
                <td mat-cell *matCellDef="let m" class="text-right mono">{{ m.quantityOnHand }}</td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="slowCols"></tr>
              <tr mat-row *matRowDef="let row; columns: slowCols"></tr>
            </table>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin-bottom: 20px; }
    .kpi { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.08); display: flex; flex-direction: column; gap: 2px; }
    .kpi .v { font-size: 24px; font-weight: 600; }
    .kpi .sub { font-size: 12px; color: rgba(0,0,0,.55); }
    .kpi .muted { font-size: 12px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; margin-bottom: 16px; }
    .card.wide { grid-column: 1 / -1; }
    .card h3 { margin: 0 0 12px; font-weight: 500; }
    .empty-state mat-icon { font-size: 40px; height: 40px; width: 40px; color: #999; }
  `]
})
export class AnalyticsComponent {
  private api = inject(ReportsApi);
  private notify = inject(Notify);

  loading = signal(false);
  accessDenied = signal(false);
  summary = signal<DashboardSummary | null>(null);
  movers = signal<MoversReport | null>(null);

  marginByCatConfig = signal<ChartConfiguration | null>(null);
  salesShareConfig = signal<ChartConfiguration | null>(null);
  paymentConfig = signal<ChartConfiguration | null>(null);
  inventoryConfig = signal<ChartConfiguration | null>(null);
  marginTrendConfig = signal<ChartConfiguration | null>(null);

  fromDate = '';
  toDate = '';
  datePresets: DateRangePreset[] = ['all', 'today', 'yesterday', '3m', '6m', 'ytd', 'custom'];
  moverCols = ['name', 'unitsSold', 'revenue'];
  slowCols = ['name', 'unitsSold', 'quantityOnHand'];

  constructor() { this.load(); }

  onRange(r: DateRange) { this.fromDate = r.from ?? ''; this.toDate = r.to ?? ''; this.load(); }

  load() {
    this.loading.set(true);
    this.accessDenied.set(false);
    const range = { fromDate: this.fromDate || null, toDate: this.toDate ? this.toDate + 'T23:59:59Z' : null };

    forkJoin({
      summary: this.api.summary(range),
      margin: this.api.margin(range, 'Month'),
      sales: this.api.salesByCategory(range),
      inventory: this.api.inventoryValuation(),
      payments: this.api.paymentMethods(range),
      movers: this.api.movers(range, 5)
    }).subscribe({
      next: (r) => {
        this.summary.set(r.summary);
        this.movers.set(r.movers);
        this.buildCharts(r.margin, r.sales, r.inventory, r.payments);
        this.loading.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.loading.set(false);
        if (e.status === 403) { this.accessDenied.set(true); }
        else { this.notify.error(e); }
      }
    });
  }

  private buildCharts(margin: MarginReport, sales: SalesByCategoryReport, inv: InventoryValuationReport, pay: PaymentMethodReport) {
    // Margin by category — grouped bars (cost vs revenue)
    this.marginByCatConfig.set({
      type: 'bar',
      data: {
        labels: margin.byCategory.map(c => c.categoryName),
        datasets: [
          { label: 'Cost', data: margin.byCategory.map(c => c.originalCost), backgroundColor: '#c62828' },
          { label: 'Revenue', data: margin.byCategory.map(c => c.finalRevenue), backgroundColor: '#2e7d32' }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });

    // Revenue share doughnut
    this.salesShareConfig.set(this.doughnut(
      sales.rows.map(r => r.categoryName), sales.rows.map(r => r.revenue)));

    // Payment methods doughnut (null if empty)
    this.paymentConfig.set(pay.rows.length
      ? this.doughnut(pay.rows.map(r => r.method), pay.rows.map(r => r.amountPaid))
      : null);

    // Inventory valuation grouped bars
    this.inventoryConfig.set({
      type: 'bar',
      data: {
        labels: inv.rows.map(r => r.categoryName),
        datasets: [
          { label: 'At cost', data: inv.rows.map(r => r.valueAtOriginal), backgroundColor: '#1565c0' },
          { label: 'At sale', data: inv.rows.map(r => r.valueAtSale), backgroundColor: '#5b5bd6' }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });

    // Margin trend line
    this.marginTrendConfig.set({
      type: 'line',
      data: {
        labels: margin.byDate.map(d => d.bucket),
        datasets: [
          { label: 'Revenue', data: margin.byDate.map(d => d.finalRevenue), borderColor: '#2e7d32', backgroundColor: 'rgba(46,125,50,.1)', fill: true, tension: 0.3 },
          { label: 'Margin', data: margin.byDate.map(d => d.margin), borderColor: '#5b5bd6', backgroundColor: 'rgba(91,91,214,.1)', fill: true, tension: 0.3 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
  }

  private doughnut(labels: string[], data: number[]): ChartConfiguration {
    return {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length]) }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    };
  }
}
