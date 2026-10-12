import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-drama-card-skeleton',
  templateUrl: './drama-card-skeleton.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DramaCardSkeletonComponent {}
