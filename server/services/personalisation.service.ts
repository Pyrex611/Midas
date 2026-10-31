export class PersonalisationService {
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

  /**
   * Spintax Engine:
   * Strictly matches {Choice A|Choice B|Choice C} requiring at least one pipe '|'.
   * Never touches single variables like {company} or {{name}}.
   */
  private resolveSpintax(text: string): string {
    const spintaxRegex = /\{([^{}]+?\|[^{}]+?)\}/g;
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
   * Enterprise Personalization Engine:
   * 1. Interpolates variables FIRST (supports both {{var}} and {var}, plus {{var|fallback}} and {var|fallback}).
   * 2. Sanitizes bogus tokens ("name", "company", "senderName").
   * 3. Dynamically injects Ultra-Personalization tokens from lead.enrichedData.
   * 4. Resolves Spintax SECOND ({Option A|Option B}).
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
    let pSubject = subject;
    let pBody = body;

    // 1. Resolve Lead Attributes
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

    // 2. Build Master Variable Context Map (Case-Insensitive)
    const variableMap: Record<string, string | null> = {
      name: validName,
      fullname: validName,
      firstname: validFirstName,
      fname: validFirstName,
      lastname: validLastName,
      lname: validLastName,
      company: validCompany,
      companyname: validCompany,
      position: validPosition,
      title: validPosition,
      jobtitle: validPosition,
      role: validPosition,
      sendername: validSenderName,
      sender: validSenderName,
      reference_company: reference ? 'a recent partner' : null,
    };

    // Inject dynamic Ultra-Personalization tokens from lead.enrichedData
    if (lead?.enrichedData && typeof lead.enrichedData === 'object') {
      for (const [k, v] of Object.entries(lead.enrichedData)) {
        if (typeof v === 'string' && v.trim()) {
          variableMap[k.toLowerCase().replace(/[^a-z0-9_]/g, '')] = v.trim();
        }
      }
    }

    // Default Fallbacks Map
    const defaultFallbacks: Record<string, string> = {
      name: 'there',
      fullname: 'there',
      firstname: 'there',
      fname: 'there',
      lastname: '',
      lname: '',
      company: 'your clinic',
      companyname: 'your clinic',
      position: 'your role',
      title: 'your role',
      jobtitle: 'your role',
      role: 'your role',
      sendername: 'The Team',
      sender: 'The Team',
      reference_company: 'a recent partner',
    };

    /**
     * Variable Replacer Function:
     * Matches both double braces {{token}} and single braces {token},
     * as well as custom fallbacks {{token|fallback}} and {token|fallback}.
     */
    const replaceVariables = (text: string): string => {
      // Regex captures:
      // Group 1: variable name
      // Group 2: optional user fallback
      const tokenRegex = /\{{1,2}\s*([a-zA-Z0-9_]+)(?:\|([^}]+))?\s*\}{1,2}/g;

      return text.replace(tokenRegex, (fullMatch, rawVarName, userFallback) => {
        const key = rawVarName.toLowerCase().replace(/[^a-z0-9_]/g, '');

        // If the token is not recognized and has no pipe, check if it's a known variable
        if (key in variableMap) {
          const resolvedVal = variableMap[key];
          if (resolvedVal && resolvedVal.trim()) {
            return resolvedVal.trim();
          }
          if (userFallback && userFallback.trim()) {
            return userFallback.trim();
          }
          return defaultFallbacks[key] || '';
        }

        // Leave un-matched tokens with pipe for Spintax
        if (fullMatch.includes('|')) {
          return fullMatch;
        }

        return '';
      });
    };

    // STEP A: Interpolate Variables FIRST
    pSubject = replaceVariables(pSubject);
    pBody = replaceVariables(pBody);

    // STEP B: Clean Reference Lines if no reference provided
    if (!reference) {
      pBody = pBody.split('\n').filter(line => !line.includes('a recent partner')).join('\n');
    }

    // STEP C: Resolve Spintax SECOND ({Option A|Option B})
    pSubject = this.resolveSpintax(pSubject);
    pBody = this.resolveSpintax(pBody);

    // STEP D: CAN-SPAM Legal & Postal Compliance Footer
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

    return { subject: pSubject.trim(), body: pBody.trim() };
  }
}

export const personalisationService = new PersonalisationService();