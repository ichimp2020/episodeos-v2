import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mic, Users, Calendar, Clock, CalendarClock, UserPlus, Upload, ChevronRight, TrendingUp, Trash2, ClipboardPaste, X, Radio, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Episode, Task, TeamMember, StudioDate, Guest, Interview, Publishing } from "@shared/schema";
import { format, parseISO, isAfter, isBefore, subDays } from "date-fns";
import { Link, useLocation } from "wouter";
import GuestEditDialog from "@/components/GuestEditDialog";
import EpisodeEditDialog from "@/components/EpisodeEditDialog";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const statusColors: Record<string, string> = {
  scheduled: "bg-primary/10 text-primary",
  planning: "bg-chart-4/10 text-chart-4",
  recording: "bg-chart-5/10 text-chart-5",
  editing: "bg-chart-3/10 text-chart-3",
  publishing: "bg-chart-2/10 text-chart-2",
  archived: "bg-muted text-muted-foreground",
};

const interviewStatusColors: Record<string, string> = {
  proposed: "bg-chart-4/10 text-chart-4",
  confirmed: "bg-chart-2/10 text-chart-2",
  completed: "bg-primary/10 text-primary",
  cancelled: "bg-destructive/10 text-destructive",
  "needs-reschedule": "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
};

const guestStatusColors: Record<string, string> = {
  prospect: "bg-chart-4/10 text-chart-4",
  contacted: "bg-amber-500/10 text-amber-600",
  confirmed: "bg-chart-2/10 text-chart-2",
  declined: "bg-destructive/10 text-destructive",
  completed: "bg-primary/10 text-primary",
};

export default function Dashboard() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const [quickEditGuest, setQuickEditGuest] = useState<Guest | null>(null);
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [quickEditEpisode, setQuickEditEpisode] = useState<Episode | null>(null);
  const [quickEditEpisodeOpen, setQuickEditEpisodeOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const { toast } = useToast();

  const deleteEpisode = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/episodes/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Episode deleted" });
    },
  });

  const deleteGuest = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/guests/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/guests"] });
      toast({ title: "Guest deleted" });
    },
  });

  const deleteInterview = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/interviews/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/interviews"] });
      toast({ title: "Interview deleted" });
    },
  });

  const bulkImportGuests = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiRequest("POST", "/api/guests/bulk", { text });
      return res.json();
    },
    onSuccess: (data: { created: Guest[]; skipped: string[] }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/guests"] });
      const parts = [];
      if (data.created.length > 0) parts.push(`${data.created.length} ${t.dashboard.created}`);
      if (data.skipped.length > 0) parts.push(`${data.skipped.length} ${t.dashboard.skipped}`);
      toast({ title: t.dashboard.importSuccess, description: parts.join(", ") });
      setImportOpen(false);
      setImportText("");
    },
  });

  const { data: settings } = useQuery<{ podcastName: string }>({
    queryKey: ["/api/settings"],
  });
  const { data: episodes, isLoading: loadingEpisodes } = useQuery<Episode[]>({
    queryKey: ["/api/episodes"],
  });
  const { data: tasks, isLoading: loadingTasks } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });
  const { data: members, isLoading: loadingMembers } = useQuery<TeamMember[]>({
    queryKey: ["/api/team-members"],
  });
  const { data: studioDates, isLoading: loadingStudio } = useQuery<StudioDate[]>({
    queryKey: ["/api/studio-dates"],
  });
  const { data: guests } = useQuery<Guest[]>({
    queryKey: ["/api/guests"],
  });
  const { data: allInterviews } = useQuery<Interview[]>({
    queryKey: ["/api/interviews"],
  });
  const { data: allPublishing } = useQuery<Publishing[]>({
    queryKey: ["/api/publishing"],
  });

  const isLoading = loadingEpisodes || loadingTasks || loadingMembers || loadingStudio;

  const activeEpisodes = episodes?.filter((e) => e.status !== "publishing" && e.status !== "archived")
    .sort((a, b) => {
      if (!a.scheduledDate) return 1;
      if (!b.scheduledDate) return -1;
      return parseISO(a.scheduledDate).getTime() - parseISO(b.scheduledDate).getTime();
    }) || [];

  const goingLiveEpisodes = episodes?.filter((e) => {
    if (e.status !== "publishing" || !e.publishDate) return false;
    const datePart = e.publishDate;
    const timePart = e.publishTime || "00:00";
    const publishDateTime = new Date(`${datePart}T${timePart}:00`);
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return publishDateTime >= now && publishDateTime <= in24h;
  }) || [];
  const hasTimeSlots = (notes: string | null) => {
    if (!notes) return false;
    return /\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/.test(notes);
  };
  const upcomingDates = studioDates
    ?.filter((d) => d.status === "available" && isAfter(parseISO(d.date), new Date()) && hasTimeSlots(d.notes))
    .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime())
    .slice(0, 5) || [];
  const pendingTasks = tasks?.filter((t) => t.status !== "done") || [];

  const twoWeeksAgo = subDays(new Date(), 14);
  const confirmedRecently = allInterviews
    ?.filter((i) => {
      if (i.status !== "confirmed") return false;
      if (i.scheduledDate && isAfter(parseISO(i.scheduledDate), twoWeeksAgo)) return true;
      if (i.createdAt && isAfter(parseISO(i.createdAt as unknown as string), twoWeeksAgo)) return true;
      return false;
    })
    .sort((a, b) => {
      if (!a.scheduledDate) return 1;
      if (!b.scheduledDate) return -1;
      return parseISO(a.scheduledDate).getTime() - parseISO(b.scheduledDate).getTime();
    })
    .slice(0, 5) || [];

  const scheduledPublishing = allPublishing?.filter((p) => p.status === "scheduled")
    .sort((a, b) => {
      if (!a.scheduledDate) return 1;
      if (!b.scheduledDate) return -1;
      return parseISO(a.scheduledDate).getTime() - parseISO(b.scheduledDate).getTime();
    })
    .slice(0, 3) || [];

  const pipelineGuests = guests || [];
  const prospectGuests = pipelineGuests.filter((g) => g.status === "prospect");
  const contactedGuests = pipelineGuests.filter((g) => g.status === "contacted");
  const confirmedGuests = pipelineGuests.filter((g) => g.status === "confirmed");
  const declinedGuests = pipelineGuests.filter((g) => g.status === "declined");

  const getGuest = (id: string) => guests?.find((g) => g.id === id);
  const getMember = (id: string) => members?.find((m) => m.id === id);

  const getEpisodeGuest = (episode: Episode) => {
    if (episode.guestId) return guests?.find((g) => g.id === episode.guestId) || null;
    if (episode.interviewId) {
      const interview = allInterviews?.find((i) => i.id === episode.interviewId);
      if (interview) return guests?.find((g) => g.id === interview.guestId) || null;
    }
    return null;
  };

  const allStudioDateStrings = useMemo(() => {
    if (!studioDates) return new Set<string>();
    return new Set(studioDates.map((d) => d.date));
  }, [studioDates]);

  const getEpisodeInterview = (episode: Episode) => {
    if (episode.interviewId) return allInterviews?.find((i) => i.id === episode.interviewId) || null;
    if (episode.guestId) return allInterviews?.find((i) => i.guestId === episode.guestId) || null;
    return null;
  };

  const episodeNeedsReschedule = (episode: Episode) => {
    if (["publishing", "archived"].includes(episode.status)) return false;
    const interview = getEpisodeInterview(episode);
    if (interview?.status === "needs-reschedule") return true;
    if (episode.scheduledDate && !allStudioDateStrings.has(episode.scheduledDate)) return true;
    return false;
  };

  const isEpisodePastDate = (episode: Episode) => {
    if (!episode.scheduledDate) return false;
    if (["publishing", "archived"].includes(episode.status)) return false;
    return isBefore(parseISO(episode.scheduledDate), new Date());
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-dashboard-title">
          {t.dashboard.title}{settings?.podcastName ? <span className="text-muted-foreground font-normal"> "{settings.podcastName}"</span> : ""}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t.dashboard.subtitle}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: t.dashboard.activeEpisodes, value: activeEpisodes.length, icon: Mic, color: "from-blue-500/10 to-blue-600/5", iconColor: "text-blue-500", iconBg: "bg-blue-500/10", href: "/episodes" },
          { label: t.dashboard.confirmedRecently, value: confirmedRecently.length, icon: CalendarClock, color: "from-emerald-500/10 to-emerald-600/5", iconColor: "text-emerald-500", iconBg: "bg-emerald-500/10", href: "/studio" },
          { label: t.dashboard.openTasks, value: pendingTasks.length, icon: Clock, color: "from-amber-500/10 to-amber-600/5", iconColor: "text-amber-500", iconBg: "bg-amber-500/10", href: "/episodes" },
          { label: t.dashboard.guestPipeline, value: guests?.length || 0, icon: UserPlus, color: "from-purple-500/10 to-purple-600/5", iconColor: "text-purple-500", iconBg: "bg-purple-500/10", href: "/guests" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="ios-stat-card cursor-pointer hover-elevate transition-transform active:scale-[0.97]"
            onClick={() => setLocation(stat.href)}
            data-testid={`card-stat-${stat.label.toLowerCase().replace(/\s/g, "-")}`}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} rounded-2xl pointer-events-none`} />
            <div className="relative flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl sm:text-3xl font-bold mt-1.5 tracking-tight">{stat.value}</p>
              </div>
              <div className={`flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-2xl ${stat.iconBg}`}>
                <stat.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.iconColor}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {goingLiveEpisodes.length > 0 && (
        <div className="ios-section border-2 border-chart-2/30 bg-gradient-to-r from-chart-2/5 to-transparent">
          <div className="ios-section-header">
            <h2 className="ios-section-title flex items-center gap-2" data-testid="text-going-live-title">
              <Radio className="h-4 w-4 text-chart-2 animate-pulse" />
              <span className="text-chart-2">{t.dashboard.goingLive}</span>
            </h2>
          </div>
          <div className="px-4 pb-4 space-y-2">
            {goingLiveEpisodes.map((ep) => {
              const guest = getEpisodeGuest(ep);
              const publishDate = ep.publishDate ? parseISO(ep.publishDate) : null;
              const hoursUntil = publishDate ? Math.max(0, Math.round((publishDate.getTime() - Date.now()) / (1000 * 60 * 60))) : null;
              return (
                <div
                  key={ep.id}
                  className="flex items-center justify-between rounded-xl bg-background/80 p-3 cursor-pointer hover-elevate transition-transform active:scale-[0.98]"
                  onClick={() => setLocation(`/episodes?highlight=${ep.id}`)}
                  data-testid={`card-going-live-${ep.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-chart-2/10">
                      <Radio className="h-4 w-4 text-chart-2" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{guest?.name || ep.title}</p>
                      {ep.title && guest?.name && <p className="text-xs text-muted-foreground truncate">{ep.title}</p>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge className="bg-chart-2/10 text-chart-2 border-0">
                      {hoursUntil !== null && hoursUntil <= 0 ? t.dashboard.today : hoursUntil !== null && hoursUntil <= 1 ? `< 1 ${t.dashboard.hours}` : `${t.dashboard.goingLiveIn} ${hoursUntil} ${t.dashboard.hours}`}
                    </Badge>
                    {ep.publishTime && <p className="text-[10px] text-muted-foreground mt-0.5">{ep.publishTime}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="ios-section">
          <div className="ios-section-header">
            <h2 className="ios-section-title" data-testid="text-active-episodes-title">{t.dashboard.activeEpisodes}</h2>
            <Link href="/episodes">
              <span className="ios-pill-button ios-pill-button-secondary text-xs !px-3 !py-1.5 cursor-pointer" data-testid="link-view-all-episodes">
                {t.dashboard.viewAll}
                <ChevronRight className="h-3 w-3" />
              </span>
            </Link>
          </div>
          <div className="px-4 pb-4 space-y-2">
            {activeEpisodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/50 mb-3">
                  <Mic className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground">{t.dashboard.noActiveEpisodes}</p>
              </div>
            ) : (
              activeEpisodes.slice(0, 5).map((episode) => {
                const episodeTasks = tasks?.filter((t) => t.episodeId === episode.id) || [];
                const doneTasks = episodeTasks.filter((t) => t.status === "done").length;
                const guest = getEpisodeGuest(episode);
                const needsReschedule = episodeNeedsReschedule(episode);
                const pastDate = isEpisodePastDate(episode);
                return (
                  <div
                    key={episode.id}
                    className="group ios-list-item cursor-pointer hover-elevate"
                    onClick={() => { setQuickEditEpisode(episode); setQuickEditEpisodeOpen(true); }}
                    data-testid={`card-episode-${episode.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {episode.episodeNumber && (
                          <span className="text-[11px] text-muted-foreground font-mono bg-muted/50 rounded-md px-1.5 py-0.5">#{episode.episodeNumber}</span>
                        )}
                        <p className="text-sm font-semibold truncate">{guest?.name || episode.title}</p>
                        {needsReschedule && (
                          <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 gap-1" data-testid={`badge-reschedule-dash-${episode.id}`}>
                            <AlertTriangle className="w-3 h-3" />
                            {t.common.rescheduleNeeded}
                          </Badge>
                        )}
                      </div>
                      {episode.scheduledDate && (
                        <p className={`text-xs mt-1 ${pastDate ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                          {format(parseISO(episode.scheduledDate), "MMM d, yyyy")}{episode.scheduledTime ? ` at ${episode.scheduledTime}` : ""}
                          {pastDate && " (past)"}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {episodeTasks.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-chart-2 rounded-full transition-all duration-500"
                              style={{ width: `${(doneTasks / episodeTasks.length) * 100}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-muted-foreground font-medium">
                            {doneTasks}/{episodeTasks.length}
                          </span>
                        </div>
                      )}
                      <Badge className={`ios-badge border-0 ${statusColors[episode.status]}`}>
                        {episode.status}
                      </Badge>
                      <button
                        className="opacity-0 group-hover:opacity-100 hover:text-destructive text-muted-foreground transition-opacity p-1 rounded-md hover:bg-destructive/10"
                        onClick={(e) => { e.stopPropagation(); deleteEpisode.mutate(episode.id); }}
                        data-testid={`button-delete-episode-dash-${episode.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="ios-section">
          <div className="ios-section-header">
            <h2 className="ios-section-title" data-testid="text-guest-pipeline-title">{t.dashboard.guestPipeline}</h2>
            <div className="flex items-center gap-2">
              <button
                className="ios-pill-button ios-pill-button-secondary text-xs !px-3 !py-1.5 cursor-pointer"
                onClick={() => setImportOpen(true)}
                data-testid="button-import-guests"
              >
                <ClipboardPaste className="h-3 w-3" />
                {t.dashboard.importGuests}
              </button>
              <Link href="/guests">
                <span className="ios-pill-button ios-pill-button-secondary text-xs !px-3 !py-1.5 cursor-pointer" data-testid="link-view-all-guests">
                  {t.dashboard.viewAll}
                  <ChevronRight className="h-3 w-3" />
                </span>
              </Link>
            </div>
          </div>
          <div className="px-4 pb-4 space-y-3">
            {pipelineGuests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/50 mb-3">
                  <UserPlus className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground">{t.dashboard.noGuestsInPipeline}</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: t.dashboard.prospects, count: prospectGuests.length, color: "bg-chart-4/10 text-chart-4" },
                    { label: t.dashboard.contacted, count: contactedGuests.length, color: "bg-amber-500/10 text-amber-600" },
                    { label: t.dashboard.confirmed, count: confirmedGuests.length, color: "bg-chart-2/10 text-chart-2" },
                    { label: t.dashboard.declined, count: declinedGuests.length, color: "bg-destructive/10 text-destructive" },
                  ].map((stage) => (
                    <div key={stage.label} className="text-center py-2.5 rounded-xl bg-muted/30" data-testid={`stat-pipeline-${stage.label.toLowerCase()}`}>
                      <p className="text-lg font-bold">{stage.count}</p>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{stage.label}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  {pipelineGuests
                    .sort((a, b) => {
                      const order = ["prospect", "contacted", "confirmed", "declined", "completed"];
                      return order.indexOf(a.status) - order.indexOf(b.status);
                    })
                    .slice(0, 4)
                    .map((guest) => {
                      const assignee = guest.addedBy ? getMember(guest.addedBy) : null;
                      return (
                        <div
                          key={guest.id}
                          className="group ios-list-item cursor-pointer hover-elevate"
                          onClick={() => { setQuickEditGuest(guest); setQuickEditOpen(true); }}
                          data-testid={`card-pipeline-guest-${guest.id}`}
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-500/10 shrink-0">
                            <UserPlus className="h-4 w-4 text-purple-500" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate">{guest.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {assignee && (
                                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white" style={{ backgroundColor: assignee.color }}>{assignee.initials}</span>
                                  {assignee.name}
                                </span>
                              )}
                              {guest.shortDescription ? (
                                <span className="text-[11px] text-muted-foreground truncate">{guest.shortDescription}</span>
                              ) : null}
                            </div>
                          </div>
                          <Badge className={`ios-badge border-0 ${guestStatusColors[guest.status]}`}>
                            {guest.status}
                          </Badge>
                          <button
                            className="opacity-0 group-hover:opacity-100 hover:text-destructive text-muted-foreground transition-opacity p-1 rounded-md hover:bg-destructive/10"
                            onClick={(e) => { e.stopPropagation(); deleteGuest.mutate(guest.id); }}
                            data-testid={`button-delete-guest-dash-${guest.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="ios-section">
          <div className="ios-section-header">
            <h2 className="ios-section-title" data-testid="text-confirmed-recently-title">{t.dashboard.confirmedRecently}</h2>
            <Link href="/scheduling">
              <span className="ios-pill-button ios-pill-button-secondary text-xs !px-3 !py-1.5 cursor-pointer" data-testid="link-view-scheduling">
                {t.dashboard.viewAll}
                <ChevronRight className="h-3 w-3" />
              </span>
            </Link>
          </div>
          <div className="px-4 pb-4 space-y-2">
            {confirmedRecently.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50 mb-2">
                  <CalendarClock className="h-5 w-5 text-muted-foreground/40" />
                </div>
                <p className="text-xs text-muted-foreground">{t.dashboard.noRecentConfirmations}</p>
              </div>
            ) : (
              confirmedRecently.map((interview) => {
                const guest = getGuest(interview.guestId);
                return (
                  <div
                    key={interview.id}
                    className="group ios-list-item cursor-pointer hover-elevate"
                    onClick={() => {
                      if (guest) { setQuickEditGuest(guest); setQuickEditOpen(true); }
                    }}
                    data-testid={`card-confirmed-${interview.id}`}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-chart-2/10 shrink-0">
                      <CalendarClock className="h-4 w-4 text-chart-2" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{guest?.name || "Unknown"}</p>
                      {interview.scheduledDate && (
                        <span className="text-[11px] text-muted-foreground">
                          {format(parseISO(interview.scheduledDate), "MMM d, yyyy")}
                          {interview.scheduledTime && ` at ${interview.scheduledTime}`}
                        </span>
                      )}
                    </div>
                    <Badge className="ios-badge border-0 bg-chart-2/10 text-chart-2">
                      {t.dashboard.confirmed}
                    </Badge>
                    <button
                      className="opacity-0 group-hover:opacity-100 hover:text-destructive text-muted-foreground transition-opacity p-1 rounded-md hover:bg-destructive/10"
                      onClick={(e) => { e.stopPropagation(); deleteInterview.mutate(interview.id); }}
                      data-testid={`button-delete-interview-dash-${interview.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="ios-section">
          <div className="ios-section-header">
            <h2 className="ios-section-title">{t.dashboard.studioAvailability}</h2>
            <Link href="/studio">
              <span className="ios-pill-button ios-pill-button-secondary text-xs !px-3 !py-1.5 cursor-pointer" data-testid="link-view-studio">
                {t.dashboard.viewCalendar}
                <ChevronRight className="h-3 w-3" />
              </span>
            </Link>
          </div>
          <div className="px-4 pb-4 space-y-2">
            {upcomingDates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50 mb-2">
                  <Calendar className="h-5 w-5 text-muted-foreground/40" />
                </div>
                <p className="text-xs text-muted-foreground">{t.dashboard.noUpcomingStudioDates}</p>
              </div>
            ) : (
              upcomingDates.slice(0, 5).map((d) => (
                <div
                  key={d.id}
                  className="ios-list-item cursor-pointer hover-elevate"
                  onClick={() => setLocation("/studio")}
                  data-testid={`card-studio-date-${d.id}`}
                >
                  <div className="flex h-10 w-10 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/15 to-emerald-600/5 shrink-0">
                    <span className="text-[9px] font-semibold text-chart-2 leading-none uppercase">
                      {format(parseISO(d.date), "MMM")}
                    </span>
                    <span className="text-sm font-bold text-chart-2 leading-tight">
                      {format(parseISO(d.date), "d")}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{format(parseISO(d.date), "EEEE")}</p>
                    {d.notes && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{d.notes.match(/\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/)?.[0] || d.notes}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="ios-section">
          <div className="ios-section-header">
            <h2 className="ios-section-title">{t.dashboard.teamWorkload}</h2>
            <Link href="/team">
              <span className="ios-pill-button ios-pill-button-secondary text-xs !px-3 !py-1.5 cursor-pointer" data-testid="link-view-team">
                {t.dashboard.viewTeam}
                <ChevronRight className="h-3 w-3" />
              </span>
            </Link>
          </div>
          <div className="px-4 pb-4">
            <div className="space-y-1.5">
              {members?.slice(0, 6).map((member) => {
                const memberTasks = pendingTasks.filter((t) => (t.assigneeIds || (t.assigneeId ? [t.assigneeId] : [])).includes(member.id));
                return (
                  <div
                    key={member.id}
                    className="ios-list-item cursor-pointer hover-elevate"
                    onClick={() => setLocation("/team")}
                    data-testid={`card-member-workload-${member.id}`}
                  >
                    <Avatar className="h-8 w-8 ring-2 ring-background shadow-sm">
                      <AvatarFallback
                        className="text-[10px] font-semibold text-white"
                        style={{ backgroundColor: member.color }}
                      >
                        {member.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{member.name}</p>
                    </div>
                    {memberTasks.length > 0 && (
                      <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold px-1">
                        {memberTasks.length}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <GuestEditDialog
        guest={quickEditGuest}
        open={quickEditOpen}
        onOpenChange={(open) => { setQuickEditOpen(open); if (!open) setQuickEditGuest(null); }}
        members={members}
      />

      <EpisodeEditDialog
        episode={quickEditEpisode}
        open={quickEditEpisodeOpen}
        onOpenChange={(open) => { setQuickEditEpisodeOpen(open); if (!open) setQuickEditEpisode(null); }}
      />

      <Dialog open={importOpen} onOpenChange={(open) => { setImportOpen(open); if (!open) setImportText(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardPaste className="h-5 w-5 text-purple-500" />
              {t.dashboard.importGuests}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">{t.dashboard.pasteWhatsAppMessage}</p>
          </DialogHeader>
          <div className="space-y-4">
            <textarea
              className="w-full min-h-[160px] rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              placeholder={t.dashboard.pasteHere}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              dir="auto"
              data-testid="textarea-import-guests"
            />
            <div className="flex justify-end gap-2">
              <button
                className="ios-pill-button ios-pill-button-secondary text-sm !px-4 !py-2"
                onClick={() => { setImportOpen(false); setImportText(""); }}
                data-testid="button-cancel-import"
              >
                {t.scheduling.cancel}
              </button>
              <button
                className="ios-pill-button text-sm !px-4 !py-2 bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50"
                onClick={() => bulkImportGuests.mutate(importText)}
                disabled={!importText.trim() || bulkImportGuests.isPending}
                data-testid="button-confirm-import"
              >
                {bulkImportGuests.isPending ? t.dashboard.importing : t.dashboard.importNames}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
