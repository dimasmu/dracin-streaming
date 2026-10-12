import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  imports: [RouterLink],
  templateUrl: './dmca.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DmcaComponent {}
