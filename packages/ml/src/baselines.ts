/** The old project's rule: raise at 80% accuracy, lower under 60%. Kept only as an evaluation baseline. */
export function thresholdNext(accuracyPercent: number, level: number, maxLevel: number): number {
  if (accuracyPercent >= 80) return Math.min(maxLevel, level + 1);
  if (accuracyPercent < 60) return Math.max(0, level - 1);
  return level;
}
