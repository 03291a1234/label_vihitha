import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { InvoiceApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { AuthService } from '../../core/auth/auth.service';
import { Invoice } from '../../core/models';
import { RecordPaymentDialog } from './record-payment.dialog';

@Component({
  selector: 'app-invoice-detail',
  standalone: true,
  imports: [
    CurrencyPipe, DatePipe, RouterLink, MatCardModule, MatTableModule,
    MatButtonModule, MatIconModule, MatProgressBarModule
  ],
  template: `
    <div class="page">
      @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
      @if (invoice(); as inv) {
        <div class="page-header">
          <h1>
            <button mat-icon-button routerLink="/invoices"><mat-icon>arrow_back</mat-icon></button>
            {{ inv.invoiceNumber }} <span class="chip {{inv.paymentStatus}}">{{ inv.paymentStatus }}</span>
          </h1>
          <div class="toolbar-row">
            @if (auth.canManage() && inv.amountRemaining > 0 && inv.paymentStatus !== 'Refunded') {
              <button mat-raised-button color="primary" (click)="recordPayment(inv)">
                <mat-icon>add_card</mat-icon> Record payment
              </button>
            }
          </div>
        </div>

        <div class="meta card">
          <div><span class="muted">Order</span><div><a [routerLink]="['/orders', inv.orderId]">{{ inv.orderNumber }}</a></div></div>
          <div><span class="muted">Customer</span><div>{{ inv.customerName }}</div></div>
          <div><span class="muted">Invoice date</span><div>{{ inv.invoiceDate | date:'medium' }}</div></div>
          <div><span class="muted">Method</span><div>{{ inv.paymentMethod }}@if (inv.paymentReference) { · {{ inv.paymentReference }} }</div></div>
          <div><span class="muted">Amount due</span><div class="mono">{{ inv.amountDue | currency }}</div></div>
          <div><span class="muted">Paid</span><div class="mono">{{ inv.amountPaid | currency }}</div></div>
          <div><span class="muted">Remaining</span><div class="mono strong">{{ inv.amountRemaining | currency }}</div></div>
          <div><span class="muted">Paid date</span><div>{{ inv.paidDate ? (inv.paidDate | date:'mediumDate') : '—' }}</div></div>
        </div>

        @if (inv.notes) { <div class="card notes"><mat-icon>sticky_note_2</mat-icon> {{ inv.notes }}</div> }

        <div class="card">
          <h3>Payments</h3>
          <table mat-table [dataSource]="inv.payments" class="full">
            <ng-container matColumnDef="paymentDate">
              <th mat-header-cell *matHeaderCellDef>Date</th>
              <td mat-cell *matCellDef="let p">{{ p.paymentDate | date:'medium' }}</td>
            </ng-container>
            <ng-container matColumnDef="method">
              <th mat-header-cell *matHeaderCellDef>Method</th>
              <td mat-cell *matCellDef="let p">{{ p.method }}</td>
            </ng-container>
            <ng-container matColumnDef="referenceNumber">
              <th mat-header-cell *matHeaderCellDef>Reference</th>
              <td mat-cell *matCellDef="let p">{{ p.referenceNumber || '—' }}</td>
            </ng-container>
            <ng-container matColumnDef="recordedBy">
              <th mat-header-cell *matHeaderCellDef>Recorded by</th>
              <td mat-cell *matCellDef="let p">{{ p.recordedBy || '—' }}</td>
            </ng-container>
            <ng-container matColumnDef="amount">
              <th mat-header-cell *matHeaderCellDef class="text-right">Amount</th>
              <td mat-cell *matCellDef="let p" class="text-right mono">{{ p.amount | currency }}</td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="cols"></tr>
            <tr mat-row *matRowDef="let row; columns: cols"></tr>
          </table>
          @if (inv.payments.length === 0) { <div class="empty-state">No payments recorded yet.</div> }
        </div>
      }
    </div>
  `,
  styles: [`
    .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin-bottom: 16px; }
    .meta .muted { font-size: 12px; }
    .strong { font-weight: 600; }
    .notes { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; background: #fffde7; }
    .card { margin-bottom: 16px; }
    h3 { margin: 4px 0 12px; }
  `]
})
export class InvoiceDetailComponent {
  private route = inject(ActivatedRoute);
  private api = inject(InvoiceApi);
  private dialog = inject(MatDialog);
  private notify = inject(Notify);
  auth = inject(AuthService);

  invoice = signal<Invoice | null>(null);
  loading = signal(false);
  cols = ['paymentDate', 'method', 'referenceNumber', 'recordedBy', 'amount'];

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.load(id);
  }

  load(id: number) {
    this.loading.set(true);
    this.api.get(id).subscribe({
      next: (i) => { this.invoice.set(i); this.loading.set(false); },
      error: (e) => { this.loading.set(false); this.notify.error(e); }
    });
  }

  recordPayment(inv: Invoice) {
    this.dialog.open(RecordPaymentDialog, { data: inv, width: '420px' }).afterClosed().subscribe(ok => {
      if (ok) this.load(inv.id);
    });
  }
}
