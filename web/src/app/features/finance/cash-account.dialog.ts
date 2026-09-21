import { Component, Inject, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { CashApi, OwnerApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { CashAccount, Owner } from '../../core/models';

export interface CashAccountData { account: CashAccount | null; }

@Component({
  selector: 'app-cash-account-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatSlideToggleModule],
  template: `
    <h2 mat-dialog-title>{{ data.account ? 'Edit account' : 'Add cash account' }}</h2>
    <mat-dialog-content>
      <mat-form-field class="full">
        <mat-label>Account name</mat-label>
        <input matInput [(ngModel)]="name" placeholder="e.g. Common India account" />
      </mat-form-field>
      <mat-form-field class="full">
        <mat-label>Type</mat-label>
        <mat-select [(ngModel)]="isCommon">
          <mat-option [value]="true">Common / shared account</mat-option>
          <mat-option [value]="false">An owner's holdings</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field class="full">
        <mat-label>Linked owner {{ isCommon ? '(optional)' : '' }}</mat-label>
        <mat-select [(ngModel)]="ownerId">
          <mat-option [value]="null">— None —</mat-option>
          @for (o of owners(); track o.id) { <mat-option [value]="o.id">{{ o.name }}</mat-option> }
        </mat-select>
      </mat-form-field>
      @if (data.account) {
        <mat-slide-toggle [(ngModel)]="isActive">Active</mat-slide-toggle>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close(false)">Cancel</button>
      <button mat-raised-button color="primary" (click)="save()" [disabled]="!name.trim() || busy()">Save</button>
    </mat-dialog-actions>
  `,
  styles: [`.full { width: 100%; }`]
})
export class CashAccountDialog {
  private api = inject(CashApi);
  private ownerApi = inject(OwnerApi);
  private notify = inject(Notify);
  ref = inject(MatDialogRef<CashAccountDialog>);

  owners = signal<Owner[]>([]);
  name = '';
  isCommon = true;
  ownerId: number | null = null;
  isActive = true;
  busy = signal(false);

  constructor(@Inject(MAT_DIALOG_DATA) public data: CashAccountData) {
    this.ownerApi.list().subscribe(o => this.owners.set(o));
    const a = data.account;
    if (a) { this.name = a.name; this.isCommon = a.isCommon; this.ownerId = a.ownerId ?? null; this.isActive = a.isActive; }
  }

  save() {
    const name = this.name.trim();
    if (!name) return;
    this.busy.set(true);
    const done = {
      next: () => { this.notify.success('Saved'); this.ref.close(true); },
      error: (e: unknown) => { this.busy.set(false); this.notify.error(e); }
    };
    if (this.data.account) {
      this.api.updateAccount(this.data.account.id, { name, isCommon: this.isCommon, ownerId: this.ownerId, isActive: this.isActive, sortOrder: this.data.account.sortOrder }).subscribe(done);
    } else {
      this.api.createAccount({ name, isCommon: this.isCommon, ownerId: this.ownerId }).subscribe(done);
    }
  }
}
