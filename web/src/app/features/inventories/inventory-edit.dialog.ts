import { Component, Inject, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { forkJoin, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { InventoryApi, OwnerApi, apiOrigin } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { Inventory, InventoryBill, Owner } from '../../core/models';

interface StagedBill { fileUrl: string; fileName: string; amount: number | null; billDate: string; note: string; }

@Component({
  selector: 'app-inventory-edit',
  standalone: true,
  imports: [
    CurrencyPipe, FormsModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule, MatSlideToggleModule, MatProgressBarModule
  ],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Edit inventory' : 'New inventory' }}</h2>
    <mat-dialog-content>
      @if (busy()) { <mat-progress-bar mode="indeterminate" /> }
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field>
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" placeholder="e.g. Inventory 2" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>Description</mat-label>
          <textarea matInput rows="2" formControlName="description" placeholder="Batch / collection details"></textarea>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Paid by</mat-label>
          <mat-select formControlName="paidByOwnerId">
            <mat-option [value]="null">— None (jointly funded) —</mat-option>
            @for (o of owners(); track o.id) { <mat-option [value]="o.id">{{ o.name }}</mat-option> }
          </mat-select>
          <mat-hint>Owner whose capital funded this whole batch (optional)</mat-hint>
        </mat-form-field>
        @if (data) { <mat-slide-toggle formControlName="isActive">Active</mat-slide-toggle> }
      </form>

      <!-- Bills -->
      <div class="bills-panel">
        <h3>Bills <span class="muted">(supplier invoices for this batch)</span></h3>
        @for (b of savedBills(); track b.id) {
          <div class="bill">
            <mat-icon class="fic">{{ isPdf(b.fileUrl) ? 'picture_as_pdf' : 'image' }}</mat-icon>
            <a class="fname" [href]="fileUrl(b.fileUrl)" target="_blank" rel="noopener">{{ b.fileName }}</a>
            <span class="amt">{{ b.amount ? (b.amount | currency) : '—' }}</span>
            <button mat-icon-button color="warn" (click)="removeSaved(b)"><mat-icon>delete</mat-icon></button>
          </div>
        }
        @for (b of staged(); track $index) {
          <div class="bill staged">
            <mat-icon class="fic">{{ isPdf(b.fileUrl) ? 'picture_as_pdf' : 'image' }}</mat-icon>
            <span class="fname">{{ b.fileName }} <span class="muted">(pending)</span></span>
            <span class="amt">{{ b.amount ? (b.amount | currency) : '—' }}</span>
            <button mat-icon-button color="warn" (click)="removeStaged($index)"><mat-icon>close</mat-icon></button>
          </div>
        }

        <div class="add-bill">
          <button mat-stroked-button type="button" (click)="fileInput.click()" [disabled]="busy()">
            <mat-icon>upload_file</mat-icon> {{ pendingName() || 'Choose file (image / PDF)' }}
          </button>
          <input #fileInput type="file" hidden accept="image/*,application/pdf" (change)="onFile($event)" />
          <div class="bfields">
            <mat-form-field appearance="outline" class="famt">
              <mat-label>Amount (USD)</mat-label>
              <input matInput type="number" min="0" step="0.01" [(ngModel)]="billAmount" [ngModelOptions]="{standalone:true}" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="fdate">
              <mat-label>Bill date</mat-label>
              <input matInput type="date" [(ngModel)]="billDate" [ngModelOptions]="{standalone:true}" />
            </mat-form-field>
          </div>
          <mat-form-field appearance="outline" class="fnote">
            <mat-label>Note (vendor, what it covers…)</mat-label>
            <input matInput [(ngModel)]="billNote" [ngModelOptions]="{standalone:true}" />
          </mat-form-field>
          <button mat-stroked-button type="button" (click)="addBill()" [disabled]="!pendingUrl() || busy()">
            <mat-icon>add</mat-icon> Add bill
          </button>
        </div>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close(false)">Cancel</button>
      <button mat-raised-button color="primary" (click)="save()" [disabled]="form.invalid || busy()">Save</button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content { min-width: 460px; }
    .bills-panel { border-top: 1px solid var(--lv-line); margin-top: 8px; padding-top: 12px; }
    .bills-panel h3 { margin: 0 0 8px; color: var(--lv-wine); font-size: 15px; }
    .bill { display: grid; grid-template-columns: auto 1fr auto auto; align-items: center; gap: 8px;
      padding: 6px 8px; border: 1px solid var(--lv-line); border-radius: 8px; margin-bottom: 6px; background: #fffdfb; }
    .bill.staged { border-style: dashed; }
    .bill .fic { color: var(--lv-wine); }
    .fname { color: var(--lv-wine); font-weight: 600; text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    a.fname:hover { text-decoration: underline; }
    .amt { font-weight: 700; white-space: nowrap; }
    .add-bill { margin-top: 8px; }
    .bfields { display: flex; gap: 10px; margin-top: 8px; }
    .famt, .fdate { flex: 1; }
    .fnote { width: 100%; }
    .muted { color: rgba(58,37,48,.6); }
  `]
})
export class InventoryEditDialog {
  private fb = inject(FormBuilder);
  private api = inject(InventoryApi);
  private ownerApi = inject(OwnerApi);
  private notify = inject(Notify);
  ref = inject(MatDialogRef<InventoryEditDialog>);
  busy = signal(false);
  owners = signal<Owner[]>([]);

  savedBills = signal<InventoryBill[]>([]);
  staged = signal<StagedBill[]>([]);
  pendingUrl = signal<string | null>(null);
  pendingName = signal<string | null>(null);
  billAmount: number | null = null;
  billDate = '';
  billNote = '';

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: [''],
    paidByOwnerId: [null as number | null],
    isActive: [true]
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: Inventory | null) {
    this.ownerApi.list(false).subscribe(os => this.owners.set(os));
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

  addBill() {
    const url = this.pendingUrl();
    if (!url) return;
    const bill: StagedBill = {
      fileUrl: url, fileName: this.pendingName() ?? 'bill',
      amount: this.billAmount != null && this.billAmount > 0 ? this.billAmount : null,
      billDate: this.billDate || '', note: this.billNote.trim()
    };
    if (this.data) {
      // Existing inventory — attach immediately.
      this.busy.set(true);
      this.api.addBill(this.data.id, { fileUrl: bill.fileUrl, fileName: bill.fileName, amount: bill.amount, billDate: bill.billDate || null, note: bill.note || null })
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
    this.billAmount = null; this.billDate = ''; this.billNote = '';
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
            fileUrl: b.fileUrl, fileName: b.fileName, amount: b.amount, billDate: b.billDate || null, note: b.note || null
          })));
        })
      ).subscribe({
        next: () => { this.notify.success('Inventory saved'); this.ref.close(true); },
        error: (e) => { this.busy.set(false); this.notify.error(e); }
      });
    }
  }
}
