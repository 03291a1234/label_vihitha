import { Component, inject, signal } from '@angular/core';
import { MoneyPipe } from '../core/money.pipe';
import { PrivacyService } from '../core/privacy.service';
import { DecimalPipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonGrid, IonRow, IonCol, IonCard,
  IonCardHeader, IonCardTitle, IonCardContent, IonRefresher, IonRefresherContent,
  IonButtons, IonButton, IonIcon
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { logOutOutline, eyeOutline, eyeOffOutline } from 'ionicons/icons';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { DashboardSummary } from '../core/models';

@Component({
  selector: 'app-today',
  standalone: true,
  imports: [
    MoneyPipe, DecimalPipe, IonHeader, IonToolbar, IonTitle, IonContent, IonGrid, IonRow,
    IonCol, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonRefresher,
    IonRefresherContent, IonButtons, IonButton, IonIcon
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Summary</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="privacy.toggle()"><ion-icon slot="icon-only" [name]="privacy.hidden() ? 'eye-off-outline' : 'eye-outline'"></ion-icon></ion-button>
          <ion-button (click)="auth.logout()"><ion-icon slot="icon-only" name="log-out-outline"></ion-icon></ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-refresher slot="fixed" (ionRefresh)="load($any($event))">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      @if (s(); as sum) {
        @if (!auth.isOwner()) {
          <p class="ion-text-center ion-padding">Sales figures are visible to the Owner role only.</p>
        } @else {
          <ion-grid>
            <ion-row>
              <ion-col size="6"><ion-card><ion-card-header><ion-card-title>{{ sum.totalRevenue | currency }}</ion-card-title></ion-card-header><ion-card-content>Revenue</ion-card-content></ion-card></ion-col>
              <ion-col size="6"><ion-card><ion-card-header><ion-card-title>{{ sum.grossMargin | currency }}</ion-card-title></ion-card-header><ion-card-content>Margin · {{ sum.marginPercent | number:'1.0-1' }}%</ion-card-content></ion-card></ion-col>
            </ion-row>
            <ion-row>
              <ion-col size="6"><ion-card><ion-card-header><ion-card-title>{{ sum.orderCount }}</ion-card-title></ion-card-header><ion-card-content>Orders · {{ sum.unitsSold }} units</ion-card-content></ion-card></ion-col>
              <ion-col size="6"><ion-card><ion-card-header><ion-card-title>{{ sum.outstandingInvoiceAmount | currency }}</ion-card-title></ion-card-header><ion-card-content>Outstanding</ion-card-content></ion-card></ion-col>
            </ion-row>
            <ion-row>
              <ion-col size="6"><ion-card [color]="sum.lowStockCount > 0 ? 'warning' : undefined"><ion-card-header><ion-card-title>{{ sum.lowStockCount }}</ion-card-title></ion-card-header><ion-card-content>Low stock items</ion-card-content></ion-card></ion-col>
            </ion-row>
          </ion-grid>
        }
      }
    </ion-content>
  `
})
export class TodayPage {
  private api = inject(ApiService);
  auth = inject(AuthService);
  privacy = inject(PrivacyService);
  s = signal<DashboardSummary | null>(null);

  constructor() {
    addIcons({ logOutOutline, eyeOutline, eyeOffOutline });
    this.load();
  }

  load(refresher?: { target: { complete: () => void } }) {
    if (!this.auth.isOwner()) { refresher?.target.complete(); return; }
    this.api.summary().subscribe({
      next: (d) => { this.s.set(d); refresher?.target.complete(); },
      error: () => refresher?.target.complete()
    });
  }
}
