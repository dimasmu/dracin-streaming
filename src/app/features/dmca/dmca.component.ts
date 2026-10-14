import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LEGAL_CONTACT, type LegalSection } from '../../core/legal';
import { EmailLinkComponent } from '../../shared/components/email-link/email-link.component';
import { LegalPageComponent } from '../../shared/components/legal-page/legal-page.component';

@Component({
  imports: [RouterLink, TranslocoPipe, LegalPageComponent, EmailLinkComponent],
  templateUrl: './dmca.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DmcaComponent {
  protected readonly email = LEGAL_CONTACT.dmca;
  protected readonly checklist = [1, 2, 3, 4, 5, 6];
  protected readonly steps = [1, 2, 3, 4];

  protected readonly sections: readonly LegalSection[] = [
    { id: 'scope', labelKey: 'dmca.toc1' },
    { id: 'notice', labelKey: 'dmca.toc2' },
    { id: 'checklist', labelKey: 'dmca.toc21', level: 2 },
    { id: 'steps', labelKey: 'dmca.toc22', level: 2 },
    { id: 'counter', labelKey: 'dmca.toc3' },
    { id: 'repeat', labelKey: 'dmca.toc4' },
    { id: 'contact', labelKey: 'dmca.toc5' },
  ];
}
