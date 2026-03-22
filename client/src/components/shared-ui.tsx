import { Button } from "@/components/ui/button";
import { CalendarPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  episodeStatusColors,
  guestStatusColors,
  interviewStatusColors,
  getEpisodeStatusLabel,
  getGuestStatusLabel,
  getInterviewStatusLabel,
} from "@/lib/statusColors";
import { useLanguage } from "@/i18n/LanguageProvider";
import { format, parseISO } from "date-fns";

type StatusDomain = "episode" | "guest" | "interview";

interface StatusBadgeProps {
  status: string;
  domain: StatusDomain;
  className?: string;
}

export function StatusBadge({ status, domain, className }: StatusBadgeProps) {
  const { t } = useLanguage();

  const colorMap: Record<StatusDomain, Record<string, string>> = {
    episode: episodeStatusColors,
    guest: guestStatusColors,
    interview: interviewStatusColors,
  };

  const labelFn: Record<StatusDomain, (status: string) => string> = {
    episode: (s) => getEpisodeStatusLabel(t, s),
    guest: (s) => getGuestStatusLabel(t, s),
    interview: (s) => getInterviewStatusLabel(t, s),
  };

  const colorClass = colorMap[domain][status] ?? "bg-muted text-muted-foreground border-transparent";
  const label = labelFn[domain](status);

  return (
    <span className={cn("ios-badge border-0", colorClass, className)}>
      {label}
    </span>
  );
}

interface CalendarInviteButtonProps {
  onClick: () => void;
  label?: string;
  isPending?: boolean;
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
}

export function CalendarInviteButton({
  onClick,
  label,
  isPending,
  disabled,
  className,
  "data-testid": testId,
}: CalendarInviteButtonProps) {
  const { t } = useLanguage();
  const displayLabel = label ?? t.scheduling?.sendInvite ?? "Send Calendar Invite";

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled || isPending}
      className={cn("gap-1.5", className)}
      data-testid={testId}
    >
      <CalendarPlus className="h-3.5 w-3.5" />
      {isPending ? "..." : displayLabel}
    </Button>
  );
}

interface DateTimeDisplayProps {
  date: string | null | undefined;
  time?: string | null;
  fallback?: string;
  className?: string;
}

export function DateTimeDisplay({ date, time, fallback, className }: DateTimeDisplayProps) {
  const { t } = useLanguage();
  const noDateText = fallback ?? t.dashboard?.noDateSet ?? "No date set";

  if (!date) {
    return (
      <span className={cn("text-muted-foreground/50 italic", className)}>
        {noDateText}
      </span>
    );
  }

  const formatted = format(parseISO(date), "MMM d, yyyy");
  const timeStr = time ? ` · ${time}` : "";

  return (
    <span className={cn(className)}>
      {formatted}{timeStr}
    </span>
  );
}
