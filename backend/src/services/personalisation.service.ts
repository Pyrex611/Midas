import { Lead } from '../types/lead.types';

export class PersonalisationService {
  /**
   * Replace placeholders in email body and subject with lead data.
   * Handles {{reference_company}} specially based on whether a reference story exists.
   */
  personalise(
    lead: Lead,
    subject: string,
    body: string,
    reference?: string | null
  ): { subject: string; body: string } {
    // Base placeholders from lead data
    const placeholders: Record<string, string> = {
      '{{name}}': lead.name,
      '{{company}}': lead.company || 'your company',
      '{{position}}': lead.position || 'your role',
      '{{firstName}}': lead.name.split(' ')[0],
      '{{lastName}}': lead.name.split(' ').slice(1).join(' ') || '',
      '{{valueProposition}}': 'improving team productivity', // can be dynamic later
    };

    // If a reference story is provided, we keep the {{reference_company}} placeholder
    // to be replaced with a generic fallback after personalisation.
    // If no reference, we will strip any lines containing {{reference_company}}.

    let personalisedSubject = subject;
    let personalisedBody = body;

    // Replace base placeholders
    Object.entries(placeholders).forEach(([key, value]) => {
      personalisedSubject = personalisedSubject.replace(new RegExp(key, 'g'), value);
      personalisedBody = personalisedBody.replace(new RegExp(key, 'g'), value);
    });

    // Handle reference_company based on presence of reference story
    if (reference) {
      // Replace {{reference_company}} with a generic placeholder (could be extracted from reference later)
      personalisedSubject = personalisedSubject.replace(/\{\{reference_company\}\}/g, 'a client');
      personalisedBody = personalisedBody.replace(/\{\{reference_company\}\}/g, 'a client');
    } else {
      // No reference: remove any lines that contain {{reference_company}} to avoid incomplete sentences
      personalisedBody = personalisedBody
        .split('\n')
        .filter(line => !line.includes('{{reference_company}}'))
        .join('\n');
      // Also remove from subject if present
      personalisedSubject = personalisedSubject.replace(/\{\{reference_company\}\}/g, '');
    }

    // Final cleanup: remove any other leftover placeholders (e.g., {{something}})
    personalisedSubject = personalisedSubject.replace(/\{\{[^}]+\}\}/g, '');
    personalisedBody = personalisedBody.replace(/\{\{[^}]+\}\}/g, '');

    return {
      subject: personalisedSubject.trim(),
      body: personalisedBody.trim(),
    };
  }
}

export const personalisationService = new PersonalisationService();