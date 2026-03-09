export function getNextActiveTime(now: Date, startHour: number, endHour: number): Date {
  const currentHour = now.getUTCHours();
  if (currentHour >= startHour && currentHour < endHour) {
    return now; // already in window
  }
  const next = new Date(now);
  next.setUTCHours(startHour, 0, 0, 0);
  if (next <= now) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}