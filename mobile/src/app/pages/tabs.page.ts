import { Component } from '@angular/core';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { cashOutline, searchOutline, todayOutline } from 'ionicons/icons';

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="sale">
          <ion-icon name="cash-outline"></ion-icon>
          <ion-label>New sale</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="lookup">
          <ion-icon name="search-outline"></ion-icon>
          <ion-label>Lookup</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="today">
          <ion-icon name="today-outline"></ion-icon>
          <ion-label>Today</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `
})
export class TabsPage {
  constructor() {
    addIcons({ cashOutline, searchOutline, todayOutline });
  }
}
