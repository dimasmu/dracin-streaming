import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  imports: [RouterLink, TranslocoPipe, EmptyStateComponent],
  templateUrl: './not-found.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundComponent {}
