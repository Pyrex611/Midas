export class PersonalisationService {
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
    senderName?: string | null
  ): { subject: string; body: string } {
    let pSubject = this.resolveSpintax(subject);
    let pBody = this.resolveSpintax(body);

    const firstName = lead.name ? lead.name.split(' ')[0] : '';
    const lastName = lead.name && lead.name.split(' ').length > 1 ? lead.name.split(' ').slice(1).join(' ') : '';

    // Smart Variable Fallbacks: {{variable|fallback}}
    const replaceWithFallback = (text: string, varName: string, value: string | null | undefined, defaultFallback = '') => {
      const regexWithPipe = new RegExp(`\\{\\{${varName}\\|([^}]+)\\}\\}`, 'gi');
      text = text.replace(regexWithPipe, (_, fallback) => (value && value.trim() ? value : fallback.trim()));

      const standardRegex = new RegExp(`\\{\\{${varName}\\}\\}`, 'gi');
      text = text.replace(standardRegex, value && value.trim() ? value : defaultFallback);
      return text;
    };

    pSubject = replaceWithFallback(pSubject, 'name', lead.name, 'there');
    pBody = replaceWithFallback(pBody, 'name', lead.name, 'there');

    pSubject = replaceWithFallback(pSubject, 'firstName', firstName, 'there');
    pBody = replaceWithFallback(pBody, 'firstName', firstName, 'there');

    pSubject = replaceWithFallback(pSubject, 'lastName', lastName, '');
    pBody = replaceWithFallback(pBody, 'lastName', lastName, '');

    pSubject = replaceWithFallback(pSubject, 'company', lead.company, 'your company');
    pBody = replaceWithFallback(pBody, 'company', lead.company, 'your company');

    pSubject = replaceWithFallback(pSubject, 'position', lead.position, 'your role');
    pBody = replaceWithFallback(pBody, 'position', lead.position, 'your role');

    pSubject = replaceWithFallback(pSubject, 'senderName', senderName, 'Team');
    pBody = replaceWithFallback(pBody, 'senderName', senderName, 'Team');

    if (!reference) {
      pBody = pBody.split('\n').filter(line => !line.includes('{{reference_company}}')).join('\n');
    } else {
      pBody = pBody.replace(/\{\{reference_company\}\}/gi, 'a recent partner');
      pSubject = pSubject.replace(/\{\{reference_company\}\}/gi, 'a recent partner');
    }

    pSubject = pSubject.replace(/\{\{[^}]+\}\}/g, '').trim();
    pBody = pBody.replace(/\{\{[^}]+\}\}/g, '').trim();

    return { subject: pSubject, body: pBody };
  }
}

export const personalisationService = new PersonalisationService();