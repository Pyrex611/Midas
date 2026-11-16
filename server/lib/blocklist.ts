export function isEmailBlocked(email: string, blocklist: { pattern: string }[]): boolean {
  const cleanEmail = email.trim().toLowerCase();
  const emailDomain = cleanEmail.split('@')[1] || '';

  return blocklist.some((b) => {
    const cleanPattern = b.pattern.trim().toLowerCase().replace(/^\*@?/, '').replace(/^@/, '');
    if (!cleanPattern) return false;
    return (
      cleanEmail === cleanPattern ||
      emailDomain === cleanPattern ||
      cleanEmail.endsWith('@' + cleanPattern) ||
      cleanEmail.endsWith('.' + cleanPattern)
    );
  });
}