import { Progress } from "@/components/ui/progress.tsx";

/**
 * How far the session has gone: the app's one progress bar, filled by what was answered.
 * The count itself is written next to it by the page ("3 de 10 respondidas").
 */
export function StudySessionProgress({
  completed,
  total,
  label,
  className,
}: {
  completed: number;
  total: number;
  label: string;
  className?: string;
}) {
  const maximum = Math.max(1, total);
  const value = Math.min(maximum, Math.max(0, completed));
  return <Progress aria-label={label} className={className} max={maximum} value={value} />;
}
