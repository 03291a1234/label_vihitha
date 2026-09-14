import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonInput,
  IonButton, IonIcon, IonNote, IonSelect, IonSelectOption, IonSegment, IonSegmentButton,
  IonToggle, IonButtons, IonSearchbar, IonListHeader,
  AlertController, ToastController, LoadingController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { logOutOutline, addCircle, trashOutline, personAddOutline } from 'ionicons/icons';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { Customer, Product, PaymentMethod } from '../core/models';

interface Line { product: Product; quantity: number; finalPrice: number; }

@Component({
  selector: 'app-sale',
  standalone: true,
  imports: [
    CurrencyPipe, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem,
    IonLabel, IonInput, IonButton, IonIcon, IonNote, IonSelect, IonSelectOption, IonSegment,
    IonSegmentButton, IonToggle, IonButtons, IonSearchbar, IonListHeader
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>New sale</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="auth.logout()"><ion-icon slot="icon-only" name="log-out-outline"></ion-icon></ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-list inset="true">
        <ion-item>
          <ion-select label="Customer" [(ngModel)]="customerId" interface="action-sheet" placeholder="Select">
            @for (c of customers(); track c.id) { <ion-select-option [value]="c.id">{{ c.name }}</ion-select-option> }
          </ion-select>
          <ion-button slot="end" fill="clear" (click)="addCustomer()"><ion-icon slot="icon-only" name="person-add-outline"></ion-icon></ion-button>
        </ion-item>
      </ion-list>

      <ion-searchbar placeholder="Add product by name / SKU" (ionInput)="search($any($event).target.value)"></ion-searchbar>
      @if (term()) {
        <ion-list>
          @for (p of filtered(); track p.id) {
            <ion-item button (click)="addLine(p)" [disabled]="p.quantityOnHand < 1">
              <ion-label>
                <h3>{{ p.name }}</h3>
                <ion-note>{{ p.sku }} · {{ p.salePrice | currency }} · {{ p.quantityOnHand }} left</ion-note>
              </ion-label>
              <ion-icon slot="end" name="add-circle" color="primary"></ion-icon>
            </ion-item>
          }
        </ion-list>
      }

      <ion-list inset="true">
        <ion-list-header>Cart</ion-list-header>
        @if (lines().length === 0) {
          <ion-item lines="none"><ion-label color="medium"><p>No items yet — search above to add.</p></ion-label></ion-item>
        }
        @for (l of lines(); track l.product.id) {
          <ion-item>
            <ion-label>
              <h3>{{ l.product.name }}</h3>
              <ion-note>{{ l.product.sku }} · list {{ l.product.salePrice | currency }}</ion-note>
              <div class="line-inputs">
                <ion-input type="number" label="Qty" labelPlacement="stacked" [(ngModel)]="l.quantity" (ngModelChange)="bump()" min="1"></ion-input>
                <ion-input type="number" label="Final $" labelPlacement="stacked" [(ngModel)]="l.finalPrice" (ngModelChange)="bump()" min="0"></ion-input>
                <div class="line-total"><small>Line</small><strong>{{ l.finalPrice * l.quantity | currency }}</strong></div>
              </div>
            </ion-label>
            <ion-button slot="end" fill="clear" color="danger" (click)="remove(l)"><ion-icon slot="icon-only" name="trash-outline"></ion-icon></ion-button>
          </ion-item>
        }
      </ion-list>

      <ion-list inset="true">
        <ion-item>
          <ion-label>Payment</ion-label>
          <ion-segment slot="end" [(ngModel)]="method">
            <ion-segment-button value="Zelle"><ion-label>Zelle</ion-label></ion-segment-button>
            <ion-segment-button value="Cash"><ion-label>Cash</ion-label></ion-segment-button>
          </ion-segment>
        </ion-item>
        <ion-item>
          <ion-toggle [(ngModel)]="markPaid">Mark paid now</ion-toggle>
        </ion-item>
      </ion-list>

      <div class="grand">
        <span>Total</span>
        <strong>{{ grandTotal() | currency }}</strong>
      </div>

      <ion-button expand="block" size="large" (click)="complete()"
                  [disabled]="!customerId || lines().length === 0 || busy()">
        {{ busy() ? 'Processing…' : 'Complete sale' }}
      </ion-button>
    </ion-content>
  `,
  styles: [`
    .line-inputs { display: flex; gap: 12px; align-items: flex-end; margin-top: 6px; }
    .line-inputs ion-input { max-width: 90px; --background: #f4f4f6; border-radius: 8px; padding-inline: 8px; }
    .line-total { display: flex; flex-direction: column; }
    .line-total small { color: var(--ion-color-medium); }
    .grand { display: flex; justify-content: space-between; align-items: baseline; padding: 8px 16px 16px; font-size: 20px; }
    .grand strong { font-size: 26px; }
  `]
})
export class SalePage {
  private api = inject(ApiService);
  auth = inject(AuthService);
  private alert = inject(AlertController);
  private toast = inject(ToastController);
  private loadingCtrl = inject(LoadingController);

  customers = signal<Customer[]>([]);
  private allProducts = signal<Product[]>([]);
  term = signal('');
  lines = signal<Line[]>([]);
  busy = signal(false);
  private v = signal(0);

  customerId: number | null = null;
  method: PaymentMethod = 'Zelle';
  markPaid = true;

  filtered = computed(() => {
    const t = this.term().toLowerCase();
    if (!t) return [];
    return this.allProducts().filter(p =>
      p.name.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t)).slice(0, 12);
  });
  grandTotal = computed(() => { this.v(); return this.lines().reduce((s, l) => s + (l.finalPrice || 0) * (l.quantity || 0), 0); });

  constructor() {
    addIcons({ logOutOutline, addCircle, trashOutline, personAddOutline });
    this.api.customers().subscribe(c => this.customers.set(c));
    this.api.products().subscribe(r => this.allProducts.set(r.items));
  }

  search(value: string) { this.term.set(value ?? ''); }
  bump() { this.v.update(n => n + 1); }

  addLine(p: Product) {
    if (this.lines().some(l => l.product.id === p.id)) return;
    this.lines.update(ls => [...ls, { product: p, quantity: 1, finalPrice: p.salePrice }]);
    this.term.set('');
    this.bump();
  }
  remove(l: Line) { this.lines.update(ls => ls.filter(x => x !== l)); this.bump(); }

  async addCustomer() {
    const a = await this.alert.create({
      header: 'New customer',
      inputs: [
        { name: 'name', placeholder: 'Name', attributes: { required: true } },
        { name: 'phone', placeholder: 'Phone (optional)' }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Add',
          handler: (data) => {
            if (!data.name?.trim()) return false;
            this.api.createCustomer(data.name.trim(), data.phone).subscribe(c => {
              this.customers.update(cs => [...cs, c]);
              this.customerId = c.id;
            });
            return true;
          }
        }
      ]
    });
    await a.present();
  }

  async complete() {
    if (!this.customerId || this.lines().length === 0) return;
    this.busy.set(true);
    const loading = await this.loadingCtrl.create({ message: 'Completing sale…' });
    await loading.present();
    try {
      const order = await firstValueFrom(this.api.createOrder({
        customerId: this.customerId,
        items: this.lines().map(l => ({ productId: l.product.id, quantity: l.quantity, finalPrice: l.finalPrice }))
      }));
      await firstValueFrom(this.api.setStatus(order.id, 'Confirmed'));
      const invoice = await firstValueFrom(this.api.createInvoice(order.id, this.method));
      if (this.markPaid) {
        await firstValueFrom(this.api.recordPayment(invoice.id, invoice.amountDue, this.method));
      }
      await this.showToast(`Sale complete · ${order.orderNumber} · ${invoice.invoiceNumber}`, 'success');
      this.reset();
      // refresh stock for subsequent sales
      this.api.products().subscribe(r => this.allProducts.set(r.items));
    } catch (e: any) {
      const msg = e?.error?.title ?? 'Could not complete the sale';
      await this.showToast(msg, 'danger');
    } finally {
      this.busy.set(false);
      await loading.dismiss();
    }
  }

  private reset() {
    this.lines.set([]);
    this.customerId = null;
    this.method = 'Zelle';
    this.markPaid = true;
    this.term.set('');
    this.bump();
  }

  private async showToast(message: string, color: string) {
    (await this.toast.create({ message, duration: 3000, color, position: 'top' })).present();
  }
}
