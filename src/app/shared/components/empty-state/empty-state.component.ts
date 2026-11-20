import { Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-empty-state',
  imports: [TranslocoPipe],
  templateUrl: './empty-state.component.html',
})
export class EmptyStateComponent {
  readonly title = input('');
  readonly message = input('');
}
