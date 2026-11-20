import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppHeaderComponent } from '../../shared/components/app-header/app-header.component';
import { AppFooterComponent } from '../../shared/components/app-footer/app-footer.component';
import { MobileBottomNavComponent } from '../../shared/components/mobile-bottom-nav/mobile-bottom-nav.component';

/** Base shell 1: Website Utama (`/`) with TiraiPlay header, main outlet, footer, and mobile bottom bar. */
@Component({
  selector: 'app-public-layout',
  imports: [RouterOutlet, AppHeaderComponent, AppFooterComponent, MobileBottomNavComponent],
  templateUrl: './public-layout.component.html',
})
export class PublicLayoutComponent {}
