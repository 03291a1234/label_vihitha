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
          <img class="mark-img" src="assets/icon/favicon.png" alt="Label_Vihitha" />
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
        <ion-text color="medium"><p class="hint">Sign in with your owner credentials.</p></ion-text>
      </div>
    </ion-content>
  `,
  styles: [`
    .login-bg { --background: linear-gradient(135deg, #6e1f3e, #3f1228); }
    .wrap { max-width: 420px; margin: 8vh auto 0; }
    .logo { text-align: center; color: #fff; margin-bottom: 16px; }
    .logo .mark-img { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; box-shadow: 0 2px 10px rgba(0,0,0,.25); }
    .logo h1 { margin: 8px 0 0; font-size: 24px; }
    .logo p { margin: 2px 0 0; opacity: .7; }
    .hint { text-align: center; font-size: 12px; }
  `]
})
export class LoginPage {
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastController);

  userName = '';
  password = '';
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
