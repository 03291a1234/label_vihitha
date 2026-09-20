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
import { MatDialog } from '@angular/material/dialog';
import { FinanceApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { ProfitLossReport, VendorSpend } from '../../core/models';
import { DateRangeComponent, DateRange } from '../../shared/date-range.component';
import { RecordContributionDialog } from './record-contribution.dialog';

@Component({
  selector: 'app-profit-loss',
  standalone: true,
  imports: [
    CurrencyPipe, DecimalPipe, RouterLink, FormsModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatTableModule, MatProgressBarModule, DateRangeComponent
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Profit &amp; Loss</h1>
        <app-date-range (rangeChange)="onRange($event)" />
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
            <div class="muted foot">{{ r.orderCount }} orders · {{ r.unitsSold }} units sold · Stock purchases and supplier bills are
              capital (see Total investment), not expenses — so they don't reduce profit here.</div>
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

        <!-- Joint account (cash) -->
        <div class="card cash">
          <div class="jh">
            <h2>Joint account <span class="muted">(common account, to date)</span></h2>
            <div class="j-actions">
              <button mat-stroked-button (click)="recordContribution()"><mat-icon>savings</mat-icon> Record contribution</button>
              <button mat-stroked-button routerLink="/inventories"><mat-icon>add_shopping_cart</mat-icon> Buy new inventory</button>
            </div>
          </div>
          <div class="cash-grid">
            <div class="sec">Money in</div>
            <div class="line"><span>Owner contributions</span><span class="mono pos">+{{ r.totalContributions | currency }}</span></div>
            <div class="line"><span>Sales collected <span class="muted">(all time)</span></span><span class="mono pos">+{{ r.allTimeRevenue | currency }}</span></div>
            <div class="sec bt">Money out</div>
            <div class="line"><span>Inventory purchased <span class="muted">(at cost)</span></span><span class="mono neg">−{{ r.inventoryValueAtCost + r.allTimeCogs | currency }}</span></div>
            @if (r.totalBillsRecorded > 0) {
              <div class="line"><span>Supplier bills <span class="muted">(stitching, cloth…)</span></span><span class="mono neg">−{{ r.totalBillsRecorded | currency }}</span></div>
            }
            <div class="line"><span>Operating expenses</span><span class="mono neg">−{{ r.allTimeExpenses | currency }}</span></div>
            <div class="line"><span>Owner withdrawals</span><span class="mono neg">−{{ r.totalWithdrawals | currency }}</span></div>
            <div class="line cash-net bt"><span>Cash remaining</span>
              <span class="mono" [class.neg]="cashRemaining() < 0">{{ cashRemaining() | currency }}
                <span class="muted inr">≈ {{ cashRemaining() * 95 | currency:'INR':'symbol':'1.0-0' }}</span></span>
            </div>
          </div>
          <div class="muted foot">Money remaining = everything put in (contributions + sales collected) minus everything spent
            (inventory at cost + supplier bills + operating expenses + withdrawals). This is what's available to buy new inventory. Assumes sales are collected in full.</div>
        </div>

        <!-- Total investment (capital deployed) -->
        <div class="card invest">
          <h2>Total investment <span class="muted">(capital deployed, to date)</span></h2>
          <div class="cash-grid">
            <div class="line"><span>Stock on hand <span class="muted">(at cost)</span></span><span class="mono">{{ r.inventoryValueAtCost | currency }}</span></div>
            <div class="line"><span>Cost of goods already sold <span class="muted">(bought &amp; since sold)</span></span><span class="mono">{{ r.allTimeCogs | currency }}</span></div>
            @if (r.totalBillsRecorded > 0) {
              <div class="line"><span>Supplier bills <span class="muted">(stitching, cloth… from Inventories)</span></span><span class="mono">{{ r.totalBillsRecorded | currency }}</span></div>
            }
            <div class="line"><span>Operating expenses <span class="muted">(to date)</span></span><span class="mono">{{ r.allTimeExpenses | currency }}</span></div>
            <div class="line strong bt"><span>Total invested</span>
              <span class="mono">{{ r.totalInvested | currency }}
                <span class="muted inr">≈ {{ r.totalInvested * 95 | currency:'INR':'symbol':'1.0-0' }}</span></span>
            </div>
          </div>
          <div class="recon">
            <div class="sec">From contributions</div>
            <div class="rline"><span>Total owner contributions</span><span class="mono pos">+{{ r.totalContributions | currency }}</span></div>
            @if (r.totalWithdrawals > 0) {
              <div class="rline"><span>Owner withdrawals</span><span class="mono neg">−{{ r.totalWithdrawals | currency }}</span></div>
            }
            <div class="rline"><span>Total invested (deployed)</span><span class="mono neg">−{{ r.totalInvested | currency }}</span></div>
            <div class="rline strong bt2"><span>Contributions left after investment</span>
              <span class="mono" [class.neg]="contributionsLeft() < 0">{{ contributionsLeft() | currency }}
                <span class="muted inr">≈ {{ contributionsLeft() * 95 | currency:'INR':'symbol':'1.0-0' }}</span></span>
            </div>
            @if (contributionsLeft() >= 0) {
              <div class="muted foot">Of the {{ r.totalContributions | currency }} contributed, {{ r.totalInvested | currency }}
                has been deployed into stock and costs — leaving <strong>{{ contributionsLeft() | currency }}</strong> of contribution
                money not yet spent. (Total cash on hand is more — {{ cashRemaining() | currency }} — because sales collected add to it too.)</div>
            } @else {
              <div class="muted foot">More has been deployed than owners contributed — the extra
                <strong>{{ -contributionsLeft() | currency }}</strong> was funded by reinvested sales profit.</div>
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
    .line.exp-item { font-size: 13px; padding: 2px 0 2px 16px; }
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
    .jh { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
    .j-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .cash-grid .sec { font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: rgba(58,37,48,.5);
      margin: 8px 0 2px; font-weight: 700; }
    .cash-grid .sec.bt { border-top: 1px solid var(--lv-line); padding-top: 8px; margin-top: 8px; }
    .line .pos { color: #2e7d32; }
    .spend-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
    .sort-toggle { display: flex; align-items: center; gap: 6px; font-size: 13px; }
    .sort-toggle button { border: 1px solid var(--lv-line); background: #fff; border-radius: 999px; padding: 3px 12px;
      cursor: pointer; font: inherit; font-size: 12px; color: var(--lv-wine); }
    .sort-toggle button.on { background: var(--lv-wine); color: #fff; border-color: var(--lv-wine); }
    .invest { margin-bottom: 16px; }
    .recon { max-width: 560px; margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--lv-line); }
    .rline { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 4px 0; }
    .rline.strong { font-weight: 700; color: var(--lv-wine); font-size: 15px; }
    .rline.bt2 { border-top: 1px solid var(--lv-line); padding-top: 8px; margin-top: 4px; }
    .rline.bt2 .inr { font-weight: 400; margin-left: 6px; }
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
  private dialog = inject(MatDialog);

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

  /** Cash left in the joint account = money in (contributions + sales) − money out (inventory + expenses + withdrawals). */
  cashRemaining(): number {
    const r = this.report();
    if (!r) return 0;
    return r.totalContributions + r.allTimeRevenue
      - (r.inventoryValueAtCost + r.allTimeCogs) - r.totalBillsRecorded - r.allTimeExpenses - r.totalWithdrawals;
  }

  /** How much of the owners' contributions is still available after what's been deployed
   * (contributions − withdrawals − capital deployed). Negative means sales profit funded the rest. */
  contributionsLeft(): number {
    const r = this.report();
    if (!r) return 0;
    return r.totalContributions - r.totalWithdrawals - r.totalInvested;
  }

  recordContribution() {
    this.dialog.open(RecordContributionDialog, { width: '440px' }).afterClosed()
      .subscribe(ok => { if (ok) this.load(); });
  }

  label() {
    if (!this.fromDate && !this.toDate) return 'all time';
    return `${this.fromDate || '…'} → ${this.toDate || 'now'}`;
  }

  onRange(r: DateRange) { this.fromDate = r.from ?? ''; this.toDate = r.to ?? ''; this.load(); }

  load() {
    this.loading.set(true);
    this.api.profitLoss(
      this.fromDate ? new Date(this.fromDate + 'T00:00:00').toISOString() : null,
      this.toDate ? new Date(this.toDate + 'T23:59:59').toISOString() : null
    ).subscribe({
      next: (r) => { this.report.set(r); this.loading.set(false); },
      error: (e) => { this.loading.set(false); this.notify.error(e); }
    });
  }
}
