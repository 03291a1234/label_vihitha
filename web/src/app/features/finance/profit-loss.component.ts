import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FinanceApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { ProfitLossReport, VendorSpend } from '../../core/models';

@Component({
  selector: 'app-profit-loss',
  standalone: true,
  imports: [
    CurrencyPipe, DecimalPipe, RouterLink, FormsModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatTableModule, MatProgressBarModule
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Profit &amp; Loss</h1>
        <div class="toolbar-row">
          <mat-form-field><mat-label>From</mat-label><input matInput type="date" [(ngModel)]="fromDate" (change)="load()" /></mat-form-field>
          <mat-form-field><mat-label>To</mat-label><input matInput type="date" [(ngModel)]="toDate" (change)="load()" /></mat-form-field>
          <button mat-stroked-button (click)="clearRange()"><mat-icon>all_inclusive</mat-icon> All time</button>
        </div>
      </div>

      @if (loading()) { <mat-progress-bar mode="indeterminate" /> }

      @if (report(); as r) {
        <!-- Headline metrics -->
        <div class="kpi-strip">
          <div class="card k-card">
            <div class="k-top">Total invested <span class="muted">(to date)</span></div>
            <div class="k-big">{{ r.totalInvested | currency }}</div>
            <div class="k-sub">≈ {{ r.totalInvested * 95 | currency:'INR':'symbol':'1.0-0' }} · stock + goods sold + expenses</div>
          </div>
          <div class="card k-card">
            <div class="k-top">Sales</div>
            <div class="k-big">{{ r.revenue | currency }}</div>
            <div class="k-sub">{{ r.orderCount }} orders · {{ r.unitsSold }} units sold</div>
          </div>
          <div class="card k-card">
            <div class="k-top">{{ r.netProfit < 0 ? 'Net loss' : 'Net profit' }}</div>
            <div class="k-big" [class.pos]="r.netProfit >= 0" [class.neg2]="r.netProfit < 0">{{ r.netProfit | currency }}</div>
            <div class="k-sub">revenue − cost of goods − expenses</div>
          </div>
          <div class="card k-card">
            <div class="k-top">Stock in hand (at cost)</div>
            <div class="k-big">{{ r.inventoryValueAtCost | currency }}</div>
            <div class="k-sub">≈ {{ r.inventoryValueAtCost * 95 | currency:'INR':'symbol':'1.0-0' }} · {{ r.inventoryUnits }} units</div>
          </div>
        </div>

        <div class="grid">
          <!-- P&L statement -->
          <div class="card statement">
            <h2>Income statement <span class="muted">({{ label() }})</span></h2>
            <div class="line"><span>Sales revenue</span><span class="mono">{{ r.revenue | currency }}</span></div>
            <div class="line sub"><span>Cost of goods sold</span><span class="mono neg">−{{ r.cogs | currency }}</span></div>
            <div class="line strong bt"><span>Gross profit <span class="muted">({{ r.grossMarginPct | number:'1.0-1' }}%)</span></span><span class="mono">{{ r.grossProfit | currency }}</span></div>

            <div class="line bt"><span>Operating expenses <span class="muted">— itemised on the <a routerLink="/expenses" class="link">Expenses tab</a></span></span><span class="mono neg">−{{ r.expensesTotal | currency }}</span></div>

            <div class="line net bt" [class.loss]="r.netProfit < 0">
              <span>{{ r.netProfit < 0 ? 'Net loss' : 'Net profit' }} <span class="muted">({{ r.netMarginPct | number:'1.0-1' }}%)</span></span>
              <span class="mono">{{ r.netProfit | currency }}</span>
            </div>
            <div class="line memo bt">
              <span>Inventory on hand (at cost) <span class="muted">— asset, not a loss</span></span>
              <span class="mono">{{ r.inventoryValueAtCost | currency }}
                <span class="muted inr">≈ {{ r.inventoryValueAtCost * 95 | currency:'INR':'symbol':'1.0-0' }}</span></span>
            </div>
            <div class="muted foot">{{ r.orderCount }} orders · {{ r.unitsSold }} units sold · Stock purchases are capital,
              expensed as cost-of-goods only when sold — so they don't reduce profit here.</div>
          </div>

          <!-- Inventory on hand -->
          <div class="card kpis">
            <h2>Inventory on hand <span class="muted">(now)</span></h2>
            <div class="kpi"><div class="k-label">Capital in stock (at cost)</div><div class="k-val">{{ r.inventoryValueAtCost | currency }}</div>
              <div class="muted">≈ {{ r.inventoryValueAtCost * 95 | currency:'INR':'symbol':'1.0-0' }}</div></div>
            <div class="kpi"><div class="k-label">Retail value (at sale)</div><div class="k-val">{{ r.inventoryValueAtSale | currency }}</div>
              <div class="muted">≈ {{ r.inventoryValueAtSale * 95 | currency:'INR':'symbol':'1.0-0' }}</div></div>
            <div class="kpi"><div class="k-label">Potential margin</div><div class="k-val">{{ r.inventoryValueAtSale - r.inventoryValueAtCost | currency }}</div>
              <div class="muted">≈ {{ (r.inventoryValueAtSale - r.inventoryValueAtCost) * 95 | currency:'INR':'symbol':'1.0-0' }}</div></div>
            <div class="kpi"><div class="k-label">Units in stock</div><div class="k-val">{{ r.inventoryUnits }}</div></div>
          </div>
        </div>

        <!-- Cash position (joint account) -->
        <div class="card cash">
          <h2>Cash position <span class="muted">(joint account, to date)</span></h2>
          <div class="cash-grid">
            <div class="line"><span>Owner contributions</span><span class="mono">{{ r.totalContributions | currency }}</span></div>
            <div class="line"><span>Owner withdrawals</span><span class="mono neg">−{{ r.totalWithdrawals | currency }}</span></div>
            <div class="line"><span>Retained profit / loss</span><span class="mono">{{ r.allTimeNetProfit | currency }}</span></div>
            <div class="line strong bt"><span>Owner equity</span><span class="mono">{{ r.totalOwnerEquity | currency }}</span></div>
            <div class="line"><span>Money tied up in stock (inventory at cost)</span><span class="mono neg">−{{ r.inventoryValueAtCost | currency }}</span></div>
            <div class="line cash-net bt"><span>Cash remaining</span>
              <span class="mono">{{ r.totalOwnerEquity - r.inventoryValueAtCost | currency }}
                <span class="muted inr">≈ {{ (r.totalOwnerEquity - r.inventoryValueAtCost) * 95 | currency:'INR':'symbol':'1.0-0' }}</span></span>
            </div>
          </div>
          <div class="muted foot">Buying stock moves cash into "inventory at cost", so it's deducted here automatically. Assumes sales are collected in full (no receivables tracked).</div>
        </div>

        <!-- Total investment reconciliation -->
        <div class="card invest">
          <h2>Total investment <span class="muted">(all money put in, to date)</span></h2>
          <div class="cash-grid">
            <div class="line"><span>Stock on hand <span class="muted">(at cost)</span></span><span class="mono">{{ r.inventoryValueAtCost | currency }}</span></div>
            <div class="line"><span>Cost of goods already sold <span class="muted">(bought &amp; since sold)</span></span><span class="mono">{{ r.allTimeCogs | currency }}</span></div>
            <div class="line"><span>Operating expenses <span class="muted">(to date)</span></span><span class="mono">{{ r.allTimeExpenses | currency }}</span></div>
            <div class="line strong bt"><span>Total invested</span>
              <span class="mono">{{ r.totalInvested | currency }}
                <span class="muted inr">≈ {{ r.totalInvested * 95 | currency:'INR':'symbol':'1.0-0' }}</span></span>
            </div>
          </div>
          <div class="recon">
            <div class="rline">
              <span>Owner contributions recorded</span>
              <span class="mono">{{ r.totalContributions | currency }}</span>
            </div>
            <div class="rline">
              <span>Documented on supplier bills</span>
              <span class="mono">{{ r.totalBillsRecorded | currency }}
                <span class="muted">of {{ r.inventoryValueAtCost + r.allTimeCogs | currency }} inventory cost</span></span>
            </div>
            @if (fundingGap() > 1) {
              <div class="rline gap">
                <span><mat-icon>info</mat-icon> Unrecorded funding gap</span>
                <span class="mono">{{ fundingGap() | currency }}</span>
              </div>
              <div class="muted foot">Contributions are less than what's been invested — either some capital came from
                retained sales, or owner contributions haven't all been logged. Add them under
                <a routerLink="/owners" class="link">Owners</a>, or attach bills on the
                <a routerLink="/inventories" class="link">Inventories</a> tab to document the spend.</div>
            } @else {
              <div class="muted foot">Recorded contributions cover the invested capital. Attach supplier bills on the
                <a routerLink="/inventories" class="link">Inventories</a> tab to document the actual spend per batch.</div>
            }
          </div>
        </div>

        <!-- Owner equity -->
        <div class="card">
          <div class="owners-head">
            <h2>Owner equity <span class="muted">(to date)</span></h2>
            <div class="muted">Retained net profit to date: <strong>{{ r.allTimeNetProfit | currency }}</strong>
              @if (r.totalSharePercent !== 100 && r.owners.length) { · <span class="warn">shares total {{ r.totalSharePercent }}%</span> }
            </div>
          </div>
          <table mat-table [dataSource]="r.owners" class="full">
            <ng-container matColumnDef="name"><th mat-header-cell *matHeaderCellDef>Owner</th>
              <td mat-cell *matCellDef="let o"><strong>{{ o.name }}</strong></td></ng-container>
            <ng-container matColumnDef="share"><th mat-header-cell *matHeaderCellDef class="text-right">Share</th>
              <td mat-cell *matCellDef="let o" class="text-right mono">{{ o.sharePercent | number:'1.0-2' }}%</td></ng-container>
            <ng-container matColumnDef="contrib"><th mat-header-cell *matHeaderCellDef class="text-right">Contributions</th>
              <td mat-cell *matCellDef="let o" class="text-right mono">{{ o.contributions | currency }}</td></ng-container>
            <ng-container matColumnDef="withdraw"><th mat-header-cell *matHeaderCellDef class="text-right">Withdrawals</th>
              <td mat-cell *matCellDef="let o" class="text-right mono neg">{{ o.withdrawals | currency }}</td></ng-container>
            <ng-container matColumnDef="profit"><th mat-header-cell *matHeaderCellDef class="text-right">Profit share</th>
              <td mat-cell *matCellDef="let o" class="text-right mono">{{ o.profitShare | currency }}</td></ng-container>
            <ng-container matColumnDef="equity"><th mat-header-cell *matHeaderCellDef class="text-right">Equity balance</th>
              <td mat-cell *matCellDef="let o" class="text-right mono strong">{{ o.equity | currency }}</td></ng-container>
            <tr mat-header-row *matHeaderRowDef="ownerCols"></tr>
            <tr mat-row *matRowDef="let row; columns: ownerCols"></tr>
          </table>
          @if (r.owners.length === 0) { <div class="empty-state">No owners yet — add owners with profit shares to see the split.</div> }
          @if (r.owners.length) {
            <div class="totals">
              <span>Totals</span>
              <span class="mono">{{ r.totalContributions | currency }}</span>
              <span class="mono neg">{{ r.totalWithdrawals | currency }}</span>
              <span class="mono">{{ r.allTimeNetProfit | currency }}</span>
              <span class="mono strong">{{ r.totalOwnerEquity | currency }}</span>
            </div>
          }
        </div>

        <!-- Who funded the inventory -->
        <div class="card funded">
          <h2>Inventory funded by owner <span class="muted">(current stock, at cost)</span></h2>
          <table mat-table [dataSource]="r.inventoryFundedByOwner" class="full">
            <ng-container matColumnDef="owner"><th mat-header-cell *matHeaderCellDef>Funded by</th>
              <td mat-cell *matCellDef="let f"><strong [class.muted]="!f.ownerId">{{ f.ownerName }}</strong></td></ng-container>
            <ng-container matColumnDef="units"><th mat-header-cell *matHeaderCellDef class="text-right">Units</th>
              <td mat-cell *matCellDef="let f" class="text-right mono">{{ f.units }}</td></ng-container>
            <ng-container matColumnDef="cost"><th mat-header-cell *matHeaderCellDef class="text-right">Cost invested</th>
              <td mat-cell *matCellDef="let f" class="text-right mono strong">{{ f.inventoryCost | currency }}
                <span class="muted inr">≈ {{ f.inventoryCost * 95 | currency:'INR':'symbol':'1.0-0' }}</span></td></ng-container>
            <ng-container matColumnDef="pct"><th mat-header-cell *matHeaderCellDef class="text-right">Share of stock</th>
              <td mat-cell *matCellDef="let f" class="text-right mono">{{ fundedPct(f.inventoryCost) | number:'1.0-1' }}%</td></ng-container>
            <tr mat-header-row *matHeaderRowDef="fundedCols"></tr>
            <tr mat-row *matRowDef="let row; columns: fundedCols"></tr>
          </table>
          @if (r.inventoryFundedByOwner.length === 0) { <div class="empty-state">No stock on hand.</div> }
          <div class="muted foot">Set each inventory's "Paid by" owner (Inventories → edit) to attribute its stock here. A product's own "Paid by" overrides its inventory for exceptions.</div>
        </div>

        <!-- Spend by vendor (by inventory) -->
        <div class="card funded">
          <div class="spend-head">
            <h2>Spend by vendor <span class="muted">(current stock, at cost · by inventory)</span></h2>
            <div class="sort-toggle">
              <span class="muted">Sort:</span>
              <button [class.on]="spendSort() === 'name'" (click)="spendSort.set('name')">Vendor name</button>
              <button [class.on]="spendSort() === 'cost'" (click)="spendSort.set('cost')">Spend</button>
            </div>
          </div>
          @for (v of sortedSpend(r.spendByVendor); track v.vendorId) {
            <div class="vendor-block">
              <div class="vendor-row">
                <strong [class.muted]="!v.vendorId">{{ v.vendorName }}</strong>
                <span class="v-figs">
                  <span class="muted">{{ v.units }} units</span>
                  <span class="mono strong">{{ v.totalCost | currency }}</span>
                  <span class="muted inr">≈ {{ v.totalCost * 95 | currency:'INR':'symbol':'1.0-0' }}</span>
                </span>
              </div>
              <div class="inv-chips">
                @for (i of v.inventories; track i.inventoryId) {
                  <span class="inv-chip" [class.none]="!i.inventoryId">
                    {{ i.inventoryName }} · <strong>{{ i.cost | currency }}</strong> <span class="u">({{ i.units }} u)</span>
                  </span>
                }
              </div>
            </div>
          }
          @if (r.spendByVendor.length === 0) { <div class="empty-state">No stock on hand.</div> }
          <div class="totals-line">
            <span>Total purchase cost of current stock</span>
            <span class="mono strong">{{ r.inventoryValueAtCost | currency }}</span>
          </div>
          <div class="muted foot">Based on stock on hand (cost × quantity); items already sold aren't included. Set a product's Vendor to attribute its spend here.</div>
        </div>
      }
    </div>
  `,
  styles: [`
    .kpi-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 16px; }
    @media (max-width: 900px) { .kpi-strip { grid-template-columns: repeat(2, 1fr); } }
    .k-card { padding: 16px 18px; }
    .k-top { font-size: 12px; text-transform: uppercase; letter-spacing: .5px; color: rgba(58,37,48,.6); font-weight: 600; }
    .k-big { font-size: 26px; font-weight: 800; color: var(--lv-wine); margin: 6px 0 2px; line-height: 1.1; }
    .k-big.pos { color: #1e7d3a; }
    .k-big.neg2 { color: #b3261e; }
    .k-sub { font-size: 12px; color: #777; }
    .grid { display: grid; grid-template-columns: 1.3fr 1fr; gap: 16px; margin-bottom: 16px; }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
    .card { padding: 18px 20px; }
    h2 { font-size: 16px; margin: 0 0 12px; color: var(--lv-wine); }
    .line { display: flex; justify-content: space-between; padding: 6px 0; }
    .line.sub { padding-left: 12px; color: #444; }
    .line.strong { font-weight: 700; }
    .line.bt { border-top: 1px solid var(--lv-line); margin-top: 4px; padding-top: 8px; }
    .line.net { font-weight: 800; font-size: 17px; color: #1e7d3a; }
    .line.net.loss { color: #b3261e; }
    .line.memo { color: var(--lv-wine); font-weight: 600; }
    .line.memo .inr { font-weight: 400; margin-left: 6px; font-size: 12px; }
    .section-label { margin-top: 12px; font-size: 12px; text-transform: uppercase; letter-spacing: .6px; color: #8a6; color: var(--lv-wine); opacity: .7; }
    .neg { color: #b3261e; }
    .link { color: var(--lv-wine); font-weight: 600; text-decoration: none; border-bottom: 1px solid currentColor; }
    .link:hover { opacity: .8; }
    .foot { margin-top: 10px; font-size: 12px; }
    .kpis .kpi { padding: 8px 0; border-bottom: 1px solid var(--lv-line); }
    .kpis .kpi:last-child { border-bottom: none; }
    .k-label { font-size: 13px; color: #555; }
    .k-val { font-size: 20px; font-weight: 700; color: var(--lv-wine); }
    .cash { margin-bottom: 16px; }
    .cash-grid { max-width: 520px; }
    .spend-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
    .sort-toggle { display: flex; align-items: center; gap: 6px; font-size: 13px; }
    .sort-toggle button { border: 1px solid var(--lv-line); background: #fff; border-radius: 999px; padding: 3px 12px;
      cursor: pointer; font: inherit; font-size: 12px; color: var(--lv-wine); }
    .sort-toggle button.on { background: var(--lv-wine); color: #fff; border-color: var(--lv-wine); }
    .invest { margin-bottom: 16px; }
    .recon { max-width: 560px; margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--lv-line); }
    .rline { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 4px 0; }
    .rline.gap { color: #b3261e; font-weight: 600; }
    .rline.gap span:first-child { display: inline-flex; align-items: center; gap: 6px; }
    .rline.gap mat-icon { font-size: 18px; height: 18px; width: 18px; }
    .rline .muted { font-weight: 400; margin-left: 6px; }
    .cash-net { font-weight: 800; font-size: 17px; color: var(--lv-wine); }
    .cash-net .inr { font-weight: 400; margin-left: 8px; }
    .funded { margin-bottom: 16px; }
    .funded .inr { font-weight: 400; margin-left: 6px; font-size: 12px; }
    .vendor-block { padding: 10px 0; border-bottom: 1px solid var(--lv-line); }
    .vendor-block:last-of-type { border-bottom: none; }
    .vendor-row { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
    .vendor-row strong { font-size: 15px; }
    .v-figs { display: flex; align-items: baseline; gap: 10px; white-space: nowrap; }
    .inv-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .inv-chip { background: var(--lv-rose-soft); color: var(--lv-wine); border-radius: 999px; padding: 3px 10px; font-size: 12px; }
    .inv-chip.none { background: #eee; color: #666; }
    .inv-chip .u { font-weight: 400; opacity: .75; }
    .totals-line { display: flex; justify-content: space-between; padding: 12px 0 2px; margin-top: 6px;
      border-top: 2px solid var(--lv-line); font-weight: 700; }
    .owners-head { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 8px; }
    .warn { color: #8a5a00; }
    .totals { display: grid; grid-template-columns: 1fr auto auto auto auto; gap: 24px; padding: 12px 16px; margin-top: 4px;
      border-top: 2px solid var(--lv-line); font-weight: 700; }
    .totals .mono { text-align: right; }
  `]
})
export class ProfitLossComponent {
  private api = inject(FinanceApi);
  private notify = inject(Notify);

  report = signal<ProfitLossReport | null>(null);
  loading = signal(false);
  fromDate = '';
  toDate = '';
  ownerCols = ['name', 'share', 'contrib', 'withdraw', 'profit', 'equity'];
  fundedCols = ['owner', 'units', 'cost', 'pct'];

  constructor() { this.load(); }

  /** A funding row's cost as a percentage of all current inventory at cost. */
  fundedPct(cost: number): number {
    const total = this.report()?.inventoryValueAtCost ?? 0;
    return total > 0 ? (cost / total) * 100 : 0;
  }

  /** Spend-by-vendor sort order. */
  spendSort = signal<'cost' | 'name'>('cost');
  sortedSpend(rows: VendorSpend[]): VendorSpend[] {
    const copy = [...rows];
    return this.spendSort() === 'name'
      ? copy.sort((a, b) => a.vendorName.localeCompare(b.vendorName))
      : copy.sort((a, b) => b.totalCost - a.totalCost);
  }

  /** How much of the invested capital isn't covered by recorded owner contributions. */
  fundingGap(): number {
    const r = this.report();
    if (!r) return 0;
    return Math.max(0, r.totalInvested - r.totalContributions);
  }

  label() {
    if (!this.fromDate && !this.toDate) return 'all time';
    return `${this.fromDate || '…'} → ${this.toDate || 'now'}`;
  }

  clearRange() { this.fromDate = ''; this.toDate = ''; this.load(); }

  load() {
    this.loading.set(true);
    this.api.profitLoss(
      this.fromDate ? new Date(this.fromDate).toISOString() : null,
      this.toDate ? new Date(this.toDate).toISOString() : null
    ).subscribe({
      next: (r) => { this.report.set(r); this.loading.set(false); },
      error: (e) => { this.loading.set(false); this.notify.error(e); }
    });
  }
}
