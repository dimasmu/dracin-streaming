import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import type { LegalSection } from '../../core/legal';
import { LegalPageComponent } from '../../shared/components/legal-page/legal-page.component';

@Component({
  imports: [RouterLink, TranslocoPipe, LegalPageComponent],
  templateUrl: './terms.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermsComponent {
  protected readonly sections: readonly LegalSection[] = [
    { id: 'p1', labelKey: 'terms.toc1' },
    { id: 'p2', labelKey: 'terms.toc2' },
    { id: 'p3', labelKey: 'terms.toc3' },
    { id: 'p4', labelKey: 'terms.toc4' },
    { id: 'p5', labelKey: 'terms.toc5' },
    { id: 'p6', labelKey: 'terms.toc6' },
    { id: 'p7', labelKey: 'terms.toc7' },
    { id: 'p8', labelKey: 'terms.toc8' },
    { id: 'p9', labelKey: 'terms.toc9' },
  ];
}
