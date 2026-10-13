import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-footer',
  imports: [RouterLink, TranslocoPipe],
  templateUrl: './app-footer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppFooterComponent {}
