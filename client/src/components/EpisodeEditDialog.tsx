import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Pencil, Trash2, CheckCircle, Circle, Mic } from "lucide-react";
import type { Episode, Task, TeamMember } from "@shared/schema";
import { useLanguage } from "@/i18n/LanguageProvider";

const statuses = ["planning", "scheduled", "recording", "editing", "published"];
const statusColors: Record<string, string> = {
  planning: "bg-chart-4/10 text-chart-4",
  scheduled: "bg-primary/10 text-primary",
  recording: "bg-chart-5/10 text-chart-5",
  editing: "bg-chart-3/10 text-chart-3",
  published: "bg-chart-2/10 text-chart-2",
};

interface EpisodeEditDialogProps {
  episode: Episode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EpisodeEditDialog({ episode, open, onOpenChange }: EpisodeEditDialogProps) {
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    status: "planning",
    episodeNumber: "",
    scheduledDate: "",
    scheduledTime: "",
  });
  const { toast } = useToast();
  const { t } = useLanguage();

  const { data: tasks } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    enabled: open,
  });

  const { data: members } = useQuery<TeamMember[]>({
    queryKey: ["/api/team-members"],
    enabled: open,
  });

  useEffect(() => {
    if (open && episode) {
      setEditForm({
        title: episode.title,
        description: episode.description || "",
        status: episode.status,
        episodeNumber: episode.episodeNumber?.toString() || "",
        scheduledDate: episode.scheduledDate || "",
        scheduledTime: episode.scheduledTime || "",
      });
    }
  }, [open, episode]);

  const episodeTasks = tasks?.filter((t) => t.episodeId === episode?.id) || [];
  const doneTasks = episodeTasks.filter((t) => t.status === "done").length;

  const getMember = (id: string) => members?.find((m) => m.id === id);

  const updateEpisode = useMutation({
    mutationFn: async () => {
      if (!episode) return;
      await apiRequest("PATCH", `/api/episodes/${episode.id}`, {
        title: editForm.title,
        description: editForm.description || null,
        status: editForm.status,
        episodeNumber: editForm.episodeNumber ? parseInt(editForm.episodeNumber) : null,
        scheduledDate: editForm.scheduledDate || null,
        scheduledTime: editForm.scheduledTime || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      onOpenChange(false);
      toast({ title: "Episode updated" });
    },
    onError: () => toast({ title: "Failed to update episode", variant: "destructive" }),
  });

  const deleteEpisode = useMutation({
    mutationFn: async () => {
      if (!episode) return;
      await apiRequest("DELETE", `/api/episodes/${episode.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      onOpenChange(false);
      toast({ title: "Episode deleted" });
    },
  });

  const toggleTaskDone = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/tasks/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        {episode && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mic className="h-4 w-4" />
                {t.episodes.title}
              </DialogTitle>
              <DialogDescription>Quick edit episode details</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t.episodes.status}</label>
                <Select value={editForm.status} onValueChange={(val) => setEditForm({ ...editForm, status: val })}>
                  <SelectTrigger data-testid="select-episode-status-quick">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((s) => (
                      <SelectItem key={s} value={s}>
                        <Badge className={`ios-badge border-0 ${statusColors[s]}`}>{s}</Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t.episodes.episodeTitle}</label>
                <Input
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  data-testid="input-quick-episode-title"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t.episodes.episodeNumber}</label>
                  <Input
                    type="number"
                    value={editForm.episodeNumber}
                    onChange={(e) => setEditForm({ ...editForm, episodeNumber: e.target.value })}
                    placeholder="#"
                    data-testid="input-quick-episode-number"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t.episodes.scheduledDate}</label>
                  <Input
                    type="date"
                    value={editForm.scheduledDate}
                    onChange={(e) => setEditForm({ ...editForm, scheduledDate: e.target.value })}
                    data-testid="input-quick-episode-date"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t.episodes.description}</label>
                <Textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  data-testid="input-quick-episode-description"
                />
              </div>

              {episodeTasks.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">{t.episodes.tasks}</label>
                    <span className="text-xs text-muted-foreground">{doneTasks}/{episodeTasks.length}</span>
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {episodeTasks.map((task) => {
                      const assigneeIds = task.assigneeIds || (task.assigneeId ? [task.assigneeId] : []);
                      return (
                        <div
                          key={task.id}
                          className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => toggleTaskDone.mutate({ id: task.id, status: task.status === "done" ? "todo" : "done" })}
                          data-testid={`quick-task-toggle-${task.id}`}
                        >
                          {task.status === "done" ? (
                            <CheckCircle className="h-4 w-4 text-chart-2 shrink-0" />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <span className={`text-sm flex-1 truncate ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                            {task.title}
                          </span>
                          <div className="flex -space-x-1">
                            {assigneeIds.slice(0, 3).map((aid) => {
                              const m = getMember(aid);
                              return m ? (
                                <Avatar key={aid} className="h-5 w-5 ring-1 ring-background">
                                  <AvatarFallback className="text-[7px] font-bold text-white" style={{ backgroundColor: m.color }}>
                                    {m.initials}
                                  </AvatarFallback>
                                </Avatar>
                              ) : null;
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => deleteEpisode.mutate()}
                  data-testid="button-delete-episode-quick"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  {t.episodes.deleteEpisode}
                </Button>
                <Button
                  className="rounded-full px-5 shadow-md"
                  onClick={() => updateEpisode.mutate()}
                  disabled={!editForm.title || updateEpisode.isPending}
                  data-testid="button-save-episode-quick"
                >
                  {updateEpisode.isPending ? t.episodes.saving : t.episodes.saveChanges}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}