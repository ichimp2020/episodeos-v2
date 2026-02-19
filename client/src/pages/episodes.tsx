import { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Mic, ChevronRight, Trash2, CheckCircle, Circle, Clock } from "lucide-react";
import type { Episode, Task, TeamMember } from "@shared/schema";
import { format, parseISO } from "date-fns";

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
  const [newEpisode, setNewEpisode] = useState({ title: "", description: "", episodeNumber: "", scheduledDate: "" });
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

  const createEpisode = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/episodes", {
        title: newEpisode.title,
        description: newEpisode.description || null,
        episodeNumber: newEpisode.episodeNumber ? parseInt(newEpisode.episodeNumber) : null,
        scheduledDate: newEpisode.scheduledDate || null,
        status: "planning",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      setShowNewEpisode(false);
      setNewEpisode({ title: "", description: "", episodeNumber: "", scheduledDate: "" });
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
                            {format(parseISO(episode.scheduledDate), "MMM d, yyyy")}
                          </span>
                        )}
                        {eTasks.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {done}/{eTasks.length} tasks done
                          </span>
                        )}
                        {eTasks.length > 0 && (
                          <div className="flex -space-x-1">
                            {[...new Set(eTasks.map((t) => t.assigneeId).filter(Boolean))].slice(0, 4).map((id) => {
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
              <Input
                type="date"
                value={newEpisode.scheduledDate}
                onChange={(e) => setNewEpisode({ ...newEpisode, scheduledDate: e.target.value })}
                data-testid="input-episode-date"
              />
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
                      Scheduled: {format(parseISO(selectedEpisode.scheduledDate), "MMM d, yyyy")}
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
