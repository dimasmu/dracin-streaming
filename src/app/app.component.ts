import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ToastModule } from 'primeng/toast';
import { PwaService } from './core/services/pwa.service';
import { AuthDialogComponent } from './shared/components/auth-dialog/auth-dialog.component';
import { VipUpgradeDialogComponent } from './shared/components/vip-upgrade-dialog/vip-upgrade-dialog.component';
import { DramaPreviewComponent } from './shared/components/drama-preview/drama-preview.component';

/** Root shell hosting ambient Tirai Bambu backdrop, global toast/preview/auth/VIP overlays, and top-level layout routes (`/` vs `/admin`). */
@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    ToastModule,
    DramaPreviewComponent,
    AuthDialogComponent,
    VipUpgradeDialogComponent,
    TranslocoPipe,
  ],
  templateUrl: './app.component.html',
})
export class AppComponent {
  protected readonly pwa = inject(PwaService);
}
