import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mic, Users, Calendar, Clock, CalendarClock, UserPlus, Upload, ChevronRight, TrendingUp } from "lucide-react";
import type { Episode, Task, TeamMember, StudioDate, Guest, Interview, Publishing } from "@shared/schema";
import { format, parseISO, isAfter } from "date-fns";
import { Link } from "wouter";

const statusColors: Record<string, string> = {
  planning: "bg-chart-4/10 text-chart-4",
  scheduled: "bg-primary/10 text-primary",
  recording: "bg-chart-5/10 text-chart-5",
  editing: "bg-chart-3/10 text-chart-3",
  published: "bg-chart-2/10 text-chart-2",
};

const interviewStatusColors: Record<string, string> = {
  proposed: "bg-chart-4/10 text-chart-4",
  confirmed: "bg-chart-2/10 text-chart-2",
  completed: "bg-primary/10 text-primary",
  cancelled: "bg-destructive/10 text-destructive",
};

export default function Dashboard() {
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

  const activeEpisodes = episodes?.filter((e) => e.status !== "published")
    .sort((a, b) => {
      if (!a.scheduledDate) return 1;
      if (!b.scheduledDate) return -1;
      return parseISO(a.scheduledDate).getTime() - parseISO(b.scheduledDate).getTime();
    }) || [];
  const upcomingDates = studioDates
    ?.filter((d) => d.status === "available" && isAfter(parseISO(d.date), new Date()))
    .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime())
    .slice(0, 5) || [];
  const pendingTasks = tasks?.filter((t) => t.status !== "done") || [];
  const upcomingInterviews = allInterviews
    ?.filter((i) => i.status === "proposed" || i.status === "confirmed")
    .sort((a, b) => {
      if (!a.scheduledDate) return 1;
      if (!b.scheduledDate) return -1;
      return parseISO(a.scheduledDate).getTime() - parseISO(b.scheduledDate).getTime();
    })
    .slice(0, 3) || [];
  const scheduledPublishing = allPublishing?.filter((p) => p.status === "scheduled")
    .sort((a, b) => {
      if (!a.scheduledDate) return 1;
      if (!b.scheduledDate) return -1;
      return parseISO(a.scheduledDate).getTime() - parseISO(b.scheduledDate).getTime();
    })
    .slice(0, 3) || [];

  const getGuest = (id: string) => guests?.find((g) => g.id === id);

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
          Dashboard{settings?.podcastName ? <span className="text-muted-foreground font-normal"> "{settings.podcastName}"</span> : ""}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Your podcast at a glance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active Episodes", value: activeEpisodes.length, icon: Mic, color: "from-blue-500/10 to-blue-600/5", iconColor: "text-blue-500", iconBg: "bg-blue-500/10" },
          { label: "Upcoming Interviews", value: upcomingInterviews.length, icon: CalendarClock, color: "from-emerald-500/10 to-emerald-600/5", iconColor: "text-emerald-500", iconBg: "bg-emerald-500/10" },
          { label: "Open Tasks", value: pendingTasks.length, icon: Clock, color: "from-amber-500/10 to-amber-600/5", iconColor: "text-amber-500", iconBg: "bg-amber-500/10" },
          { label: "Guest Pipeline", value: guests?.length || 0, icon: UserPlus, color: "from-purple-500/10 to-purple-600/5", iconColor: "text-purple-500", iconBg: "bg-purple-500/10" },
        ].map((stat) => (
          <div key={stat.label} className="ios-stat-card" data-testid={`card-stat-${stat.label.toLowerCase().replace(/\s/g, "-")}`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} rounded-2xl pointer-events-none`} />
            <div className="relative flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                <p className="text-3xl font-bold mt-2 tracking-tight">{stat.value}</p>
              </div>
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${stat.iconBg}`}>
                <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="ios-section">
          <div className="ios-section-header">
            <h2 className="ios-section-title" data-testid="text-active-episodes-title">Active Episodes</h2>
            <Link href="/episodes">
              <span className="ios-pill-button ios-pill-button-secondary text-xs !px-3 !py-1.5 cursor-pointer" data-testid="link-view-all-episodes">
                View all
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
                <p className="text-sm text-muted-foreground">No active episodes yet</p>
              </div>
            ) : (
              activeEpisodes.slice(0, 4).map((episode) => {
                const episodeTasks = tasks?.filter((t) => t.episodeId === episode.id) || [];
                const doneTasks = episodeTasks.filter((t) => t.status === "done").length;
                return (
                  <div
                    key={episode.id}
                    className="ios-list-item cursor-pointer"
                    data-testid={`card-episode-${episode.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {episode.episodeNumber && (
                          <span className="text-[11px] text-muted-foreground font-mono bg-muted/50 rounded-md px-1.5 py-0.5">#{episode.episodeNumber}</span>
                        )}
                        <p className="text-sm font-semibold truncate">{episode.title}</p>
                      </div>
                      {episode.scheduledDate && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(parseISO(episode.scheduledDate), "MMM d, yyyy")}{episode.scheduledTime ? ` at ${episode.scheduledTime}` : ""}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2.5">
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
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="ios-section">
          <div className="ios-section-header">
            <h2 className="ios-section-title">Upcoming Interviews</h2>
            <Link href="/scheduling">
              <span className="ios-pill-button ios-pill-button-secondary text-xs !px-3 !py-1.5 cursor-pointer" data-testid="link-view-scheduling">
                View all
                <ChevronRight className="h-3 w-3" />
              </span>
            </Link>
          </div>
          <div className="px-4 pb-4 space-y-2">
            {upcomingInterviews.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/50 mb-3">
                  <CalendarClock className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground">No upcoming interviews</p>
              </div>
            ) : (
              upcomingInterviews.map((interview) => {
                const guest = getGuest(interview.guestId);
                return (
                  <div
                    key={interview.id}
                    className="ios-list-item"
                    data-testid={`card-interview-${interview.id}`}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-chart-2/10 shrink-0">
                      <CalendarClock className="h-4.5 w-4.5 text-chart-2" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{guest?.name || "Unknown"}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {interview.scheduledDate && (
                          <span className="text-xs text-muted-foreground">
                            {format(parseISO(interview.scheduledDate), "MMM d, yyyy")}
                            {interview.scheduledTime && ` at ${interview.scheduledTime}`}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge className={`ios-badge border-0 ${interviewStatusColors[interview.status]}`}>
                      {interview.status}
                    </Badge>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="ios-section">
          <div className="ios-section-header">
            <h2 className="ios-section-title">Studio Availability</h2>
            <Link href="/studio">
              <span className="ios-pill-button ios-pill-button-secondary text-xs !px-3 !py-1.5 cursor-pointer" data-testid="link-view-studio">
                View calendar
                <ChevronRight className="h-3 w-3" />
              </span>
            </Link>
          </div>
          <div className="px-4 pb-4 space-y-2">
            {upcomingDates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/50 mb-3">
                  <Calendar className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground">No upcoming studio dates</p>
              </div>
            ) : (
              upcomingDates.map((d) => (
                <div
                  key={d.id}
                  className="ios-list-item"
                  data-testid={`card-studio-date-${d.id}`}
                >
                  <div className="flex h-11 w-11 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/15 to-emerald-600/5 shrink-0">
                    <span className="text-[10px] font-semibold text-chart-2 leading-none uppercase">
                      {format(parseISO(d.date), "MMM")}
                    </span>
                    <span className="text-base font-bold text-chart-2 leading-tight">
                      {format(parseISO(d.date), "d")}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{format(parseISO(d.date), "EEEE")}</p>
                    {d.notes && <p className="text-xs text-muted-foreground mt-0.5">{d.notes}</p>}
                  </div>
                  <Badge className="ios-badge border-0 bg-chart-2/10 text-chart-2">
                    Available
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="ios-section">
          <div className="ios-section-header">
            <h2 className="ios-section-title">Team Workload</h2>
            <Link href="/team">
              <span className="ios-pill-button ios-pill-button-secondary text-xs !px-3 !py-1.5 cursor-pointer" data-testid="link-view-team">
                View team
                <ChevronRight className="h-3 w-3" />
              </span>
            </Link>
          </div>
          <div className="px-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {members?.map((member) => {
                const memberTasks = pendingTasks.filter((t) => t.assigneeId === member.id);
                return (
                  <div
                    key={member.id}
                    className="ios-list-item"
                    data-testid={`card-member-workload-${member.id}`}
                  >
                    <Avatar className="h-9 w-9 ring-2 ring-background shadow-sm">
                      <AvatarFallback
                        className="text-xs font-semibold text-white"
                        style={{ backgroundColor: member.color }}
                      >
                        {member.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.role}</p>
                    </div>
                    {memberTasks.length > 0 && (
                      <span className="inline-flex items-center justify-center h-6 min-w-6 rounded-full bg-primary/10 text-primary text-[11px] font-bold px-1.5">
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
    </div>
  );
}
