import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { AppHeaderComponent } from './shared/components/app-header/app-header.component';
import { AppFooterComponent } from './shared/components/app-footer/app-footer.component';
import { DramaPreviewComponent } from './shared/components/drama-preview/drama-preview.component';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    ToastModule,
    AppHeaderComponent,
    AppFooterComponent,
    DramaPreviewComponent,
  ],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {}
