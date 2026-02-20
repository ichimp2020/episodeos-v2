import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Plus, CalendarClock, MapPin, Clock, User, Trash2, CheckCircle, AlertCircle, Pencil, UserPlus, Phone, Calendar, Check } from "lucide-react";
import type { Interview, Guest, StudioDate, TeamMember, InterviewParticipant, InterviewerUnavailability } from "@shared/schema";
import { format, parseISO, isAfter } from "date-fns";
import { useLanguage } from "@/i18n/LanguageProvider";

const interviewStatuses = ["proposed", "confirmed", "completed", "cancelled"];

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
const statusColors: Record<string, string> = {
  proposed: "bg-chart-4/10 text-chart-4 border-transparent",
  confirmed: "bg-chart-2/10 text-chart-2 border-transparent",
  completed: "bg-primary/10 text-primary border-transparent",
  cancelled: "bg-destructive/10 text-destructive border-transparent",
};

export default function Scheduling() {
  const [showNewInterview, setShowNewInterview] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ guestName: "", scheduledDate: "", scheduledTime: "", location: "", notes: "" });
  const [showRescheduleCalendar, setShowRescheduleCalendar] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<string | null>(null);
  const [rescheduleSlot, setRescheduleSlot] = useState<TimeSlot | null>(null);
  const [newInterview, setNewInterview] = useState({
    guestId: "", studioDateId: "", scheduledDate: "", scheduledTime: "", location: "", notes: "",
    participantIds: [] as string[],
  });
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickGuest, setQuickGuest] = useState({ name: "", phone: "", email: "" });
  const { toast } = useToast();
  const { t } = useLanguage();

  const { data: allInterviews, isLoading } = useQuery<Interview[]>({
    queryKey: ["/api/interviews"],
  });
  const { data: guests } = useQuery<Guest[]>({
    queryKey: ["/api/guests"],
  });
  const { data: studioDates } = useQuery<StudioDate[]>({
    queryKey: ["/api/studio-dates"],
  });
  const { data: members } = useQuery<TeamMember[]>({
    queryKey: ["/api/team-members"],
  });
  const { data: unavailabilityData } = useQuery<InterviewerUnavailability[]>({
    queryKey: ["/api/interviewer-unavailability"],
  });

  useEffect(() => {
    const checkHighlight = () => {
      if (!allInterviews) return;
      const params = new URLSearchParams(window.location.search);
      const highlightId = params.get("highlight");
      if (highlightId) {
        const interview = allInterviews.find((i) => String(i.id) === highlightId);
        if (interview) setSelectedInterview(interview);
        window.history.replaceState({}, "", window.location.pathname);
      }
    };
    checkHighlight();
    window.addEventListener("spotlight-navigate", checkHighlight);
    return () => window.removeEventListener("spotlight-navigate", checkHighlight);
  }, [allInterviews]);

  const availableStudioDates = studioDates?.filter(
    (d) => d.status === "available" && isAfter(parseISO(d.date), new Date())
  ).sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()) || [];

  const confirmedGuests = guests?.filter((g) => g.status === "confirmed" || g.status === "contacted") || [];

  const interviewers = members?.filter((m) => m.role === "Interviewer") || [];

  const getAvailableInterviewers = (dateStr: string, slotLabel?: string) => {
    if (!unavailabilityData) return interviewers;
    return interviewers.filter((m) => {
      return !unavailabilityData.some((u) =>
        u.teamMemberId === m.id &&
        u.unavailableDate === dateStr &&
        (slotLabel ? (u.slotLabel === slotLabel || u.slotLabel === null) : !u.slotLabel)
      );
    });
  };

  const createInterview = useMutation({
    mutationFn: async () => {
      const selectedStudio = studioDates?.find((d) => d.id === newInterview.studioDateId);
      const interview = await apiRequest("POST", "/api/interviews", {
        guestId: newInterview.guestId,
        studioDateId: newInterview.studioDateId || null,
        scheduledDate: selectedStudio ? selectedStudio.date : (newInterview.scheduledDate || null),
        scheduledTime: newInterview.scheduledTime || null,
        location: newInterview.location || null,
        notes: newInterview.notes || null,
        status: "proposed",
      });
      const interviewData = await interview.json();

      for (const memberId of newInterview.participantIds) {
        await apiRequest("POST", "/api/interview-participants", {
          interviewId: interviewData.id,
          teamMemberId: memberId,
          role: "interviewer",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/interviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/studio-dates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      setShowNewInterview(false);
      setNewInterview({ guestId: "", studioDateId: "", scheduledDate: "", scheduledTime: "", location: "", notes: "", participantIds: [] });
      toast({ title: "Interview scheduled" });
    },
    onError: () => toast({ title: "Failed to schedule interview", variant: "destructive" }),
  });

  const updateInterviewStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/interviews/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/interviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
    },
  });

  const updateInterview = useMutation({
    mutationFn: async ({ id, data, guestId, guestName, newStudioDateId, slot, oldStudioDateId, oldBookedSlot }: {
      id: string;
      data: Record<string, unknown>;
      guestId?: string;
      guestName?: string;
      newStudioDateId?: string;
      slot?: TimeSlot | null;
      oldStudioDateId?: string | null;
      oldBookedSlot?: string | null;
    }) => {
      await apiRequest("PATCH", `/api/interviews/${id}`, data);
      if (guestId && guestName) {
        await apiRequest("PATCH", `/api/guests/${guestId}`, { name: guestName });
      }
      if (newStudioDateId && oldStudioDateId && oldStudioDateId !== newStudioDateId) {
        await apiRequest("PATCH", `/api/studio-dates/${oldStudioDateId}`, {
          status: "available",
          bookedSlot: null,
        });
      }
      if (newStudioDateId && slot) {
        const studioDate = studioDates?.find((d) => d.id === newStudioDateId);
        if (studioDate) {
          const patchData: Record<string, unknown> = {};
          const allSlots = studioDate.notes ? parseTimeSlots(studioDate.notes) : [];
          const remainingSlots = allSlots.filter((s) => s.label !== slot.label);
          if (remainingSlots.length === 0) {
            patchData.status = "taken";
          } else {
            patchData.notes = remainingSlots.map((s) => `${s.start}-${s.end}`).join(", ");
          }
          patchData.bookedSlot = slot.label;
          await apiRequest("PATCH", `/api/studio-dates/${newStudioDateId}`, patchData);
        }
      } else if (newStudioDateId) {
        await apiRequest("PATCH", `/api/studio-dates/${newStudioDateId}`, { status: "taken" });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/interviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/guests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/studio-dates"] });
      setIsEditing(false);
      setShowRescheduleCalendar(false);
      setRescheduleDate(null);
      setRescheduleSlot(null);
      toast({ title: "Interview updated" });
    },
    onError: () => toast({ title: "Failed to update interview", variant: "destructive" }),
  });

  const deleteInterview = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/interviews/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/interviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/studio-dates"] });
      setSelectedInterview(null);
      toast({ title: "Interview removed" });
    },
  });

  const quickAddGuest = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/guests", {
        name: quickGuest.name,
        phone: quickGuest.phone || null,
        email: quickGuest.email || null,
        status: "prospect",
      });
      return (await res.json()) as Guest;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["/api/guests"] });
      setNewInterview((prev) => ({ ...prev, guestId: created.id }));
      setQuickGuest({ name: "", phone: "", email: "" });
      setShowQuickAdd(false);
      toast({ title: `${created.name} added as a guest` });
    },
    onError: () => toast({ title: "Failed to add guest", variant: "destructive" }),
  });

  const getGuest = (id: string) => guests?.find((g) => g.id === id);
  const getStudioDate = (id: string | null) => id ? studioDates?.find((d) => d.id === id) : null;
  const getMember = (id: string | null) => id ? members?.find((m) => m.id === id) : null;

  const toggleParticipant = (memberId: string) => {
    setNewInterview((prev) => ({
      ...prev,
      participantIds: prev.participantIds.includes(memberId)
        ? prev.participantIds.filter((id) => id !== memberId)
        : [...prev.participantIds, memberId],
    }));
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  const upcomingInterviews = allInterviews?.filter((i) => i.status === "proposed" || i.status === "confirmed")
    .sort((a, b) => {
      if (!a.scheduledDate) return 1;
      if (!b.scheduledDate) return -1;
      return parseISO(a.scheduledDate).getTime() - parseISO(b.scheduledDate).getTime();
    }) || [];

  const pastInterviews = allInterviews?.filter((i) => i.status === "completed" || i.status === "cancelled") || [];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-scheduling-title">{t.scheduling.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.scheduling.subtitle}</p>
        </div>
        <Button onClick={() => setShowNewInterview(true)} data-testid="button-new-interview" className="rounded-full px-5 shadow-md">
          <Plus className="h-4 w-4 mr-2" />
          {t.scheduling.scheduleInterview}
        </Button>
      </div>

      {(!allInterviews || allInterviews.length === 0) ? (
        <div className="ios-section">
          <div className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/50 mb-3">
              <CalendarClock className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">{t.scheduling.noInterviews}</p>
            <p className="text-sm text-muted-foreground mt-1">{t.scheduling.scheduleFirst}</p>
            <Button className="rounded-full px-5 shadow-md mt-4" onClick={() => setShowNewInterview(true)} data-testid="button-create-first-interview">
              <Plus className="h-4 w-4 mr-2" />
              {t.scheduling.scheduleInterview}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {upcomingInterviews.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-medium">Upcoming</h2>
                <Badge variant="secondary" className="text-xs">{upcomingInterviews.length}</Badge>
              </div>
              <div className="space-y-2">
                {upcomingInterviews.map((interview) => {
                  const guest = getGuest(interview.guestId);
                  const studio = getStudioDate(interview.studioDateId);
                  return (
                    <div
                      key={interview.id}
                      className="ios-card cursor-pointer"
                      onClick={() => setSelectedInterview(interview)}
                      data-testid={`card-interview-${interview.id}`}
                    >
                      <div className="py-4 px-5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm font-medium">{guest?.name || "Unknown Guest"}</h3>
                              <div className={`ios-badge border-0 ${statusColors[interview.status]}`}>
                                {interview.status}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              {interview.scheduledDate && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <CalendarClock className="h-3 w-3" />
                                  {format(parseISO(interview.scheduledDate), "MMM d, yyyy")}
                                  {interview.scheduledTime && ` at ${interview.scheduledTime}`}
                                </span>
                              )}
                              {interview.location && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <MapPin className="h-3 w-3" /> {interview.location}
                                </span>
                              )}
                              {studio && (
                                <span className="text-xs text-muted-foreground">
                                  Studio: {studio.notes || format(parseISO(studio.date), "MMM d")}
                                </span>
                              )}
                            </div>
                          </div>
                          {interview.status === "proposed" && (
                            <AlertCircle className="h-4 w-4 text-chart-4 shrink-0" />
                          )}
                          {interview.status === "confirmed" && (
                            <CheckCircle className="h-4 w-4 text-chart-2 shrink-0" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {pastInterviews.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-medium">Past</h2>
                <Badge variant="secondary" className="text-xs">{pastInterviews.length}</Badge>
              </div>
              <div className="space-y-2">
                {pastInterviews.map((interview) => {
                  const guest = getGuest(interview.guestId);
                  return (
                    <div
                      key={interview.id}
                      className="ios-card cursor-pointer opacity-60"
                      onClick={() => setSelectedInterview(interview)}
                      data-testid={`card-interview-${interview.id}`}
                    >
                      <div className="py-3 px-5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-medium">{guest?.name || "Unknown"}</h3>
                            <div className={`ios-badge border-0 ${statusColors[interview.status]}`}>
                              {interview.status}
                            </div>
                          </div>
                          {interview.scheduledDate && (
                            <span className="text-xs text-muted-foreground">
                              {format(parseISO(interview.scheduledDate), "MMM d, yyyy")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={showNewInterview} onOpenChange={setShowNewInterview}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Schedule Interview</DialogTitle>
            <DialogDescription>Set up a new interview with a guest</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Guest</label>
              <Select value={newInterview.guestId} onValueChange={(val) => setNewInterview({ ...newInterview, guestId: val })}>
                <SelectTrigger data-testid="select-interview-guest">
                  <SelectValue placeholder="Select a guest" />
                </SelectTrigger>
                <SelectContent>
                  {confirmedGuests.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name} ({g.status})
                    </SelectItem>
                  ))}
                  {guests?.filter((g) => g.status === "prospect").map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name} (prospect)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!showQuickAdd ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-1 text-xs gap-1.5 rounded-full px-4"
                  onClick={() => setShowQuickAdd(true)}
                  data-testid="button-quick-add-guest"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Add New Guest
                </Button>
              ) : (
                <div className="mt-2 p-3 rounded-md border bg-muted/30 space-y-2">
                  <p className="text-xs font-medium">Quick Add Guest</p>
                  <Input
                    placeholder="Name *"
                    value={quickGuest.name}
                    onChange={(e) => setQuickGuest({ ...quickGuest, name: e.target.value })}
                    data-testid="input-quick-guest-name"
                  />
                  <Input
                    placeholder="Phone number"
                    type="tel"
                    value={quickGuest.phone}
                    onChange={(e) => setQuickGuest({ ...quickGuest, phone: e.target.value })}
                    data-testid="input-quick-guest-phone"
                  />
                  <Input
                    placeholder="Email (optional)"
                    type="email"
                    value={quickGuest.email}
                    onChange={(e) => setQuickGuest({ ...quickGuest, email: e.target.value })}
                    data-testid="input-quick-guest-email"
                  />
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 rounded-full px-5 shadow-md"
                      disabled={!quickGuest.name.trim() || quickAddGuest.isPending}
                      onClick={() => quickAddGuest.mutate()}
                      data-testid="button-save-quick-guest"
                    >
                      {quickAddGuest.isPending ? "Adding..." : "Add Guest"}
                    </Button>
                    <Button
                      variant="secondary"
                      className="flex-1 rounded-full px-4"
                      onClick={() => { setShowQuickAdd(false); setQuickGuest({ name: "", phone: "", email: "" }); }}
                      data-testid="button-cancel-quick-guest"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Studio Date</label>
              <Select value={newInterview.studioDateId} onValueChange={(val) => {
                const studio = studioDates?.find((d) => d.id === val);
                setNewInterview({
                  ...newInterview,
                  studioDateId: val,
                  scheduledDate: studio?.date || newInterview.scheduledDate,
                });
              }}>
                <SelectTrigger data-testid="select-interview-studio">
                  <SelectValue placeholder="Pick an available studio date" />
                </SelectTrigger>
                <SelectContent>
                  {availableStudioDates.map((d) => {
                    const availInterviewers = getAvailableInterviewers(d.date);
                    const noOneAvail = interviewers.length > 0 && availInterviewers.length === 0;
                    return (
                      <SelectItem key={d.id} value={d.id} className={noOneAvail ? "opacity-40" : ""}>
                        {format(parseISO(d.date), "EEE, MMM d, yyyy")}
                        {d.notes && ` - ${d.notes}`}
                        {interviewers.length > 0 && ` (${availInterviewers.map((m) => m.initials).join(", ") || "none free"})`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Time</label>
                <Input
                  type="time"
                  value={newInterview.scheduledTime}
                  onChange={(e) => setNewInterview({ ...newInterview, scheduledTime: e.target.value })}
                  data-testid="input-interview-time"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Location</label>
                <Input
                  value={newInterview.location}
                  onChange={(e) => setNewInterview({ ...newInterview, location: e.target.value })}
                  placeholder="Main Studio"
                  data-testid="input-interview-location"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Interviewers</label>
              <div className="flex flex-wrap gap-2">
                {interviewers.map((member) => (
                  <Button
                    key={member.id}
                    variant={newInterview.participantIds.includes(member.id) ? "default" : "secondary"}
                    className={`rounded-full px-5 ${newInterview.participantIds.includes(member.id) ? "shadow-md" : ""}`}
                    onClick={() => toggleParticipant(member.id)}
                    data-testid={`button-toggle-interviewer-${member.id}`}
                  >
                    <Avatar className="h-5 w-5 mr-1.5">
                      <AvatarFallback className="text-[8px] text-white" style={{ backgroundColor: member.color }}>
                        {member.initials}
                      </AvatarFallback>
                    </Avatar>
                    {member.name}
                  </Button>
                ))}
                {interviewers.length === 0 && (
                  <p className="text-xs text-muted-foreground">No team members with "Interviewer" role found</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={newInterview.notes}
                onChange={(e) => setNewInterview({ ...newInterview, notes: e.target.value })}
                placeholder="Interview topic, special requirements..."
                data-testid="input-interview-notes"
              />
            </div>

            <Button
              className="w-full rounded-full px-5 shadow-md"
              onClick={() => createInterview.mutate()}
              disabled={!newInterview.guestId || createInterview.isPending}
              data-testid="button-submit-interview"
            >
              {createInterview.isPending ? "Scheduling..." : "Schedule Interview"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedInterview} onOpenChange={(open) => {
        if (!open) { setSelectedInterview(null); setIsEditing(false); setShowRescheduleCalendar(false); setRescheduleDate(null); setRescheduleSlot(null); }
      }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedInterview && (() => {
            const guest = getGuest(selectedInterview.guestId);
            const studio = getStudioDate(selectedInterview.studioDateId);
            const confirmer = getMember(selectedInterview.confirmedBy);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center justify-between gap-2">
                    <span>Interview: {guest?.name || "Unknown"}</span>
                    {!isEditing && (
                      <Button
                        variant="secondary"
                        className="rounded-full px-4"
                        onClick={() => {
                          setEditForm({
                            guestName: guest?.name || "",
                            scheduledDate: selectedInterview.scheduledDate || "",
                            scheduledTime: selectedInterview.scheduledTime || "",
                            location: selectedInterview.location || "",
                            notes: selectedInterview.notes || "",
                          });
                          setShowRescheduleCalendar(false);
                          setRescheduleDate(null);
                          setRescheduleSlot(null);
                          setIsEditing(true);
                        }}
                        data-testid="button-edit-interview"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </DialogTitle>
                  <DialogDescription>{guest?.shortDescription}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-muted-foreground">Status:</label>
                      <Select
                        value={selectedInterview.status}
                        onValueChange={(val) => {
                          updateInterviewStatus.mutate({ id: selectedInterview.id, status: val });
                          setSelectedInterview({ ...selectedInterview, status: val });
                        }}
                      >
                        <SelectTrigger className="w-[140px]" data-testid="select-detail-interview-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {interviewStatuses.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">{t.guests.name}</label>
                        <Input
                          value={editForm.guestName}
                          onChange={(e) => setEditForm({ ...editForm, guestName: e.target.value })}
                          data-testid="input-edit-guest-name"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium">Date</label>
                          <Input
                            type="date"
                            value={editForm.scheduledDate}
                            onChange={(e) => setEditForm({ ...editForm, scheduledDate: e.target.value })}
                            data-testid="input-edit-date"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium">Time</label>
                          <Input
                            type="time"
                            value={editForm.scheduledTime}
                            onChange={(e) => setEditForm({ ...editForm, scheduledTime: e.target.value })}
                            data-testid="input-edit-time"
                          />
                        </div>
                      </div>

                      {!showRescheduleCalendar ? (
                        <Button
                          variant="outline"
                          className="w-full rounded-xl border-dashed border-2 py-3 text-sm"
                          onClick={() => setShowRescheduleCalendar(true)}
                          data-testid="button-reschedule-availability"
                        >
                          <Calendar className="h-4 w-4 mr-2" />
                          {t.guests.checkStudioAvailability}
                        </Button>
                      ) : (
                        <div className="rounded-xl border bg-muted/30 p-3 space-y-2" data-testid="panel-reschedule-availability">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold flex items-center gap-1.5">
                              <Calendar className="h-4 w-4 text-primary" />
                              {t.guests.studioAvailability}
                            </h3>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setShowRescheduleCalendar(false); setRescheduleDate(null); setRescheduleSlot(null); }} data-testid="button-close-reschedule">
                              <span className="sr-only">Close</span>
                              &times;
                            </Button>
                          </div>
                          {availableStudioDates.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-3">{t.guests.noAvailableDates}</p>
                          ) : (
                            <div className="space-y-1 max-h-56 overflow-y-auto">
                              {availableStudioDates.map((d) => {
                                const slots = d.notes ? parseTimeSlots(d.notes) : [];
                                const isExpanded = rescheduleDate === d.date && slots.length > 0;
                                const dateAvailInterviewers = getAvailableInterviewers(d.date);
                                const noOneAvail = interviewers.length > 0 && dateAvailInterviewers.length === 0 && slots.length === 0;
                                return (
                                  <div key={d.id} className={noOneAvail ? "opacity-40" : ""}>
                                    <button
                                      className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                                        rescheduleDate === d.date
                                          ? "bg-primary/10 ring-1 ring-primary/30"
                                          : "hover:bg-muted/50"
                                      }`}
                                      onClick={() => {
                                        if (slots.length > 0) {
                                          setRescheduleDate(d.date);
                                          setRescheduleSlot(null);
                                        } else {
                                          setRescheduleDate(d.date);
                                          setRescheduleSlot(null);
                                          setEditForm({ ...editForm, scheduledDate: d.date });
                                        }
                                      }}
                                      data-testid={`button-reschedule-date-${d.id}`}
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
                                          {d.notes && <span className="text-[11px] text-muted-foreground truncate">{d.notes}</span>}
                                          {interviewers.length > 0 && slots.length === 0 && (
                                            <div className="flex items-center gap-0.5 ml-1">
                                              {interviewers.map((m) => (
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
                                      {rescheduleDate === d.date && slots.length === 0 && (
                                        <Check className="h-4 w-4 text-primary shrink-0" />
                                      )}
                                    </button>
                                    {isExpanded && (
                                      <div className="ml-12 mt-1 mb-2 space-y-1" data-testid="panel-reschedule-hour-slots">
                                        <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1 mb-1.5">
                                          <Clock className="h-3 w-3" />
                                          {t.guests.selectHourSlot}
                                        </p>
                                        <div className="grid grid-cols-2 gap-1">
                                          {slots.filter((slot) => {
                                            const slotAvailInterviewers = getAvailableInterviewers(d.date, slot.label);
                                            return !(interviewers.length > 0 && slotAvailInterviewers.length < interviewers.length);
                                          }).map((slot) => {
                                            const slotAvailInterviewers = getAvailableInterviewers(d.date, slot.label);
                                            return (
                                            <button
                                              key={slot.label}
                                              className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                                                rescheduleSlot?.label === slot.label
                                                  ? "bg-primary text-primary-foreground shadow-sm"
                                                  : "bg-muted/50 hover:bg-muted text-foreground"
                                              }`}
                                              onClick={() => {
                                                setRescheduleSlot(slot);
                                                setEditForm({ ...editForm, scheduledDate: rescheduleDate!, scheduledTime: slot.start });
                                              }}
                                              data-testid={`button-reschedule-slot-${slot.start}`}
                                            >
                                              <Clock className="h-3 w-3" />
                                              {slot.label}
                                              {interviewers.length > 0 && (
                                                <div className="flex items-center gap-0.5 ml-0.5">
                                                  {interviewers.map((m) => (
                                                    <div
                                                      key={m.id}
                                                      className={`h-1.5 w-1.5 rounded-full ${slotAvailInterviewers.some((a) => a.id === m.id) ? "" : "opacity-20"}`}
                                                      style={{ backgroundColor: rescheduleSlot?.label === slot.label ? "white" : m.color }}
                                                      title={`${m.name}: ${slotAvailInterviewers.some((a) => a.id === m.id) ? "Available" : "Unavailable"}`}
                                                    />
                                                  ))}
                                                </div>
                                              )}
                                              {rescheduleSlot?.label === slot.label && (
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
                          {rescheduleDate && (rescheduleSlot || !(availableStudioDates.find((d) => d.date === rescheduleDate)?.notes ? parseTimeSlots(availableStudioDates.find((d) => d.date === rescheduleDate)!.notes!).length > 0 : false)) && (
                            <div className="pt-1">
                              <Badge className="ios-badge border-0 bg-chart-2/10 text-chart-2">
                                {t.guests.selected}: {format(parseISO(rescheduleDate), "MMM d, yyyy")}{rescheduleSlot ? ` (${rescheduleSlot.label})` : ""}
                              </Badge>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Location</label>
                        <Input
                          value={editForm.location}
                          onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                          placeholder="Main Studio"
                          data-testid="input-edit-location"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Notes</label>
                        <Textarea
                          value={editForm.notes}
                          onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                          placeholder="Interview topic, special requirements..."
                          data-testid="input-edit-notes"
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          className="flex-1 ios-pill-button ios-pill-button-secondary"
                          onClick={() => { setIsEditing(false); setShowRescheduleCalendar(false); setRescheduleDate(null); setRescheduleSlot(null); }}
                          data-testid="button-cancel-edit"
                        >
                          Cancel
                        </button>
                        <button
                          className="flex-1 ios-pill-button ios-pill-button-primary"
                          disabled={updateInterview.isPending}
                          onClick={() => {
                            const rescheduledStudioDate = rescheduleDate ? availableStudioDates.find((d) => d.date === rescheduleDate) : null;
                            const finalDate = rescheduledStudioDate ? rescheduleDate! : editForm.scheduledDate;
                            const finalTime = rescheduleSlot ? rescheduleSlot.start : editForm.scheduledTime;
                            updateInterview.mutate({
                              id: selectedInterview.id,
                              data: {
                                scheduledDate: finalDate || null,
                                scheduledTime: finalTime || null,
                                location: editForm.location || null,
                                notes: editForm.notes || null,
                                ...(rescheduledStudioDate ? { studioDateId: rescheduledStudioDate.id } : {}),
                              },
                              guestId: guest?.id,
                              guestName: editForm.guestName !== guest?.name ? editForm.guestName : undefined,
                              newStudioDateId: rescheduledStudioDate?.id,
                              slot: rescheduleSlot,
                              oldStudioDateId: selectedInterview.studioDateId,
                            });
                            setSelectedInterview({
                              ...selectedInterview,
                              scheduledDate: finalDate || null,
                              scheduledTime: finalTime || null,
                              location: editForm.location || null,
                              notes: editForm.notes || null,
                            });
                          }}
                          data-testid="button-save-edit"
                        >
                          {updateInterview.isPending ? "Saving..." : "Save Changes"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3">
                        {selectedInterview.scheduledDate && (
                          <div className="flex items-center gap-2 text-sm">
                            <CalendarClock className="h-4 w-4 text-muted-foreground" />
                            <span>{format(parseISO(selectedInterview.scheduledDate), "EEEE, MMM d, yyyy")}</span>
                            {selectedInterview.scheduledTime && <span>at {selectedInterview.scheduledTime}</span>}
                          </div>
                        )}
                        {selectedInterview.location && (
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>{selectedInterview.location}</span>
                          </div>
                        )}
                        {guest?.phone && (
                          <div className="flex items-center gap-2 text-sm">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span>{guest.phone}</span>
                            {guest.email && <span className="text-muted-foreground">| {guest.email}</span>}
                          </div>
                        )}
                        {confirmer && (
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-chart-2" />
                            <span className="text-muted-foreground">Confirmed by {confirmer.name}</span>
                          </div>
                        )}
                      </div>

                      {selectedInterview.notes && (
                        <div>
                          <label className="text-xs text-muted-foreground">Notes</label>
                          <p className="text-sm mt-1">{selectedInterview.notes}</p>
                        </div>
                      )}
                    </>
                  )}

                  {!isEditing && (
                    <div className="flex justify-end pt-2">
                      <button
                        className="ios-pill-button ios-pill-button-secondary"
                        onClick={() => deleteInterview.mutate(selectedInterview.id)}
                        data-testid="button-delete-interview"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete Interview
                      </button>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
