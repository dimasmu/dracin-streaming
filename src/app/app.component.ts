import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ToastModule } from 'primeng/toast';
import { PwaService } from './core/services/pwa.service';
import { DramaPreviewComponent } from './shared/components/drama-preview/drama-preview.component';

/** Root shell hosting ambient Tirai Bambu backdrop, global toast/preview overlays, and top-level layout routes (`/` vs `/admin`). */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastModule, DramaPreviewComponent, TranslocoPipe],
  templateUrl: './app.component.html',
})
export class AppComponent {
  protected readonly pwa = inject(PwaService);
}
