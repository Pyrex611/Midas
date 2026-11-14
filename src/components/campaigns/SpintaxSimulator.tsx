import React, { useState } from 'react';
import { Icons } from '../../lib/icons';

interface SpintaxSimulatorProps {
  subject: string;
  body: string;
}

export const SpintaxSimulator: React.FC<SpintaxSimulatorProps> = ({ subject, body }) => {
  const [samples, setSamples] = useState<{ subject: string; body: string }[]>([]);

  const resolveSpintax = (text: string): string => {
    const spintaxRegex = /\{([^{}]+?\|[^{}]+?)\}/g;
    let result = text;
    let iterations = 0;
    while (spintaxRegex.test(result) && iterations < 50) {
      result = result.replace(spintaxRegex, (_, choices) => {
        const options = choices.split('|');
        return options[Math.floor(Math.random() * options.length)] || '';
      });
      iterations++;
    }
    return result;
  };

  const generateSamples = () => {
    const mockLead = { name: 'Sarah Chen', company: 'Acme Robotics' };
    const generated = Array.from({ length: 3 }, () => {
      let s = subject.replace(/\{\{name\}\}/gi, mockLead.name).replace(/\{\{company\}\}/gi, mockLead.company);
      let b = body.replace(/\{\{name\}\}/gi, mockLead.name).replace(/\{\{company\}\}/gi, mockLead.company);
      s = resolveSpintax(s);
      b = resolveSpintax(b);
      return { subject: s, body: b };
    });
    setSamples(generated);
  };

  return (
    <div className="p-4 bg-thistle-50/70 border border-gold-500/35 rounded-2xl space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h4 className="text-xs font-bold text-royal-950 uppercase tracking-wider">Spintax Diversity Tester</h4>
          <p className="text-[11px] text-thistle-500">Test how permutations resolve with sample data (Sarah Chen @ Acme Robotics).</p>
        </div>
        <button
          onClick={generateSamples}
          className="px-3 py-1.5 bg-royal-950 hover:bg-royal-800 text-gold-300 border border-gold-500/40 rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5"
        >
          <Icons.Refresh />
          <span>Spin 3 Permutations</span>
        </button>
      </div>

      {samples.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-gold-500/30">
          {samples.map((sample, idx) => (
            <div key={idx} className="p-3 bg-white border border-gold-500/35 rounded-xl text-xs space-y-1">
              <p className="font-bold text-royal-950">
                <span className="text-[10px] text-gold-600 font-mono mr-2">#{idx + 1}</span>
                {sample.subject}
              </p>
              <p className="text-royal-950/75 whitespace-pre-wrap text-[11px] font-sans">{sample.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};