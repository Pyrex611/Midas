// backend/src/services/personalisation.service.ts

import { Lead } from '../types/lead.types';

export class PersonalisationService {
  /**
   * Personalises email content with lead data and strategic tools.
   * Uses split/join instead of RegExp to prevent crashes from special characters in company names.
   */
  personalise(
    lead: Lead,
    subject: string,
    body: string,
    reference?: string | null,
    senderName?: string | null,
    targetTool?: string | null,      // 🔥 Added
    lastEmailContent?: string | null // 🔥 Added
  ): { subject: string; body: string } {
    
    const placeholders: Record<string, string> = {
      '{{name}}': lead.name,
      '{{firstName}}': lead.name.split(' ')[0],
      '{{company}}': lead.company || 'your company',
      '{{position}}': lead.position || 'your role',
      '{{senderName}}': senderName || 'Your Name',
      '{{targetTool}}': targetTool || '', // 🔥 Injection of Phone or Link
    };

    let pSubject = subject;
    let pBody = body;

    // 1. Core Placeholder Replacement
    Object.entries(placeholders).forEach(([key, value]) => {
      pSubject = pSubject.split(key).join(value);
      pBody = pBody.split(key).join(value);
    });

    // 2. Reference Story Handling (Social Proof)
    if (!reference) {
      // If no reference, remove lines that accidentally reference a placeholder
      pBody = pBody.split('\n')
        .filter(line => !line.includes('{{reference_company}}'))
        .join('\n');
    } else {
      pBody = pBody.split('{{reference_company}}').join('a recent client');
      pSubject = pSubject.split('{{reference_company}}').join('a client');
    }

    // 3. Final Cleanup: Remove any un-replaced brackets
    pSubject = pSubject.replace(/\{\{[^}]+\}\}/g, '').trim();
    pBody = pBody.replace(/\{\{[^}]+\}\}/g, '').trim();

    return { subject: pSubject, body: pBody };
  }
}

export const personalisationService = new PersonalisationService();