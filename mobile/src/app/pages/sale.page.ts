import { Component, computed, inject, signal } from '@angular/core';
import { MoneyPipe } from '../core/money.pipe';
import { PrivacyService } from '../core/privacy.service';

import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonInput,
  IonButton, IonIcon, IonNote, IonSelect, IonSelectOption, IonSegment, IonSegmentButton,
  IonToggle, IonButtons, IonSearchbar, IonListHeader,
  AlertController, ToastController, LoadingController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { logOutOutline, addCircle, trashOutline, personAddOutline, barcodeOutline, closeOutline, eyeOutline, eyeOffOutline } from 'ionicons/icons';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { Customer, Product, PaymentMethod } from '../core/models';

interface Line { product: Product; quantity: number; finalPrice: number; }

@Component({
  selector: 'app-sale',
  standalone: true,
  imports: [
    MoneyPipe, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem,
    IonLabel, IonInput, IonButton, IonIcon, IonNote, IonSelect, IonSelectOption, IonSegment,
    IonSegmentButton, IonToggle, IonButtons, IonSearchbar, IonListHeader
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>New sale</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="privacy.toggle()"><ion-icon slot="icon-only" [name]="privacy.hidden() ? 'eye-off-outline' : 'eye-outline'"></ion-icon></ion-button>
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

      <ion-button expand="block" fill="outline" class="scan-btn" (click)="startScan()">
        <ion-icon name="barcode-outline" slot="start"></ion-icon> Scan barcode to add
      </ion-button>
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
        <ion-list-header>Additional services <ion-note class="hdr-note">stitching, shipping, alteration…</ion-note></ion-list-header>
        @for (s of services(); track $index) {
          <ion-item>
            <div class="svc-row">
              <ion-input label="Service" labelPlacement="stacked" placeholder="e.g. Stitching" [(ngModel)]="s.label" (ngModelChange)="bump()"></ion-input>
              <ion-input type="number" min="0" label="$ Amount" labelPlacement="stacked" placeholder="0.00" [(ngModel)]="s.amount" (ngModelChange)="bump()"></ion-input>
            </div>
            <ion-button slot="end" fill="clear" color="danger" (click)="removeService($index)"><ion-icon slot="icon-only" name="trash-outline"></ion-icon></ion-button>
          </ion-item>
        }
        <ion-item lines="none">
          <ion-button fill="clear" (click)="addService()"><ion-icon slot="start" name="add-circle"></ion-icon> Add service</ion-button>
        </ion-item>
      </ion-list>

      <ion-list inset="true">
        <ion-item>
          <ion-input type="number" min="0" label="Manual discount ($)" labelPlacement="stacked"
                     placeholder="0.00" [(ngModel)]="manualDiscount" (ionInput)="bump()"></ion-input>
        </ion-item>
        <ion-item lines="none">
          <ion-note class="flow-note">Placed as <strong>Pending</strong> — confirm, fulfil &amp; invoice from Orders.</ion-note>
        </ion-item>
      </ion-list>

      @if (discountAmount() > 0 || servicesTotal() > 0) {
        <div class="grand sub"><span>Subtotal</span><span>{{ subTotal() | currency }}</span></div>
        @if (discountAmount() > 0) {
          <div class="grand sub disc"><span>Manual discount</span><span>−{{ discountAmount() | currency }}</span></div>
        }
        @if (servicesTotal() > 0) {
          <div class="grand sub"><span>Services</span><span>+{{ servicesTotal() | currency }}</span></div>
        }
      }
      <div class="grand">
        <span>Total</span>
        <strong>{{ grandTotal() | currency }}</strong>
      </div>

      <ion-button expand="block" size="large" (click)="complete()"
                  [disabled]="!customerId || lines().length === 0 || busy()">
        {{ busy() ? 'Placing…' : 'Place order' }}
      </ion-button>
    </ion-content>

    @if (scanning()) {
      <div class="scan-overlay">
        <video id="scan-video" playsinline muted autoplay></video>
        <div class="scan-frame"></div>
        <div class="scan-hint">Point the camera at the label barcode</div>
        <ion-button class="scan-cancel" fill="solid" color="light" (click)="stopScan()">
          <ion-icon name="close-outline" slot="start"></ion-icon> Cancel
        </ion-button>
      </div>
    }
  `,
  styles: [`
    .line-inputs { display: flex; gap: 12px; align-items: flex-end; margin-top: 6px; }
    .line-inputs ion-input { max-width: 90px; --background: #f4f4f6; border-radius: 8px; padding-inline: 8px; }
    .line-total { display: flex; flex-direction: column; }
    .line-total small { color: var(--ion-color-medium); }
    .grand { display: flex; justify-content: space-between; align-items: baseline; padding: 8px 16px 16px; font-size: 20px; }
    .grand.sub { padding: 2px 16px; font-size: 15px; color: var(--ion-color-medium); }
    .grand.sub.disc { color: var(--ion-color-primary); }
    .svc-row { display: flex; gap: 12px; width: 100%; }
    .svc-row ion-input { flex: 1; }
    .hdr-note { font-weight: 400; text-transform: none; margin-left: 6px; }
    .flow-note { font-size: 13px; color: var(--ion-color-medium); }
    .scan-btn { margin: 4px 8px 0; }
    .scan-overlay { position: fixed; inset: 0; z-index: 2000; background: #000; display: flex;
      flex-direction: column; align-items: center; justify-content: center; }
    .scan-overlay video { width: 100%; height: 100%; object-fit: cover; position: absolute; inset: 0; }
    .scan-frame { position: relative; width: 78%; max-width: 340px; aspect-ratio: 5 / 3;
      border: 3px solid rgba(255,255,255,.9); border-radius: 12px; box-shadow: 0 0 0 100vmax rgba(0,0,0,.45); }
    .scan-hint { position: absolute; bottom: 22%; color: #fff; font-size: 15px; text-shadow: 0 1px 3px #000; }
    .scan-cancel { position: absolute; bottom: 8%; }
    .grand strong { font-size: 26px; }
  `]
})
export class SalePage {
  private api = inject(ApiService);
  auth = inject(AuthService);
  privacy = inject(PrivacyService);
  private alert = inject(AlertController);
  private toast = inject(ToastController);
  private loadingCtrl = inject(LoadingController);

  customers = signal<Customer[]>([]);
  private allProducts = signal<Product[]>([]);
  term = signal('');
  lines = signal<Line[]>([]);
  services = signal<{ label: string; amount: number | null }[]>([]);
  busy = signal(false);
  scanning = signal(false);
  private v = signal(0);
  private scanControls?: IScannerControls;
  private scanReader?: BrowserMultiFormatReader;

  customerId: number | null = null;
  method: PaymentMethod = 'Zelle';
  markPaid = true;
  manualDiscount: number | null = null;

  filtered = computed(() => {
    const t = this.term().toLowerCase();
    if (!t) return [];
    return this.allProducts().filter(p =>
      p.name.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t)).slice(0, 12);
  });
  subTotal = computed(() => { this.v(); return this.lines().reduce((s, l) => s + (l.finalPrice || 0) * (l.quantity || 0), 0); });
  servicesTotal = computed(() => { this.v(); return this.services().reduce((s, x) => s + (Number(x.amount) || 0), 0); });
  discountAmount = computed(() => { this.v(); return Math.min(this.subTotal(), Math.max(0, this.manualDiscount || 0)); });
  grandTotal = computed(() => this.subTotal() - this.discountAmount() + this.servicesTotal());

  constructor() {
    addIcons({ logOutOutline, addCircle, trashOutline, personAddOutline, barcodeOutline, closeOutline, eyeOutline, eyeOffOutline });
    this.api.customers().subscribe(c => this.customers.set(c));
    this.api.products().subscribe(r => this.allProducts.set(r.items));
  }

  search(value: string) { this.term.set(value ?? ''); }
  bump() { this.v.update(n => n + 1); }

  addLine(p: Product) {
    if (this.lines().some(l => l.product.id === p.id)) {
      // Already in the cart — bump its quantity instead of ignoring the scan.
      this.lines.update(ls => ls.map(l => l.product.id === p.id ? { ...l, quantity: l.quantity + 1 } : l));
    } else {
      this.lines.update(ls => [...ls, { product: p, quantity: 1, finalPrice: p.salePrice }]);
    }
    this.term.set('');
    this.bump();
  }

  // ---- Barcode scanning: decode the SKU off the printed label and add to the cart ----
  async startScan() {
    this.scanning.set(true);
    await new Promise(r => setTimeout(r, 60));   // let the <video> render before we bind
    const video = document.getElementById('scan-video') as HTMLVideoElement | null;
    if (!video) { this.stopScan(); return; }
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128]);
    this.scanReader = new BrowserMultiFormatReader(hints);
    try {
      this.scanControls = await this.scanReader.decodeFromVideoDevice(undefined, video, (result) => {
        if (result) this.onScanned(result.getText());
      });
    } catch {
      await this.toastMsg('Cannot open the camera. Allow camera access and try again.', 'danger');
      this.stopScan();
    }
  }

  stopScan() {
    this.scanControls?.stop();
    this.scanControls = undefined;
    this.scanReader = undefined;
    this.scanning.set(false);
  }

  private async onScanned(text: string) {
    const sku = (text || '').trim();
    if (!sku) return;
    const p = this.allProducts().find(x => x.sku.toLowerCase() === sku.toLowerCase());
    this.stopScan();
    if (!p) { await this.toastMsg(`No product found for “${sku}”.`, 'danger'); return; }
    if (p.quantityOnHand < 1) { await this.toastMsg(`${p.name} is out of stock.`, 'warning'); return; }
    Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
    this.addLine(p);
    await this.toastMsg(`Added ${p.name}`, 'success');
  }

  private async toastMsg(message: string, color: string) {
    const t = await this.toast.create({ message, duration: 1600, color, position: 'top' });
    await t.present();
  }
  remove(l: Line) { this.lines.update(ls => ls.filter(x => x !== l)); this.bump(); }

  addService() { this.services.update(s => [...s, { label: '', amount: null }]); this.bump(); }
  removeService(i: number) { this.services.update(s => s.filter((_, idx) => idx !== i)); this.bump(); }

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
    const loading = await this.loadingCtrl.create({ message: 'Placing order…' });
    await loading.present();
    try {
      // Create a Pending order — same lifecycle as the web: the owner reviews it to
      // Confirmed, then Fulfilled, and invoices/takes payment from the Orders screen.
      const order = await firstValueFrom(this.api.createOrder({
        customerId: this.customerId,
        items: this.lines().map(l => ({ productId: l.product.id, quantity: l.quantity, finalPrice: l.finalPrice })),
        orderDiscount: this.discountAmount(),
        charges: this.services()
          .filter(s => s.label.trim() && (Number(s.amount) || 0) > 0)
          .map(s => ({ label: s.label.trim(), amount: Number(s.amount) }))
      }));
      await this.showToast(`Order ${order.orderNumber} placed — pending review.`, 'success');
      this.reset();
      // refresh stock for subsequent sales
      this.api.products().subscribe(r => this.allProducts.set(r.items));
    } catch (e: any) {
      const msg = e?.error?.title ?? 'Could not place the order';
      await this.showToast(msg, 'danger');
    } finally {
      this.busy.set(false);
      await loading.dismiss();
    }
  }

  private reset() {
    this.lines.set([]);
    this.services.set([]);
    this.customerId = null;
    this.method = 'Zelle';
    this.markPaid = true;
    this.manualDiscount = null;
    this.term.set('');
    this.bump();
  }

  private async showToast(message: string, color: string) {
    (await this.toast.create({ message, duration: 3000, color, position: 'top' })).present();
  }
}
