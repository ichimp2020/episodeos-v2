import { useState, useMemo, useCallback } from "react";
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
import { Plus, Mic, ChevronRight, Trash2, CheckCircle, Circle, Clock, CalendarIcon, ChevronLeft, Upload, FileText, Film, ThumbsUp, ThumbsDown, Loader2, ExternalLink, Image, Pencil, Check, X } from "lucide-react";
import type { Episode, Task, TeamMember, StudioDate, EpisodeFile, EpisodeShort } from "@shared/schema";
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
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ title: "", description: "", episodeNumber: "" });
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskValues, setEditTaskValues] = useState({ title: "", assigneeId: "", dueDate: "" });
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

  const timeOfDayForSelectedDate = useMemo(() => {
    if (!newEpisode.scheduledDate || !studioDates || slotsForSelectedDate.length > 0) return null;
    const selectedKey = newEpisode.scheduledDate;
    const record = studioDates.find(
      (d) => d.status === "available" && d.notes && format(parseISO(d.date), "yyyy-MM-dd") === selectedKey
    );
    if (!record || !record.notes) return null;
    const notesLower = record.notes.toLowerCase();
    if (notesLower.includes("morning") || notesLower.includes("בוקר")) return "Morning";
    if (notesLower.includes("evening") || notesLower.includes("ערב")) return "Evening";
    if (notesLower.includes("afternoon") || notesLower.includes("צהריים")) return "Afternoon";
    return null;
  }, [newEpisode.scheduledDate, studioDates, slotsForSelectedDate]);

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

  const updateEpisode = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      await apiRequest("PATCH", `/api/episodes/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
    },
  });

  const startEditing = (field: string) => {
    if (!selectedEpisode) return;
    setEditValues({
      title: selectedEpisode.title,
      description: selectedEpisode.description || "",
      episodeNumber: selectedEpisode.episodeNumber?.toString() || "",
    });
    setEditingField(field);
  };

  const saveField = (field: string) => {
    if (!selectedEpisode) return;
    const value = editValues[field as keyof typeof editValues];
    const data: Record<string, unknown> = {};
    if (field === "episodeNumber") {
      data[field] = value ? parseInt(value, 10) : null;
    } else {
      data[field] = value;
    }
    updateEpisode.mutate({ id: selectedEpisode.id, data });
    setSelectedEpisode({ ...selectedEpisode, ...data } as Episode);
    setEditingField(null);
  };

  const cancelEditing = () => {
    setEditingField(null);
  };

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

  const updateTask = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      await apiRequest("PATCH", `/api/tasks/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
    onError: () => toast({ title: "Failed to update task", variant: "destructive" }),
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
          {[...episodes].sort((a, b) => {
            if (!a.scheduledDate) return 1;
            if (!b.scheduledDate) return -1;
            return parseISO(a.scheduledDate).getTime() - parseISO(b.scheduledDate).getTime();
          }).map((episode) => {
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
              {newEpisode.scheduledDate && timeOfDayForSelectedDate && (
                <div className="mt-2 flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Studio available:</span>
                  <Badge variant="secondary" className="text-xs" data-testid="badge-time-of-day">
                    {timeOfDayForSelectedDate}
                  </Badge>
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
                <div className="space-y-1">
                  {editingField === "title" ? (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 flex-1">
                        {selectedEpisode.episodeNumber != null && (
                          <span className="text-muted-foreground font-mono text-sm shrink-0">#{selectedEpisode.episodeNumber}</span>
                        )}
                        <Input
                          value={editValues.title}
                          onChange={(e) => setEditValues({ ...editValues, title: e.target.value })}
                          onKeyDown={(e) => { if (e.key === "Enter") saveField("title"); if (e.key === "Escape") cancelEditing(); }}
                          autoFocus
                          className="text-lg font-semibold"
                          data-testid="input-edit-title"
                        />
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => saveField("title")} data-testid="button-save-title">
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={cancelEditing} data-testid="button-cancel-title">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <DialogTitle
                      className="flex items-center gap-2 flex-wrap cursor-pointer group"
                      onClick={() => startEditing("title")}
                      data-testid="text-episode-title"
                    >
                      {selectedEpisode.episodeNumber != null && (
                        <span className="text-muted-foreground font-mono text-sm">#{selectedEpisode.episodeNumber}</span>
                      )}
                      {selectedEpisode.title}
                      <Pencil className="h-3 w-3 text-muted-foreground/50" />
                    </DialogTitle>
                  )}

                  {editingField === "description" ? (
                    <div className="flex items-start gap-2">
                      <Textarea
                        value={editValues.description}
                        onChange={(e) => setEditValues({ ...editValues, description: e.target.value })}
                        onKeyDown={(e) => { if (e.key === "Escape") cancelEditing(); }}
                        autoFocus
                        rows={2}
                        className="text-sm"
                        data-testid="input-edit-description"
                      />
                      <div className="flex flex-col gap-1">
                        <Button size="icon" variant="ghost" onClick={() => saveField("description")} data-testid="button-save-description">
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={cancelEditing} data-testid="button-cancel-description">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <DialogDescription
                      className="cursor-pointer group flex items-center gap-1"
                      onClick={() => startEditing("description")}
                      data-testid="text-episode-description"
                    >
                      {selectedEpisode.description || "No description — click to add"}
                      <Pencil className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                    </DialogDescription>
                  )}
                </div>
              </DialogHeader>

              <div className="space-y-5 mt-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">Status:</label>
                    <Select
                      value={selectedEpisode.status}
                      onValueChange={(val) => {
                        updateEpisode.mutate({ id: selectedEpisode.id, data: { status: val } });
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
                        const isEditingThis = editingTaskId === task.id;
                        return isEditingThis ? (
                          <div key={task.id} className="p-3 rounded-md bg-card space-y-3" data-testid={`card-task-edit-${task.id}`}>
                            <div className="space-y-2">
                              <Input
                                value={editTaskValues.title}
                                onChange={(e) => setEditTaskValues({ ...editTaskValues, title: e.target.value })}
                                placeholder="Task title"
                                autoFocus
                                className="text-sm h-8"
                                data-testid={`input-edit-task-title-${task.id}`}
                              />
                              <div className="flex gap-2">
                                <Select
                                  value={editTaskValues.assigneeId || "__none__"}
                                  onValueChange={(val) => setEditTaskValues({ ...editTaskValues, assigneeId: val === "__none__" ? "" : val })}
                                >
                                  <SelectTrigger className="text-sm h-8 flex-1" data-testid={`select-edit-task-assignee-${task.id}`}>
                                    <SelectValue placeholder="Assignee" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">Unassigned</SelectItem>
                                    {members?.map((m) => (
                                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input
                                  type="date"
                                  value={editTaskValues.dueDate}
                                  onChange={(e) => setEditTaskValues({ ...editTaskValues, dueDate: e.target.value })}
                                  className="text-sm h-8 w-[140px]"
                                  data-testid={`input-edit-task-date-${task.id}`}
                                />
                              </div>
                            </div>
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingTaskId(null)}
                                data-testid={`button-cancel-edit-task-${task.id}`}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => {
                                  updateTask.mutate({
                                    id: task.id,
                                    data: {
                                      title: editTaskValues.title,
                                      assigneeId: editTaskValues.assigneeId || null,
                                      dueDate: editTaskValues.dueDate || null,
                                    },
                                  });
                                  setEditingTaskId(null);
                                }}
                                disabled={!editTaskValues.title}
                                data-testid={`button-save-edit-task-${task.id}`}
                              >
                                Save
                              </Button>
                            </div>
                          </div>
                        ) : (
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
                            <div
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => {
                                setEditTaskValues({
                                  title: task.title,
                                  assigneeId: task.assigneeId || "",
                                  dueDate: task.dueDate || "",
                                });
                                setEditingTaskId(task.id);
                              }}
                              data-testid={`text-task-title-${task.id}`}
                            >
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
                            <Pencil
                              className="h-3 w-3 text-muted-foreground/40 shrink-0 cursor-pointer"
                              onClick={() => {
                                setEditTaskValues({
                                  title: task.title,
                                  assigneeId: task.assigneeId || "",
                                  dueDate: task.dueDate || "",
                                });
                                setEditingTaskId(task.id);
                              }}
                              data-testid={`button-edit-task-${task.id}`}
                            />
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

                <EpisodeFilesSection episodeId={selectedEpisode.id} />

                <EpisodeShortsSection episodeId={selectedEpisode.id} />

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

const fileCategoryIcons: Record<string, typeof FileText> = {
  graphic: Image,
  thumbnail: Image,
  document: FileText,
  video: Film,
};

function getFileCategory(contentType: string | null | undefined, name: string): string {
  if (!contentType) {
    const ext = name.split(".").pop()?.toLowerCase();
    if (ext && ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "graphic";
    if (ext && ["mp4", "mov", "avi", "webm"].includes(ext)) return "video";
    return "document";
  }
  if (contentType.startsWith("image/")) return "graphic";
  if (contentType.startsWith("video/")) return "video";
  return "document";
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function EpisodeFilesSection({ episodeId }: { episodeId: string }) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("document");

  const { data: files, isLoading } = useQuery<EpisodeFile[]>({
    queryKey: ["/api/episodes", episodeId, "files"],
    queryFn: async () => {
      const res = await fetch(`/api/episodes/${episodeId}/files`);
      if (!res.ok) throw new Error("Failed to fetch files");
      return res.json();
    },
  });

  const deleteFile = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/episode-files/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/episodes", episodeId, "files"] });
      toast({ title: "File removed" });
    },
  });

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const urlRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();

      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });

      const category = selectedCategory === "auto" ? getFileCategory(file.type, file.name) : selectedCategory;
      await apiRequest("POST", `/api/episodes/${episodeId}/files`, {
        name: file.name,
        category,
        objectPath,
        contentType: file.type,
        size: file.size,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/episodes", episodeId, "files"] });
      toast({ title: "File uploaded" });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  }, [episodeId, selectedCategory, toast]);

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-medium">Files & Documents</h3>
        <div className="flex items-center gap-2">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[120px]" data-testid="select-file-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="graphic">Graphic</SelectItem>
              <SelectItem value="thumbnail">Thumbnail</SelectItem>
              <SelectItem value="document">Document</SelectItem>
              <SelectItem value="auto">Auto-detect</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" disabled={isUploading} asChild data-testid="button-upload-file">
            <label className="cursor-pointer">
              {isUploading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
              Upload
              <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
            </label>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-12" />
      ) : !files || files.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground">No files yet. Upload graphics, thumbnails, or documents.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {files.map((file) => {
            const FileIcon = fileCategoryIcons[file.category] || FileText;
            return (
              <div
                key={file.id}
                className="flex items-center gap-3 p-2.5 rounded-md bg-card group"
                data-testid={`card-file-${file.id}`}
              >
                <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{file.name}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs">{file.category}</Badge>
                    {file.size && <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>}
                  </div>
                </div>
                <a
                  href={file.objectPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0"
                  data-testid={`link-download-file-${file.id}`}
                >
                  <Button variant="ghost" size="icon">
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 shrink-0"
                  onClick={() => deleteFile.mutate(file.id)}
                  data-testid={`button-delete-file-${file.id}`}
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const shortStatusColors: Record<string, string> = {
  pending: "bg-chart-4/10 text-chart-4 border-transparent",
  approved: "bg-chart-2/10 text-chart-2 border-transparent",
  rejected: "bg-destructive/10 text-destructive border-transparent",
};

function EpisodeShortsSection({ episodeId }: { episodeId: string }) {
  const { toast } = useToast();
  const [showAddShort, setShowAddShort] = useState(false);
  const [newShortTitle, setNewShortTitle] = useState("");
  const [isUploadingShort, setIsUploadingShort] = useState(false);

  const { data: shorts, isLoading } = useQuery<EpisodeShort[]>({
    queryKey: ["/api/episodes", episodeId, "shorts"],
    queryFn: async () => {
      const res = await fetch(`/api/episodes/${episodeId}/shorts`);
      if (!res.ok) throw new Error("Failed to fetch shorts");
      return res.json();
    },
  });

  const createShort = useMutation({
    mutationFn: async ({ title, objectPath }: { title: string; objectPath?: string }) => {
      await apiRequest("POST", `/api/episodes/${episodeId}/shorts`, {
        title,
        objectPath: objectPath || null,
        status: "pending",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/episodes", episodeId, "shorts"] });
      setShowAddShort(false);
      setNewShortTitle("");
      toast({ title: "Short added" });
    },
    onError: () => toast({ title: "Failed to add short", variant: "destructive" }),
  });

  const updateShortStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/episode-shorts/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/episodes", episodeId, "shorts"] });
    },
  });

  const deleteShort = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/episode-shorts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/episodes", episodeId, "shorts"] });
      toast({ title: "Short removed" });
    },
  });

  const handleShortUpload = useCallback(async (shortId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingShort(true);
    try {
      const urlRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();

      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });

      await apiRequest("PATCH", `/api/episode-shorts/${shortId}`, { objectPath });
      queryClient.invalidateQueries({ queryKey: ["/api/episodes", episodeId, "shorts"] });
      toast({ title: "Video uploaded" });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setIsUploadingShort(false);
      e.target.value = "";
    }
  }, [episodeId, toast]);

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-medium">Shorts (CEO Approval)</h3>
        <Button variant="ghost" size="sm" onClick={() => setShowAddShort(true)} data-testid="button-add-short">
          <Plus className="h-3 w-3 mr-1" />
          Add Short
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-12" />
      ) : !shorts || shorts.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground">No shorts yet. Add up to 3 short videos for CEO approval.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {shorts.map((short) => (
            <div
              key={short.id}
              className="flex items-center gap-3 p-3 rounded-md bg-card group"
              data-testid={`card-short-${short.id}`}
            >
              <Film className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm">{short.title}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <Badge variant="secondary" className={`text-xs ${shortStatusColors[short.status]}`}>
                    {short.status}
                  </Badge>
                  {short.objectPath ? (
                    <a
                      href={short.objectPath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary underline"
                      data-testid={`link-view-short-${short.id}`}
                    >
                      View video
                    </a>
                  ) : (
                    <label className="text-xs text-primary cursor-pointer underline" data-testid={`button-upload-short-video-${short.id}`}>
                      {isUploadingShort ? "Uploading..." : "Upload video"}
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => handleShortUpload(short.id, e)}
                        disabled={isUploadingShort}
                      />
                    </label>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => updateShortStatus.mutate({ id: short.id, status: "approved" })}
                  disabled={short.status === "approved"}
                  data-testid={`button-approve-short-${short.id}`}
                >
                  <ThumbsUp className={`h-3.5 w-3.5 ${short.status === "approved" ? "text-chart-2" : "text-muted-foreground"}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => updateShortStatus.mutate({ id: short.id, status: "rejected" })}
                  disabled={short.status === "rejected"}
                  data-testid={`button-reject-short-${short.id}`}
                >
                  <ThumbsDown className={`h-3.5 w-3.5 ${short.status === "rejected" ? "text-destructive" : "text-muted-foreground"}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100"
                  onClick={() => deleteShort.mutate(short.id)}
                  data-testid={`button-delete-short-${short.id}`}
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showAddShort} onOpenChange={setShowAddShort}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Short Video</DialogTitle>
            <DialogDescription>Add a short video clip for CEO approval</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={newShortTitle}
                onChange={(e) => setNewShortTitle(e.target.value)}
                placeholder="e.g. Highlight clip #1"
                data-testid="input-short-title"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => createShort.mutate({ title: newShortTitle })}
              disabled={!newShortTitle || createShort.isPending}
              data-testid="button-submit-short"
            >
              {createShort.isPending ? "Adding..." : "Add Short"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
