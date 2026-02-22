import { Lead } from '../types/lead.types';

export class PersonalisationService {
  personalise(lead: Lead, subject: string, body: string, reference?: string | null): { subject: string; body: string } {
		const placeholders: Record<string, string> = {
			'{{name}}': lead.name,
			'{{company}}': lead.company || 'your company',
			'{{position}}': lead.position || 'your role',
			'{{firstName}}': lead.name.split(' ')[0],
			'{{lastName}}': lead.name.split(' ').slice(1).join(' ') || '',
			'{{senderName}}': senderName || 'Your Name',
			'{{valueProposition}}': 'improving team productivity', // can be dynamic in future
		};

		// If reference story is provided, add reference_company placeholder
		if (reference) {
			// If the user provided a specific reference company name, we could use it.
			// For simplicity, we'll just use a generic "a client" if reference is present but no company.
			// But here we assume the reference text already contains the company name; we'll replace {{reference_company}} with a generic.
			// Actually, we need to decide: the AI will include {{reference_company}} in the draft; we should replace it with the actual reference company name if provided, or remove the sentence.
			// For now, we'll just replace with "a client" if no specific reference company.
			placeholders['{{reference_company}}'] = 'a client'; // or could be extracted from reference?
		} else {
			// If no reference, remove any sentences containing {{reference_company}} to avoid incomplete text
			// We'll handle this by stripping lines that contain the placeholder.
		}

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

		return {
			subject: personalisedSubject,
			body: personalisedBody,
		};
	}
}

export const personalisationService = new PersonalisationService();