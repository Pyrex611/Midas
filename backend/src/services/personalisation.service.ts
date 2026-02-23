import { Lead } from '../types/lead.types';

export class PersonalisationService {
  personalise(
    lead: Lead,
    subject: string,
    body: string,
    reference?: string | null,
    senderName?: string | null
  ): { subject: string; body: string } {
    const placeholders: Record<string, string> = {
      '{{name}}': lead.name,
      '{{company}}': lead.company || 'your company',
      '{{position}}': lead.position || 'your role',
      '{{firstName}}': lead.name.split(' ')[0],
      '{{lastName}}': lead.name.split(' ').slice(1).join(' ') || '',
      '{{senderName}}': senderName || 'Your Name',
    };

    let personalisedSubject = subject;
    let personalisedBody = body;

    Object.entries(placeholders).forEach(([key, value]) => {
      personalisedSubject = personalisedSubject.replace(new RegExp(key, 'g'), value);
      personalisedBody = personalisedBody.replace(new RegExp(key, 'g'), value);
    });

    // If no reference, remove any remaining reference_company placeholders and associated sentences
    if (!reference) {
      // Remove lines that contain {{reference_company}} (simple approach)
      personalisedBody = personalisedBody
        .split('\n')
        .filter(line => !line.includes('{{reference_company}}'))
        .join('\n');
    } else {
      // Replace any remaining {{reference_company}} with a generic fallback
      personalisedBody = personalisedBody.replace(/\{\{reference_company\}\}/g, 'a client');
      personalisedSubject = personalisedSubject.replace(/\{\{reference_company\}\}/g, 'a client');
    }

    // Final cleanup: remove any other leftover placeholders
    personalisedSubject = personalisedSubject.replace(/\{\{[^}]+\}\}/g, '');
    personalisedBody = personalisedBody.replace(/\{\{[^}]+\}\}/g, '');

    return { subject: personalisedSubject, body: personalisedBody };
  }
}

export const personalisationService = new PersonalisationService();