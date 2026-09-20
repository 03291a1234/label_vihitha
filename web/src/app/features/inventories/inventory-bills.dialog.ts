import { Component, Inject, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { InventoryApi, VendorApi, apiOrigin } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { Inventory, InventoryBill, Vendor } from '../../core/models';
import { DateInputComponent } from '../../shared/date-input.component';
import { SearchSelectComponent } from '../../shared/search-select.component';
import { BillProductsDialog } from './bill-products.dialog';

@Component({
  selector: 'app-inventory-bills',
  standalone: true,
  imports: [DateInputComponent, SearchSelectComponent,
    CurrencyPipe, DatePipe, FormsModule, MatDialogModule, MatFormFieldModule,
    MatInputModule, MatButtonModule, MatIconModule, MatProgressBarModule
  ],
  template: `
    <h2 mat-dialog-title>Bills — {{ data.name }}</h2>
    <mat-dialog-content>
      @if (busy()) { <mat-progress-bar mode="indeterminate" /> }

      @if (bills().length > 0) {
        @for (g of grouped(); track g.key) {
          <div class="vgroup">
            <div class="vhead">
              <span class="vname"><mat-icon>store</mat-icon> {{ g.vendorName }}</span>
              <span class="vsub">{{ g.bills.length }} bill{{ g.bills.length === 1 ? '' : 's' }} ·
                <strong>{{ g.subtotal | currency:'USD':'symbol':'1.0-2' }}</strong></span>
            </div>
            @for (b of g.bills; track b.id) {
              <div class="bill">
                <mat-icon class="file-ic">{{ isPdf(b.fileUrl) ? 'picture_as_pdf' : 'image' }}</mat-icon>
                <a class="fname" [href]="fileUrl(b.fileUrl)" target="_blank" rel="noopener">{{ b.fileName }}</a>
                <span class="amt">
                  @if (b.amount) {
                    {{ b.amount | currency:'USD':'symbol':'1.0-2' }}
                    <span class="inr">≈ {{ b.amount * 95 | currency:'INR':'symbol':'1.0-0' }}</span>
                  } @else { <span class="muted">—</span> }
                </span>
                <span class="bdate muted">{{ b.billDate ? (b.billDate | date:'mediumDate') : '' }}</span>
                <button mat-stroked-button class="extract-btn" (click)="addProducts(b)" title="Create products from this bill">
                  <mat-icon>playlist_add</mat-icon> Products
                </button>
                <button mat-icon-button color="warn" (click)="remove(b)" title="Delete bill"><mat-icon>delete</mat-icon></button>
                @if (b.note) { <div class="note muted">{{ b.note }}</div> }
              </div>
            }
          </div>
        }
        <div class="total">Total recorded: <strong>{{ total() | currency:'USD':'symbol':'1.0-2' }}</strong>
          <span class="inr">≈ {{ total() * 95 | currency:'INR':'symbol':'1.0-0' }}</span></div>
      } @else {
        <p class="muted">No bills attached yet. Add the supplier invoice(s) for this batch below — one per vendor.</p>
      }

      <div class="add">
        <h3>Attach a bill</h3>
        <div class="add-row">
          <button mat-stroked-button (click)="fileInput.click()" [disabled]="busy()">
            <mat-icon>upload_file</mat-icon> {{ pendingName() || 'Choose file (image / PDF)' }}
          </button>
          <input #fileInput type="file" hidden accept="image/*,application/pdf" (change)="onFile($event)" />
        </div>
        <app-search-select label="Vendor" [items]="vendors()" [(ngModel)]="vendorId"
          nullOption nullLabel="— No vendor —" searchPlaceholder="Search vendors…" />
        <div class="fields">
          <mat-form-field appearance="outline">
            <mat-label>Amount (USD)</mat-label>
            <input matInput type="number" min="0" step="0.01" [(ngModel)]="amount" />
          </mat-form-field>
          <app-date-input class="fdate" label="Bill date" [(ngModel)]="billDate" [ngModelOptions]="{standalone:true}" />
        </div>
        <mat-form-field appearance="outline" class="full">
          <mat-label>Note (what it covers…)</mat-label>
          <input matInput [(ngModel)]="note" />
        </mat-form-field>
        <button mat-raised-button color="primary" (click)="save()" [disabled]="!pendingUrl() || busy()">
          <mat-icon>add</mat-icon> Add bill
        </button>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close(changed)">Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content { min-width: 480px; }
    .vgroup { margin: 10px 0; }
    .vhead { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-bottom: 6px;
      padding-bottom: 4px; border-bottom: 1px solid var(--lv-line); }
    .vhead .vname { display: inline-flex; align-items: center; gap: 5px; font-weight: 700; color: var(--lv-wine); }
    .vhead .vname mat-icon { font-size: 17px; height: 17px; width: 17px; }
    .vhead .vsub { font-size: 12px; color: rgba(58,37,48,.6); }
    .bills { display: flex; flex-direction: column; gap: 8px; margin: 8px 0; }
    .vgroup .bill { margin-bottom: 6px; }
    .bill { display: grid; grid-template-columns: auto 1fr auto auto auto auto; align-items: center; gap: 10px;
      padding: 8px 10px; border: 1px solid var(--lv-line); border-radius: 8px; background: #fffdfb; }
    .extract-btn { white-space: nowrap; }
    .bill .file-ic { color: var(--lv-wine); }
    .fname { color: var(--lv-wine); font-weight: 600; text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .fname:hover { text-decoration: underline; }
    .amt { font-weight: 700; white-space: nowrap; text-align: right; }
    .amt .inr { display: block; font-size: 11px; font-weight: 400; color: rgba(58,37,48,.55); }
    .bdate { font-size: 12px; white-space: nowrap; }
    .note { grid-column: 1 / -1; font-size: 12px; margin-top: -2px; }
    .total { text-align: right; margin: 6px 2px 4px; }
    .total .inr { color: rgba(58,37,48,.55); margin-left: 6px; font-size: 12px; }
    .add { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--lv-line); }
    .add h3 { margin: 0 0 10px; color: var(--lv-wine); font-size: 15px; }
    .add-row { margin-bottom: 10px; }
    .fields { display: flex; gap: 12px; }
    .fields mat-form-field, .fields app-date-input { flex: 1; }
    .full { width: 100%; }
    .muted { color: rgba(58,37,48,.6); }
  `]
})
export class InventoryBillsDialog {
  private api = inject(InventoryApi);
  private notify = inject(Notify);
  ref = inject(MatDialogRef<InventoryBillsDialog>);

  private vendorApi = inject(VendorApi);
  bills = signal<InventoryBill[]>([]);
  vendors = signal<Vendor[]>([]);
  busy = signal(false);
  changed = false;

  pendingUrl = signal<string | null>(null);
  pendingName = signal<string | null>(null);
  vendorId: number | null = null;
  amount: number | null = null;
  billDate = '';
  note = '';

  constructor(@Inject(MAT_DIALOG_DATA) public data: Inventory) {
    this.bills.set([...(data.bills ?? [])]);
    this.vendorApi.list(false).subscribe(vs => this.vendors.set(vs));
  }

  private dialog = inject(MatDialog);

  total() { return this.bills().reduce((s, b) => s + (b.amount ?? 0), 0); }

  /** Bills grouped by vendor, with a per-vendor subtotal. */
  grouped() {
    const map = new Map<string, { key: string; vendorName: string; bills: InventoryBill[]; subtotal: number }>();
    for (const b of this.bills()) {
      const key = b.vendorId != null ? 'v' + b.vendorId : 'none';
      let g = map.get(key);
      if (!g) { g = { key, vendorName: b.vendorName ?? 'No vendor', bills: [], subtotal: 0 }; map.set(key, g); }
      g.bills.push(b); g.subtotal += b.amount ?? 0;
    }
    return [...map.values()].sort((a, b) => a.vendorName.localeCompare(b.vendorName));
  }
  isPdf(url: string) { return url.toLowerCase().endsWith('.pdf'); }
  fileUrl(url: string) { return url.startsWith('http') ? url : apiOrigin + url; }

  addProducts(bill: InventoryBill) {
    this.dialog.open(BillProductsDialog, {
      data: { inventoryId: this.data.id, inventoryName: this.data.name, bill },
      width: '860px', maxWidth: '95vw'
    }).afterClosed().subscribe(created => { if (created) this.changed = true; });
  }

  onFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.busy.set(true);
    this.api.uploadBill(file).subscribe({
      next: (r) => { this.pendingUrl.set(r.url); this.pendingName.set(r.fileName); this.busy.set(false); },
      error: (e) => { this.busy.set(false); this.notify.error(e); }
    });
    input.value = '';
  }

  save() {
    const url = this.pendingUrl();
    if (!url) return;
    this.busy.set(true);
    this.api.addBill(this.data.id, {
      fileUrl: url,
      fileName: this.pendingName() ?? 'bill',
      amount: this.amount != null && this.amount > 0 ? this.amount : null,
      billDate: this.billDate || null,
      note: this.note.trim() || null,
      vendorId: this.vendorId ?? null
    }).subscribe({
      next: (b) => {
        this.bills.update(list => [b, ...list]);
        this.changed = true;
        this.pendingUrl.set(null); this.pendingName.set(null);
        this.amount = null; this.billDate = ''; this.note = ''; this.vendorId = null;
        this.busy.set(false);
        this.notify.success('Bill attached');
      },
      error: (e) => { this.busy.set(false); this.notify.error(e); }
    });
  }

  remove(b: InventoryBill) {
    this.busy.set(true);
    this.api.removeBill(this.data.id, b.id).subscribe({
      next: () => { this.bills.update(list => list.filter(x => x.id !== b.id)); this.changed = true; this.busy.set(false); },
      error: (e) => { this.busy.set(false); this.notify.error(e); }
    });
  }
}
