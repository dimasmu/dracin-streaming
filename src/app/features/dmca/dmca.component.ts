import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  imports: [RouterLink, TranslocoPipe],
  templateUrl: './dmca.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DmcaComponent {
  protected readonly checklist = [1, 2, 3, 4, 5, 6];
  protected readonly steps = [1, 2, 3, 4];
}
