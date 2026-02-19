import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Mic, ChevronRight, Trash2, CheckCircle, Circle, Clock, CalendarIcon, ChevronLeft } from "lucide-react";
import type { Episode, Task, TeamMember, StudioDate } from "@shared/schema";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isBefore,
} from "date-fns";

const statuses = ["planning", "scheduled", "recording", "editing", "published"];
const statusColors: Record<string, string> = {
  planning: "bg-chart-4/10 text-chart-4 border-transparent",
  scheduled: "bg-primary/10 text-primary border-transparent",
  recording: "bg-chart-5/10 text-chart-5 border-transparent",
  editing: "bg-chart-3/10 text-chart-3 border-transparent",
  published: "bg-chart-2/10 text-chart-2 border-transparent",
};

const taskStatusIcons: Record<string, typeof CheckCircle> = {
  todo: Circle,
  in_progress: Clock,
  done: CheckCircle,
};

export default function Episodes() {
  const [showNewEpisode, setShowNewEpisode] = useState(false);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [newEpisode, setNewEpisode] = useState({ title: "", description: "", episodeNumber: "", scheduledDate: "", scheduledTime: "" });
  const [newTask, setNewTask] = useState({ title: "", assigneeId: "", dueDate: "" });
  const { toast } = useToast();

  const { data: episodes, isLoading } = useQuery<Episode[]>({
    queryKey: ["/api/episodes"],
  });
  const { data: tasks } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });
  const { data: members } = useQuery<TeamMember[]>({
    queryKey: ["/api/team-members"],
  });
  const { data: studioDates } = useQuery<StudioDate[]>({
    queryKey: ["/api/studio-dates"],
  });

  const [datePickerMonth, setDatePickerMonth] = useState(new Date());
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const availableStudioDates = useMemo(() => {
    if (!studioDates) return new Set<string>();
    return new Set(
      studioDates
        .filter((d) => d.status === "available")
        .map((d) => d.date)
    );
  }, [studioDates]);

  const takenStudioDates = useMemo(() => {
    if (!studioDates) return new Set<string>();
    return new Set(
      studioDates
        .filter((d) => d.status === "taken")
        .map((d) => d.date)
    );
  }, [studioDates]);

  const studioDateNotes = useMemo(() => {
    if (!studioDates) return new Map<string, string>();
    const map = new Map<string, string>();
    studioDates
      .filter((d) => d.status === "available" && d.notes)
      .forEach((d) => {
        const existing = map.get(d.date);
        map.set(d.date, existing ? `${existing}, ${d.notes}` : d.notes!);
      });
    return map;
  }, [studioDates]);

  const slotsForSelectedDate = useMemo(() => {
    if (!newEpisode.scheduledDate || !studioDates) return [];
    const selectedKey = newEpisode.scheduledDate;
    const availableRecords = studioDates.filter(
      (d) => d.status === "available" && d.notes && format(parseISO(d.date), "yyyy-MM-dd") === selectedKey
    );
    const slots: { start: string; end: string; label: string }[] = [];
    for (const record of availableRecords) {
      const ranges = record.notes!.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/g);
      if (!ranges) continue;
      for (const range of ranges) {
        const match = range.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
        if (!match) continue;
        const startH = parseInt(match[1]);
        const startM = parseInt(match[2]);
        const endH = parseInt(match[3]);
        const endM = parseInt(match[4]);
        let curH = startH, curM = startM;
        while (curH < endH || (curH === endH && curM < endM)) {
          let nextH = curH + 1, nextM = curM;
          if (nextH > endH || (nextH === endH && nextM > endM)) {
            nextH = endH; nextM = endM;
          }
          const startStr = `${String(curH).padStart(2, "0")}:${String(curM).padStart(2, "0")}`;
          const endStr = `${String(nextH).padStart(2, "0")}:${String(nextM).padStart(2, "0")}`;
          slots.push({ start: startStr, end: endStr, label: `${startStr} - ${endStr}` });
          curH = nextH; curM = nextM;
        }
      }
    }
    return slots;
  }, [newEpisode.scheduledDate, studioDates]);

  const createEpisode = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/episodes", {
        title: newEpisode.title,
        description: newEpisode.description || null,
        episodeNumber: newEpisode.episodeNumber ? parseInt(newEpisode.episodeNumber) : null,
        scheduledDate: newEpisode.scheduledDate || null,
        scheduledTime: newEpisode.scheduledTime || null,
        status: "planning",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      setShowNewEpisode(false);
      setNewEpisode({ title: "", description: "", episodeNumber: "", scheduledDate: "", scheduledTime: "" });
      toast({ title: "Episode created" });
    },
    onError: () => toast({ title: "Failed to create episode", variant: "destructive" }),
  });

  const updateEpisodeStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/episodes/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      if (selectedEpisode) {
        setSelectedEpisode({ ...selectedEpisode, status: selectedEpisode.status });
      }
    },
  });

  const createTask = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/tasks", {
        episodeId: selectedEpisode!.id,
        title: newTask.title,
        assigneeId: newTask.assigneeId || null,
        dueDate: newTask.dueDate || null,
        status: "todo",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setShowNewTask(false);
      setNewTask({ title: "", assigneeId: "", dueDate: "" });
      toast({ title: "Task added" });
    },
    onError: () => toast({ title: "Failed to add task", variant: "destructive" }),
  });

  const updateTaskStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/tasks/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task removed" });
    },
  });

  const deleteEpisode = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/episodes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setSelectedEpisode(null);
      toast({ title: "Episode deleted" });
    },
  });

  const episodeTasks = (episodeId: string) => tasks?.filter((t) => t.episodeId === episodeId) || [];

  const getMember = (id: string | null) => members?.find((m) => m.id === id);

  const cycleTaskStatus = (task: Task) => {
    const next = task.status === "todo" ? "in_progress" : task.status === "in_progress" ? "done" : "todo";
    updateTaskStatus.mutate({ id: task.id, status: next });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-episodes-title">Episodes</h1>
          <p className="text-sm text-muted-foreground mt-1">Plan, track, and manage your episodes</p>
        </div>
        <Button onClick={() => setShowNewEpisode(true)} data-testid="button-new-episode">
          <Plus className="h-4 w-4 mr-2" />
          New Episode
        </Button>
      </div>

      {(!episodes || episodes.length === 0) ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Mic className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-medium">No episodes yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first episode to get started</p>
            <Button className="mt-4" onClick={() => setShowNewEpisode(true)} data-testid="button-create-first-episode">
              <Plus className="h-4 w-4 mr-2" />
              Create Episode
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {episodes.map((episode) => {
            const eTasks = episodeTasks(episode.id);
            const done = eTasks.filter((t) => t.status === "done").length;
            return (
              <Card
                key={episode.id}
                className="hover-elevate cursor-pointer"
                onClick={() => setSelectedEpisode(episode)}
                data-testid={`card-episode-${episode.id}`}
              >
                <CardContent className="py-4 px-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {episode.episodeNumber && (
                          <span className="text-xs text-muted-foreground font-mono">#{episode.episodeNumber}</span>
                        )}
                        <h3 className="text-sm font-medium">{episode.title}</h3>
                        <Badge variant="secondary" className={statusColors[episode.status]}>
                          {episode.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                        {episode.scheduledDate && (
                          <span className="text-xs text-muted-foreground">
                            {format(parseISO(episode.scheduledDate), "MMM d, yyyy")}{episode.scheduledTime ? ` at ${episode.scheduledTime}` : ""}
                          </span>
                        )}
                        {eTasks.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {done}/{eTasks.length} tasks done
                          </span>
                        )}
                        {eTasks.length > 0 && (
                          <div className="flex -space-x-1">
                            {[...new Set(eTasks.map((t) => t.assigneeId).filter((id): id is string => !!id))].slice(0, 4).map((id) => {
                              const m = getMember(id!);
                              if (!m) return null;
                              return (
                                <Avatar key={m.id} className="h-5 w-5 border-2 border-background">
                                  <AvatarFallback className="text-[8px] text-white" style={{ backgroundColor: m.color }}>
                                    {m.initials}
                                  </AvatarFallback>
                                </Avatar>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showNewEpisode} onOpenChange={setShowNewEpisode}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Episode</DialogTitle>
            <DialogDescription>Add a new episode to your pipeline</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={newEpisode.title}
                onChange={(e) => setNewEpisode({ ...newEpisode, title: e.target.value })}
                placeholder="Episode title"
                data-testid="input-episode-title"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Episode Number</label>
              <Input
                type="number"
                value={newEpisode.episodeNumber}
                onChange={(e) => setNewEpisode({ ...newEpisode, episodeNumber: e.target.value })}
                placeholder="e.g. 42"
                data-testid="input-episode-number"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={newEpisode.description}
                onChange={(e) => setNewEpisode({ ...newEpisode, description: e.target.value })}
                placeholder="Brief description or topic"
                data-testid="input-episode-description"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Scheduled Date</label>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    data-testid="input-episode-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newEpisode.scheduledDate
                      ? `${format(parseISO(newEpisode.scheduledDate), "MMM d, yyyy")}${newEpisode.scheduledTime ? ` at ${newEpisode.scheduledTime}` : ""}`
                      : "Pick a date"}
                    {newEpisode.scheduledDate && availableStudioDates.has(newEpisode.scheduledDate) && (
                      <Badge variant="secondary" className="ml-auto text-xs">Studio Available</Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="p-3">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDatePickerMonth(subMonths(datePickerMonth, 1))}
                        data-testid="button-datepicker-prev"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm font-medium" data-testid="text-datepicker-month">
                        {format(datePickerMonth, "MMMM yyyy")}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDatePickerMonth(addMonths(datePickerMonth, 1))}
                        data-testid="button-datepicker-next"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-7 gap-0">
                      {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                        <div key={d} className="p-1.5 text-center text-xs font-medium text-muted-foreground">
                          {d}
                        </div>
                      ))}
                      {(() => {
                        const ms = startOfMonth(datePickerMonth);
                        const me = endOfMonth(datePickerMonth);
                        const cs = startOfWeek(ms, { weekStartsOn: 0 });
                        const ce = endOfWeek(me, { weekStartsOn: 0 });
                        const days = eachDayOfInterval({ start: cs, end: ce });
                        return days.map((day) => {
                          const dateStr = format(day, "yyyy-MM-dd");
                          const isCurrentMonth = isSameMonth(day, datePickerMonth);
                          const isToday = isSameDay(day, new Date());
                          const isPast = isBefore(day, new Date()) && !isToday;
                          const isAvailable = availableStudioDates.has(dateStr);
                          const isTaken = takenStudioDates.has(dateStr) && !isAvailable;
                          const isSelected = newEpisode.scheduledDate === dateStr;
                          const notes = studioDateNotes.get(dateStr);
                          return (
                            <button
                              key={dateStr}
                              type="button"
                              className={`relative p-1.5 text-center text-sm rounded-md transition-colors ${
                                !isCurrentMonth ? "opacity-30" : ""
                              } ${isPast ? "text-muted-foreground" : ""} ${
                                isSelected
                                  ? "bg-primary text-primary-foreground"
                                  : isAvailable
                                  ? "bg-chart-2/15 hover-elevate"
                                  : "hover-elevate"
                              } ${isToday && !isSelected ? "ring-1 ring-primary/30" : ""}`}
                              onClick={() => {
                                setNewEpisode({ ...newEpisode, scheduledDate: dateStr, scheduledTime: "" });
                                setDatePickerOpen(false);
                              }}
                              title={isAvailable ? `Studio available${notes ? `: ${notes}` : ""}` : isTaken ? "Studio taken" : ""}
                              data-testid={`datepicker-day-${dateStr}`}
                            >
                              {format(day, "d")}
                              {(isAvailable || isTaken) && (
                                <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2">
                                  <div className={`h-1 w-1 rounded-full ${isAvailable ? "bg-chart-2" : "bg-chart-5"}`} />
                                </div>
                              )}
                            </button>
                          );
                        });
                      })()}
                    </div>
                    <div className="flex items-center gap-3 mt-2 pt-2 border-t text-xs text-muted-foreground flex-wrap">
                      <div className="flex items-center gap-1">
                        <div className="h-2 w-2 rounded-full bg-chart-2" />
                        Studio available
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="h-2 w-2 rounded-full bg-chart-5" />
                        Studio taken
                      </div>
                    </div>
                    {newEpisode.scheduledDate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full mt-2"
                        onClick={() => setNewEpisode({ ...newEpisode, scheduledDate: "", scheduledTime: "" })}
                        data-testid="button-clear-date"
                      >
                        Clear date
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              {newEpisode.scheduledDate && slotsForSelectedDate.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  <span className="text-xs text-muted-foreground">Available studio time slots:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {slotsForSelectedDate.map((slot, i) => (
                      <Button
                        key={slot.label}
                        type="button"
                        variant={newEpisode.scheduledTime === slot.label ? "default" : "outline"}
                        size="sm"
                        onClick={() => setNewEpisode({ ...newEpisode, scheduledTime: slot.label })}
                        data-testid={`button-time-slot-${i}`}
                      >
                        <Clock className="h-3 w-3 mr-1" />
                        {slot.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <Button
              className="w-full"
              onClick={() => createEpisode.mutate()}
              disabled={!newEpisode.title || createEpisode.isPending}
              data-testid="button-submit-episode"
            >
              {createEpisode.isPending ? "Creating..." : "Create Episode"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedEpisode} onOpenChange={(open) => !open && setSelectedEpisode(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedEpisode && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <DialogTitle className="flex items-center gap-2 flex-wrap">
                      {selectedEpisode.episodeNumber && (
                        <span className="text-muted-foreground font-mono text-sm">#{selectedEpisode.episodeNumber}</span>
                      )}
                      {selectedEpisode.title}
                    </DialogTitle>
                    <DialogDescription>
                      {selectedEpisode.description || "No description"}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-5 mt-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">Status:</label>
                    <Select
                      value={selectedEpisode.status}
                      onValueChange={(val) => {
                        updateEpisodeStatus.mutate({ id: selectedEpisode.id, status: val });
                        setSelectedEpisode({ ...selectedEpisode, status: val });
                      }}
                    >
                      <SelectTrigger className="w-[140px]" data-testid="select-episode-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedEpisode.scheduledDate && (
                    <span className="text-sm text-muted-foreground">
                      Scheduled: {format(parseISO(selectedEpisode.scheduledDate), "MMM d, yyyy")}{selectedEpisode.scheduledTime ? ` at ${selectedEpisode.scheduledTime}` : ""}
                    </span>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h3 className="text-sm font-medium">Tasks</h3>
                    <Button variant="ghost" size="sm" onClick={() => setShowNewTask(true)} data-testid="button-add-task">
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </div>

                  {episodeTasks(selectedEpisode.id).length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-sm text-muted-foreground">No tasks yet. Add one to assign responsibilities.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {episodeTasks(selectedEpisode.id).map((task) => {
                        const StatusIcon = taskStatusIcons[task.status] || Circle;
                        const assignee = getMember(task.assigneeId);
                        return (
                          <div
                            key={task.id}
                            className="flex items-center gap-3 p-3 rounded-md bg-card group"
                            data-testid={`card-task-${task.id}`}
                          >
                            <button
                              onClick={() => cycleTaskStatus(task)}
                              className="shrink-0"
                              data-testid={`button-toggle-task-${task.id}`}
                            >
                              <StatusIcon
                                className={`h-4 w-4 ${
                                  task.status === "done"
                                    ? "text-chart-2"
                                    : task.status === "in_progress"
                                    ? "text-chart-4"
                                    : "text-muted-foreground"
                                }`}
                              />
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                                {task.title}
                              </p>
                              {task.dueDate && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Due {format(parseISO(task.dueDate), "MMM d")}
                                </p>
                              )}
                            </div>
                            {assignee && (
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-[9px] text-white" style={{ backgroundColor: assignee.color }}>
                                  {assignee.initials}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="opacity-0 group-hover:opacity-100 visibility-visible shrink-0"
                              onClick={() => deleteTask.mutate(task.id)}
                              data-testid={`button-delete-task-${task.id}`}
                            >
                              <Trash2 className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => deleteEpisode.mutate(selectedEpisode.id)}
                    data-testid="button-delete-episode"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete Episode
                  </Button>
                </div>
              </div>

              <Dialog open={showNewTask} onOpenChange={setShowNewTask}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Task</DialogTitle>
                    <DialogDescription>Add a task for this episode</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Task</label>
                      <Input
                        value={newTask.title}
                        onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                        placeholder="e.g. Write intro script"
                        data-testid="input-task-title"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Assign to</label>
                      <Select
                        value={newTask.assigneeId}
                        onValueChange={(val) => setNewTask({ ...newTask, assigneeId: val })}
                      >
                        <SelectTrigger data-testid="select-task-assignee">
                          <SelectValue placeholder="Select team member" />
                        </SelectTrigger>
                        <SelectContent>
                          {members?.map((m) => (
                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Due Date</label>
                      <Input
                        type="date"
                        value={newTask.dueDate}
                        onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                        data-testid="input-task-due-date"
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => createTask.mutate()}
                      disabled={!newTask.title || createTask.isPending}
                      data-testid="button-submit-task"
                    >
                      {createTask.isPending ? "Adding..." : "Add Task"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
