import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent, IonInput, IonButton, IonItem, IonList, IonSpinner, IonText, ToastController
} from '@ionic/angular';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, IonContent, IonInput, IonButton, IonItem, IonList, IonSpinner, IonText],
  template: `
    <ion-content class="ion-padding login-bg">
      <div class="wrap">
        <div class="logo">
          <div class="mark">🛍️</div>
          <h1>Label_Vihitha</h1>
          <p>Point of sale</p>
        </div>
        <ion-list inset="true">
          <ion-item>
            <ion-input label="Username" labelPlacement="floating" [(ngModel)]="userName" autocapitalize="off"></ion-input>
          </ion-item>
          <ion-item>
            <ion-input label="Password" labelPlacement="floating" type="password" [(ngModel)]="password"></ion-input>
          </ion-item>
        </ion-list>
        <ion-button expand="block" (click)="submit()" [disabled]="loading()">
          @if (loading()) { <ion-spinner name="dots"></ion-spinner> } @else { Sign in }
        </ion-button>
        <ion-text color="medium"><p class="hint">Seeded owner: owner / Owner#12345</p></ion-text>
      </div>
    </ion-content>
  `,
  styles: [`
    .login-bg { --background: linear-gradient(135deg, #6e1f3e, #3f1228); }
    .wrap { max-width: 420px; margin: 8vh auto 0; }
    .logo { text-align: center; color: #fff; margin-bottom: 16px; }
    .logo .mark { font-size: 48px; }
    .logo h1 { margin: 8px 0 0; font-size: 24px; }
    .logo p { margin: 2px 0 0; opacity: .7; }
    .hint { text-align: center; font-size: 12px; }
  `]
})
export class LoginPage {
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastController);

  userName = 'owner';
  password = 'Owner#12345';
  loading = signal(false);

  async submit() {
    this.loading.set(true);
    this.auth.login(this.userName, this.password).subscribe({
      next: () => { this.loading.set(false); this.router.navigateByUrl('/tabs/sale', { replaceUrl: true }); },
      error: async () => {
        this.loading.set(false);
        (await this.toast.create({ message: 'Login failed', duration: 2500, color: 'danger' })).present();
      }
    });
  }
}
