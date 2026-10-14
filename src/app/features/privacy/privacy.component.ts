import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LEGAL_CONTACT, type LegalSection } from '../../core/legal';
import { EmailLinkComponent } from '../../shared/components/email-link/email-link.component';
import { LegalPageComponent } from '../../shared/components/legal-page/legal-page.component';

@Component({
  imports: [RouterLink, TranslocoPipe, LegalPageComponent, EmailLinkComponent],
  templateUrl: './privacy.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivacyComponent {
  protected readonly email = LEGAL_CONTACT.general;
  protected readonly sections: readonly LegalSection[] = [
    { id: 'p1', labelKey: 'privacy.toc1' },
    { id: 'p2', labelKey: 'privacy.toc2' },
    { id: 'p3', labelKey: 'privacy.toc3' },
    { id: 'p4', labelKey: 'privacy.toc4' },
    { id: 'p5', labelKey: 'privacy.toc5' },
    { id: 'p6', labelKey: 'privacy.toc6' },
    { id: 'p7', labelKey: 'privacy.toc7' },
    { id: 'p8', labelKey: 'privacy.toc8' },
  ];
}
