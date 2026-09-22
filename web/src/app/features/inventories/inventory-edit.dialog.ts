import { Component, Inject, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { forkJoin, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { InventoryApi, OwnerApi, VendorApi, apiOrigin } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { Inventory, InventoryBill, Owner, Vendor } from '../../core/models';
import { SearchSelectComponent } from '../../shared/search-select.component';
import { DateInputComponent } from '../../shared/date-input.component';
import { MoneyInputComponent } from '../../shared/money-input.component';
import { AuthService } from '../../core/auth/auth.service';
import { ApplyShippingDialog } from './apply-shipping.dialog';
import { RepriceDialog } from './reprice.dialog';

interface StagedBill { fileUrl: string; fileName: string; amount: number | null; billDate: string; note: string; vendorId: number | null; vendorName: string | null; }

@Component({
  selector: 'app-inventory-edit',
  standalone: true,
  imports: [DateInputComponent, SearchSelectComponent, MoneyInputComponent,
    CurrencyPipe, FormsModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule, MatSlideToggleModule, MatProgressBarModule
  ],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Edit inventory' : 'New inventory' }}</h2>
    <mat-dialog-content>
      @if (busy()) { <mat-progress-bar mode="indeterminate" /> }
      <form [formGroup]="form" class="grid2">
        <mat-form-field>
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" placeholder="e.g. Inventory 2" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>Paid by</mat-label>
          <mat-select formControlName="paidByOwnerId">
            <mat-option [value]="null">— None (jointly funded) —</mat-option>
            @for (o of owners(); track o.id) { <mat-option [value]="o.id">{{ o.name }}</mat-option> }
          </mat-select>
          <mat-hint>Owner whose capital funded this batch (optional)</mat-hint>
        </mat-form-field>
        <mat-form-field class="span2">
          <mat-label>Description</mat-label>
          <textarea matInput rows="2" formControlName="description" placeholder="Batch / collection details"></textarea>
        </mat-form-field>
        @if (data) { <mat-slide-toggle class="span2" formControlName="isActive">Active</mat-slide-toggle> }
      </form>

      <!-- Bills -->
      <div class="bills-panel">
        <h3>Bills <span class="muted">(supplier invoices for this batch)</span></h3>
        @for (b of savedBills(); track b.id) {
          <div class="bill">
            <mat-icon class="fic">{{ b.fileUrl ? (isPdf(b.fileUrl) ? 'picture_as_pdf' : 'image') : 'receipt_long' }}</mat-icon>
            @if (b.fileUrl) {
              <a class="fname" [href]="fileUrl(b.fileUrl)" target="_blank" rel="noopener">{{ b.fileName }}
                @if (b.vendorName) { <span class="vtag">{{ b.vendorName }}</span> }</a>
            } @else {
              <span class="fname">{{ b.vendorName || b.note || 'Bill' }}
                @if (b.vendorName && b.note) { <span class="vtag">{{ b.note }}</span> }</span>
            }
            <span class="amt">{{ b.amount ? (b.amount | currency) : '—' }}</span>
            <button mat-icon-button color="warn" (click)="removeSaved(b)"><mat-icon>delete</mat-icon></button>
          </div>
        }
        @for (b of staged(); track $index) {
          <div class="bill staged">
            <mat-icon class="fic">{{ b.fileUrl ? (isPdf(b.fileUrl) ? 'picture_as_pdf' : 'image') : 'receipt_long' }}</mat-icon>
            <span class="fname">{{ b.fileUrl ? b.fileName : (b.vendorName || b.note || 'Bill') }} <span class="muted">(pending)</span>
              @if (b.fileUrl && b.vendorName) { <span class="vtag">{{ b.vendorName }}</span> }</span>
            <span class="amt">{{ b.amount ? (b.amount | currency) : '—' }}</span>
            <button mat-icon-button color="warn" (click)="removeStaged($index)"><mat-icon>close</mat-icon></button>
          </div>
        }

        <div class="add-bill grid2">
          <button mat-stroked-button type="button" class="filebtn" (click)="fileInput.click()" [disabled]="busy()">
            <mat-icon>upload_file</mat-icon> {{ pendingName() || 'Choose file (optional)' }}
          </button>
          <input #fileInput type="file" hidden accept="image/*,application/pdf" (change)="onFile($event)" />
          <app-search-select label="Vendor" [items]="vendors()" [(ngModel)]="billVendorId" [ngModelOptions]="{standalone:true}"
            nullOption nullLabel="— No vendor —" searchPlaceholder="Search vendors…" />
          <app-money-input label="Amount" [(ngModel)]="billAmount" [ngModelOptions]="{standalone:true}" />
          <app-date-input label="Bill date" [(ngModel)]="billDate" [ngModelOptions]="{standalone:true}" />
          <mat-form-field appearance="outline" class="span2">
            <mat-label>Note (vendor, what it covers…)</mat-label>
            <input matInput [(ngModel)]="billNote" [ngModelOptions]="{standalone:true}" />
          </mat-form-field>
          <div class="span2 add-row">
            <span class="add-hint muted">Attach an invoice or just enter a vendor and amount.</span>
            <button mat-stroked-button type="button" (click)="addBill()" [disabled]="!canAddBill() || busy()">
              <mat-icon>add</mat-icon> Add bill
            </button>
          </div>
        </div>
      </div>

      <!-- Pricing (existing inventory with stock only) -->
      @if (data && auth.canManageInventory()) {
        <div class="pricing-panel">
          <h3>Pricing <span class="muted">(shipping &amp; sale price)</span></h3>
          @if (data.totalUnits > 0) {
            <div class="price-actions">
              <button mat-stroked-button type="button" (click)="openShipping()">
                <mat-icon>local_shipping</mat-icon> Shipping (add / edit / remove)
              </button>
              <button mat-stroked-button type="button" (click)="openReprice()">
                <mat-icon>percent</mat-icon> Re-price only (markup, no shipping)
              </button>
            </div>
            <p class="add-hint muted">Splits shipping across units into product cost, then re-prices sale = cost × markup.</p>
          } @else {
            <p class="add-hint muted">Add products to this inventory first to apply shipping or re-price.</p>
          }
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close(pricingChanged())">Cancel</button>
      <button mat-raised-button color="primary" (click)="save()" [disabled]="form.invalid || busy()">Save</button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content { min-width: min(720px, 92vw); max-height: 78vh; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; align-items: start; }
    .grid2 > * { min-width: 0; }
    .grid2 .span2 { grid-column: 1 / -1; }
    .grid2 mat-slide-toggle { margin: 2px 0 4px; }
    .grid2 app-search-select, .grid2 app-money-input, .grid2 app-date-input { display: block; width: 100%; }
    .grid2 .filebtn { justify-self: start; align-self: center; }
    .add-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 2px; }
    @media (max-width: 560px) { .grid2 { grid-template-columns: 1fr; } .grid2 .span2 { grid-column: auto; } }
    .bills-panel { border-top: 1px solid var(--lv-line); margin-top: 8px; padding-top: 12px; }
    .bills-panel h3 { margin: 0 0 8px; color: var(--lv-wine); font-size: 15px; }
    .bill { display: grid; grid-template-columns: auto 1fr auto auto; align-items: center; gap: 8px;
      padding: 6px 8px; border: 1px solid var(--lv-line); border-radius: 8px; margin-bottom: 6px; background: #fffdfb; }
    .bill.staged { border-style: dashed; }
    .bill .fic { color: var(--lv-wine); }
    .fname { color: var(--lv-wine); font-weight: 600; text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .vtag { background: var(--lv-rose-soft); color: var(--lv-wine); border-radius: 999px; padding: 1px 8px; font-size: 11px; font-weight: 600; margin-left: 6px; }
    a.fname:hover { text-decoration: underline; }
    .amt { font-weight: 700; white-space: nowrap; }
    .add-bill { margin-top: 10px; }
    .add-hint { font-size: 12px; }
    .muted { color: rgba(58,37,48,.6); }
    .pricing-panel { border-top: 1px solid var(--lv-line); margin-top: 12px; padding-top: 12px; }
    .pricing-panel h3 { margin: 0 0 8px; color: var(--lv-wine); font-size: 15px; }
    .price-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  `]
})
export class InventoryEditDialog {
  private fb = inject(FormBuilder);
  private api = inject(InventoryApi);
  private ownerApi = inject(OwnerApi);
  private vendorApi = inject(VendorApi);
  private notify = inject(Notify);
  private dialog = inject(MatDialog);
  auth = inject(AuthService);
  ref = inject(MatDialogRef<InventoryEditDialog>);
  busy = signal(false);
  pricingChanged = signal(false);
  owners = signal<Owner[]>([]);
  vendors = signal<Vendor[]>([]);

  savedBills = signal<InventoryBill[]>([]);
  staged = signal<StagedBill[]>([]);
  pendingUrl = signal<string | null>(null);
  pendingName = signal<string | null>(null);
  billAmount: number | null = null;
  billDate = '';
  billNote = '';
  billVendorId: number | null = null;

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: [''],
    paidByOwnerId: [null as number | null],
    isActive: [true]
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: Inventory | null) {
    this.ownerApi.list(false).subscribe(os => this.owners.set(os));
    this.vendorApi.list(false).subscribe(vs => this.vendors.set(vs));
    if (data) {
      this.form.patchValue({ name: data.name, description: data.description ?? '',
        paidByOwnerId: data.paidByOwnerId ?? null, isActive: data.isActive });
      this.savedBills.set([...(data.bills ?? [])]);
    }
  }

  isPdf(url: string) { return url.toLowerCase().endsWith('.pdf'); }
  fileUrl(url: string) { return url.startsWith('http') ? url : apiOrigin + url; }

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

  /** A bill line is addable once it carries either an attached file or a positive amount. */
  canAddBill() { return !!this.pendingUrl() || (this.billAmount != null && this.billAmount > 0); }

  addBill() {
    if (!this.canAddBill()) return;
    const url = this.pendingUrl();
    const bill: StagedBill = {
      fileUrl: url ?? '', fileName: url ? (this.pendingName() ?? 'bill') : '',
      amount: this.billAmount != null && this.billAmount > 0 ? this.billAmount : null,
      billDate: this.billDate || '', note: this.billNote.trim(),
      vendorId: this.billVendorId ?? null,
      vendorName: this.vendors().find(v => v.id === this.billVendorId)?.name ?? null
    };
    if (this.data) {
      // Existing inventory — attach immediately.
      this.busy.set(true);
      this.api.addBill(this.data.id, { fileUrl: bill.fileUrl, fileName: bill.fileName, amount: bill.amount, billDate: bill.billDate || null, note: bill.note || null, vendorId: bill.vendorId })
        .subscribe({
          next: (b) => { this.savedBills.update(l => [b, ...l]); this.clearPending(); this.busy.set(false); this.notify.success('Bill attached'); },
          error: (e) => { this.busy.set(false); this.notify.error(e); }
        });
    } else {
      // New inventory — stage until the inventory is created.
      this.staged.update(l => [bill, ...l]);
      this.clearPending();
    }
  }

  private clearPending() {
    this.pendingUrl.set(null); this.pendingName.set(null);
    this.billAmount = null; this.billDate = ''; this.billNote = ''; this.billVendorId = null;
  }

  removeSaved(b: InventoryBill) {
    if (!this.data) return;
    this.busy.set(true);
    this.api.removeBill(this.data.id, b.id).subscribe({
      next: () => { this.savedBills.update(l => l.filter(x => x.id !== b.id)); this.busy.set(false); },
      error: (e) => { this.busy.set(false); this.notify.error(e); }
    });
  }
  removeStaged(i: number) { this.staged.update(l => l.filter((_, idx) => idx !== i)); }

  openShipping() {
    if (!this.data) return;
    const i = this.data;
    this.dialog.open(ApplyShippingDialog, {
      data: {
        inventoryId: i.id, inventoryName: i.name, totalUnits: i.totalUnits,
        categories: i.categories.map(c => ({ id: c.categoryId, name: c.categoryName, units: c.totalUnits }))
      }, width: '480px'
    }).afterClosed().subscribe(applied => { if (applied) this.pricingChanged.set(true); });
  }

  openReprice() {
    if (!this.data) return;
    this.dialog.open(RepriceDialog, {
      data: { inventoryId: this.data.id, inventoryName: this.data.name }, width: '440px'
    }).afterClosed().subscribe(done => { if (done) this.pricingChanged.set(true); });
  }

  save() {
    if (this.form.invalid) return;
    this.busy.set(true);
    const v = this.form.getRawValue();
    if (this.data) {
      this.api.update(this.data.id, { name: v.name, description: v.description || null, isActive: v.isActive, paidByOwnerId: v.paidByOwnerId }).subscribe({
        next: () => { this.notify.success('Inventory saved'); this.ref.close(true); },
        error: (e) => { this.busy.set(false); this.notify.error(e); }
      });
    } else {
      // Create the inventory, then attach any staged bills.
      this.api.create({ name: v.name, description: v.description || null, paidByOwnerId: v.paidByOwnerId }).pipe(
        switchMap(inv => {
          const pend = this.staged();
          if (pend.length === 0) return of(inv);
          return forkJoin(pend.map(b => this.api.addBill(inv.id, {
            fileUrl: b.fileUrl, fileName: b.fileName, amount: b.amount, billDate: b.billDate || null, note: b.note || null, vendorId: b.vendorId
          })));
        })
      ).subscribe({
        next: () => { this.notify.success('Inventory saved'); this.ref.close(true); },
        error: (e) => { this.busy.set(false); this.notify.error(e); }
      });
    }
  }
}
