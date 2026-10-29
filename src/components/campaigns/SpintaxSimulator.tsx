import React, { useState } from 'react';

interface SpintaxSimulatorProps {
  subject: string;
  body: string;
}

export const SpintaxSimulator: React.FC<SpintaxSimulatorProps> = ({ subject, body }) => {
  const [samples, setSamples] = useState<{ subject: string; body: string }[]>([]);

  const resolveSpintax = (text: string): string => {
    const spintaxRegex = /\{([^{}]+)\}/g;
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
      let s = resolveSpintax(subject);
      let b = resolveSpintax(body);
      s = s.replace(/\{\{name\}\}/gi, mockLead.name).replace(/\{\{company\}\}/gi, mockLead.company);
      b = b.replace(/\{\{name\}\}/gi, mockLead.name).replace(/\{\{company\}\}/gi, mockLead.company);
      return { subject: s, body: b };
    });
    setSamples(generated);
  };

  return (
    <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Spintax Diversity Tester</h4>
          <p className="text-[11px] text-zinc-500">Test how permutations resolve with sample data (Sarah Chen @ Acme Robotics).</p>
        </div>
        <button
          onClick={generateSamples}
          className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
        >
          🎲 Spin 3 Permutations
        </button>
      </div>

      {samples.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-zinc-200/60">
          {samples.map((sample, idx) => (
            <div key={idx} className="p-3 bg-white border border-zinc-200 rounded-xl text-xs space-y-1">
              <p className="font-bold text-zinc-900">
                <span className="text-[10px] text-zinc-400 font-mono mr-2">#{idx + 1}</span>
                {sample.subject}
              </p>
              <p className="text-zinc-600 whitespace-pre-wrap text-[11px] font-sans opacity-90">{sample.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};