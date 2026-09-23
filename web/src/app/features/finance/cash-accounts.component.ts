import { Component, inject, signal } from '@angular/core';
import { MoneyPipe } from '../../shared/money.pipe';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CashApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { CashAccount, CashMovement, CashOverview } from '../../core/models';
import { ConfirmDialog } from '../../shared/confirm.dialog';
import { CashMovementDialog } from './cash-movement.dialog';
import { CashAccountDialog } from './cash-account.dialog';

@Component({
  selector: 'app-cash-accounts',
  standalone: true,
  imports: [MoneyPipe, DatePipe, MatButtonModule, MatIconModule, MatProgressBarModule, MatDialogModule],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Cash accounts</h1>
        <div class="head-actions">
          <button mat-stroked-button (click)="openAccount(null)"><mat-icon>add</mat-icon> Add account</button>
          <button mat-raised-button color="primary" (click)="openMovement()" [disabled]="(overview()?.accounts?.length ?? 0) < 1">
            <mat-icon>swap_horiz</mat-icon> Record movement
          </button>
        </div>
      </div>
      <p class="muted intro">Track where the business's cash physically sits — the common India account and each owner's holdings — and move money between them.</p>

      @if (loading()) { <mat-progress-bar mode="indeterminate" /> }

      @if (overview(); as o) {
        <!-- Reconciliation banner -->
        <div class="card recon" [class.ok]="reconciled(o)" [class.off]="!reconciled(o)">
          <div class="r-item"><span class="l">Tracked across accounts</span><span class="v">{{ o.trackedTotal | currency }}</span></div>
          <mat-icon>{{ reconciled(o) ? 'check_circle' : 'sync_problem' }}</mat-icon>
          <div class="r-item"><span class="l">Cash the books expect</span><span class="v">{{ o.expectedCash | currency }}</span></div>
          <div class="r-item diff"><span class="l">Difference</span>
            <span class="v" [class.neg]="o.difference !== 0">{{ o.difference | currency }}</span></div>
        </div>
        @if (!reconciled(o)) {
          <p class="muted hint">The tracked total doesn't match the pooled cash the P&amp;L computes. Add an <strong>opening balance</strong> to each account (or a money-in / money-out entry) until the difference is $0.</p>
        }

        <!-- Account cards -->
        <div class="accounts">
          @for (a of o.accounts; track a.id) {
            <div class="card acct" [class.inactive]="!a.isActive">
              <div class="a-top">
                <div class="a-name">
                  <mat-icon>{{ a.isCommon ? 'account_balance' : 'person' }}</mat-icon>
                  <div>
                    <strong>{{ a.name }}</strong>
                    <span class="tag">{{ a.isCommon ? 'Common' : (a.ownerName || 'Owner') }}</span>
                  </div>
                </div>
                <div class="a-actions">
                  <button mat-icon-button (click)="openAccount(a)" title="Edit"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button color="warn" (click)="removeAccount(a)" title="Delete"><mat-icon>delete</mat-icon></button>
                </div>
              </div>
              <div class="a-bal" [class.neg]="a.balance < 0">{{ a.balance | currency }}</div>
            </div>
          }
          @if (o.accounts.length === 0) { <div class="card empty-state">No accounts yet. Add the common India account and each owner's holdings to start.</div> }
        </div>

        <!-- Movements -->
        <div class="card mv">
          <h2>Recent movements</h2>
          @if (movements().length === 0) { <div class="muted empty">No movements recorded yet.</div> }
          @for (m of movements(); track m.id) {
            <div class="mrow">
              <div class="m-main">
                <span class="m-kind {{ m.kind }}">{{ label(m) }}</span>
                <span class="m-flow">
                  {{ m.fromAccountName || '—' }} <mat-icon>arrow_forward</mat-icon> {{ m.toAccountName || '—' }}
                </span>
                @if (m.note) { <span class="m-note">{{ m.note }}</span> }
              </div>
              <div class="m-right">
                <span class="m-amt">{{ m.amount | currency }}</span>
                <span class="m-date">{{ m.date | date:'mediumDate' }}</span>
                <button mat-icon-button color="warn" (click)="removeMovement(m)" title="Delete"><mat-icon>close</mat-icon></button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .head-actions { display: flex; gap: 8px; }
    .intro { margin: -6px 0 16px; }
    .card { padding: 16px; }
    .recon { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; margin-bottom: 12px; border-left: 4px solid var(--lv-line); }
    .recon.ok { border-left-color: #2e7d32; }
    .recon.off { border-left-color: #b3261e; }
    .recon > mat-icon { color: rgba(58,37,48,.4); }
    .recon.ok > mat-icon { color: #2e7d32; }
    .recon.off > mat-icon { color: #b3261e; }
    .r-item { display: flex; flex-direction: column; }
    .r-item .l { font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: rgba(58,37,48,.55); font-weight: 700; }
    .r-item .v { font-size: 20px; font-weight: 800; color: var(--lv-wine); }
    .r-item .v.neg { color: #b3261e; }
    .hint { margin: 0 0 16px; }
    .accounts { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .acct.inactive { opacity: .55; }
    .a-top { display: flex; justify-content: space-between; align-items: flex-start; }
    .a-name { display: flex; gap: 10px; align-items: center; }
    .a-name mat-icon { color: #c9a24b; }
    .a-name strong { display: block; }
    .tag { font-size: 11px; color: rgba(58,37,48,.6); }
    .a-bal { font-size: 26px; font-weight: 800; color: var(--lv-wine); margin-top: 10px; }
    .a-bal.neg { color: #b3261e; }
    .mv h2 { margin: 0 0 10px; }
    .empty { padding: 12px 0; }
    .mrow { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--lv-line); }
    .mrow:last-child { border-bottom: none; }
    .m-main { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .m-kind { font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 999px; background: var(--lv-rose-soft); color: var(--lv-wine); }
    .m-kind.Transfer { background: #e7eefc; color: #2f4f8f; }
    .m-kind.CashIn, .m-kind.Opening { background: #e5f3e8; color: #226b39; }
    .m-kind.CashOut { background: #efe7ea; color: #6b5560; }
    .m-flow { display: inline-flex; align-items: center; gap: 4px; color: #3a2530; }
    .m-flow mat-icon { font-size: 16px; height: 16px; width: 16px; color: rgba(58,37,48,.5); }
    .m-note { color: rgba(58,37,48,.6); font-size: 13px; }
    .m-right { display: flex; align-items: center; gap: 12px; }
    .m-amt { font-weight: 700; color: var(--lv-wine); font-variant-numeric: tabular-nums; }
    .m-date { font-size: 12px; color: rgba(58,37,48,.6); }
  `]
})
export class CashAccountsComponent {
  private api = inject(CashApi);
  private dialog = inject(MatDialog);
  private notify = inject(Notify);

  overview = signal<CashOverview | null>(null);
  movements = signal<CashMovement[]>([]);
  loading = signal(false);

  constructor() { this.load(); }

  reconciled(o: CashOverview) { return Math.abs(o.difference) < 0.005; }
  label(m: CashMovement) {
    return m.kind === 'CashIn' ? 'Money in' : m.kind === 'CashOut' ? 'Money out'
      : m.kind === 'Opening' ? 'Opening' : 'Transfer';
  }

  load() {
    this.loading.set(true);
    this.api.overview().subscribe({
      next: (o) => { this.overview.set(o); this.loading.set(false); },
      error: (e) => { this.loading.set(false); this.notify.error(e); }
    });
    this.api.movements().subscribe({ next: (m) => this.movements.set(m) });
  }

  openMovement() {
    const accounts = this.overview()?.accounts?.filter(a => a.isActive) ?? [];
    this.dialog.open(CashMovementDialog, { data: { accounts }, width: '460px' })
      .afterClosed().subscribe(ok => { if (ok) this.load(); });
  }

  openAccount(a: CashAccount | null) {
    this.dialog.open(CashAccountDialog, { data: { account: a }, width: '440px' })
      .afterClosed().subscribe(ok => { if (ok) this.load(); });
  }

  removeAccount(a: CashAccount) {
    this.dialog.open(ConfirmDialog, { data: { title: 'Delete account', message: `Delete "${a.name}"?`, confirmText: 'Delete', danger: true } })
      .afterClosed().subscribe(ok => {
        if (!ok) return;
        this.api.deleteAccount(a.id).subscribe({
          next: () => { this.notify.success('Account deleted'); this.load(); },
          error: (e) => this.notify.error(e)
        });
      });
  }

  removeMovement(m: CashMovement) {
    this.dialog.open(ConfirmDialog, { data: { title: 'Delete movement', message: 'Remove this cash movement?', confirmText: 'Delete', danger: true } })
      .afterClosed().subscribe(ok => {
        if (!ok) return;
        this.api.deleteMovement(m.id).subscribe({
          next: () => { this.notify.success('Movement removed'); this.load(); },
          error: (e) => this.notify.error(e)
        });
      });
  }
}
