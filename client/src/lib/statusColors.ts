export const episodeStatusColors: Record<string, string> = {
  scheduled: "bg-primary/10 text-primary border-transparent",
  planning: "bg-chart-4/10 text-chart-4 border-transparent",
  recording: "bg-chart-5/10 text-chart-5 border-transparent",
  editing: "bg-chart-3/10 text-chart-3 border-transparent",
  publishing: "bg-chart-2/10 text-chart-2 border-transparent",
  archived: "bg-muted text-muted-foreground border-transparent",
};

export const guestStatusColors: Record<string, string> = {
  prospect: "bg-chart-4/10 text-chart-4 border-transparent",
  contacted: "bg-amber-500/10 text-amber-600 border-transparent",
  confirmed: "bg-chart-2/10 text-chart-2 border-transparent",
  declined: "bg-destructive/10 text-destructive border-transparent",
};

export const interviewStatusColors: Record<string, string> = {
  proposed: "bg-chart-4/10 text-chart-4 border-transparent",
  confirmed: "bg-chart-2/10 text-chart-2 border-transparent",
  completed: "bg-primary/10 text-primary border-transparent",
  cancelled: "bg-destructive/10 text-destructive border-transparent",
  "needs-reschedule": "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-transparent",
};

export const publishingStatusColors: Record<string, string> = {
  scheduled: "bg-chart-4/10 text-chart-4 border-transparent",
  published: "bg-chart-2/10 text-chart-2 border-transparent",
  failed: "bg-destructive/10 text-destructive border-transparent",
};

export function getEpisodeStatusLabel(t: any, status: string): string {
  const map: Record<string, string> = {
    scheduled: t.episodes?.scheduled,
    planning: t.episodes?.planning,
    recording: t.episodes?.recording,
    editing: t.episodes?.editing,
    publishing: t.episodes?.publishing,
    archived: t.episodes?.archived,
  };
  return map[status] || status;
}

export function getGuestStatusLabel(t: any, status: string): string {
  const map: Record<string, string> = {
    prospect: t.guests?.prospect,
    contacted: t.guests?.contacted,
    confirmed: t.guests?.confirmed,
    declined: t.guests?.declined,
  };
  return map[status] || status;
}

export function getInterviewStatusLabel(t: any, status: string): string {
  const map: Record<string, string> = {
    proposed: t.scheduling?.proposed,
    confirmed: t.scheduling?.confirmed,
    completed: t.scheduling?.completed,
    cancelled: t.scheduling?.cancelled,
    "needs-reschedule": t.common?.rescheduleNeeded || "needs-reschedule",
  };
  return map[status] || status;
}

export function getPublishingStatusLabel(t: any, status: string): string {
  const map: Record<string, string> = {
    scheduled: t.publishing?.scheduled,
    published: t.publishing?.publishedLabel,
    failed: t.publishing?.failed,
  };
  return map[status] || status;
}
