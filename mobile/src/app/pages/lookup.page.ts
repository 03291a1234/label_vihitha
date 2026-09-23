import { Component, inject, signal } from '@angular/core';
import { MoneyPipe } from '../core/money.pipe';
import { PrivacyService } from '../core/privacy.service';

import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonSearchbar, IonList, IonItem,
  IonLabel, IonBadge, IonNote, IonButtons, IonButton, IonIcon, IonRefresher,
  IonRefresherContent
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { logOutOutline, eyeOutline, eyeOffOutline } from 'ionicons/icons';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { Product } from '../core/models';

@Component({
  selector: 'app-lookup',
  standalone: true,
  imports: [
    MoneyPipe, IonHeader, IonToolbar, IonTitle, IonContent, IonSearchbar, IonList,
    IonItem, IonLabel, IonBadge, IonNote, IonButtons, IonButton, IonIcon,
    IonRefresher, IonRefresherContent
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Inventory</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="privacy.toggle()"><ion-icon slot="icon-only" [name]="privacy.hidden() ? 'eye-off-outline' : 'eye-outline'"></ion-icon></ion-button>
          <ion-button (click)="auth.logout()"><ion-icon slot="icon-only" name="log-out-outline"></ion-icon></ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar color="primary">
        <ion-searchbar placeholder="Search name or SKU" (ionInput)="onSearch($any($event).target.value)"></ion-searchbar>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="load($any($event))">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>
      <ion-list>
        @for (p of products(); track p.id) {
          <ion-item>
            <ion-label>
              <h2>{{ p.name }}</h2>
              <p>{{ p.sku }} · {{ p.categoryName }}{{ p.color ? ' · ' + p.color : '' }}</p>
              <ion-note>Cost {{ p.originalPrice | currency }} · Sale {{ p.salePrice | currency }}</ion-note>
            </ion-label>
            <ion-badge slot="end" [color]="p.isLowStock ? 'danger' : 'success'">{{ p.quantityOnHand }} in stock</ion-badge>
          </ion-item>
        }
        @if (products().length === 0 && !loading()) {
          <ion-item lines="none"><ion-label class="ion-text-center"><p>No products found.</p></ion-label></ion-item>
        }
      </ion-list>
    </ion-content>
  `
})
export class LookupPage {
  private api = inject(ApiService);
  auth = inject(AuthService);
  privacy = inject(PrivacyService);
  products = signal<Product[]>([]);
  loading = signal(false);
  private term = '';

  constructor() {
    addIcons({ logOutOutline, eyeOutline, eyeOffOutline });
    this.load();
  }

  onSearch(value: string) { this.term = value; this.load(); }

  load(refresher?: { target: { complete: () => void } }) {
    this.loading.set(true);
    this.api.products(this.term || undefined).subscribe({
      next: (r) => { this.products.set(r.items); this.loading.set(false); refresher?.target.complete(); },
      error: () => { this.loading.set(false); refresher?.target.complete(); }
    });
  }
}
