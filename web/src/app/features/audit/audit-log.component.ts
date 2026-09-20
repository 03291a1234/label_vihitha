import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { environment } from '../../../environments/environment';
import { SearchSelectComponent } from '../../shared/search-select.component';
import { DateInputComponent } from '../../shared/date-input.component';

const base = environment.apiUrl;

interface AuditEntry {
  id: number; entityName: string; entityId: string; action: string;
  changedBy: string | null; changedAt: string; oldValues: string | null; newValues: string | null;
}
interface AuditPage { items: AuditEntry[]; total: number; page: number; pageSize: number; }
interface Change { field: string; from: unknown; to: unknown; }

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [DatePipe, FormsModule, MatButtonModule, MatIconModule, MatProgressBarModule,
    SearchSelectComponent, DateInputComponent],
  template: `
    <div class="page">
      <div class="page-header"><h1>Audit log</h1></div>

      <div class="card filters">
        <app-search-select class="f" label="Entity" [items]="entityOptions()" [(ngModel)]="entity" (ngModelChange)="reload()"
          nullOption nullLabel="— All —" />
        <app-search-select class="f" label="Action" [items]="actionOptions" [(ngModel)]="action" (ngModelChange)="reload()"
          nullOption nullLabel="— All —" />
        <app-date-input class="f" label="From" [(ngModel)]="from" (ngModelChange)="reload()" />
        <app-date-input class="f" label="To" [(ngModel)]="to" (ngModelChange)="reload()" />
        <span class="spacer"></span>
        <span class="muted">{{ total() }} change(s)</span>
      </div>

      @if (loading()) { <mat-progress-bar mode="indeterminate" /> }

      <div class="card list">
        @if (!loading() && rows().length === 0) { <div class="empty-state">No changes recorded for this filter.</div> }
        @for (r of rows(); track r.id) {
          <div class="row">
            <div class="meta">
              <span class="chip" [class]="r.action">{{ r.action }}</span>
              <strong>{{ r.entityName }}</strong> <span class="muted">#{{ r.entityId }}</span>
            </div>
            <div class="who muted">{{ r.changedAt | date:'MMM d, y, h:mm a' }} · {{ r.changedBy || 'system' }}</div>
            <div class="changes">
              @for (c of changesFor(r); track c.field) {
                <span class="change">
                  <span class="fld">{{ c.field }}</span>
                  @if (r.action === 'Update') { <span class="old">{{ fmt(c.from) }}</span> <mat-icon>arrow_forward</mat-icon> <span class="new">{{ fmt(c.to) }}</span> }
                  @else if (r.action === 'Create') { <span class="new">{{ fmt(c.to) }}</span> }
                  @else { <span class="old">{{ fmt(c.from) }}</span> }
                </span>
              }
              @if (changesFor(r).length === 0) { <span class="muted">(no field detail)</span> }
            </div>
          </div>
        }
      </div>

      @if (total() > pageSize) {
        <div class="pager">
          <button mat-stroked-button [disabled]="page() <= 1" (click)="go(page() - 1)"><mat-icon>chevron_left</mat-icon></button>
          <span class="muted">Page {{ page() }} of {{ pageCount() }}</span>
          <button mat-stroked-button [disabled]="page() >= pageCount()" (click)="go(page() + 1)"><mat-icon>chevron_right</mat-icon></button>
        </div>
      }
    </div>
  `,
  styles: [`
    .filters { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
    .filters .f { min-width: 150px; }
    .filters .spacer { flex: 1; }
    .list { padding: 0; }
    .row { padding: 12px 16px; border-bottom: 1px solid var(--lv-line); display: grid;
      grid-template-columns: 1fr auto; gap: 4px 16px; align-items: baseline; }
    .row:last-child { border-bottom: none; }
    .meta { font-size: 15px; }
    .who { font-size: 12px; text-align: right; }
    .changes { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 8px; margin-top: 2px; }
    .change { display: inline-flex; align-items: center; gap: 4px; background: var(--lv-cream);
      border: 1px solid var(--lv-line); border-radius: 8px; padding: 2px 8px; font-size: 12px; }
    .change .fld { font-weight: 600; color: var(--lv-wine); }
    .change mat-icon { font-size: 15px; height: 15px; width: 15px; color: rgba(58,37,48,.5); }
    .change .old { color: #9a5a12; text-decoration: line-through; opacity: .8; }
    .change .new { color: #226b39; }
    .chip { font-size: 11px; padding: 1px 8px; border-radius: 999px; font-weight: 700; margin-right: 6px; }
    .chip.Create { background: #e5f3e8; color: #226b39; }
    .chip.Update { background: var(--lv-rose-soft); color: var(--lv-wine); }
    .chip.Delete { background: #efe7ea; color: #6b5560; }
    .pager { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 16px; }
    .muted { color: rgba(58,37,48,.6); }
  `]
})
export class AuditLogComponent {
  private http = inject(HttpClient);

  rows = signal<AuditEntry[]>([]);
  entityNames = signal<string[]>([]);
  total = signal(0);
  page = signal(1);
  loading = signal(false);
  readonly pageSize = 50;

  entity: string | null = null;
  action: string | null = null;
  from = '';
  to = '';

  readonly actionOptions = [{ id: 'Create', name: 'Create' }, { id: 'Update', name: 'Update' }, { id: 'Delete', name: 'Delete' }];
  entityOptions = computed(() => this.entityNames().map(n => ({ id: n, name: n })));
  pageCount = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));

  constructor() {
    this.http.get<string[]>(`${base}/audit/entities`).subscribe(n => this.entityNames.set(n));
    this.load();
  }

  reload() { this.page.set(1); this.load(); }
  go(p: number) { this.page.set(p); this.load(); }

  private load() {
    this.loading.set(true);
    const params: Record<string, string> = { page: String(this.page()), pageSize: String(this.pageSize) };
    if (this.entity) params['entity'] = this.entity;
    if (this.action) params['action'] = this.action;
    if (this.from) params['from'] = this.from;
    if (this.to) params['to'] = this.to + 'T23:59:59';
    this.http.get<AuditPage>(`${base}/audit`, { params }).subscribe({
      next: r => { this.rows.set(r.items); this.total.set(r.total); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  changesFor(r: AuditEntry): Change[] {
    const oldV = this.parse(r.oldValues);
    const newV = this.parse(r.newValues);
    const keys = new Set([...Object.keys(oldV), ...Object.keys(newV)]);
    return [...keys].map(field => ({ field, from: oldV[field], to: newV[field] }));
  }
  private parse(s: string | null): Record<string, unknown> {
    if (!s) return {};
    try { return JSON.parse(s); } catch { return {}; }
  }
  fmt(v: unknown): string {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'boolean') return v ? 'yes' : 'no';
    return String(v);
  }
}
