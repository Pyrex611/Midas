export class PersonalisationService {
  // Blacklist of literal placeholder strings often found in dirty CSVs or test records
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

  /**
   * Strictly interpolates {{variable}} or {{variable|fallback}} mustache tokens.
   * Bare words like "name", "company", or "team" in the body text are NEVER modified.
   */
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
    // 1. Resolve Spintax first: {Option A|Option B}
    let pSubject = this.resolveSpintax(subject);
    let pBody = this.resolveSpintax(body);

    // 2. Extract and sanitize prospect values
    const rawFullName = this.cleanString(lead?.name);
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

    const rawCompany = this.cleanString(lead?.company);
    let validCompany: string | null = null;
    if (rawCompany && !PersonalisationService.BOGUS_COMPANY_TOKENS.has(rawCompany.toLowerCase())) {
      validCompany = this.toTitleCase(rawCompany);
    }

    const rawPosition = this.cleanString(lead?.position);
    let validPosition: string | null = null;
    if (rawPosition && !/^(n\/a|null|undefined|none|test)$/i.test(rawPosition)) {
      validPosition = this.toTitleCase(rawPosition);
    }

    const rawSender = this.cleanString(senderName);
    let validSenderName = 'The Team';
    if (rawSender && !PersonalisationService.BOGUS_SENDER_TOKENS.has(rawSender.toLowerCase())) {
      validSenderName = this.toTitleCase(rawSender);
    }

    // 3. Strict Mustache Token Replacer:
    // Matches ONLY: {{token}} or {{token|fallback}}
    // Leaves all other un-braced words untouched.
    const replaceMustacheTokens = (
      text: string,
      tokenName: string,
      resolvedValue: string | null,
      systemFallback: string
    ): string => {
      // Handles pipe syntax: {{token|customFallback}}
      const pipeRegex = new RegExp(`\\{\\{${tokenName}\\|([^}]+)\\}\\}`, 'gi');
      text = text.replace(pipeRegex, (_, userFallback) => {
        return resolvedValue && resolvedValue.trim() ? resolvedValue : userFallback.trim();
      });

      // Handles standard syntax: {{token}}
      const standardRegex = new RegExp(`\\{\\{${tokenName}\\}\\}`, 'gi');
      text = text.replace(standardRegex, () => {
        return resolvedValue && resolvedValue.trim() ? resolvedValue : systemFallback;
      });

      return text;
    };

    // Apply strict mustache token replacements
    pSubject = replaceMustacheTokens(pSubject, 'name', validName, 'there');
    pBody = replaceMustacheTokens(pBody, 'name', validFirstName || validName, 'there');

    pSubject = replaceMustacheTokens(pSubject, 'firstName', validFirstName, 'there');
    pBody = replaceMustacheTokens(pBody, 'firstName', validFirstName, 'there');

    pSubject = replaceMustacheTokens(pSubject, 'lastName', validLastName, '');
    pBody = replaceMustacheTokens(pBody, 'lastName', validLastName, '');

    pSubject = replaceMustacheTokens(pSubject, 'company', validCompany, 'your team');
    pBody = replaceMustacheTokens(pBody, 'company', validCompany, 'your team');

    pSubject = replaceMustacheTokens(pSubject, 'position', validPosition, 'your role');
    pBody = replaceMustacheTokens(pBody, 'position', validPosition, 'your role');

    pSubject = replaceMustacheTokens(pSubject, 'senderName', validSenderName, 'The Team');
    pBody = replaceMustacheTokens(pBody, 'senderName', validSenderName, 'The Team');

    // Reference story interpolation
    if (!reference) {
      pBody = pBody.split('\n').filter(line => !line.includes('{{reference_company}}')).join('\n');
    } else {
      pBody = pBody.replace(/\{\{reference_company\}\}/gi, 'a recent partner');
      pSubject = pSubject.replace(/\{\{reference_company\}\}/gi, 'a recent partner');
    }

    // 4. Clean any remaining unrecognized {{mustache}} tokens so raw tags never leak
    pSubject = pSubject.replace(/\{\{[^}]+\}\}/g, '').trim();
    pBody = pBody.replace(/\{\{[^}]+\}\}/g, '').trim();

    // 5. CAN-SPAM Legal & Postal Compliance Footer
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