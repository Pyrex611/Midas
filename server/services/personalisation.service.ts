export class PersonalisationService {
  /**
   * Resolves Spintax formatted strings: {Word A|Word B|Word C}
   */
  private resolveSpintax(text: string): string {
    const spintaxRegex = /\{([^{}]+)\}/g;
    let result = text;
    let match;
    
    // Iteratively resolve nested or flat spintax
    while ((match = spintaxRegex.exec(result)) !== null) {
      const options = match[1].split('|');
      const choice = options[Math.floor(Math.random() * options.length)];
      result = result.substring(0, match.index) + choice + result.substring(match.index + match[0].length);
      spintaxRegex.lastIndex = 0; // reset to process newly formed string if needed
    }
    return result;
  }

  personalise(
    lead: any,
    subject: string,
    body: string,
    reference?: string | null,
    senderName?: string | null
  ): { subject: string; body: string } {
    
    // First, resolve Spintax to lock in the variation
    let pSubject = this.resolveSpintax(subject);
    let pBody = this.resolveSpintax(body);

    const placeholders: Record<string, string> = {
      '{{name}}': lead.name,
      '{{company}}': lead.company || '',
      '{{position}}': lead.position || '',
      '{{firstName}}': lead.name.split(' ')[0],
      '{{lastName}}': lead.name.split(' ').slice(1).join(' ') || '',
      '{{senderName}}': senderName || 'Your Name',
    };

    Object.entries(placeholders).forEach(([key, value]) => {
      const regex = new RegExp(key, 'gi');
      pSubject = pSubject.replace(regex, value);
      pBody = pBody.replace(regex, value);
    });

    if (!reference) {
      // Remove lines trying to use the reference
      pBody = pBody.split('\n').filter(line => !line.includes('{{reference_company}}')).join('\n');
    } else {
      pBody = pBody.replace(/\{\{reference_company\}\}/gi, 'a recent client');
      pSubject = pSubject.replace(/\{\{reference_company\}\}/gi, 'a recent client');
    }

    // Cleanup lingering unresolved placeholders
    pSubject = pSubject.replace(/\{\{[^}]+\}\}/g, '').trim();
    pBody = pBody.replace(/\{\{[^}]+\}\}/g, '').trim();

    return { subject: pSubject, body: pBody };
  }
}

export const personalisationService = new PersonalisationService();