import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mic, Users, Calendar, CheckCircle, Clock, AlertCircle } from "lucide-react";
import type { Episode, Task, TeamMember, StudioDate } from "@shared/schema";
import { format, parseISO, isAfter, isBefore, addDays } from "date-fns";
import { Link } from "wouter";

const statusColors: Record<string, string> = {
  planning: "bg-chart-4/10 text-chart-4 border-transparent",
  scheduled: "bg-primary/10 text-primary border-transparent",
  recording: "bg-chart-5/10 text-chart-5 border-transparent",
  editing: "bg-chart-3/10 text-chart-3 border-transparent",
  published: "bg-chart-2/10 text-chart-2 border-transparent",
};

export default function Dashboard() {
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

  const isLoading = loadingEpisodes || loadingTasks || loadingMembers || loadingStudio;

  const activeEpisodes = episodes?.filter((e) => e.status !== "published") || [];
  const upcomingDates = studioDates
    ?.filter((d) => d.status === "available" && isAfter(parseISO(d.date), new Date()))
    .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime())
    .slice(0, 5) || [];
  const pendingTasks = tasks?.filter((t) => t.status !== "done") || [];
  const completedTasks = tasks?.filter((t) => t.status === "done") || [];

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-dashboard-title">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Your podcast at a glance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Active Episodes</p>
                <p className="text-2xl font-semibold mt-1" data-testid="text-active-episodes-count">{activeEpisodes.length}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                <Mic className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Team Members</p>
                <p className="text-2xl font-semibold mt-1" data-testid="text-team-count">{members?.length || 0}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-chart-2/10">
                <Users className="h-5 w-5 text-chart-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Open Tasks</p>
                <p className="text-2xl font-semibold mt-1" data-testid="text-open-tasks-count">{pendingTasks.length}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-chart-4/10">
                <Clock className="h-5 w-5 text-chart-4" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Studio Dates</p>
                <p className="text-2xl font-semibold mt-1" data-testid="text-studio-dates-count">{upcomingDates.length}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-chart-3/10">
                <Calendar className="h-5 w-5 text-chart-3" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <CardTitle className="text-base font-medium">Active Episodes</CardTitle>
            <Link href="/episodes">
              <span className="text-xs text-primary cursor-pointer" data-testid="link-view-all-episodes">View all</span>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeEpisodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Mic className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No active episodes yet</p>
              </div>
            ) : (
              activeEpisodes.slice(0, 4).map((episode) => {
                const episodeTasks = tasks?.filter((t) => t.episodeId === episode.id) || [];
                const doneTasks = episodeTasks.filter((t) => t.status === "done").length;
                return (
                  <div
                    key={episode.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-md bg-card hover-elevate"
                    data-testid={`card-episode-${episode.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {episode.episodeNumber && (
                          <span className="text-xs text-muted-foreground font-mono">#{episode.episodeNumber}</span>
                        )}
                        <p className="text-sm font-medium truncate">{episode.title}</p>
                      </div>
                      {episode.scheduledDate && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(parseISO(episode.scheduledDate), "MMM d, yyyy")}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {episodeTasks.length > 0 && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {doneTasks}/{episodeTasks.length}
                        </span>
                      )}
                      <Badge variant="secondary" className={statusColors[episode.status]}>
                        {episode.status}
                      </Badge>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <CardTitle className="text-base font-medium">Studio Availability</CardTitle>
            <Link href="/studio">
              <span className="text-xs text-primary cursor-pointer" data-testid="link-view-studio">View calendar</span>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingDates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No upcoming studio dates</p>
              </div>
            ) : (
              upcomingDates.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-md bg-card"
                  data-testid={`card-studio-date-${d.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-col items-center justify-center rounded-md bg-chart-2/10">
                      <span className="text-[10px] font-medium text-chart-2 leading-none">
                        {format(parseISO(d.date), "MMM")}
                      </span>
                      <span className="text-sm font-semibold text-chart-2 leading-tight">
                        {format(parseISO(d.date), "d")}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{format(parseISO(d.date), "EEEE")}</p>
                      {d.notes && <p className="text-xs text-muted-foreground">{d.notes}</p>}
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-chart-2/10 text-chart-2 border-transparent">
                    Available
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <CardTitle className="text-base font-medium">Team Workload</CardTitle>
          <Link href="/team">
            <span className="text-xs text-primary cursor-pointer" data-testid="link-view-team">View team</span>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {members?.map((member) => {
              const memberTasks = pendingTasks.filter((t) => t.assigneeId === member.id);
              return (
                <div
                  key={member.id}
                  className="flex items-center gap-3 p-3 rounded-md bg-card"
                  data-testid={`card-member-workload-${member.id}`}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback
                      className="text-xs font-medium text-white"
                      style={{ backgroundColor: member.color }}
                    >
                      {member.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{memberTasks.length} open task{memberTasks.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
