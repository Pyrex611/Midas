/**
 * Calculates the next active time for a campaign based on its specific timezone.
 */
export function getNextActiveTime(now: Date, startHour: number, endHour: number, timezone: string = 'UTC'): Date {
  // 1. Get the current hour in the TARGET timezone
  const targetTimeStr = now.toLocaleString('en-US', { timeZone: timezone, hour12: false, hour: '2-digit' });
  const currentTargetHour = parseInt(targetTimeStr);

  // 2. If we are currently within the window in that timezone, return "now"
  if (currentTargetHour >= startHour && currentTargetHour < endHour) {
    return now;
  }

  // 3. Otherwise, calculate the start of the next window
  const next = new Date(now);
  
  // We move to the start hour. If the hour has already passed today in that TZ, 
  // we move to tomorrow.
  // Note: For simplicity and to avoid complex offset math, we increment by 1 hour
  // until we hit the start hour in the target timezone.
  let safetyCounter = 0;
  while (safetyCounter < 24) {
    next.setUTCHours(next.getUTCHours() + 1);
    const hourCheck = parseInt(next.toLocaleString('en-US', { timeZone: timezone, hour12: false, hour: '2-digit' }));
    if (hourCheck === startHour) break;
    safetyCounter++;
  }

  next.setUTCMinutes(0, 0, 0);
  return next;
}