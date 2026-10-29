import prisma from '../lib/prisma';

export interface ComplianceGrade {
  score: number; // 0 to 100
  rating: 'OPTIMAL' | 'ACCEPTABLE' | 'AT_RISK' | 'CRITICAL';
  metrics: {
    spamScore: number;
    diversityPermutations: number;
    hasPhysicalAddress: boolean;
    hasUnsubscribeMechanism: boolean;
    hasSpamTriggers: boolean;
    spamTriggersFound: string[];
    warnings: string[];
  };
}

const HIGH_RISK_TRIGGERS = [
  '100% free',
  '100% satisfied',
  'act now',
  'all natural',
  'apply now',
  'as seen on',
  'bad credit',
  'best price',
  'big bucks',
  'billion dollars',
  'buy direct',
  'call now',
  'cancel at any time',
  'cash bonus',
  'certified',
  'cheap',
  'claim',
  'clearance',
  'click here',
  'compare rates',
  'congratulations',
  'credit card offers',
  'cures',
  'dear friend',
  'direct email',
  'direct marketing',
  'discount',
  'double your income',
  'earn extra cash',
  'earn money',
  'eliminate debt',
  'exclusive deal',
  'expect to earn',
  'extra income',
  'fast cash',
  'financial freedom',
  'free consultation',
  'free gift',
  'free info',
  'free membership',
  'free preview',
  'free quote',
  'free sample',
  'free trial',
  'full refund',
  'get out of debt',
  'get paid',
  'giveaway',
  'guaranteed',
  'hidden assets',
  'income from home',
  'increase sales',
  'instant',
  'investment',
  'join millions',
  'lowest price',
  'make money',
  'million dollars',
  'miracle',
  'money back',
  'mortgage rates',
  'multi-level marketing',
  'no catch',
  'no cost',
  'no credit check',
  'no experience',
  'no fees',
  'no gimmick',
  'no hidden costs',
  'no interest',
  'no investment',
  'no obligation',
  'no purchase necessary',
  'no risk',
  'no strings attached',
  'not spam',
  'obligation',
  'once in a lifetime',
  'one time',
  'online marketing',
  'open immediately',
  'order now',
  'pennies a day',
  'potential earnings',
  'prize',
  'promise',
  'pure profit',
  'refund',
  'remove',
  'reverse aging',
  'risk free',
  'save big',
  'save money',
  'score',
  'see for yourself',
  'special promotion',
  'stop snoring',
  'terms and conditions',
  'this isn\'t spam',
  'unlimited',
  'unsecured credit',
  'urgent',
  'valuable',
  'viagra',
  'vicodin',
  'warranty',
  'weight loss',
  'while supplies last',
  'win',
  'winner',
  'winning',
  'work from home',
  'you have been selected',
  'your income',
];

export class ComplianceService {
  calculateSpintaxPermutations(text: string): number {
    const spintaxRegex = /\{([^{}]+)\}/g;
    let match;
    let permutations = 1;
    let count = 0;

    while ((match = spintaxRegex.exec(text)) !== null) {
      const options = match[1].split('|').filter(Boolean);
      if (options.length > 0) {
        permutations *= options.length;
        count++;
      }
      if (count > 20) break;
    }

    return permutations;
  }

  scanSpamTriggers(text: string): string[] {
    const found: string[] = [];
    const normalized = text.toLowerCase();

    for (const trigger of HIGH_RISK_TRIGGERS) {
      const regex = new RegExp(`\\b${trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(normalized)) {
        found.push(trigger);
      }
    }

    return found;
  }

  async gradeEmail(
    userId: string,
    subject: string,
    body: string
  ): Promise<ComplianceGrade> {
    const warnings: string[] = [];
    let score = 100;

    const subjectTriggers = this.scanSpamTriggers(subject);
    const bodyTriggers = this.scanSpamTriggers(body);
    const allTriggers = Array.from(new Set([...subjectTriggers, ...bodyTriggers]));

    if (allTriggers.length > 0) {
      const penalty = Math.min(35, allTriggers.length * 10);
      score -= penalty;
      warnings.push(`Contains ${allTriggers.length} high-risk spam trigger phrase(s): ${allTriggers.slice(0, 3).join(', ')}${allTriggers.length > 3 ? '...' : ''}`);
    }

    if (subject.length > 60) {
      score -= 5;
      warnings.push('Subject line is over 60 characters; risks mobile truncation.');
    }
    if (subject === subject.toUpperCase() && subject.replace(/[^a-zA-Z]/g, '').length > 5) {
      score -= 15;
      warnings.push('Subject line is written in all-caps; severe spam penalty.');
    }
    if ((subject.match(/!|\?/g) || []).length > 1) {
      score -= 5;
      warnings.push('Subject line contains multiple exclamation or question marks.');
    }

    const permutations = this.calculateSpintaxPermutations(body);
    if (permutations === 1) {
      score -= 10;
      warnings.push('No Spintax variations detected. All prospects receive identical templates, increasing fingerprinting risk.');
    } else if (permutations < 6) {
      score -= 5;
      warnings.push(`Low Spintax diversity (${permutations} variants). Aim for at least 10+ permutations.`);
    }

    const settings = await prisma.userSettings.findUnique({ where: { userId } });
    const hasPhysicalAddress = Boolean(settings?.physicalAddress && settings.physicalAddress.trim().length > 5);

    if (!hasPhysicalAddress) {
      score -= 15;
      warnings.push('CAN-SPAM Non-Compliance: Missing registered physical business postal address in Workspace Settings.');
    }

    let rating: ComplianceGrade['rating'] = 'OPTIMAL';
    if (score < 55) rating = 'CRITICAL';
    else if (score < 75) rating = 'AT_RISK';
    else if (score < 90) rating = 'ACCEPTABLE';

    return {
      score: Math.max(0, score),
      rating,
      metrics: {
        spamScore: allTriggers.length,
        diversityPermutations: permutations,
        hasPhysicalAddress,
        hasUnsubscribeMechanism: true,
        hasSpamTriggers: allTriggers.length > 0,
        spamTriggersFound: allTriggers,
        warnings,
      },
    };
  }
}

export const complianceService = new ComplianceService();