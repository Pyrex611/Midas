/**
 * Detects whether an LLM model belongs to a reasoning/thinking family
 * (e.g. Gemini 2.0/2.5 Thinking, OpenAI o1/o3/o4, DeepSeek-R1, QwQ, Nemotron).
 */
export function isReasoningModel(provider: string, model: string): boolean {
  if (!model || typeof model !== 'string') return false;
  const m = model.toLowerCase();

  return (
    m.includes('thinking') ||
    m.includes('nemotron') ||
    m.includes('deepseek-r1') ||
    m.includes('deepseek-reasoner') ||
    m.includes('qwq') ||
    m.includes(':thinking') ||
    m.startsWith('o1') ||
    m.startsWith('o3') ||
    m.startsWith('o4') ||
    m.includes('/o1') ||
    m.includes('/o3') ||
    m.includes('/o4')
  );
}