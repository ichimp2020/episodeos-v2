import type { Episode, Interview } from "@shared/schema";

export function needsReschedule(
  episode: Episode,
  availableStudioDates: Set<string>,
  takenStudioDates: Set<string>,
  interview: Interview | null | undefined,
): boolean {
  if (interview?.status === "needs-reschedule") return true;
  const dateNoLongerAvailable =
    !!episode.scheduledDate &&
    !availableStudioDates.has(episode.scheduledDate) &&
    !takenStudioDates.has(episode.scheduledDate);
  return dateNoLongerAvailable && !["publishing", "archived"].includes(episode.status);
}

export function canReschedule(episode: Episode): boolean {
  return !["publishing", "archived"].includes(episode.status);
}
