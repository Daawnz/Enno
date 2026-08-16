export function formatCountdown(ms: number): string {
  const totalSecs = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSecs / 60);
  const seconds = totalSecs % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function remainingMs(endTime: number, now: number): number {
  return endTime ? Math.max(0, endTime - now) : 0;
}

export function ringProgress(endTime: number, totalMs: number, now: number): number {
  if (!endTime)
    return 1;
  const remaining = remainingMs(endTime, now);
  return Math.max(0, Math.min(1, remaining / totalMs));
}
