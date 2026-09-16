import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ProductImportResult } from '../../core/models';

@Component({
  selector: 'app-import-result',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Import complete</h2>
    <mat-dialog-content>
      <div class="summary">
        <div class="stat"><span class="n">{{ data.productsCreated }}</span><span class="l">products</span></div>
        <div class="stat"><span class="n">{{ data.variantsCreated }}</span><span class="l">size lines</span></div>
        <div class="stat"><span class="n">{{ data.rowsProcessed }}</span><span class="l">rows read</span></div>
      </div>

      @if (created().length) {
        <div class="block">
          <div class="muted">Newly created:</div>
          @for (c of created(); track c) { <span class="chip">{{ c }}</span> }
        </div>
      }

      @if (data.errors.length) {
        <div class="block errors">
          <div class="muted"><mat-icon>warning</mat-icon> {{ data.errors.length }} row(s) skipped:</div>
          <ul>@for (e of data.errors; track e) { <li>{{ e }}</li> }</ul>
        </div>
      } @else {
        <div class="ok"><mat-icon>check_circle</mat-icon> No errors.</div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-raised-button color="primary" (click)="ref.close()">Done</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .summary { display: flex; gap: 22px; margin-bottom: 12px; }
    .stat { display: flex; flex-direction: column; }
    .stat .n { font-size: 26px; font-weight: 800; color: var(--lv-wine); }
    .stat .l { font-size: 12px; color: #666; }
    .block { margin-top: 10px; }
    .chip { display: inline-block; background: var(--lv-rose-soft, #f7ebf0); color: var(--lv-wine);
      border-radius: 999px; padding: 2px 10px; font-size: 12px; font-weight: 600; margin: 3px 4px 0 0; }
    .errors ul { margin: 6px 0 0; padding-left: 18px; font-size: 13px; color: #8a3324; max-height: 220px; overflow: auto; }
    .errors .muted, .ok { display: flex; align-items: center; gap: 6px; }
    .ok { color: #1e7d3a; margin-top: 10px; }
    mat-icon { font-size: 18px; height: 18px; width: 18px; }
  `]
})
export class ImportResultDialog {
  constructor(@Inject(MAT_DIALOG_DATA) public data: ProductImportResult,
              public ref: MatDialogRef<ImportResultDialog>) {}

  created(): string[] {
    return [
      ...this.data.createdCategories.map(x => 'Category: ' + x),
      ...this.data.createdSubCategories.map(x => 'Sub: ' + x),
      ...this.data.createdInventories.map(x => 'Inventory: ' + x),
      ...this.data.createdVendors.map(x => 'Vendor: ' + x),
    ];
  }
}
