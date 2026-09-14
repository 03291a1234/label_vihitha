import { Routes } from '@angular/router';
import { authGuard } from './core/auth.interceptor';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login.page').then(m => m.LoginPage)
  },
  {
    path: 'tabs',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/tabs.page').then(m => m.TabsPage),
    children: [
      { path: 'sale', loadComponent: () => import('./pages/sale.page').then(m => m.SalePage) },
      { path: 'lookup', loadComponent: () => import('./pages/lookup.page').then(m => m.LookupPage) },
      { path: 'today', loadComponent: () => import('./pages/today.page').then(m => m.TodayPage) },
      { path: '', redirectTo: 'sale', pathMatch: 'full' }
    ]
  },
  { path: '', redirectTo: 'tabs/sale', pathMatch: 'full' },
  { path: '**', redirectTo: 'tabs/sale' }
];
