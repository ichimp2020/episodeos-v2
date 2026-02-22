import { useState, useMemo, useCallback, useEffect } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
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
import { Plus, Mic, ChevronRight, Trash2, CheckCircle, Circle, Clock, CalendarIcon, ChevronLeft, Upload, FileText, Film, ThumbsUp, ThumbsDown, Loader2, ExternalLink, Image, Pencil, Check, X, UserPlus, Mail, Link2, Phone, ChevronDown, ChevronUp, AlertTriangle, Globe, Archive } from "lucide-react";
import { SiYoutube, SiSpotify, SiApplemusic } from "react-icons/si";
import type { Episode, Task, TeamMember, StudioDate, EpisodeFile, EpisodeShort, EpisodeLargeLink, EpisodePlatformLink, Interview, Guest } from "@shared/schema";
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
  isAfter,
} from "date-fns";

const statuses = ["scheduled", "planning", "recording", "editing", "publishing", "archived"];
const statusColors: Record<string, string> = {
  scheduled: "bg-primary/10 text-primary border-transparent",
  planning: "bg-chart-4/10 text-chart-4 border-transparent",
  recording: "bg-chart-5/10 text-chart-5 border-transparent",
  editing: "bg-chart-3/10 text-chart-3 border-transparent",
  publishing: "bg-chart-2/10 text-chart-2 border-transparent",
  archived: "bg-muted text-muted-foreground border-transparent",
};


function parseTimeSlotsEpisodes(notes: string): { start: string; end: string; label: string }[] {
  const slots: { start: string; end: string; label: string }[] = [];
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

export default function Episodes() {
  const [showNewEpisode, setShowNewEpisode] = useState(false);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [newEpisode, setNewEpisode] = useState({ title: "", description: "", episodeNumber: "", scheduledDate: "", scheduledTime: "" });
  const [newTask, setNewTask] = useState({ title: "", assigneeIds: [] as string[], dueDate: "" });
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ title: "", description: "", episodeNumber: "" });
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskValues, setEditTaskValues] = useState({ title: "", assigneeIds: [] as string[], dueDate: "" });
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<string | null>(null);
  const [rescheduleSlot, setRescheduleSlot] = useState<{ start: string; end: string; label: string } | null>(null);
  const [rescheduleAttendees, setRescheduleAttendees] = useState<Record<string, boolean>>({});
  const [attendeesInitialized, setAttendeesInitialized] = useState(false);
  const [editingGuestEmail, setEditingGuestEmail] = useState(false);
  const [guestEmailValue, setGuestEmailValue] = useState("");
  const [editingGuestPhone, setEditingGuestPhone] = useState(false);
  const [guestPhoneValue, setGuestPhoneValue] = useState("");
  const [showGuestDetails, setShowGuestDetails] = useState(false);
  const [showGuestPicker, setShowGuestPicker] = useState(false);
  const [showPublishDate, setShowPublishDate] = useState(false);
  const [publishDateValue, setPublishDateValue] = useState("");
  const [publishTimeValue, setPublishTimeValue] = useState("12:00");
  const [showPlatformLink, setShowPlatformLink] = useState<string | null>(null);
  const [platformLinkUrl, setPlatformLinkUrl] = useState("");
  const { toast } = useToast();
  const { t } = useLanguage();

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
  const { data: allInterviews } = useQuery<Interview[]>({
    queryKey: ["/api/interviews"],
  });
  const { data: allGuests } = useQuery<Guest[]>({
    queryKey: ["/api/guests"],
  });
  const { data: platformLinks } = useQuery<EpisodePlatformLink[]>({
    queryKey: ["/api/episodes", selectedEpisode?.id, "platform-links"],
    queryFn: () => selectedEpisode ? fetch(`/api/episodes/${selectedEpisode.id}/platform-links`).then(r => r.json()) : Promise.resolve([]),
    enabled: !!selectedEpisode && (selectedEpisode.status === "publishing" || selectedEpisode.status === "published"),
  });

  const [datePickerMonth, setDatePickerMonth] = useState(new Date());
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  useEffect(() => {
    apiRequest("POST", "/api/episodes/auto-status", {}).then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const checkHighlight = () => {
      if (!episodes) return;
      const params = new URLSearchParams(window.location.search);
      const highlightId = params.get("highlight");
      if (highlightId) {
        const ep = episodes.find((e) => String(e.id) === highlightId);
        if (ep) setSelectedEpisode(ep);
        window.history.replaceState({}, "", window.location.pathname);
      }
    };
    checkHighlight();
    window.addEventListener("spotlight-navigate", checkHighlight);
    return () => window.removeEventListener("spotlight-navigate", checkHighlight);
  }, [episodes]);

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
        status: "scheduled",
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

  const getEpisodeGuest = useCallback((episode: Episode): Guest | null => {
    if (episode.guestId) {
      return allGuests?.find((g) => g.id === episode.guestId) || null;
    }
    if (episode.interviewId) {
      const interview = allInterviews?.find((i) => i.id === episode.interviewId);
      if (interview) {
        return allGuests?.find((g) => g.id === interview.guestId) || null;
      }
    }
    return null;
  }, [allGuests, allInterviews]);

  const getEpisodeInterview = useCallback((episode: Episode): Interview | null => {
    if (episode.interviewId) {
      return allInterviews?.find((i) => i.id === episode.interviewId) || null;
    }
    if (episode.guestId) {
      return allInterviews?.find((i) => i.guestId === episode.guestId) || null;
    }
    return null;
  }, [allInterviews]);

  const updateGuestEmail = useMutation({
    mutationFn: async ({ guestId, email }: { guestId: string; email: string }) => {
      await apiRequest("PATCH", `/api/guests/${guestId}`, { email });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/guests"] });
      setEditingGuestEmail(false);
      toast({ title: t.episodes.emailSaved });
    },
    onError: () => toast({ title: "Failed to save email", variant: "destructive" }),
  });

  const updateGuestPhone = useMutation({
    mutationFn: async ({ guestId, phone }: { guestId: string; phone: string }) => {
      await apiRequest("PATCH", `/api/guests/${guestId}`, { phone });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/guests"] });
      setEditingGuestPhone(false);
      toast({ title: t.episodes.phoneSaved });
    },
    onError: () => toast({ title: "Failed to save phone", variant: "destructive" }),
  });

  const linkGuestToEpisode = useMutation({
    mutationFn: async ({ episodeId, guestId }: { episodeId: string; guestId: string }) => {
      await apiRequest("PATCH", `/api/episodes/${episodeId}`, { guestId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      setShowGuestPicker(false);
    },
  });

  const STUDIO_EMAIL = "studio@example.com";
  const DEFAULT_TEAM_NAMES = ["gal", "zion"];

  const getAttendeesForEpisode = useCallback((episode: Episode | null) => {
    if (!episode || !members) return {};
    const attendees: Record<string, boolean> = {};
    const guest = getEpisodeGuest(episode);
    if (guest?.email) attendees[guest.email] = true;
    for (const m of members) {
      if (m.email) {
        attendees[m.email] = DEFAULT_TEAM_NAMES.includes(m.name.toLowerCase());
      }
    }
    attendees[STUDIO_EMAIL] = true;
    return attendees;
  }, [members, getEpisodeGuest]);

  useEffect(() => {
    if (showReschedule && !attendeesInitialized && selectedEpisode) {
      setRescheduleAttendees(getAttendeesForEpisode(selectedEpisode));
      setAttendeesInitialized(true);
    }
    if (!showReschedule) {
      setAttendeesInitialized(false);
    }
  }, [showReschedule, attendeesInitialized, selectedEpisode, getAttendeesForEpisode]);

  const attendeesList = useMemo(() => {
    if (!selectedEpisode || !members) return [];
    const guest = getEpisodeGuest(selectedEpisode);
    const list: { email: string; label: string; type: "guest" | "team" | "studio" }[] = [];
    if (guest?.email) {
      list.push({ email: guest.email, label: `${guest.name} (${t.episodes.guest})`, type: "guest" });
    }
    for (const m of members) {
      if (m.email && m.email !== guest?.email) {
        list.push({ email: m.email, label: `${m.name}`, type: "team" });
      }
    }
    list.push({ email: STUDIO_EMAIL, label: t.episodes.studioEmail, type: "studio" });
    return list;
  }, [selectedEpisode, members, getEpisodeGuest, t]);

  const updateEpisode = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      await apiRequest("PATCH", `/api/episodes/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
    },
  });

  const rescheduleAvailableDates = studioDates
    ?.filter((d) => d.status === "available" && isAfter(parseISO(d.date), new Date()) && d.notes && /\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/.test(d.notes))
    .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()) || [];

  const rescheduleSelectedDateObj = rescheduleDate ? rescheduleAvailableDates.find((d) => d.date === rescheduleDate) : null;
  const rescheduleAvailableSlots = rescheduleSelectedDateObj?.notes ? parseTimeSlotsEpisodes(rescheduleSelectedDateObj.notes) : [];
  const isRescheduleFullySelected = rescheduleDate && (rescheduleAvailableSlots.length === 0 || rescheduleSlot !== null);

  const rescheduleEpisode = useMutation({
    mutationFn: async () => {
      if (!selectedEpisode || !rescheduleDate) return;
      const linkedInterview = selectedEpisode.interviewId
        ? allInterviews?.find((i) => i.id === selectedEpisode.interviewId)
        : null;
      const newStudioDate = rescheduleAvailableDates.find((d) => d.date === rescheduleDate);

      if (linkedInterview?.studioDateId) {
        const oldStudioDate = studioDates?.find((d) => d.id === linkedInterview.studioDateId);
        if (oldStudioDate) {
          const oldBookedSlot = oldStudioDate.bookedSlot;
          if (oldBookedSlot) {
            const currentNotes = oldStudioDate.notes || "";
            const slotRange = oldBookedSlot.replace(/\s*-\s*/, "-").replace(/\s+/g, "");
            const newNotes = currentNotes ? `${currentNotes}, ${slotRange}` : slotRange;
            await apiRequest("PATCH", `/api/studio-dates/${oldStudioDate.id}`, { notes: newNotes, status: "available", bookedSlot: null });
          } else {
            await apiRequest("PATCH", `/api/studio-dates/${oldStudioDate.id}`, { status: "available" });
          }
        }
      }

      if (newStudioDate && rescheduleSlot) {
        const allSlots = newStudioDate.notes ? parseTimeSlotsEpisodes(newStudioDate.notes) : [];
        const remainingSlots = allSlots.filter((s) => s.label !== rescheduleSlot.label);
        const patchData: Record<string, unknown> = { bookedSlot: rescheduleSlot.label };
        if (remainingSlots.length === 0) {
          patchData.status = "taken";
        } else {
          patchData.notes = remainingSlots.map((s) => `${s.start}-${s.end}`).join(", ");
        }
        await apiRequest("PATCH", `/api/studio-dates/${newStudioDate.id}`, patchData);
      }

      if (linkedInterview) {
        await apiRequest("PATCH", `/api/interviews/${linkedInterview.id}`, {
          scheduledDate: rescheduleDate,
          scheduledTime: rescheduleSlot ? rescheduleSlot.start : null,
          studioDateId: newStudioDate?.id || null,
        });
      }

      await apiRequest("PATCH", `/api/episodes/${selectedEpisode.id}`, {
        scheduledDate: rescheduleDate,
        scheduledTime: rescheduleSlot ? rescheduleSlot.start : null,
      });

      let calendarResult: "sent" | "no-attendees" | "failed" | "no-slot" = "no-slot";
      const selectedEmails = Object.entries(rescheduleAttendees)
        .filter(([, checked]) => checked)
        .map(([email]) => email)
        .filter((e) => e.includes("@"));
      if (rescheduleSlot && selectedEmails.length > 0) {
        try {
          const guest = getEpisodeGuest(selectedEpisode);
          const calResponse = await apiRequest("POST", "/api/calendar-event", {
            date: rescheduleDate,
            startTime: rescheduleSlot.start,
            endTime: rescheduleSlot.end,
            summary: `Podcast Recording: ${selectedEpisode.title}`,
            description: `Recording session for "${selectedEpisode.title}"${guest ? ` with ${guest.name}` : ""}`,
            attendeeEmails: selectedEmails,
            previousEventId: (selectedEpisode as any).calendarEventId || undefined,
          });
          const eventData = await calResponse.json();
          if (eventData.id) {
            await apiRequest("PATCH", `/api/episodes/${selectedEpisode.id}`, {
              calendarEventId: eventData.id,
            });
          }
          calendarResult = "sent";
        } catch (calErr) {
          console.error("Calendar invite failed:", calErr);
          calendarResult = "failed";
        }
      } else if (rescheduleSlot && selectedEmails.length === 0) {
        calendarResult = "no-attendees";
      }
      return calendarResult;
    },
    onSuccess: (calendarResult) => {
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/interviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/studio-dates"] });
      if (selectedEpisode && rescheduleDate) {
        setSelectedEpisode({
          ...selectedEpisode,
          scheduledDate: rescheduleDate,
          scheduledTime: rescheduleSlot ? rescheduleSlot.start : null,
        } as Episode);
      }
      setShowReschedule(false);
      setRescheduleDate(null);
      setRescheduleSlot(null);
      setRescheduleAttendees({});
      setAttendeesInitialized(false);
      const calMsg = calendarResult === "sent" ? ` — ${t.episodes.inviteSent}` : calendarResult === "failed" ? ` — ${t.episodes.inviteFailed}` : "";
      toast({ title: `Rescheduled to ${rescheduleDate ? format(parseISO(rescheduleDate), "MMM d, yyyy") : ""}${rescheduleSlot ? ` (${rescheduleSlot.label})` : ""}${calMsg}` });
    },
    onError: () => toast({ title: "Failed to reschedule", variant: "destructive" }),
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
        assigneeIds: newTask.assigneeIds.length > 0 ? newTask.assigneeIds : null,
        dueDate: newTask.dueDate || null,
        status: "todo",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setShowNewTask(false);
      setNewTask({ title: "", assigneeIds: [], dueDate: "" });
      toast({ title: "Task added" });
    },
    onError: () => toast({ title: "Failed to add task", variant: "destructive" }),
  });

  const updateTaskStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/tasks/${id}`, { status });
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/tasks"] });
      const prev = queryClient.getQueryData<Task[]>(["/api/tasks"]);
      queryClient.setQueryData<Task[]>(["/api/tasks"], (old) =>
        old?.map((t) => (t.id === id ? { ...t, status } : t))
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(["/api/tasks"], context.prev);
    },
    onSettled: () => {
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

  const toggleTaskDone = (task: Task) => {
    const next = task.status === "done" ? "todo" : "done";
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
    <div className="p-6 space-y-6 max-w-5xl mx-auto pb-24">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-episodes-title">{t.episodes.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.episodes.subtitle}</p>
        </div>
        <Button onClick={() => setShowNewEpisode(true)} className="rounded-full px-5 shadow-md" data-testid="button-new-episode">
          <Plus className="h-4 w-4 mr-2" />
          {t.episodes.newEpisode}
        </Button>
      </div>

      {(!episodes || episodes.length === 0) ? (
        <div className="ios-section">
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50 mb-4">
              <Mic className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <p className="text-muted-foreground font-semibold">{t.episodes.noEpisodesYet}</p>
            <p className="text-sm text-muted-foreground mt-1">{t.episodes.createFirstEpisode}</p>
            <Button className="rounded-full px-5 shadow-md mt-5" onClick={() => setShowNewEpisode(true)} data-testid="button-create-first-episode">
              <Plus className="h-4 w-4 mr-2" />
              {t.episodes.createEpisode}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {[...episodes].filter((e) => e.status !== "archived").sort((a, b) => {
            if (!a.scheduledDate) return 1;
            if (!b.scheduledDate) return -1;
            return parseISO(a.scheduledDate).getTime() - parseISO(b.scheduledDate).getTime();
          }).map((episode) => {
            const eTasks = episodeTasks(episode.id);
            const done = eTasks.filter((t) => t.status === "done").length;
            return (
              <div
                key={episode.id}
                className="ios-card cursor-pointer p-4 px-5"
                onClick={() => setSelectedEpisode(episode)}
                data-testid={`card-episode-${episode.id}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {episode.episodeNumber && (
                        <span className="text-[11px] text-muted-foreground font-mono bg-muted/50 rounded-md px-1.5 py-0.5">#{episode.episodeNumber}</span>
                      )}
                      <h3 className="text-sm font-semibold">{getEpisodeGuest(episode)?.name || episode.title}</h3>
                      <Badge className={`ios-badge border-0 ${statusColors[episode.status]}`}>
                        {episode.status}
                      </Badge>
                      {getEpisodeInterview(episode)?.status === 'needs-reschedule' && (
                        <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 gap-1" data-testid={`badge-reschedule-episode-${episode.id}`}>
                          <AlertTriangle className="w-3 h-3" />
                          {t.common.rescheduleNeeded}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      {episode.scheduledDate && (
                        <span className="text-xs text-muted-foreground">
                          {format(parseISO(episode.scheduledDate), "MMM d, yyyy")}{episode.scheduledTime ? ` at ${episode.scheduledTime}` : ""}
                        </span>
                      )}
                      {eTasks.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-chart-2 rounded-full transition-all duration-500"
                              style={{ width: `${eTasks.length > 0 ? (done / eTasks.length) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-muted-foreground font-medium">
                            {done}/{eTasks.length}
                          </span>
                        </div>
                      )}
                      {eTasks.length > 0 && (
                        <div className="flex -space-x-1.5">
                          {[...new Set(eTasks.flatMap((t) => t.assigneeIds || (t.assigneeId ? [t.assigneeId] : [])))].slice(0, 4).map((id) => {
                            const m = getMember(id!);
                            if (!m) return null;
                            return (
                              <Avatar key={m.id} className="h-6 w-6 border-2 border-card ring-0">
                                <AvatarFallback className="text-[9px] font-semibold text-white" style={{ backgroundColor: m.color }}>
                                  {m.initials}
                                </AvatarFallback>
                              </Avatar>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Button
        onClick={() => setShowNewEpisode(true)}
        className="ios-floating-action md:hidden"
        data-testid="button-fab-new-episode"
      >
        <Plus className="h-6 w-6" />
      </Button>

      <Dialog open={showNewEpisode} onOpenChange={setShowNewEpisode}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.episodes.newEpisode}</DialogTitle>
            <DialogDescription>{t.episodes.addToYourPipeline}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.episodes.episodeTitle}</label>
              <Input
                value={newEpisode.title}
                onChange={(e) => setNewEpisode({ ...newEpisode, title: e.target.value })}
                placeholder={t.episodes.episodeTitle}
                data-testid="input-episode-title"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.episodes.episodeNumber}</label>
              <Input
                type="number"
                value={newEpisode.episodeNumber}
                onChange={(e) => setNewEpisode({ ...newEpisode, episodeNumber: e.target.value })}
                placeholder="e.g. 42"
                data-testid="input-episode-number"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.episodes.description}</label>
              <Textarea
                value={newEpisode.description}
                onChange={(e) => setNewEpisode({ ...newEpisode, description: e.target.value })}
                placeholder={t.episodes.description}
                data-testid="input-episode-description"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.episodes.scheduledDate}</label>
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
                      : t.episodes.pickADate}
                    {newEpisode.scheduledDate && availableStudioDates.has(newEpisode.scheduledDate) && (
                      <Badge variant="secondary" className="ml-auto text-xs">{t.episodes.studioAvailable}</Badge>
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
                              title={isAvailable ? `${t.episodes.studioAvailable}${notes ? `: ${notes}` : ""}` : isTaken ? t.episodes.studioTaken : ""}
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
                        {t.episodes.studioAvailable}
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="h-2 w-2 rounded-full bg-chart-5" />
                        {t.episodes.studioTaken}
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
              {createEpisode.isPending ? t.episodes.creating : t.episodes.createEpisode}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedEpisode} onOpenChange={(open) => { if (!open) { setSelectedEpisode(null); setShowReschedule(false); setRescheduleDate(null); setRescheduleSlot(null); setEditingGuestEmail(false); setEditingGuestPhone(false); setShowGuestDetails(false); setShowGuestPicker(false); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedEpisode && (
            <>
              <DialogHeader>
                <div className="space-y-2">
                  {(() => {
                    const headerGuest = getEpisodeGuest(selectedEpisode);
                    return (
                      <DialogTitle className="flex items-center gap-2 flex-wrap" data-testid="text-episode-guest-header">
                        {selectedEpisode.episodeNumber != null && (
                          <span className="text-muted-foreground font-mono text-sm">#{selectedEpisode.episodeNumber}</span>
                        )}
                        <UserPlus className="h-4 w-4 text-primary" />
                        <span>{headerGuest?.name || t.episodes.noGuestLinked}</span>
                        {headerGuest?.shortDescription && (
                          <span className="text-sm font-normal text-muted-foreground">— {headerGuest.shortDescription}</span>
                        )}
                      </DialogTitle>
                    );
                  })()}

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground font-medium">{t.episodes.episodeTitle}</label>
                    {editingField === "title" ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editValues.title}
                          onChange={(e) => setEditValues({ ...editValues, title: e.target.value })}
                          onKeyDown={(e) => { if (e.key === "Enter") saveField("title"); if (e.key === "Escape") cancelEditing(); }}
                          autoFocus
                          className="text-sm"
                          data-testid="input-edit-title"
                        />
                        <Button size="icon" variant="ghost" onClick={() => saveField("title")} data-testid="button-save-title">
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={cancelEditing} data-testid="button-cancel-title">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <p
                        className="text-sm cursor-pointer group flex items-center gap-1 hover:text-foreground transition-colors"
                        onClick={() => startEditing("title")}
                        data-testid="text-episode-title"
                      >
                        {selectedEpisode.title}
                        <Pencil className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </p>
                    )}
                  </div>

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
                    <label className="text-sm text-muted-foreground">{t.episodes.status}:</label>
                    <Select
                      value={selectedEpisode.status}
                      onValueChange={(val) => {
                        if (val === "publishing") {
                          setPublishDateValue(selectedEpisode.publishDate || format(new Date(), "yyyy-MM-dd"));
                          setPublishTimeValue(selectedEpisode.publishTime || "12:00");
                          setShowPublishDate(true);
                          return;
                        }
                        updateEpisode.mutate({ id: selectedEpisode.id, data: { status: val } });
                        setSelectedEpisode({ ...selectedEpisode, status: val });
                      }}
                    >
                      <SelectTrigger className="w-[140px]" data-testid="select-episode-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map((s) => {
                          const earlyStages = ["scheduled", "planning", "recording"];
                          const isEarly = earlyStages.includes(selectedEpisode.status);
                          const blocked = isEarly && (s === "publishing" || s === "archived");
                          return (
                            <SelectItem key={s} value={s} disabled={blocked}>{s}</SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {getEpisodeInterview(selectedEpisode)?.status === 'needs-reschedule' && (
                      <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 gap-1" data-testid="badge-reschedule-detail">
                        <AlertTriangle className="w-3 h-3" />
                        {t.common.rescheduleNeeded}
                      </Badge>
                    )}
                  </div>
                  {selectedEpisode.scheduledDate && !showReschedule ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <CalendarIcon className="h-3.5 w-3.5" />
                        {format(parseISO(selectedEpisode.scheduledDate), "MMM d, yyyy")}{selectedEpisode.scheduledTime ? ` at ${selectedEpisode.scheduledTime}` : ""}
                      </span>
                      <button
                        className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1 cursor-pointer font-medium"
                        onClick={() => {
                          setShowReschedule(true);
                          setRescheduleDate(null);
                          setRescheduleSlot(null);
                        }}
                        data-testid="button-reschedule-inline"
                      >
                        <Pencil className="h-3 w-3" />
                        {t.episodes.reschedule}
                      </button>
                    </div>
                  ) : !selectedEpisode.scheduledDate && !showReschedule ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => {
                        setShowReschedule(true);
                        setRescheduleDate(null);
                        setRescheduleSlot(null);
                      }}
                      data-testid="button-set-schedule"
                    >
                      <CalendarIcon className="h-3 w-3 mr-1" />
                      {t.episodes.pickNewDate}
                    </Button>
                  ) : null}
                </div>

                {showReschedule && (
                  <div className="rounded-xl border bg-muted/30 p-3 space-y-2" data-testid="panel-reschedule-episode">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold flex items-center gap-1.5">
                        <CalendarIcon className="h-4 w-4 text-primary" />
                        {t.episodes.studioAvailability}
                      </h3>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setShowReschedule(false); setRescheduleDate(null); setRescheduleSlot(null); }} data-testid="button-close-reschedule">
                        <X className="h-3 w-3" />
                      </Button>
                    </div>

                    {selectedEpisode.scheduledDate && (
                      <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-lg px-2.5 py-1.5">
                        <CalendarIcon className="h-3 w-3" />
                        {t.episodes.slotWillBeReleased}
                      </div>
                    )}

                    {rescheduleAvailableDates.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">{t.episodes.noAvailableDates}</p>
                    ) : (
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {rescheduleAvailableDates.map((d) => {
                          const slots = d.notes ? parseTimeSlotsEpisodes(d.notes) : [];
                          const isExpanded = rescheduleDate === d.date && slots.length > 0;
                          return (
                            <div key={d.id}>
                              <button
                                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                                  rescheduleDate === d.date ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted/50"
                                }`}
                                onClick={() => { setRescheduleDate(d.date); setRescheduleSlot(null); }}
                                data-testid={`button-reschedule-pick-date-${d.id}`}
                              >
                                <div className="flex h-9 w-9 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/15 to-emerald-600/5 shrink-0">
                                  <span className="text-[8px] font-semibold text-chart-2 leading-none uppercase">{format(parseISO(d.date), "MMM")}</span>
                                  <span className="text-xs font-bold text-chart-2 leading-tight">{format(parseISO(d.date), "d")}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium">{format(parseISO(d.date), "EEEE, MMMM d")}</p>
                                  {d.notes && <span className="text-[11px] text-muted-foreground truncate">{d.notes.match(/\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/)?.[0] || d.notes}</span>}
                                </div>
                                {rescheduleDate === d.date && slots.length === 0 && <Check className="h-4 w-4 text-primary shrink-0" />}
                              </button>
                              {isExpanded && (
                                <div className="ml-12 mt-1 mb-2 space-y-1">
                                  <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1 mb-1.5">
                                    <Clock className="h-3 w-3" />
                                    {t.episodes.selectHourSlot}
                                  </p>
                                  <div className="grid grid-cols-2 gap-1">
                                    {slots.map((slot) => (
                                      <button
                                        key={slot.label}
                                        className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                                          rescheduleSlot?.label === slot.label
                                            ? "bg-primary text-primary-foreground shadow-sm"
                                            : "bg-muted/50 hover:bg-muted text-foreground"
                                        }`}
                                        onClick={() => setRescheduleSlot(slot)}
                                        data-testid={`button-reschedule-pick-slot-${slot.start}`}
                                      >
                                        <Clock className="h-3 w-3" />
                                        {slot.label}
                                        {rescheduleSlot?.label === slot.label && <Check className="h-3 w-3" />}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {isRescheduleFullySelected && (
                      <div className="space-y-2 pt-1">
                        <Badge className="ios-badge border-0 bg-chart-2/10 text-chart-2">
                          {t.episodes.selected}: {format(parseISO(rescheduleDate!), "MMM d")}{rescheduleSlot ? ` (${rescheduleSlot.label})` : ""}
                        </Badge>

                        {attendeesList.length > 0 && (
                          <div className="rounded-lg border bg-background/50 p-2.5 space-y-1.5" data-testid="panel-attendees">
                            <div className="flex items-center gap-1.5">
                              <Mail className="h-3.5 w-3.5 text-primary" />
                              <span className="text-xs font-semibold">{t.episodes.attendees}</span>
                            </div>
                            <div className="space-y-0.5">
                              {attendeesList.map((att) => (
                                <label
                                  key={att.email}
                                  className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer transition-colors"
                                  data-testid={`attendee-${att.type}-${att.email}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={!!rescheduleAttendees[att.email]}
                                    onChange={(e) => setRescheduleAttendees((prev) => ({ ...prev, [att.email]: e.target.checked }))}
                                    className="h-4 w-4 rounded border-muted-foreground/30 accent-primary"
                                  />
                                  <span className="text-xs flex-1 truncate">{att.label}</span>
                                  <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">{att.email}</span>
                                </label>
                              ))}
                            </div>
                            {(selectedEpisode as any)?.calendarEventId && (
                              <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                <CalendarIcon className="h-3 w-3" />
                                {t.episodes.previousEventCanceled}
                              </p>
                            )}
                          </div>
                        )}

                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            className="rounded-full px-4 shadow-md h-7 text-xs"
                            onClick={() => rescheduleEpisode.mutate()}
                            disabled={rescheduleEpisode.isPending}
                            data-testid="button-confirm-reschedule"
                          >
                            {rescheduleEpisode.isPending ? t.episodes.saving : t.episodes.reschedule}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {(() => {
                  const guest = getEpisodeGuest(selectedEpisode);
                  return (
                    <div className="rounded-xl border bg-muted/30 p-3 space-y-2" data-testid="section-episode-guest">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-medium flex items-center gap-1.5">
                          <UserPlus className="h-4 w-4 text-primary" />
                          {t.episodes.guest}
                        </h3>
                        <div className="flex items-center gap-1">
                          {guest && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs text-muted-foreground"
                              onClick={() => { setShowGuestDetails(!showGuestDetails); setEditingGuestEmail(false); setEditingGuestPhone(false); }}
                              data-testid="button-toggle-guest-details"
                            >
                              {showGuestDetails ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                              {t.episodes.contactDetails}
                            </Button>
                          )}
                          {guest && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs text-muted-foreground"
                              onClick={() => {
                                updateEpisode.mutate({ id: selectedEpisode.id, data: { guestId: null } });
                                setSelectedEpisode({ ...selectedEpisode, guestId: null } as Episode);
                              }}
                              data-testid="button-unlink-guest"
                            >
                              <X className="h-3 w-3 mr-1" />
                              {t.episodes.unlinkGuest}
                            </Button>
                          )}
                        </div>
                      </div>
                      {guest ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium" data-testid="text-episode-guest-name">{guest.name}</span>
                            {guest.shortDescription && (
                              <span className="text-xs text-muted-foreground">— {guest.shortDescription}</span>
                            )}
                          </div>
                          {showGuestDetails && (
                            <div className="space-y-2 pt-1 border-t border-border/50" data-testid="section-guest-contact-details">
                              <div className="flex items-center gap-2">
                                <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                {editingGuestEmail ? (
                                  <div className="flex items-center gap-1 flex-1">
                                    <Input
                                      value={guestEmailValue}
                                      onChange={(e) => setGuestEmailValue(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") updateGuestEmail.mutate({ guestId: guest.id, email: guestEmailValue });
                                        if (e.key === "Escape") setEditingGuestEmail(false);
                                      }}
                                      placeholder={t.episodes.addEmail}
                                      autoFocus
                                      className="h-7 text-xs flex-1"
                                      type="email"
                                      data-testid="input-guest-email"
                                    />
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateGuestEmail.mutate({ guestId: guest.id, email: guestEmailValue })} data-testid="button-save-guest-email">
                                      <Check className="h-3 w-3" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingGuestEmail(false)}>
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <button
                                    className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer group flex items-center gap-1"
                                    onClick={() => { setEditingGuestEmail(true); setGuestEmailValue(guest.email || ""); }}
                                    data-testid="button-edit-guest-email"
                                  >
                                    {guest.email || t.episodes.addEmail}
                                    <Pencil className="h-2.5 w-2.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                {editingGuestPhone ? (
                                  <div className="flex items-center gap-1 flex-1">
                                    <Input
                                      value={guestPhoneValue}
                                      onChange={(e) => setGuestPhoneValue(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") updateGuestPhone.mutate({ guestId: guest.id, phone: guestPhoneValue });
                                        if (e.key === "Escape") setEditingGuestPhone(false);
                                      }}
                                      placeholder={t.team.addPhoneNumber}
                                      autoFocus
                                      className="h-7 text-xs flex-1"
                                      type="tel"
                                      data-testid="input-guest-phone"
                                    />
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateGuestPhone.mutate({ guestId: guest.id, phone: guestPhoneValue })} data-testid="button-save-guest-phone">
                                      <Check className="h-3 w-3" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingGuestPhone(false)}>
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <button
                                    className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer group flex items-center gap-1"
                                    onClick={() => { setEditingGuestPhone(true); setGuestPhoneValue(guest.phone || ""); }}
                                    data-testid="button-edit-guest-phone"
                                  >
                                    {guest.phone || t.team.addPhoneNumber}
                                    <Pencil className="h-2.5 w-2.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : showGuestPicker ? (
                        <div className="space-y-1 max-h-40 overflow-y-auto" data-testid="guest-picker">
                          {allGuests?.map((g) => (
                            <button
                              key={g.id}
                              className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-muted/50 transition-colors text-sm"
                              onClick={() => {
                                linkGuestToEpisode.mutate({ episodeId: selectedEpisode.id, guestId: g.id });
                                setSelectedEpisode({ ...selectedEpisode, guestId: g.id } as Episode);
                              }}
                              data-testid={`button-link-guest-${g.id}`}
                            >
                              <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{g.name}</span>
                              {g.email && <span className="text-xs text-muted-foreground ml-auto">{g.email}</span>}
                            </button>
                          ))}
                          {(!allGuests || allGuests.length === 0) && (
                            <p className="text-xs text-muted-foreground text-center py-2">{t.episodes.noGuestLinked}</p>
                          )}
                          <Button variant="ghost" size="sm" className="w-full text-xs mt-1" onClick={() => setShowGuestPicker(false)}>
                            <X className="h-3 w-3 mr-1" /> Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => setShowGuestPicker(true)}
                          data-testid="button-link-guest"
                        >
                          <Link2 className="h-3 w-3 mr-1" />
                          {t.episodes.linkGuest}
                        </Button>
                      )}
                    </div>
                  );
                })()}

                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h3 className="text-sm font-medium">{t.episodes.tasks}</h3>
                    <Button variant="ghost" size="sm" onClick={() => setShowNewTask(true)} data-testid="button-add-task">
                      <Plus className="h-3 w-3 mr-1" />
                      {t.episodes.addTask}
                    </Button>
                  </div>

                  {episodeTasks(selectedEpisode.id).length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-sm text-muted-foreground">{t.episodes.noTasks}. {t.episodes.addFirstTask}.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {episodeTasks(selectedEpisode.id).map((task) => {
                        const taskAssignees = (task.assigneeIds || (task.assigneeId ? [task.assigneeId] : [])).map((id) => getMember(id)).filter(Boolean) as TeamMember[];
                        const isEditingThis = editingTaskId === task.id;
                        return isEditingThis ? (
                          <div key={task.id} className="p-3 rounded-md bg-card space-y-3" data-testid={`card-task-edit-${task.id}`}>
                            <div className="space-y-2">
                              <Input
                                value={editTaskValues.title}
                                onChange={(e) => setEditTaskValues({ ...editTaskValues, title: e.target.value })}
                                placeholder={t.episodes.taskTitle}
                                autoFocus
                                className="text-sm h-8"
                                data-testid={`input-edit-task-title-${task.id}`}
                              />
                              <div className="flex gap-2">
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button variant="outline" className="text-sm h-8 flex-1 justify-start font-normal" data-testid={`select-edit-task-assignee-${task.id}`}>
                                      {editTaskValues.assigneeIds.length > 0
                                        ? editTaskValues.assigneeIds.map((id) => getMember(id)?.name).filter(Boolean).join(", ")
                                        : t.episodes.unassigned}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-48 p-2" align="start">
                                    {members?.map((m) => (
                                      <label key={m.id} className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={editTaskValues.assigneeIds.includes(m.id)}
                                          onChange={(e) => {
                                            setEditTaskValues({
                                              ...editTaskValues,
                                              assigneeIds: e.target.checked
                                                ? [...editTaskValues.assigneeIds, m.id]
                                                : editTaskValues.assigneeIds.filter((id) => id !== m.id),
                                            });
                                          }}
                                          className="rounded"
                                        />
                                        <Avatar className="h-5 w-5">
                                          <AvatarFallback className="text-[8px] font-semibold text-white" style={{ backgroundColor: m.color }}>{m.initials}</AvatarFallback>
                                        </Avatar>
                                        {m.name}
                                      </label>
                                    ))}
                                  </PopoverContent>
                                </Popover>
                                <Input
                                  type="date"
                                  value={editTaskValues.dueDate}
                                  onChange={(e) => setEditTaskValues({ ...editTaskValues, dueDate: e.target.value })}
                                  className="text-sm h-8 w-[140px]"
                                  data-testid={`input-edit-task-date-${task.id}`}
                                />
                              </div>
                            </div>
                            <div className="flex gap-2 justify-between items-center">
                              <button
                                onClick={() => { toggleTaskDone(task); setEditingTaskId(null); }}
                                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                                  task.status === "done"
                                    ? "bg-chart-2/15 text-chart-2"
                                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                                }`}
                                data-testid={`button-toggle-done-edit-${task.id}`}
                              >
                                <Check className="h-3.5 w-3.5" />
                                {task.status === "done" ? t.episodes.markedDone || "Done" : t.episodes.markDone || "Mark Done"}
                              </button>
                              <div className="flex gap-2">
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
                                        assigneeIds: editTaskValues.assigneeIds.length > 0 ? editTaskValues.assigneeIds : null,
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
                          </div>
                        ) : (
                          <div
                            key={task.id}
                            className="ios-list-item group"
                            data-testid={`card-task-${task.id}`}
                          >
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleTaskDone(task); }}
                              className={`ios-toggle-done ${task.status === "done" ? "checked" : ""}`}
                              title={task.status === "done" ? "Mark as not done" : "Mark as done"}
                              data-testid={`button-toggle-task-${task.id}`}
                            >
                              {task.status === "done" && <Check className="h-3.5 w-3.5" />}
                            </button>
                            <div
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => {
                                setEditTaskValues({
                                  title: task.title,
                                  assigneeIds: task.assigneeIds || (task.assigneeId ? [task.assigneeId] : []),
                                  dueDate: task.dueDate || "",
                                });
                                setEditingTaskId(task.id);
                              }}
                              data-testid={`text-task-title-${task.id}`}
                            >
                              <p className={`text-sm font-medium transition-all duration-200 ${task.status === "done" ? "line-through text-muted-foreground/60" : ""}`}>
                                {task.title}
                              </p>
                              {task.dueDate && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Due {format(parseISO(task.dueDate), "MMM d")}
                                </p>
                              )}
                            </div>
                            {taskAssignees.length > 0 && (
                              <div className="flex -space-x-1.5">
                                {taskAssignees.map((a) => (
                                  <Avatar key={a.id} className="h-6 w-6 ring-2 ring-background shadow-sm">
                                    <AvatarFallback className="text-[9px] font-semibold text-white" style={{ backgroundColor: a.color }}>
                                      {a.initials}
                                    </AvatarFallback>
                                  </Avatar>
                                ))}
                              </div>
                            )}
                            <Pencil
                              className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0 cursor-pointer hover:text-muted-foreground transition-colors"
                              onClick={() => {
                                setEditTaskValues({
                                  title: task.title,
                                  assigneeIds: task.assigneeIds || (task.assigneeId ? [task.assigneeId] : []),
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

                <EpisodeLargeLinksSection episodeId={selectedEpisode.id} />

                {(selectedEpisode.status === "publishing" || selectedEpisode.status === "published") && (
                  <div className="space-y-3 mt-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        {t.episodes.platformLinks}
                      </h4>
                    </div>

                    {selectedEpisode.publishDate && (
                      <div className="text-xs text-muted-foreground">
                        {t.episodes.publishDateLabel}: {format(parseISO(selectedEpisode.publishDate), "MMM d, yyyy")}
                        {selectedEpisode.publishTime && ` · ${selectedEpisode.publishTime}`}
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
                            data-testid={`link-platform-${platform}`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            {label}
                            <ExternalLink className="w-3 h-3 opacity-50" />
                          </a>
                        ) : (
                          <Button
                            key={platform}
                            variant="outline"
                            size="sm"
                            className={`gap-1.5 rounded-full text-xs ${colors}`}
                            onClick={() => { setShowPlatformLink(platform); setPlatformLinkUrl(""); }}
                            data-testid={`button-add-platform-${platform}`}
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

                <div className="flex items-center justify-between pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => deleteEpisode.mutate(selectedEpisode.id)}
                    data-testid="button-delete-episode"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    {t.episodes.deleteEpisode}
                  </Button>
                  <Button
                    size="sm"
                    className="rounded-full px-5"
                    onClick={() => {
                      toast({ title: t.episodes.saveChanges });
                      setSelectedEpisode(null);
                      setShowReschedule(false);
                      setEditingGuestEmail(false);
                      setEditingGuestPhone(false);
                      setShowGuestDetails(false);
                      setShowGuestPicker(false);
                    }}
                    data-testid="button-save-changes"
                  >
                    <Check className="h-3 w-3 mr-1" />
                    {t.episodes.saveChanges}
                  </Button>
                </div>
              </div>

              <Dialog open={showNewTask} onOpenChange={setShowNewTask}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t.episodes.newTask}</DialogTitle>
                    <DialogDescription>{t.episodes.addATaskForThisEpisode}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t.episodes.taskTitle}</label>
                      <Input
                        value={newTask.title}
                        onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                        placeholder="e.g. Write intro script"
                        data-testid="input-task-title"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t.episodes.assignee}</label>
                      <div className="border rounded-md p-2 space-y-1" data-testid="select-task-assignee">
                        {members?.map((m) => (
                          <label key={m.id} className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newTask.assigneeIds.includes(m.id)}
                              onChange={(e) => {
                                setNewTask({
                                  ...newTask,
                                  assigneeIds: e.target.checked
                                    ? [...newTask.assigneeIds, m.id]
                                    : newTask.assigneeIds.filter((id) => id !== m.id),
                                });
                              }}
                              className="rounded"
                            />
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-[8px] font-semibold text-white" style={{ backgroundColor: m.color }}>{m.initials}</AvatarFallback>
                            </Avatar>
                            {m.name}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t.episodes.dueDate}</label>
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
                      {createTask.isPending ? t.episodes.adding : t.episodes.addTask}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showPublishDate} onOpenChange={setShowPublishDate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.episodes.setPublishDate}</DialogTitle>
            <DialogDescription>{t.episodes.setPublishDateDescription}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.episodes.publishDateLabel}</label>
              <Input
                type="date"
                value={publishDateValue}
                onChange={(e) => setPublishDateValue(e.target.value)}
                data-testid="input-publish-date"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.episodes.publishTimeLabel}</label>
              <Input
                type="time"
                value={publishTimeValue}
                onChange={(e) => setPublishTimeValue(e.target.value)}
                data-testid="input-publish-time"
              />
            </div>
            <Button
              className="w-full"
              disabled={!publishDateValue || updateEpisode.isPending}
              onClick={() => {
                if (!selectedEpisode) return;
                updateEpisode.mutate(
                  {
                    id: selectedEpisode.id,
                    data: { status: "publishing", publishDate: publishDateValue, publishTime: publishTimeValue || null },
                  },
                  {
                    onSuccess: async () => {
                      setSelectedEpisode({ ...selectedEpisode, status: "publishing", publishDate: publishDateValue, publishTime: publishTimeValue || null });
                      setShowPublishDate(false);
                      queryClient.invalidateQueries({ queryKey: ["/api/episodes", selectedEpisode.id, "platform-links"] });
                      try {
                        await apiRequest("POST", "/api/publishing", {
                          episodeId: selectedEpisode.id,
                          platform: "all",
                          scheduledDate: publishDateValue,
                          scheduledTime: publishTimeValue || "12:00",
                          status: "scheduled",
                          title: selectedEpisode.title,
                          description: selectedEpisode.description || null,
                        });
                        queryClient.invalidateQueries({ queryKey: ["/api/publishing"] });
                      } catch (e) {
                        console.error("Failed to create publishing entry:", e);
                      }
                    },
                    onError: () => {
                      toast({ title: "Failed to update status", variant: "destructive" });
                    },
                  }
                );
              }}
              data-testid="button-confirm-publish-date"
            >
              {updateEpisode.isPending ? t.episodes.saving : t.episodes.setPublishDate}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showPlatformLink} onOpenChange={(open) => { if (!open) setShowPlatformLink(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {showPlatformLink === "youtube" ? t.episodes.youtube : showPlatformLink === "spotify" ? t.episodes.spotify : t.episodes.appleMusic}
            </DialogTitle>
            <DialogDescription>{t.episodes.pastePlatformUrl}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <Input
              value={platformLinkUrl}
              onChange={(e) => setPlatformLinkUrl(e.target.value)}
              placeholder="https://..."
              data-testid="input-platform-link-url"
            />
            <Button
              className="w-full"
              disabled={!platformLinkUrl}
              onClick={async () => {
                if (!selectedEpisode || !showPlatformLink) return;
                await apiRequest("POST", `/api/episodes/${selectedEpisode.id}/platform-links`, {
                  platform: showPlatformLink,
                  url: platformLinkUrl,
                });
                queryClient.invalidateQueries({ queryKey: ["/api/episodes", selectedEpisode.id, "platform-links"] });
                toast({ title: t.episodes.platformLinkSaved });
                setShowPlatformLink(null);
                setPlatformLinkUrl("");
              }}
              data-testid="button-submit-platform-link"
            >
              {t.episodes.addPlatformLink}
            </Button>
          </div>
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
  const { t } = useLanguage();
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
    <div className="rounded-xl border border-border/50 bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <FileText className="h-3.5 w-3.5 text-primary" />
          </div>
          <h3 className="text-sm font-semibold">{t.episodes.files}</h3>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[110px] h-8 text-xs" data-testid="select-file-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="graphic">Graphic</SelectItem>
              <SelectItem value="thumbnail">Thumbnail</SelectItem>
              <SelectItem value="document">Document</SelectItem>
              <SelectItem value="auto">Auto-detect</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg" disabled={isUploading} asChild data-testid="button-upload-file">
            <label className="cursor-pointer">
              {isUploading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
              {t.episodes.uploadFile}
              <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
            </label>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-12" />
      ) : !files || files.length === 0 ? (
        <div className="text-center py-6">
          <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{t.episodes.noFiles}</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {files.map((file) => {
            const FileIcon = fileCategoryIcons[file.category] || FileText;
            return (
              <div
                key={file.id}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-background/80 border border-border/30 group transition-colors hover:bg-background"
                data-testid={`card-file-${file.id}`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
                  <FileIcon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate font-medium">{file.name}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{file.category}</Badge>
                    {file.size && <span className="text-[11px] text-muted-foreground">{formatFileSize(file.size)}</span>}
                  </div>
                </div>
                <a
                  href={file.objectPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0"
                  data-testid={`link-download-file-${file.id}`}
                >
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 shrink-0 h-7 w-7"
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
  const { t } = useLanguage();
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
    <div className="rounded-xl border border-border/50 bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-chart-4/10">
            <Film className="h-3.5 w-3.5 text-chart-4" />
          </div>
          <h3 className="text-sm font-semibold">{t.episodes.teasers}</h3>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg" onClick={() => setShowAddShort(true)} data-testid="button-add-teaser">
          <Plus className="h-3 w-3 mr-1" />
          {t.episodes.uploadTeaser}
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-12" />
      ) : !shorts || shorts.length === 0 ? (
        <div className="text-center py-6">
          <Film className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{t.episodes.noTeasers}</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {shorts.map((short) => (
            <div
              key={short.id}
              className="flex items-center gap-3 p-2.5 rounded-lg bg-background/80 border border-border/30 group transition-colors hover:bg-background"
              data-testid={`card-short-${short.id}`}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
                <Film className="h-4 w-4 text-muted-foreground" />
              </div>
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
            <DialogTitle>Add Teaser</DialogTitle>
            <DialogDescription>Add a teaser clip for approval</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={newShortTitle}
                onChange={(e) => setNewShortTitle(e.target.value)}
                placeholder="e.g. Highlight clip #1"
                data-testid="input-teaser-title"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => createShort.mutate({ title: newShortTitle })}
              disabled={!newShortTitle || createShort.isPending}
              data-testid="button-submit-teaser"
            >
              {createShort.isPending ? t.episodes.adding : t.episodes.uploadTeaser}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EpisodeLargeLinksSection({ episodeId }: { episodeId: string }) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [showAddLink, setShowAddLink] = useState(false);
  const [newLink, setNewLink] = useState({ title: "", url: "" });

  const { data: links, isLoading } = useQuery<EpisodeLargeLink[]>({
    queryKey: ["/api/episodes", episodeId, "large-links"],
    queryFn: async () => {
      const res = await fetch(`/api/episodes/${episodeId}/large-links`);
      if (!res.ok) throw new Error("Failed to fetch links");
      return res.json();
    },
  });

  const createLink = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/episodes/${episodeId}/large-links`, {
        title: newLink.title,
        url: newLink.url,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/episodes", episodeId, "large-links"] });
      setShowAddLink(false);
      setNewLink({ title: "", url: "" });
      toast({ title: "Link added" });
    },
    onError: () => toast({ title: "Failed to add link", variant: "destructive" }),
  });

  const deleteLink = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/episode-large-links/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/episodes", episodeId, "large-links"] });
      toast({ title: "Link removed" });
    },
  });

  return (
    <div className="rounded-xl border border-border/50 bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-chart-2/10">
            <Link2 className="h-3.5 w-3.5 text-chart-2" />
          </div>
          <h3 className="text-sm font-semibold">{t.episodes.largeFileLinks}</h3>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg" onClick={() => setShowAddLink(true)} data-testid="button-add-large-link">
          <Plus className="h-3 w-3 mr-1" />
          {t.episodes.addLargeLink}
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-12" />
      ) : !links || links.length === 0 ? (
        <div className="text-center py-6">
          <Link2 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{t.episodes.noLargeLinks}</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {links.map((link) => (
            <div
              key={link.id}
              className="flex items-center gap-3 p-2.5 rounded-lg bg-background/80 border border-border/30 group transition-colors hover:bg-background"
              data-testid={`card-large-link-${link.id}`}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
                <Link2 className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{link.title}</p>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary underline truncate block"
                  data-testid={`link-open-large-link-${link.id}`}
                >
                  {link.url}
                </a>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 shrink-0"
                onClick={() => deleteLink.mutate(link.id)}
                data-testid={`button-delete-large-link-${link.id}`}
              >
                <Trash2 className="h-3 w-3 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showAddLink} onOpenChange={setShowAddLink}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.episodes.largeFileLinks}</DialogTitle>
            <DialogDescription>Google Drive, Dropbox, or other external links</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.episodes.linkTitle}</label>
              <Input
                value={newLink.title}
                onChange={(e) => setNewLink({ ...newLink, title: e.target.value })}
                placeholder="e.g. Raw Footage"
                data-testid="input-large-link-title"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.episodes.linkUrl}</label>
              <Input
                value={newLink.url}
                onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
                placeholder="https://drive.google.com/..."
                data-testid="input-large-link-url"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => createLink.mutate()}
              disabled={!newLink.title || !newLink.url || createLink.isPending}
              data-testid="button-submit-large-link"
            >
              {createLink.isPending ? t.episodes.adding : t.episodes.addLargeLink}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
