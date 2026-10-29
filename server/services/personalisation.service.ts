export class PersonalisationService {
  // Blacklist of literal placeholder strings often found in dirty CSVs or test data
  private static readonly BOGUS_NAME_TOKENS = new Set([
    'name', 'first name', 'firstname', 'last name', 'lastname', 'contact', 'lead',
    'prospect', 'user', 'test', 'unknown', 'n/a', 'null', 'none', 'there', 'customer', 'client'
  ]);

  private static readonly BOGUS_COMPANY_TOKENS = new Set([
    'company', 'company name', 'business', 'organization', 'org', 'account',
    'employer', 'firm', 'test', 'unknown', 'n/a', 'null', 'none', 'your company', 'the company'
  ]);

  private static readonly BOGUS_SENDER_TOKENS = new Set([
    'sendername', 'sender_name', 'sender', 'your name', 'my name', 'team', 'sales'
  ]);

  private cleanString(val: any): string | null {
    if (!val || typeof val !== 'string') return null;
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private toTitleCase(str: string): string {
    return str
      .toLowerCase()
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private resolveSpintax(text: string): string {
    const spintaxRegex = /\{([^{}]+)\}/g;
    let result = text;
    let iterations = 0;
    const maxIterations = 50;

    while (spintaxRegex.test(result) && iterations < maxIterations) {
      result = result.replace(spintaxRegex, (_, choices) => {
        const options = choices.split('|');
        return options[Math.floor(Math.random() * options.length)] || '';
      });
      iterations++;
    }
    return result;
  }

  personalise(
    lead: any,
    subject: string,
    body: string,
    reference?: string | null,
    senderName?: string | null,
    unsubscribeUrl?: string | null,
    complianceOptions?: {
      companyName?: string | null;
      physicalAddress?: string | null;
      customOptOutText?: string | null;
    }
  ): { subject: string; body: string } {
    let pSubject = this.resolveSpintax(subject);
    let pBody = this.resolveSpintax(body);

    // 1. Sanitize Prospect Name (Filter bogus "name" values)
    const rawFullName = this.cleanString(lead.name);
    let validName: string | null = null;
    let validFirstName: string | null = null;
    let validLastName: string | null = null;

    if (rawFullName && !PersonalisationService.BOGUS_NAME_TOKENS.has(rawFullName.toLowerCase())) {
      validName = this.toTitleCase(rawFullName);
      const parts = validName.split(' ');
      validFirstName = parts[0] || null;
      if (parts.length > 1) {
        validLastName = parts.slice(1).join(' ');
      }
    }

    // 2. Sanitize Company Name (Filter bogus "company" values)
    const rawCompany = this.cleanString(lead.company);
    let validCompany: string | null = null;
    if (rawCompany && !PersonalisationService.BOGUS_COMPANY_TOKENS.has(rawCompany.toLowerCase())) {
      validCompany = this.toTitleCase(rawCompany);
    }

    // 3. Sanitize Job Title / Position
    const rawPosition = this.cleanString(lead.position);
    let validPosition: string | null = null;
    if (rawPosition && !/^(n\/a|null|undefined|none|test)$/i.test(rawPosition)) {
      validPosition = this.toTitleCase(rawPosition);
    }

    // 4. Sanitize Sender Name
    const rawSender = this.cleanString(senderName);
    let validSenderName = 'The Team';
    if (rawSender && !PersonalisationService.BOGUS_SENDER_TOKENS.has(rawSender.toLowerCase())) {
      validSenderName = this.toTitleCase(rawSender);
    }

    // Helper: Smart replacement with fallback
    const replaceToken = (text: string, token: string, value: string | null, fallback: string) => {
      // Handles pipe syntax: {{token|fallback}}
      const pipeRegex = new RegExp(`\\{\\{${token}\\|([^}]+)\\}\\}`, 'gi');
      text = text.replace(pipeRegex, (_, userFallback) => value || userFallback.trim());

      // Handles standard syntax: {{token}}
      const standardRegex = new RegExp(`\\{\\{${token}\\}\\}`, 'gi');
      text = text.replace(standardRegex, value || fallback);
      return text;
    };

    // Interpolate Name
    pSubject = replaceToken(pSubject, 'name', validName, 'there');
    pBody = replaceToken(pBody, 'name', validFirstName || validName, 'there');
    pSubject = replaceToken(pSubject, 'firstName', validFirstName, 'there');
    pBody = replaceToken(pBody, 'firstName', validFirstName, 'there');
    pSubject = replaceToken(pSubject, 'lastName', validLastName, '');
    pBody = replaceToken(pBody, 'lastName', validLastName, '');

    // Interpolate Company with natural grammar fallback
    // e.g. "regarding {{company}}" -> if company is invalid, becomes "regarding your team"
    if (validCompany) {
      pSubject = replaceToken(pSubject, 'company', validCompany, 'your team');
      pBody = replaceToken(pBody, 'company', validCompany, 'your team');
    } else {
      pSubject = pSubject.replace(/\bregarding\s+\{\{company\}\}/gi, 'for you');
      pBody = pBody.replace(/\blooks\s+like\s+\{\{company\}\}\s+is\b/gi, 'looks like your team is');
      pSubject = replaceToken(pSubject, 'company', null, 'your team');
      pBody = replaceToken(pBody, 'company', null, 'your team');
    }

    // Interpolate Role & Sender
    pSubject = replaceToken(pSubject, 'position', validPosition, 'your role');
    pBody = replaceToken(pBody, 'position', validPosition, 'your role');
    pSubject = replaceToken(pSubject, 'senderName', validSenderName, 'The Team');
    pBody = replaceToken(pBody, 'senderName', validSenderName, 'The Team');

    // Reference story interpolation
    if (!reference) {
      pBody = pBody.split('\n').filter(line => !line.includes('{{reference_company}}')).join('\n');
    } else {
      pBody = pBody.replace(/\{\{reference_company\}\}/gi, 'a recent partner');
      pSubject = pSubject.replace(/\{\{reference_company\}\}/gi, 'a recent partner');
    }

    // Clean any remaining un-matched template tags
    pSubject = pSubject.replace(/\{\{[^}]+\}\}/g, '').trim();
    pBody = pBody.replace(/\{\{[^}]+\}\}/g, '').trim();

    // CAN-SPAM Legal Compliance Footer
    const footerLines: string[] = [];
    if (unsubscribeUrl) {
      const optOutLabel = complianceOptions?.customOptOutText?.trim() || "Don't want to receive these emails? Unsubscribe here";
      footerLines.push(`${optOutLabel}: ${unsubscribeUrl}`);
    }

    if (complianceOptions?.physicalAddress?.trim()) {
      const company = complianceOptions.companyName?.trim() ? `${complianceOptions.companyName.trim()} · ` : '';
      footerLines.push(`${company}${complianceOptions.physicalAddress.trim()}`);
    }

    if (footerLines.length > 0) {
      pBody = `${pBody}\n\n---\n${footerLines.join('\n')}`;
    }

    return { subject: pSubject, body: pBody };
  }
}

export const personalisationService = new PersonalisationService();