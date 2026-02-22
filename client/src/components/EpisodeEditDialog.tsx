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
import { Pencil, Trash2, CheckCircle, Circle, Mic, Calendar, Clock, Check, X, ArrowRight, Globe, Plus, ExternalLink } from "lucide-react";
import { SiYoutube, SiSpotify, SiApplemusic } from "react-icons/si";
import { format, parseISO, isAfter } from "date-fns";
import type { Episode, Task, TeamMember, StudioDate, Interview, InterviewerUnavailability, EpisodePlatformLink } from "@shared/schema";
import { useLanguage } from "@/i18n/LanguageProvider";

const statuses = ["scheduled", "planning", "recording", "editing", "publishing", "archived"];
const statusColors: Record<string, string> = {
  scheduled: "bg-primary/10 text-primary",
  planning: "bg-chart-4/10 text-chart-4",
  recording: "bg-chart-5/10 text-chart-5",
  editing: "bg-chart-3/10 text-chart-3",
  publishing: "bg-chart-2/10 text-chart-2",
  archived: "bg-muted text-muted-foreground",
};

interface TimeSlot {
  start: string;
  end: string;
  label: string;
}

function parseTimeSlots(notes: string): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const ranges = notes.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/g);
  if (!ranges) return slots;
  for (const range of ranges) {
    const match = range.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    if (!match) continue;
    const startH = parseInt(match[1]);
    const startM = parseInt(match[2]);
    const endH = parseInt(match[3]);
    const endM = parseInt(match[4]);
    let curH = startH;
    let curM = startM;
    while (curH < endH || (curH === endH && curM < endM)) {
      let nextH = curH + 1;
      let nextM = curM;
      if (nextH > endH || (nextH === endH && nextM > endM)) {
        nextH = endH;
        nextM = endM;
      }
      const startStr = `${String(curH).padStart(2, "0")}:${String(curM).padStart(2, "0")}`;
      const endStr = `${String(nextH).padStart(2, "0")}:${String(nextM).padStart(2, "0")}`;
      slots.push({ start: startStr, end: endStr, label: `${startStr} - ${endStr}` });
      curH = nextH;
      curM = nextM;
    }
  }
  return slots;
}

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
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
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

  const { data: studioDates } = useQuery<StudioDate[]>({
    queryKey: ["/api/studio-dates"],
    enabled: open,
  });

  const { data: allInterviews } = useQuery<Interview[]>({
    queryKey: ["/api/interviews"],
    enabled: open,
  });

  const { data: unavailabilityData } = useQuery<InterviewerUnavailability[]>({
    queryKey: ["/api/interviewer-unavailability"],
    enabled: open,
  });

  const { data: platformLinks } = useQuery<EpisodePlatformLink[]>({
    queryKey: ["/api/episodes", episode?.id, "platform-links"],
    queryFn: () => episode ? fetch(`/api/episodes/${episode.id}/platform-links`).then(r => r.json()) : Promise.resolve([]),
    enabled: open && !!episode && (episode.status === "publishing" || editForm.status === "publishing"),
  });

  const [showPlatformLink, setShowPlatformLink] = useState<string | null>(null);
  const [platformLinkUrl, setPlatformLinkUrl] = useState("");

  const interviewerMembers = members?.filter((m) => m.role?.toLowerCase() === "interviewer") || [];

  const linkedInterview = episode?.interviewId
    ? allInterviews?.find((i) => i.id === episode.interviewId)
    : null;

  const getAvailableInterviewers = (dateStr: string, slotLabel?: string) => {
    if (!unavailabilityData) return interviewerMembers;
    return interviewerMembers.filter((m) => {
      return !unavailabilityData.some((u) =>
        u.teamMemberId === m.id &&
        u.unavailableDate === dateStr &&
        (slotLabel ? (u.slotLabel === slotLabel || u.slotLabel === null) : !u.slotLabel)
      );
    });
  };

  const isSlotFullyAvailable = (dateStr: string, slotLabel: string) => {
    return interviewerMembers.every((m) => {
      return !unavailabilityData?.some((u) =>
        u.teamMemberId === m.id &&
        u.unavailableDate === dateStr &&
        (u.slotLabel === slotLabel || u.slotLabel === null)
      );
    });
  };

  const hasAnyInterviewerAvailable = (dateStr: string, notes?: string | null) => {
    if (interviewerMembers.length === 0) return true;
    if (interviewerMembers.some((m) => unavailabilityData?.some((u) => u.teamMemberId === m.id && u.unavailableDate === dateStr && !u.slotLabel))) return false;
    const slots = notes ? parseTimeSlots(notes) : [];
    if (slots.length === 0) return true;
    return slots.some((slot) => isSlotFullyAvailable(dateStr, slot.label));
  };

  const hasTimeSlots = (notes: string | null) => {
    if (!notes) return false;
    return /\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/.test(notes);
  };

  const availableDates = studioDates
    ?.filter((d) => d.status === "available" && isAfter(parseISO(d.date), new Date()) && hasTimeSlots(d.notes))
    .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()) || [];

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
      setShowCalendar(false);
      setSelectedDate(null);
      setSelectedSlot(null);
    }
  }, [open, episode]);

  const episodeTasks = tasks?.filter((t) => t.episodeId === episode?.id) || [];
  const doneTasks = episodeTasks.filter((t) => t.status === "done").length;

  const getMember = (id: string) => members?.find((m) => m.id === id);

  const handleSelectDate = (date: string) => {
    const studioDate = availableDates.find((d) => d.date === date);
    const slots = studioDate?.notes ? parseTimeSlots(studioDate.notes) : [];
    setSelectedDate(date);
    setSelectedSlot(null);
    if (slots.length === 0) {
      setEditForm({ ...editForm, scheduledDate: date, scheduledTime: "" });
    }
  };

  const handleSelectSlot = (slot: TimeSlot) => {
    setSelectedSlot(slot);
    if (selectedDate) {
      setEditForm({ ...editForm, scheduledDate: selectedDate, scheduledTime: slot.start });
    }
  };

  const selectedDateObj = selectedDate ? availableDates.find((d) => d.date === selectedDate) : null;
  const availableSlots = selectedDateObj?.notes ? parseTimeSlots(selectedDateObj.notes) : [];
  const isDateFullySelected = selectedDate && (availableSlots.length === 0 || selectedSlot !== null);

  const hasScheduleChange = selectedDate && isDateFullySelected &&
    (selectedDate !== episode?.scheduledDate || (selectedSlot && selectedSlot.start !== episode?.scheduledTime));

  const updateEpisode = useMutation({
    mutationFn: async () => {
      if (!episode) return;

      if (hasScheduleChange && selectedDate) {
        const newStudioDate = availableDates.find((d) => d.date === selectedDate);

        if (linkedInterview?.studioDateId) {
          const oldStudioDate = studioDates?.find((d) => d.id === linkedInterview.studioDateId);
          if (oldStudioDate) {
            const oldBookedSlot = oldStudioDate.bookedSlot;

            if (oldBookedSlot) {
              const currentNotes = oldStudioDate.notes || "";
              const slotRange = oldBookedSlot.replace(/\s*-\s*/, "-").replace(/\s+/g, "");
              const newNotes = currentNotes ? `${currentNotes}, ${slotRange}` : slotRange;
              await apiRequest("PATCH", `/api/studio-dates/${oldStudioDate.id}`, {
                notes: newNotes,
                status: "available",
                bookedSlot: null,
              });
            } else {
              await apiRequest("PATCH", `/api/studio-dates/${oldStudioDate.id}`, {
                status: "available",
              });
            }
          }
        }

        if (newStudioDate && selectedSlot) {
          const patchData: Record<string, unknown> = {};
          patchData.bookedSlot = selectedSlot.label;
          const allSlots = newStudioDate.notes ? parseTimeSlots(newStudioDate.notes) : [];
          const remainingSlots = allSlots.filter((s) => s.label !== selectedSlot.label);
          if (remainingSlots.length === 0) {
            patchData.status = "taken";
          } else {
            patchData.notes = remainingSlots.map((s) => `${s.start}-${s.end}`).join(", ");
          }
          await apiRequest("PATCH", `/api/studio-dates/${newStudioDate.id}`, patchData);
        }

        if (linkedInterview) {
          await apiRequest("PATCH", `/api/interviews/${linkedInterview.id}`, {
            scheduledDate: selectedDate,
            scheduledTime: selectedSlot ? selectedSlot.start : null,
            studioDateId: newStudioDate?.id || null,
          });
        }
      }

      await apiRequest("PATCH", `/api/episodes/${episode.id}`, {
        title: editForm.title,
        description: editForm.description || null,
        status: editForm.status,
        episodeNumber: editForm.episodeNumber ? parseInt(editForm.episodeNumber) : null,
        scheduledDate: selectedDate && isDateFullySelected ? selectedDate : (editForm.scheduledDate || null),
        scheduledTime: selectedSlot ? selectedSlot.start : (selectedDate && isDateFullySelected ? "" : editForm.scheduledTime) || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/interviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/studio-dates"] });
      onOpenChange(false);
      const msg = hasScheduleChange && selectedDate
        ? `Rescheduled to ${format(parseISO(selectedDate), "MMM d, yyyy")}${selectedSlot ? ` (${selectedSlot.label})` : ""}`
        : "Episode updated";
      toast({ title: msg });
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

  const hasExistingSchedule = editForm.scheduledDate && editForm.scheduledDate.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto w-[95vw] sm:w-full">
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

              {!showCalendar && hasExistingSchedule ? (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-1" data-testid="panel-current-schedule">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-primary">{t.episodes.currentSchedule}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{format(parseISO(editForm.scheduledDate), "MMM d, yyyy")}</span>
                    {editForm.scheduledTime && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {editForm.scheduledTime}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 mt-1"
                    onClick={() => setShowCalendar(true)}
                    data-testid="button-reschedule-episode"
                  >
                    <ArrowRight className="h-3 w-3 mr-1" />
                    {t.episodes.reschedule}
                  </Button>
                </div>
              ) : !showCalendar ? (
                <Button
                  variant="outline"
                  className="w-full rounded-xl border-dashed border-2 py-3 text-sm"
                  onClick={() => setShowCalendar(true)}
                  data-testid="button-pick-studio-date"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  {t.episodes.pickNewDate}
                </Button>
              ) : null}

              {showCalendar && (
                <div className="rounded-xl border bg-muted/30 p-3 space-y-2" data-testid="panel-studio-availability-episode">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-primary" />
                      {t.episodes.studioAvailability}
                    </h3>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setShowCalendar(false); setSelectedDate(null); setSelectedSlot(null); }} data-testid="button-close-studio-picker">
                      <X className="h-3 w-3" />
                    </Button>
                  </div>

                  {hasExistingSchedule && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-lg px-2.5 py-1.5">
                      <ArrowRight className="h-3 w-3" />
                      {t.episodes.slotWillBeReleased}
                    </div>
                  )}

                  {availableDates.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">{t.episodes.noAvailableDates}</p>
                  ) : (
                    <div className="space-y-1 max-h-56 overflow-y-auto">
                      {availableDates.map((d) => {
                        const slots = d.notes ? parseTimeSlots(d.notes) : [];
                        const isExpanded = selectedDate === d.date && slots.length > 0;
                        const dateAvailInterviewers = getAvailableInterviewers(d.date);
                        const noOneAvailable = interviewerMembers.length > 0 && !hasAnyInterviewerAvailable(d.date, d.notes);
                        return (
                          <div key={d.id} className={noOneAvailable ? "opacity-40" : ""}>
                            <button
                              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                                selectedDate === d.date
                                  ? "bg-primary/10 ring-1 ring-primary/30"
                                  : "hover:bg-muted/50"
                              }`}
                              onClick={() => handleSelectDate(d.date)}
                              data-testid={`button-pick-date-${d.id}`}
                            >
                              <div className="flex h-9 w-9 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/15 to-emerald-600/5 shrink-0">
                                <span className="text-[8px] font-semibold text-chart-2 leading-none uppercase">
                                  {format(parseISO(d.date), "MMM")}
                                </span>
                                <span className="text-xs font-bold text-chart-2 leading-tight">
                                  {format(parseISO(d.date), "d")}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{format(parseISO(d.date), "EEEE, MMMM d")}</p>
                                <div className="flex items-center gap-1 mt-0.5">
                                  {d.notes && <span className="text-[11px] text-muted-foreground truncate">{d.notes.match(/\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/)?.[0] || d.notes}</span>}
                                  {interviewerMembers.length > 0 && slots.length === 0 && (
                                    <div className="flex items-center gap-0.5 ml-1">
                                      {interviewerMembers.map((m) => (
                                        <div
                                          key={m.id}
                                          className={`h-2 w-2 rounded-full ${dateAvailInterviewers.some((a) => a.id === m.id) ? "" : "opacity-20"}`}
                                          style={{ backgroundColor: m.color }}
                                          title={`${m.name}: ${dateAvailInterviewers.some((a) => a.id === m.id) ? "Available" : "Unavailable"}`}
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {selectedDate === d.date && slots.length === 0 && (
                                <Check className="h-4 w-4 text-primary shrink-0" />
                              )}
                            </button>
                            {isExpanded && (
                              <div className="ml-12 mt-1 mb-2 space-y-1" data-testid="panel-hour-slots-episode">
                                <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1 mb-1.5">
                                  <Clock className="h-3 w-3" />
                                  {t.episodes.selectHourSlot}
                                </p>
                                <div className="grid grid-cols-2 gap-1">
                                  {slots.filter((slot) => {
                                    const slotAvailInterviewers = getAvailableInterviewers(d.date, slot.label);
                                    return !(interviewerMembers.length > 0 && slotAvailInterviewers.length < interviewerMembers.length);
                                  }).map((slot) => {
                                    const slotAvailInterviewers = getAvailableInterviewers(d.date, slot.label);
                                    return (
                                      <button
                                        key={slot.label}
                                        className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                                          selectedSlot?.label === slot.label
                                            ? "bg-primary text-primary-foreground shadow-sm"
                                            : "bg-muted/50 hover:bg-muted text-foreground"
                                        }`}
                                        onClick={() => handleSelectSlot(slot)}
                                        data-testid={`button-pick-slot-${slot.start}`}
                                      >
                                        <Clock className="h-3 w-3" />
                                        {slot.label}
                                        {interviewerMembers.length > 0 && (
                                          <div className="flex items-center gap-0.5 ml-0.5">
                                            {interviewerMembers.map((m) => (
                                              <div
                                                key={m.id}
                                                className={`h-1.5 w-1.5 rounded-full ${slotAvailInterviewers.some((a) => a.id === m.id) ? "" : "opacity-20"}`}
                                                style={{ backgroundColor: selectedSlot?.label === slot.label ? "white" : m.color }}
                                                title={`${m.name}: ${slotAvailInterviewers.some((a) => a.id === m.id) ? "Available" : "Unavailable"}`}
                                              />
                                            ))}
                                          </div>
                                        )}
                                        {selectedSlot?.label === slot.label && (
                                          <Check className="h-3 w-3" />
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {isDateFullySelected && (
                    <div className="pt-1">
                      <Badge className="ios-badge border-0 bg-chart-2/10 text-chart-2">
                        {t.episodes.selected}: {format(parseISO(selectedDate!), "MMM d, yyyy")}{selectedSlot ? ` (${selectedSlot.label})` : ""}
                      </Badge>
                    </div>
                  )}
                </div>
              )}

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

              {(episode.status === "publishing" || editForm.status === "publishing") && (
                <div className="space-y-3 mt-2">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    <h4 className="text-sm font-semibold">{t.episodes.platformLinks}</h4>
                  </div>
                  {episode.publishDate && (
                    <div className="text-xs text-muted-foreground">
                      {t.episodes.publishDateLabel}: {format(parseISO(episode.publishDate), "MMM d, yyyy")}
                      {episode.publishTime && ` · ${episode.publishTime}`}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {(["youtube", "spotify", "apple-music"] as const).map((platform) => {
                      const existing = platformLinks?.find((l) => l.platform === platform);
                      const Icon = platform === "youtube" ? SiYoutube : platform === "spotify" ? SiSpotify : SiApplemusic;
                      const label = platform === "youtube" ? t.episodes.youtube : platform === "spotify" ? t.episodes.spotify : t.episodes.appleMusic;
                      const colors = platform === "youtube" ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" : platform === "spotify" ? "text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30" : "text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950/30";
                      return existing ? (
                        <a
                          key={platform}
                          href={existing.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${colors} transition-colors`}
                          data-testid={`link-platform-${platform}-quick`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {label}
                          <ExternalLink className="w-3 h-3 opacity-50" />
                        </a>
                      ) : showPlatformLink === platform ? (
                        <div key={platform} className="flex items-center gap-1.5">
                          <Input
                            placeholder={`${label} URL`}
                            value={platformLinkUrl}
                            onChange={(e) => setPlatformLinkUrl(e.target.value)}
                            className="h-7 text-xs w-48"
                            autoFocus
                            data-testid={`input-platform-url-${platform}-quick`}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            disabled={!platformLinkUrl}
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await apiRequest("POST", `/api/episodes/${episode.id}/platform-links`, { platform, url: platformLinkUrl });
                                queryClient.invalidateQueries({ queryKey: ["/api/episodes", episode.id, "platform-links"] });
                                setShowPlatformLink(null);
                                setPlatformLinkUrl("");
                              } catch { toast({ title: "Failed to add link", variant: "destructive" }); }
                            }}
                            data-testid={`button-save-platform-${platform}-quick`}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setShowPlatformLink(null); setPlatformLinkUrl(""); }}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          key={platform}
                          variant="outline"
                          size="sm"
                          className={`gap-1.5 rounded-full text-xs ${colors}`}
                          onClick={() => { setShowPlatformLink(platform); setPlatformLinkUrl(""); }}
                          data-testid={`button-add-platform-${platform}-quick`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <Plus className="w-3 h-3" />
                          {label}
                        </Button>
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