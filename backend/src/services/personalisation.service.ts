import { Lead } from '../types/lead.types';

export class PersonalisationService {
  /**
   * Replace placeholders in email body and subject with lead data.
   * Also verifies no placeholders remain; if any, removes them.
   */
  personalise(lead: Lead, subject: string, body: string): { subject: string; body: string } {
    const placeholders: Record<string, string> = {
      '{{name}}': lead.name,
      '{{company}}': lead.company || 'your company',
      '{{position}}': lead.position || 'your role',
      '{{firstName}}': lead.name.split(' ')[0],
      '{{lastName}}': lead.name.split(' ').slice(1).join(' ') || '',
      '{{valueProposition}}': 'improving team productivity', // can be dynamic in future
    };

    let personalisedSubject = subject;
    let personalisedBody = body;

    Object.entries(placeholders).forEach(([key, value]) => {
      personalisedSubject = personalisedSubject.replace(new RegExp(key, 'g'), value);
      personalisedBody = personalisedBody.replace(new RegExp(key, 'g'), value);
    });

    // Cleanup: remove any remaining curly-brace placeholders
    personalisedSubject = personalisedSubject.replace(/\{\{[^}]+\}\}/g, '');
    personalisedBody = personalisedBody.replace(/\{\{[^}]+\}\}/g, '');

    return {
      subject: personalisedSubject,
      body: personalisedBody,
    };
  }
}

export const personalisationService = new PersonalisationService();