import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [RouterLink, MatIconModule, MatButtonModule],
  template: `
    <div class="page">
      <div class="page-header"><h1>Analytics</h1></div>
      <div class="card placeholder">
        <mat-icon>insights</mat-icon>
        <h2>Dashboard coming in Phase 4</h2>
        <p class="muted">
          Margin trend, sales by category, discount/negotiation, inventory valuation,
          payment-method split and open follow-ups will land here once the reports API is built.
        </p>
        <button mat-raised-button color="primary" routerLink="/orders">Go to orders</button>
      </div>
    </div>
  `,
  styles: [`
    .placeholder { text-align: center; padding: 56px 24px; }
    .placeholder mat-icon { font-size: 56px; height: 56px; width: 56px; color: #5b5bd6; }
    .placeholder h2 { margin: 12px 0 4px; font-weight: 500; }
    .placeholder p { max-width: 520px; margin: 0 auto 20px; }
  `]
})
export class AnalyticsComponent {}
