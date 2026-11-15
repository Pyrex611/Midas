export interface ComplianceOptions {
  companyName?: string | null;
  physicalAddress?: string | null;
  customOptOutText?: string | null;
  artifacts?: Record<string, { url: string; type: string; title: string }>;
}

export class PersonalisationService {
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

  private resolveVariablesAndFallbacks(
    text: string,
    vars: Record<string, { value: string | null | undefined; defaultFallback: string }>
  ): string {
    let output = text;

    for (const [varName, cfg] of Object.entries(vars)) {
      const val = cfg.value && cfg.value.trim() ? cfg.value.trim() : null;

      const doublePipeRegex = new RegExp(`\\{\\{${varName}\\|([^}]+)\\}\\}`, 'gi');
      output = output.replace(doublePipeRegex, (_, fallback) => val || fallback.trim());

      const doubleRegex = new RegExp(`\\{\\{${varName}\\}\\}`, 'gi');
      output = output.replace(doubleRegex, val || cfg.defaultFallback);

      const singlePipeRegex = new RegExp(`\\{${varName}\\|([^}]+)\\}`, 'gi');
      output = output.replace(singlePipeRegex, (_, fallback) => val || fallback.trim());

      const singleRegex = new RegExp(`\\{${varName}\\}`, 'gi');
      output = output.replace(singleRegex, val || cfg.defaultFallback);
    }

    return output;
  }

  private resolveArtifacts(
    text: string,
    artifacts?: Record<string, { url: string; type: string; title: string }>
  ): string {
    if (!artifacts) return text;
    return text.replace(/\{\{artifact:([a-z0-9_-]+)\}\}/gi, (_match, rawSlug) => {
      const entry = artifacts[String(rawSlug).toLowerCase()];
      return entry ? entry.url : '';
    });
  }

  personalise(
    lead: any,
    subject: string,
    body: string,
    reference?: string | null,
    senderName?: string | null,
    unsubscribeUrl?: string | null,
    compliance?: ComplianceOptions
  ): { subject: string; body: string } {
    const safeName = lead?.name && lead.name.trim() ? lead.name.trim() : 'there';
    const firstName = safeName === 'there' ? 'there' : safeName.split(' ')[0];
    const lastName = safeName.includes(' ') ? safeName.split(' ').slice(1).join(' ') : '';

    const vars: Record<string, { value: string | null | undefined; defaultFallback: string }> = {
      name: { value: safeName, defaultFallback: 'there' },
      firstName: { value: firstName, defaultFallback: 'there' },
      first_name: { value: firstName, defaultFallback: 'there' },
      lastName: { value: lastName, defaultFallback: '' },
      last_name: { value: lastName, defaultFallback: '' },
      company: { value: lead?.company, defaultFallback: 'your company' },
      companyName: { value: lead?.company, defaultFallback: 'your company' },
      company_name: { value: lead?.company, defaultFallback: 'your company' },
      position: { value: lead?.position, defaultFallback: 'your role' },
      role: { value: lead?.position, defaultFallback: 'your role' },
      title: { value: lead?.position, defaultFallback: 'your role' },
      senderName: { value: senderName, defaultFallback: 'The Team' },
      sender_name: { value: senderName, defaultFallback: 'The Team' },
    };

    let pSubject = this.resolveVariablesAndFallbacks(subject, vars);
    let pBody = this.resolveVariablesAndFallbacks(body, vars);

    // Resolve {{artifact:slug}} tokens into CDN/hosted URLs (auto-tracked at send time)
    pSubject = this.resolveArtifacts(pSubject, compliance?.artifacts);
    pBody = this.resolveArtifacts(pBody, compliance?.artifacts);

    if (!reference) {
      pBody = pBody.split('\n').filter(line => !line.includes('reference_company')).join('\n');
    } else {
      pBody = pBody.replace(/\{\{?reference_company\}?\}/gi, 'a recent partner');
      pSubject = pSubject.replace(/\{\{?reference_company\}?\}/gi, 'a recent partner');
    }

    pSubject = this.resolveSpintax(pSubject);
    pBody = this.resolveSpintax(pBody);

    pSubject = pSubject.replace(/\{\{[^}]+\}\}/g, '').trim();
    pBody = pBody.replace(/\{\{[^}]+\}\}/g, '').trim();

    if (unsubscribeUrl) {
      const optOutLabel = compliance?.customOptOutText || "Don't want to receive these emails?";
      const legalLines: string[] = [];

      if (compliance?.companyName || compliance?.physicalAddress) {
        const entity = [compliance.companyName, compliance.physicalAddress].filter(Boolean).join(' · ');
        legalLines.push(entity);
      }

      legalLines.push(`${optOutLabel} Unsubscribe: ${unsubscribeUrl}`);
      pBody = `${pBody}\n\n---\n${legalLines.join('\n')}`;
    }

    return { subject: pSubject, body: pBody };
  }
}

export const personalisationService = new PersonalisationService();