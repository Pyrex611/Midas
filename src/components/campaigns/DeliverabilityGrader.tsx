import React, { useState } from 'react';
import { campaignAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Icons } from '../../lib/icons';

interface DeliverabilityGraderProps {
  campaignId: string;
  subject: string;
  body: string;
}

export const DeliverabilityGrader: React.FC<DeliverabilityGraderProps> = ({
  campaignId,
  subject,
  body,
}) => {
  const { toast } = useToast();
  const [grade, setGrade] = useState<any | null>(null);
  const [grading, setGrading] = useState(false);

  const runDeliverabilityAudit = async () => {
    if (!subject.trim() || !body.trim()) {
      return toast.warning('Add a subject and body before running deliverability audit', 'Validation');
    }

    setGrading(true);
    try {
      const res = await campaignAPI.gradeDraft(campaignId, { subject, body });
      setGrade(res.data);
      if (res.data.rating === 'OPTIMAL') {
        toast.success(`Deliverability Score: ${res.data.score}/100`, 'Audit Passed');
      } else {
        toast.warning(`Deliverability Score: ${res.data.score}/100`, 'Recommendations Available');
      }
    } catch {
      toast.error('Could not complete deliverability audit', 'Error');
    } finally {
      setGrading(false);
    }
  };

  const getBadgeColor = (rating: string) => {
    switch (rating) {
      case 'OPTIMAL':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'ACCEPTABLE':
        return 'bg-thistle-100 text-royal-800 border-gold-500/40';
      case 'AT_RISK':
        return 'bg-amber-50 text-amber-800 border-gold-400/60';
      case 'CRITICAL':
      default:
        return 'bg-rose-50 text-rose-700 border-rose-200';
    }
  };

  return (
    <div className="p-4 bg-thistle-50/70 border border-gold-500/35 rounded-2xl space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-royal-950 uppercase tracking-wider">Pre-Flight Deliverability Grader</h4>
            {grade && (
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${getBadgeColor(grade.rating)}`}>
                {grade.score}/100 · {grade.rating}
              </span>
            )}
          </div>
          <p className="text-[11px] text-thistle-500 mt-0.5">
            Audit subject line length, spam trigger lexicon, Spintax diversity, and CAN-SPAM postal compliance.
          </p>
        </div>

        <button
          onClick={runDeliverabilityAudit}
          disabled={grading}
          className="px-3.5 py-1.5 btn-royal rounded-xl text-xs font-bold flex items-center gap-1.5"
        >
          <Icons.Admin className="text-gold-300" />
          <span>{grading ? 'Auditing...' : 'Audit Deliverability'}</span>
        </button>
      </div>

      {grade && (
        <div className="space-y-3 pt-2 border-t border-gold-500/30 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 bg-white border border-gold-500/35 rounded-xl text-center">
              <span className="text-[9px] uppercase font-bold text-thistle-500">Spam Triggers</span>
              <p className={`text-sm font-bold mt-0.5 ${grade.metrics.spamScore > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                {grade.metrics.spamScore} Found
              </p>
            </div>
            <div className="p-2.5 bg-white border border-gold-500/35 rounded-xl text-center">
              <span className="text-[9px] uppercase font-bold text-thistle-500">Permutations</span>
              <p className="text-sm font-bold text-royal-950 mt-0.5 font-mono">
                {grade.metrics.diversityPermutations} Variants
              </p>
            </div>
            <div className="p-2.5 bg-white border border-gold-500/35 rounded-xl text-center">
              <span className="text-[9px] uppercase font-bold text-thistle-500">Postal Address</span>
              <p className={`text-sm font-bold mt-0.5 ${grade.metrics.hasPhysicalAddress ? 'text-emerald-700' : 'text-amber-700'}`}>
                {grade.metrics.hasPhysicalAddress ? 'Configured' : 'Missing'}
              </p>
            </div>
            <div className="p-2.5 bg-white border border-gold-500/35 rounded-xl text-center">
              <span className="text-[9px] uppercase font-bold text-thistle-500">One-Click Opt-Out</span>
              <p className="text-sm font-bold text-emerald-700 mt-0.5">Enforced</p>
            </div>
          </div>

          {grade.metrics.warnings.length > 0 && (
            <div className="p-3 bg-amber-50/80 border border-gold-500/45 rounded-xl space-y-1">
              <span className="text-[10px] font-bold uppercase text-amber-900">Deliverability Recommendations</span>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-amber-900">
                {grade.metrics.warnings.map((w: string, idx: number) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};