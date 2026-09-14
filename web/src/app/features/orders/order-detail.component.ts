import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { OrderApi, InvoiceApi, FollowUpApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { AuthService } from '../../core/auth/auth.service';
import { Order, OrderStatus, FollowUp } from '../../core/models';
import { ConfirmDialog } from '../../shared/confirm.dialog';
import { FollowUpAddDialog } from './followup-add.dialog';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [
    CurrencyPipe, DatePipe, FormsModule, RouterLink, MatCardModule, MatTableModule,
    MatButtonModule, MatIconModule, MatProgressBarModule, MatDividerModule
  ],
  template: `
    <div class="page">
      @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
      @if (order(); as o) {
        <div class="page-header">
          <h1>
            <button mat-icon-button routerLink="/orders"><mat-icon>arrow_back</mat-icon></button>
            {{ o.orderNumber }} <span class="chip {{o.status}}">{{ o.status }}</span>
          </h1>
          <div class="toolbar-row">
            @if (auth.canManage()) {
              @if (o.status === 'Pending') {
                <button mat-raised-button color="primary" (click)="setStatus('Confirmed')">Confirm</button>
                <button mat-stroked-button (click)="setStatus('Cancelled')">Cancel order</button>
              }
              @if (o.status === 'Confirmed') {
                <button mat-raised-button color="primary" (click)="setStatus('Fulfilled')">Mark fulfilled</button>
                <button mat-stroked-button (click)="setStatus('Cancelled')">Cancel order</button>
              }
              @if (!o.hasInvoice && (o.status === 'Confirmed' || o.status === 'Fulfilled')) {
                <button mat-raised-button color="accent" (click)="generateInvoice()">
                  <mat-icon>receipt</mat-icon> Generate invoice
                </button>
              }
            }
            @if (o.hasInvoice) {
              <button mat-raised-button [routerLink]="['/invoices', o.invoiceId]"><mat-icon>payments</mat-icon> View invoice</button>
            }
          </div>
        </div>

        <div class="meta card">
          <div><span class="muted">Customer</span><div>{{ o.customerName }}</div></div>
          <div><span class="muted">Order date</span><div>{{ o.orderDate | date:'medium' }}</div></div>
          <div><span class="muted">Created by</span><div>{{ o.createdBy || '—' }}</div></div>
          <div><span class="muted">Grand total</span><div class="mono strong">{{ o.grandTotal | currency }}</div></div>
        </div>

        @if (o.notes) { <div class="card notes"><mat-icon>sticky_note_2</mat-icon> {{ o.notes }}</div> }

        <div class="card">
          <div class="page-header" style="margin-bottom:8px;">
            <h3 style="margin:0;">Line items</h3>
            @if (editable(o) && auth.canManage()) {
              <span class="muted">Editable while Pending</span>
            }
          </div>
          <table mat-table [dataSource]="o.items" class="full">
            <ng-container matColumnDef="product">
              <th mat-header-cell *matHeaderCellDef>Product</th>
              <td mat-cell *matCellDef="let i"><strong>{{ i.sku }}</strong> {{ i.productName }}</td>
            </ng-container>
            <ng-container matColumnDef="quantity">
              <th mat-header-cell *matHeaderCellDef class="text-right">Qty</th>
              <td mat-cell *matCellDef="let i" class="text-right">
                @if (editable(o)) {
                  <input class="inline-num" type="number" min="1" [(ngModel)]="edit[i.id].quantity" />
                } @else { <span class="mono">{{ i.quantity }}</span> }
              </td>
            </ng-container>
            <ng-container matColumnDef="salePriceAtSale">
              <th mat-header-cell *matHeaderCellDef class="text-right">List</th>
              <td mat-cell *matCellDef="let i" class="text-right mono">{{ i.salePriceAtSale | currency }}</td>
            </ng-container>
            <ng-container matColumnDef="finalPriceAtSale">
              <th mat-header-cell *matHeaderCellDef class="text-right">Final / unit</th>
              <td mat-cell *matCellDef="let i" class="text-right">
                @if (editable(o)) {
                  <input class="inline-num" type="number" min="0" [(ngModel)]="edit[i.id].finalPrice" />
                } @else { <span class="mono">{{ i.finalPriceAtSale | currency }}</span> }
              </td>
            </ng-container>
            <ng-container matColumnDef="discountAmount">
              <th mat-header-cell *matHeaderCellDef class="text-right">Disc/unit</th>
              <td mat-cell *matCellDef="let i" class="text-right mono">{{ i.discountAmount | currency }}</td>
            </ng-container>
            <ng-container matColumnDef="lineTotal">
              <th mat-header-cell *matHeaderCellDef class="text-right">Line total</th>
              <td mat-cell *matCellDef="let i" class="text-right mono">{{ i.lineTotal | currency }}</td>
            </ng-container>
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let i" class="text-right">
                @if (editable(o) && auth.canManage()) {
                  <button mat-icon-button color="primary" title="Save line" (click)="saveItem(o, i.id)"><mat-icon>save</mat-icon></button>
                  <button mat-icon-button color="warn" title="Remove line" (click)="removeItem(o, i.id)"><mat-icon>delete</mat-icon></button>
                }
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="itemCols"></tr>
            <tr mat-row *matRowDef="let row; columns: itemCols"></tr>
          </table>

          <div class="totals">
            <div><span class="muted">Subtotal (list)</span> <span class="mono">{{ o.subTotal | currency }}</span></div>
            <div><span class="muted">Discount</span> <span class="mono">−{{ o.discountTotal | currency }}</span></div>
            <div class="grand"><span>Grand total</span> <span class="mono">{{ o.grandTotal | currency }}</span></div>
          </div>
        </div>

        <!-- Follow-ups -->
        <div class="card">
          <div class="page-header" style="margin-bottom:8px;">
            <h3 style="margin:0;">Follow-ups</h3>
            @if (auth.canManage()) {
              <button mat-stroked-button (click)="addFollowUp(o)"><mat-icon>add_task</mat-icon> Add follow-up</button>
            }
          </div>
          @if (followUps().length === 0) { <div class="muted">No follow-ups.</div> }
          @for (f of followUps(); track f.id) {
            <div class="followup" [class.done]="f.status === 'Resolved'">
              <div class="fu-main">
                <span class="chip {{f.status}}">{{ f.status }}</span>
                @if (f.isOverdue) { <span class="overdue">OVERDUE</span> }
                <strong>{{ f.note }}</strong>
                <div class="muted">
                  {{ f.productName ? f.productName + ' · ' : '' }}
                  @if (f.followUpDate) { due {{ f.followUpDate | date:'mediumDate' }} · }
                  by {{ f.createdBy || '—' }}
                  @if (f.resolutionNote) { · resolved: {{ f.resolutionNote }} }
                </div>
              </div>
              @if (auth.canManage() && f.status !== 'Resolved') {
                <button mat-button color="primary" (click)="resolve(f)">Resolve</button>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 16px; }
    .meta .muted { font-size: 12px; }
    .strong { font-weight: 600; }
    .notes { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; background: #fffde7; }
    .card { margin-bottom: 16px; }
    .inline-num { width: 84px; text-align: right; border: 1px solid #ddd; border-radius: 6px; padding: 6px; font: inherit; }
    .totals { margin-top: 16px; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
    .totals > div { display: flex; gap: 24px; min-width: 260px; justify-content: space-between; }
    .totals .grand { font-size: 18px; font-weight: 600; border-top: 1px solid #eee; padding-top: 8px; margin-top: 4px; }
    .followup { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
    .followup.done { opacity: .6; }
    .fu-main { display: flex; flex-direction: column; gap: 2px; }
  `]
})
export class OrderDetailComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(OrderApi);
  private invoiceApi = inject(InvoiceApi);
  private followUpApi = inject(FollowUpApi);
  private dialog = inject(MatDialog);
  private notify = inject(Notify);
  auth = inject(AuthService);

  order = signal<Order | null>(null);
  followUps = signal<FollowUp[]>([]);
  loading = signal(false);
  edit: Record<number, { quantity: number; finalPrice: number }> = {};

  itemCols = ['product', 'quantity', 'salePriceAtSale', 'finalPriceAtSale', 'discountAmount', 'lineTotal', 'actions'];

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.load(id);
  }

  editable(o: Order) { return o.status === 'Pending'; }

  load(id: number) {
    this.loading.set(true);
    this.api.get(id).subscribe({
      next: (o) => {
        this.order.set(o);
        this.edit = {};
        for (const i of o.items) this.edit[i.id] = { quantity: i.quantity, finalPrice: i.finalPriceAtSale };
        this.loading.set(false);
        this.loadFollowUps(id);
      },
      error: (e) => { this.loading.set(false); this.notify.error(e); }
    });
  }

  loadFollowUps(orderId: number) {
    this.followUpApi.listForOrder(orderId).subscribe({ next: (f) => this.followUps.set(f) });
  }

  setStatus(status: OrderStatus) {
    const o = this.order();
    if (!o) return;
    const confirmCancel = status === 'Cancelled';
    const run = () => this.api.setStatus(o.id, status).subscribe({
      next: (u) => { this.order.set(u); this.notify.success(`Order ${status}`); },
      error: (e) => this.notify.error(e)
    });
    if (confirmCancel) {
      this.dialog.open(ConfirmDialog, {
        data: { title: 'Cancel order', message: 'Cancelling returns items to stock. Continue?', confirmText: 'Cancel order', danger: true }
      }).afterClosed().subscribe(ok => { if (ok) run(); });
    } else { run(); }
  }

  saveItem(o: Order, itemId: number) {
    const e = this.edit[itemId];
    this.api.updateItem(o.id, itemId, { quantity: e.quantity, finalPrice: e.finalPrice }).subscribe({
      next: (u) => { this.order.set(u); this.syncEdit(u); this.notify.success('Line updated'); },
      error: (err) => this.notify.error(err)
    });
  }

  removeItem(o: Order, itemId: number) {
    this.api.removeItem(o.id, itemId).subscribe({
      next: (u) => { this.order.set(u); this.syncEdit(u); this.notify.success('Line removed'); },
      error: (err) => this.notify.error(err)
    });
  }

  private syncEdit(o: Order) {
    this.edit = {};
    for (const i of o.items) this.edit[i.id] = { quantity: i.quantity, finalPrice: i.finalPriceAtSale };
  }

  generateInvoice() {
    const o = this.order();
    if (!o) return;
    // Default to Zelle; details editable on the invoice screen.
    this.invoiceApi.create({ orderId: o.id, paymentMethod: 'Zelle' }).subscribe({
      next: (inv) => { this.notify.success(`Invoice ${inv.invoiceNumber} created`); this.router.navigate(['/invoices', inv.id]); },
      error: (e) => this.notify.error(e)
    });
  }

  addFollowUp(o: Order) {
    this.dialog.open(FollowUpAddDialog, { data: { orderId: o.id, items: o.items }, width: '480px' })
      .afterClosed().subscribe(ok => { if (ok) this.loadFollowUps(o.id); });
  }

  resolve(f: FollowUp) {
    this.followUpApi.update(f.id, { status: 'Resolved', resolutionNote: 'Resolved' }).subscribe({
      next: () => { this.notify.success('Follow-up resolved'); this.loadFollowUps(f.orderId); },
      error: (e) => this.notify.error(e)
    });
  }
}
