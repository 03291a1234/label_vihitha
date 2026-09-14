import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../core/auth/auth.service';

interface NavItem { label: string; icon: string; path: string; }

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive,
    MatToolbarModule, MatSidenavModule, MatListModule, MatIconModule, MatButtonModule, MatMenuModule
  ],
  template: `
    <mat-sidenav-container class="shell">
      <mat-sidenav #snav mode="side" opened class="sidenav">
        <div class="brand">
          <mat-icon>storefront</mat-icon>
          <span>Label_Vihitha</span>
        </div>
        <mat-nav-list>
          @for (item of nav; track item.path) {
            <a mat-list-item [routerLink]="item.path" routerLinkActive="active-link">
              <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
              <span matListItemTitle>{{ item.label }}</span>
            </a>
          }
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content>
        <mat-toolbar color="primary" class="topbar">
          <button mat-icon-button (click)="snav.toggle()"><mat-icon>menu</mat-icon></button>
          <span class="spacer"></span>
          <button mat-button [matMenuTriggerFor]="menu">
            <mat-icon>account_circle</mat-icon>
            {{ auth.userName() }}
          </button>
          <mat-menu #menu="matMenu">
            <div class="menu-roles">Roles: {{ auth.roles().join(', ') || '—' }}</div>
            <button mat-menu-item (click)="auth.logout()">
              <mat-icon>logout</mat-icon><span>Sign out</span>
            </button>
          </mat-menu>
        </mat-toolbar>

        <main>
          <router-outlet />
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    .shell { height: 100vh; }
    .sidenav { width: 240px; background: #1e1e2d; color: #cfd0e0; border: none; }
    .brand {
      display: flex; align-items: center; gap: 10px; padding: 20px 16px;
      font-size: 18px; font-weight: 600; color: #fff;
    }
    mat-nav-list a { color: #cfd0e0; }
    mat-nav-list mat-icon { color: #9fa1bd; }
    .active-link { background: rgba(255,255,255,.08); color: #fff !important; }
    .active-link mat-icon { color: #fff; }
    .topbar { position: sticky; top: 0; z-index: 10; }
    .menu-roles { padding: 8px 16px; font-size: 12px; color: rgba(0,0,0,.6); }
    main { display: block; }
  `]
})
export class ShellComponent {
  auth = inject(AuthService);
  nav: NavItem[] = [
    { label: 'Analytics', icon: 'insights', path: '/analytics' },
    { label: 'Orders', icon: 'receipt_long', path: '/orders' },
    { label: 'Invoicing', icon: 'payments', path: '/invoices' },
    { label: 'Follow-ups', icon: 'task_alt', path: '/follow-ups' },
    { label: 'Inventory', icon: 'inventory_2', path: '/products' },
    { label: 'Categories', icon: 'category', path: '/categories' },
    { label: 'Customers', icon: 'group', path: '/customers' }
  ];
}
