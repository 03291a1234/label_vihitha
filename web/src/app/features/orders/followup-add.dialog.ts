import { Component, Inject, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { FollowUpApi } from '../../core/services/api.services';
import { Notify } from '../../core/services/notify.service';
import { OrderItem } from '../../core/models';
import { DateInputComponent } from '../../shared/date-input.component';
import { SearchSelectComponent } from '../../shared/search-select.component';

export interface FollowUpAddData { orderId: number; items: OrderItem[]; }

@Component({
  selector: 'app-followup-add',
  standalone: true,
  imports: [DateInputComponent, ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, SearchSelectComponent],
  template: `
    <h2 mat-dialog-title>Add follow-up</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field>
          <mat-label>What needs to happen?</mat-label>
          <textarea matInput rows="3" formControlName="note" placeholder="e.g. Alter blouse hem"></textarea>
        </mat-form-field>
        <app-search-select label="Related item (optional)" [items]="itemOptions" labelField="label"
          formControlName="orderItemId" nullOption nullLabel="— Whole order —" searchPlaceholder="Search items…" />
        <app-date-input label="Follow-up / due date (optional)" formControlName="followUpDate" />
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close(false)">Cancel</button>
      <button mat-raised-button color="primary" (click)="save()" [disabled]="form.invalid || saving()">Add</button>
    </mat-dialog-actions>
  `
})
export class FollowUpAddDialog {
  private fb = inject(FormBuilder);
  private api = inject(FollowUpApi);
  private notify = inject(Notify);
  ref = inject(MatDialogRef<FollowUpAddDialog>);
  saving = signal(false);

  form = this.fb.nonNullable.group({
    note: ['', [Validators.required, Validators.maxLength(1000)]],
    orderItemId: [null as number | null],
    followUpDate: ['']
  });

  itemOptions: { id: number; label: string }[] = [];
  constructor(@Inject(MAT_DIALOG_DATA) public data: FollowUpAddData) {
    this.itemOptions = (data.items ?? []).map(i => ({ id: i.id, label: `${i.sku} — ${i.productName}` }));
  }

  save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    this.api.createForOrder(this.data.orderId, {
      note: v.note,
      orderItemId: v.orderItemId,
      followUpDate: v.followUpDate ? new Date(v.followUpDate).toISOString() : null
    }).subscribe({
      next: () => { this.notify.success('Follow-up added'); this.ref.close(true); },
      error: (e) => { this.saving.set(false); this.notify.error(e); }
    });
  }
}
