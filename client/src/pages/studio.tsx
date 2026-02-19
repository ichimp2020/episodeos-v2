import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Label } from "@/components/ui/label";
import { Plus, Calendar, ChevronLeft, ChevronRight, Trash2, MessageSquare, Check, X, AlertCircle, Clock, Mail, Users, UserX, UserCheck } from "lucide-react";
import type { StudioDate, TeamMember, InterviewerUnavailability } from "@shared/schema";
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
  isAfter,
  isBefore,
} from "date-fns";

interface ParsedStudioDate {
  date: string;
  timeRange: string;
  dayName: string;
  notes: string;
  hasQuestion: boolean;
  selected: boolean;
}

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

const hebrewMonths: Record<string, number> = {
  "ינואר": 0, "פברואר": 1, "מרץ": 2, "מרס": 2, "אפריל": 3,
  "מאי": 4, "יוני": 5, "יולי": 6, "אוגוסט": 7,
  "ספטמבר": 8, "אוקטובר": 9, "נובמבר": 10, "דצמבר": 11,
};

const hebrewDays: Record<string, string> = {
  "ראשון": "Sun", "שני": "Mon", "שלישי": "Tue",
  "רביעי": "Wed", "חמישי": "Thu", "שישי": "Fri", "שבת": "Sat",
};

interface TimeSlot {
  start: string;
  end: string;
  label: string;
}

function parseTimeRange(notes: string): TimeSlot[] {
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

interface BookingEmails {
  studio: string;
  interviewers: string;
  interviewee: string;
  intervieweeName: string;
  intervieweePhone: string;
}

function parseWhatsAppMessage(text: string): ParsedStudioDate[] {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  const results: ParsedStudioDate[] = [];

  let detectedMonth = -1;
  let year = new Date().getFullYear();

  for (const line of lines) {
    const cleanLine = line.replace(/[^\S\n]+/g, " ").trim();

    for (const [heMonth, monthIndex] of Object.entries(hebrewMonths)) {
      if (cleanLine.includes(heMonth)) {
        detectedMonth = monthIndex;
        if (detectedMonth < new Date().getMonth() - 1) {
          year = new Date().getFullYear() + 1;
        }
        break;
      }
    }

    if (cleanLine.startsWith("היי") || cleanLine.length < 4) continue;
    if (Object.keys(hebrewMonths).some((m) => cleanLine === m)) continue;

    const dateMatch = cleanLine.match(/(\d{1,2})\.(\d{1,2})/);
    const timeMatch = cleanLine.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);

    if (!dateMatch) continue;

    const day = parseInt(dateMatch[1]);
    const parsedMonth = parseInt(dateMatch[2]) - 1;
    const monthForDate = detectedMonth !== -1 ? detectedMonth : parsedMonth;

    let dayName = "";
    for (const [heb, eng] of Object.entries(hebrewDays)) {
      if (cleanLine.includes(heb)) {
        dayName = eng;
        break;
      }
    }

    const hasQuestion = cleanLine.includes("סימן שאלה") || cleanLine.includes("?");

    let notes = "";
    if (timeMatch) {
      notes = `${timeMatch[1]}-${timeMatch[2]}`;
    }
    if (hasQuestion) {
      notes += notes ? " (tentative)" : "(tentative)";
    }

    const dateStr = `${year}-${String(monthForDate + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    try {
      const testDate = new Date(dateStr);
      if (isNaN(testDate.getTime())) continue;
    } catch {
      continue;
    }

    results.push({
      date: dateStr,
      timeRange: timeMatch ? `${timeMatch[1]}-${timeMatch[2]}` : "",
      dayName,
      notes,
      hasQuestion,
      selected: !hasQuestion,
    });
  }

  const merged = new Map<string, ParsedStudioDate>();
  for (const r of results) {
    const existing = merged.get(r.date);
    if (existing) {
      const times = [existing.timeRange, r.timeRange].filter(Boolean);
      existing.timeRange = times.join(", ");
      existing.notes = times.join(", ") + (existing.hasQuestion || r.hasQuestion ? " (tentative)" : "");
      existing.hasQuestion = existing.hasQuestion || r.hasQuestion;
    } else {
      merged.set(r.date, { ...r });
    }
  }

  return Array.from(merged.values());
}

export default function Studio() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showAddDate, setShowAddDate] = useState(false);
  const [showWhatsAppPaste, setShowWhatsAppPaste] = useState(false);
  const [selectedDate, setSelectedDate] = useState<StudioDate | null>(null);
  const [newDate, setNewDate] = useState({ date: "", notes: "" });
  const [whatsappText, setWhatsappText] = useState("");
  const [parsedDates, setParsedDates] = useState<ParsedStudioDate[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [bookingEmails, setBookingEmails] = useState<BookingEmails>({ studio: "", interviewers: "", interviewee: "", intervieweeName: "", intervieweePhone: "" });
  const { toast } = useToast();

  const { data: studioDates, isLoading } = useQuery<StudioDate[]>({
    queryKey: ["/api/studio-dates"],
  });

  const { data: teamMembersData } = useQuery<TeamMember[]>({
    queryKey: ["/api/team-members"],
  });

  const { data: unavailabilityData } = useQuery<InterviewerUnavailability[]>({
    queryKey: ["/api/interviewer-unavailability"],
  });

  const interviewers = useMemo(() =>
    teamMembersData?.filter((m) => m.role?.toLowerCase() === "interviewer") || [],
    [teamMembersData]
  );

  const toggleUnavailability = useMutation({
    mutationFn: async ({ teamMemberId, unavailableDate, slotLabel }: { teamMemberId: string; unavailableDate: string; slotLabel?: string }) => {
      await apiRequest("POST", "/api/interviewer-unavailability/toggle", { teamMemberId, unavailableDate, slotLabel });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/interviewer-unavailability"] });
    },
  });

  const isUnavailable = (teamMemberId: string, dateStr: string, slotLabel?: string) => {
    if (!unavailabilityData) return false;
    return unavailabilityData.some((u) =>
      u.teamMemberId === teamMemberId &&
      u.unavailableDate === dateStr &&
      (slotLabel ? u.slotLabel === slotLabel : !u.slotLabel)
    );
  };

  const isSlotBlockedByInterviewers = (dateStr: string, slotLabel: string) => {
    if (interviewers.length === 0) return false;
    return interviewers.some((m) =>
      isUnavailable(m.id, dateStr) || isUnavailable(m.id, dateStr, slotLabel)
    );
  };

  const getAvailableSlotsForDate = (dateStr: string, notes?: string | null) => {
    const slots = notes ? parseTimeSlots(notes) : [];
    if (slots.length === 0) return slots;
    return slots.filter((slot) => !isSlotBlockedByInterviewers(dateStr, slot.label));
  };

  const isDateBlockedByInterviewers = (dateStr: string, notes?: string | null) => {
    if (interviewers.length === 0) return false;
    if (interviewers.some((m) => isUnavailable(m.id, dateStr))) return true;
    const slots = notes ? parseTimeSlots(notes) : [];
    if (slots.length === 0) return false;
    return getAvailableSlotsForDate(dateStr, notes).length === 0;
  };

  const hasAnySlotBlocked = (dateStr: string, notes?: string | null) => {
    if (interviewers.length === 0) return false;
    if (interviewers.some((m) => isUnavailable(m.id, dateStr))) return true;
    const slots = notes ? parseTimeSlots(notes) : [];
    if (slots.length === 0) return false;
    return slots.some((slot) => isSlotBlockedByInterviewers(dateStr, slot.label));
  };

  const createDate = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/studio-dates", {
        date: newDate.date,
        notes: newDate.notes || null,
        status: "available",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/studio-dates"] });
      setShowAddDate(false);
      setNewDate({ date: "", notes: "" });
      toast({ title: "Studio date added" });
    },
    onError: () => toast({ title: "Failed to add date", variant: "destructive" }),
  });

  const bulkCreateDates = useMutation({
    mutationFn: async (dates: ParsedStudioDate[]) => {
      const selected = dates.filter((d) => d.selected);
      await apiRequest("POST", "/api/studio-dates/bulk", {
        dates: selected.map((d) => ({
          date: d.date,
          notes: d.notes || null,
          status: "available",
        })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/studio-dates"] });
      setShowWhatsAppPaste(false);
      setShowPreview(false);
      setWhatsappText("");
      setParsedDates([]);
      toast({ title: "Studio dates imported" });
    },
    onError: () => toast({ title: "Failed to import dates", variant: "destructive" }),
  });

  const deleteDate = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/studio-dates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/studio-dates"] });
      setSelectedDate(null);
      toast({ title: "Studio date removed" });
    },
  });

  const updateDateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/studio-dates/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/studio-dates"] });
    },
  });

  const bookSlot = useMutation({
    mutationFn: async ({ dateRecord, slot, emails }: { dateRecord: StudioDate; slot: TimeSlot; emails: BookingEmails }) => {
      const emailsJson = JSON.stringify(emails);
      await apiRequest("PATCH", `/api/studio-dates/${dateRecord.id}`, {
        status: "taken",
        bookedSlot: slot.label,
        participantEmails: emailsJson,
        notes: slot.label,
      });

      const allSlots = dateRecord.notes ? parseTimeRange(dateRecord.notes) : [];
      const remainingSlots = allSlots.filter((s) => s.start !== slot.start || s.end !== slot.end);
      for (const remaining of remainingSlots) {
        await apiRequest("POST", "/api/studio-dates", {
          date: dateRecord.date,
          notes: remaining.label,
          status: "available",
        });
      }

      const emailSet = new Set<string>();
      if (emails.studio) emailSet.add(emails.studio.trim().toLowerCase());
      if (emails.interviewee) emailSet.add(emails.interviewee.trim().toLowerCase());
      if (emails.interviewers) {
        emails.interviewers.split(",").forEach((e) => {
          const trimmed = e.trim().toLowerCase();
          if (trimmed) emailSet.add(trimmed);
        });
      }

      let calendarFailed = false;
      if (emailSet.size > 0) {
        const dateStr = format(parseISO(dateRecord.date), "MMMM d, yyyy");
        try {
          await apiRequest("POST", "/api/calendar-event", {
            date: dateRecord.date,
            startTime: slot.start,
            endTime: slot.end,
            summary: `Podcast Studio Recording - ${slot.label}`,
            description: `Studio recording session on ${dateStr} from ${slot.label}.\n\nParticipants:\n- Studio: ${emails.studio || "N/A"}\n- Interviewers: ${emails.interviewers || "N/A"}\n- Interviewee: ${emails.intervieweeName || "N/A"}${emails.intervieweePhone ? ` (${emails.intervieweePhone})` : ""}\n- Interviewee Email: ${emails.interviewee || "N/A"}`,
            attendeeEmails: Array.from(emailSet),
          });
        } catch {
          calendarFailed = true;
        }
      }
      return { calendarFailed };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/studio-dates"] });
      setSelectedDate(null);
      setSelectedSlot(null);
      setBookingEmails({ studio: "", interviewers: "", interviewee: "" });
      if (result?.calendarFailed) {
        toast({ title: "Slot booked", description: "But calendar invite could not be sent. Check Google Calendar connection.", variant: "destructive" });
      } else {
        toast({ title: "Slot booked successfully", description: "Calendar invites sent to all participants" });
      }
    },
    onError: () => {
      toast({ title: "Failed to book slot", variant: "destructive" });
    },
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getDatesForDay = (day: Date) => {
    return studioDates?.filter((d) => isSameDay(parseISO(d.date), day)) || [];
  };

  const getDateInfo = (day: Date) => {
    const matches = getDatesForDay(day);
    if (matches.length === 0) return undefined;
    return matches.find((d) => d.status === "available") || matches[0];
  };

  const upcomingDates = useMemo(() => {
    return studioDates
      ?.filter((d) => d.status === "available" && isAfter(parseISO(d.date), new Date()))
      .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()) || [];
  }, [studioDates]);

  const handleParseMessage = () => {
    const parsed = parseWhatsAppMessage(whatsappText);
    if (parsed.length === 0) {
      toast({ title: "Couldn't find any dates in the message", variant: "destructive" });
      return;
    }

    const existingDates = new Set(studioDates?.map((d) => d.date) || []);
    const withDuplicateMarking = parsed.map((p) => ({
      ...p,
      selected: !p.hasQuestion && !existingDates.has(p.date),
      notes: existingDates.has(p.date)
        ? p.notes + (p.notes ? " " : "") + "(already exists)"
        : p.notes,
    }));

    setParsedDates(withDuplicateMarking);
    setShowPreview(true);
  };

  const toggleParsedDate = (index: number) => {
    setParsedDates((prev) =>
      prev.map((d, i) => i === index ? { ...d, selected: !d.selected } : d)
    );
  };

  const selectAllParsed = () => {
    setParsedDates((prev) => prev.map((d) => ({ ...d, selected: true })));
  };

  const deselectAllParsed = () => {
    setParsedDates((prev) => prev.map((d) => ({ ...d, selected: false })));
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-studio-title">Studio Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage studio availability from your partner</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" className="rounded-full px-4" onClick={() => setShowWhatsAppPaste(true)} data-testid="button-paste-whatsapp">
            <MessageSquare className="h-4 w-4 mr-2" />
            Paste WhatsApp
          </Button>
          <Button className="rounded-full px-5 shadow-md" onClick={() => setShowAddDate(true)} data-testid="button-add-studio-date">
            <Plus className="h-4 w-4" />
            Add Date
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="ios-section lg:col-span-2">
          <div className="ios-section-header flex flex-row items-center justify-between gap-2">
            <h2 className="ios-section-title" data-testid="text-calendar-month">
              {format(currentMonth, "MMMM yyyy")}
            </h2>
            <div className="flex items-center gap-1">
              <Button
                variant="secondary"
                className="rounded-full px-4"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                data-testid="button-prev-month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                className="rounded-full px-4"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                data-testid="button-next-month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="px-5 pb-5">
            <div className="grid grid-cols-7 gap-px">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground">
                  {d}
                </div>
              ))}
              {calendarDays.map((day) => {
                const dayRecords = getDatesForDay(day);
                const dateInfo = getDateInfo(day);
                const dayStr = format(day, "yyyy-MM-dd");
                const availableRecords = dayRecords.filter((d) => d.status === "available");
                const hasTaken = dayRecords.some((d) => d.status === "taken");
                const allAvailableBlocked = availableRecords.length > 0 && availableRecords.every((d) => isDateBlockedByInterviewers(d.date, d.notes));
                const someSlotBlocked = availableRecords.length > 0 && !allAvailableBlocked && availableRecords.some((d) => hasAnySlotBlocked(d.date, d.notes));
                const hasAvailable = availableRecords.length > 0 && !allAvailableBlocked;
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isToday = isSameDay(day, new Date());
                const isPast = isBefore(day, new Date()) && !isToday;
                return (
                  <div
                    key={day.toISOString()}
                    className={`relative p-2 min-h-[3.5rem] rounded-md text-center cursor-pointer transition-colors ${
                      !isCurrentMonth ? "opacity-30" : ""
                    } ${isToday ? "ring-1 ring-primary/30" : ""} ${
                      allAvailableBlocked
                        ? "bg-amber-500/8"
                        : someSlotBlocked
                        ? "bg-amber-500/5"
                        : hasAvailable
                        ? "bg-chart-2/8"
                        : hasTaken
                        ? "bg-chart-5/8"
                        : ""
                    }`}
                    onClick={() => dateInfo && setSelectedDate(dateInfo)}
                    data-testid={`cell-day-${dayStr}`}
                  >
                    <span className={`text-sm ${isToday ? "font-semibold text-primary" : isPast ? "text-muted-foreground" : ""}`}>
                      {format(day, "d")}
                    </span>
                    {dayRecords.length > 0 && (
                      <div className="mt-0.5 flex items-center justify-center gap-0.5">
                        {hasAvailable && !someSlotBlocked && <div className="h-1.5 w-1.5 rounded-full bg-chart-2" />}
                        {(allAvailableBlocked || someSlotBlocked) && <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
                        {hasTaken && <div className="h-1.5 w-1.5 rounded-full bg-chart-5" />}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-4 mt-4 pt-3 border-t flex-wrap">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-chart-2" />
                <span className="text-xs text-muted-foreground">Available</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <span className="text-xs text-muted-foreground">Partial / Full Interviewer Block</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-chart-5" />
                <span className="text-xs text-muted-foreground">Taken</span>
              </div>
            </div>
          </div>
        </div>

        <div className="ios-section">
          <div className="ios-section-header">
            <h2 className="ios-section-title">Upcoming Available</h2>
          </div>
          <div className="px-5 pb-5 space-y-2">
            {upcomingDates.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No upcoming dates</p>
              </div>
            ) : (
              upcomingDates.slice(0, 8).map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-3 p-2.5 rounded-md bg-card hover-elevate cursor-pointer"
                  onClick={() => setSelectedDate(d)}
                  data-testid={`card-upcoming-date-${d.id}`}
                >
                  <div className="flex h-9 w-9 flex-col items-center justify-center rounded-md bg-chart-2/10 shrink-0">
                    <span className="text-[9px] font-medium text-chart-2 leading-none">{format(parseISO(d.date), "MMM")}</span>
                    <span className="text-xs font-semibold text-chart-2 leading-tight">{format(parseISO(d.date), "d")}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{format(parseISO(d.date), "EEE, MMM d")}</p>
                    {d.notes && <p className="text-xs text-muted-foreground truncate">{d.notes}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {interviewers.length > 0 && (
        <div className="ios-section">
          <div className="ios-section-header">
            <h2 className="ios-section-title flex items-center gap-2">
              <Users className="h-4 w-4" />
              Interviewer Availability
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Interviewers can mark dates/slots where they're unavailable
            </p>
          </div>
          <div className="px-5 pb-5">
            {(() => {
              const availableDates = studioDates
                ?.filter((d) => d.status === "available" && isAfter(parseISO(d.date), new Date()))
                .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()) || [];

              if (availableDates.length === 0) {
                return (
                  <div className="text-center py-8">
                    <Calendar className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No upcoming available dates</p>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  <div className="flex items-center gap-4 mb-3">
                    {interviewers.map((interviewer) => (
                      <div key={interviewer.id} className="flex items-center gap-1.5">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: interviewer.color }}
                        />
                        <span className="text-xs font-medium">{interviewer.name}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-1.5 ml-auto">
                      <UserCheck className="h-3 w-3 text-chart-2" />
                      <span className="text-xs text-muted-foreground">Available</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <UserX className="h-3 w-3 text-destructive" />
                      <span className="text-xs text-muted-foreground">Unavailable</span>
                    </div>
                  </div>
                  {availableDates.map((dateRecord) => {
                    const slots = dateRecord.notes ? parseTimeRange(dateRecord.notes) : [];
                    return (
                      <div key={dateRecord.id} className="rounded-lg border p-3 space-y-2" data-testid={`availability-date-${dateRecord.id}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{format(parseISO(dateRecord.date), "EEE, MMM d")}</span>
                            {dateRecord.notes && (
                              <span className="text-xs text-muted-foreground">{dateRecord.notes}</span>
                            )}
                          </div>
                          {slots.length === 0 && (
                            <div className="flex items-center gap-1">
                              {interviewers.map((interviewer) => {
                                const unavail = isUnavailable(interviewer.id, dateRecord.date);
                                return (
                                  <button
                                    key={interviewer.id}
                                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                                      unavail
                                        ? "bg-destructive/10 text-destructive"
                                        : "bg-chart-2/10 text-chart-2"
                                    }`}
                                    onClick={() => toggleUnavailability.mutate({ teamMemberId: interviewer.id, unavailableDate: dateRecord.date })}
                                    data-testid={`toggle-avail-${dateRecord.id}-${interviewer.id}`}
                                  >
                                    <div
                                      className="h-2 w-2 rounded-full"
                                      style={{ backgroundColor: interviewer.color }}
                                    />
                                    {interviewer.initials}
                                    {unavail ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        {slots.length > 0 && (
                          <div className="space-y-1.5">
                            {slots.map((slot, slotIdx) => (
                              <div key={slotIdx} className="flex items-center justify-between pl-3 py-1 rounded bg-muted/30">
                                <span className="text-xs font-medium text-muted-foreground">{slot.label}</span>
                                <div className="flex items-center gap-1">
                                  {interviewers.map((interviewer) => {
                                    const unavail = isUnavailable(interviewer.id, dateRecord.date, slot.label);
                                    return (
                                      <button
                                        key={interviewer.id}
                                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                                          unavail
                                            ? "bg-destructive/10 text-destructive"
                                            : "bg-chart-2/10 text-chart-2"
                                        }`}
                                        onClick={() => toggleUnavailability.mutate({ teamMemberId: interviewer.id, unavailableDate: dateRecord.date, slotLabel: slot.label })}
                                        data-testid={`toggle-avail-${dateRecord.id}-${interviewer.id}-slot-${slotIdx}`}
                                      >
                                        <div
                                          className="h-2 w-2 rounded-full"
                                          style={{ backgroundColor: interviewer.color }}
                                        />
                                        {interviewer.initials}
                                        {unavail ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      <Dialog open={showAddDate} onOpenChange={setShowAddDate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Studio Date</DialogTitle>
            <DialogDescription>Add an available date from your studio partner</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <Input
                type="date"
                value={newDate.date}
                onChange={(e) => setNewDate({ ...newDate, date: e.target.value })}
                data-testid="input-studio-date"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={newDate.notes}
                onChange={(e) => setNewDate({ ...newDate, notes: e.target.value })}
                placeholder="e.g. Morning slot only, Full day available"
                data-testid="input-studio-notes"
              />
            </div>
            <Button
              className="w-full rounded-full px-5 shadow-md"
              onClick={() => createDate.mutate()}
              disabled={!newDate.date || createDate.isPending}
              data-testid="button-submit-studio-date"
            >
              {createDate.isPending ? "Adding..." : "Add Date"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showWhatsAppPaste} onOpenChange={(open) => {
        if (!open) {
          setShowWhatsAppPaste(false);
          setShowPreview(false);
          setParsedDates([]);
          setWhatsappText("");
        }
      }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Import from WhatsApp
            </DialogTitle>
            <DialogDescription>
              Paste the studio availability message and we'll extract all the dates automatically
            </DialogDescription>
          </DialogHeader>

          {!showPreview ? (
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">WhatsApp Message</label>
                <Textarea
                  value={whatsappText}
                  onChange={(e) => setWhatsappText(e.target.value)}
                  placeholder={"Paste the studio message here...\n\nExample:\nפברואר\n1.2-15:00-17:00 ראשון\n10:30-11:30  2.2 שני"}
                  className="min-h-[200px] text-sm font-mono"
                  dir="rtl"
                  data-testid="textarea-whatsapp-paste"
                />
              </div>
              <Button
                className="w-full rounded-full px-5 shadow-md"
                onClick={handleParseMessage}
                disabled={!whatsappText.trim()}
                data-testid="button-parse-whatsapp"
              >
                Extract Dates
              </Button>
            </div>
          ) : (
            <div className="space-y-4 mt-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  Found {parsedDates.length} date{parsedDates.length !== 1 ? "s" : ""}
                  {" "} ({parsedDates.filter((d) => d.selected).length} selected)
                </p>
                <div className="flex items-center gap-1">
                  <Button variant="secondary" className="rounded-full px-4" onClick={selectAllParsed} data-testid="button-select-all-dates">
                    Select All
                  </Button>
                  <Button variant="secondary" className="rounded-full px-4" onClick={deselectAllParsed} data-testid="button-deselect-all-dates">
                    None
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                {parsedDates.map((pd, idx) => {
                  const isExisting = pd.notes.includes("(already exists)");
                  return (
                    <div
                      key={idx}
                      className={`ios-list-item cursor-pointer ${
                        pd.selected
                          ? "bg-chart-2/8"
                          : ""
                      } ${isExisting ? "opacity-50" : ""}`}
                      onClick={() => toggleParsedDate(idx)}
                      data-testid={`row-parsed-date-${idx}`}
                    >
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded border shrink-0 ${
                          pd.selected
                            ? "bg-chart-2 border-chart-2"
                            : "border-muted-foreground/30"
                        }`}
                      >
                        {pd.selected && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">
                            {format(parseISO(pd.date), "EEE, MMM d, yyyy")}
                          </span>
                          {pd.hasQuestion && (
                            <Badge variant="secondary" className="ios-badge border-0 bg-chart-4/10 text-chart-4 text-[10px]">
                              tentative
                            </Badge>
                          )}
                          {isExisting && (
                            <Badge variant="secondary" className="ios-badge border-0 text-[10px]">
                              exists
                            </Badge>
                          )}
                        </div>
                        {pd.timeRange && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {pd.timeRange}
                            {pd.dayName && ` (${pd.dayName})`}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button
                  variant="secondary"
                  className="flex-1 rounded-full px-4"
                  onClick={() => {
                    setShowPreview(false);
                    setParsedDates([]);
                  }}
                  data-testid="button-back-to-paste"
                >
                  Back
                </Button>
                <Button
                  className="flex-1 rounded-full px-5 shadow-md"
                  onClick={() => bulkCreateDates.mutate(parsedDates)}
                  disabled={parsedDates.filter((d) => d.selected).length === 0 || bulkCreateDates.isPending}
                  data-testid="button-import-dates"
                >
                  {bulkCreateDates.isPending
                    ? "Importing..."
                    : `Import ${parsedDates.filter((d) => d.selected).length} Date${parsedDates.filter((d) => d.selected).length !== 1 ? "s" : ""}`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedDate} onOpenChange={(open) => {
        if (!open) {
          setSelectedDate(null);
          setSelectedSlot(null);
          setBookingEmails({ studio: "", interviewers: "", interviewee: "", intervieweeName: "", intervieweePhone: "" });
        }
      }}>
        <DialogContent className="max-w-md">
          {selectedDate && !selectedSlot && (
            <>
              <DialogHeader>
                <DialogTitle>{format(parseISO(selectedDate.date), "EEEE, MMMM d, yyyy")}</DialogTitle>
                <DialogDescription>
                  {selectedDate.status === "available"
                    ? (selectedDate.notes && parseTimeRange(selectedDate.notes).length > 0
                      ? "Pick a 1-hour slot to book"
                      : "Studio date details")
                    : "Studio date details"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground">Status:</label>
                  <Badge
                    variant="secondary"
                    className={`ios-badge border-0 ${selectedDate.status === "available"
                      ? "bg-chart-2/10 text-chart-2"
                      : "bg-chart-5/10 text-chart-5"
                    }`}
                  >
                    {selectedDate.status}
                  </Badge>
                </div>

                {selectedDate.status === "available" && interviewers.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      Interviewer Availability
                    </Label>
                    <div className="flex items-center gap-2">
                      {interviewers.map((m) => {
                        const blocked = isUnavailable(m.id, selectedDate.date) || (selectedDate.notes && parseTimeSlots(selectedDate.notes).length > 0 && parseTimeSlots(selectedDate.notes).every((slot) => isUnavailable(m.id, selectedDate.date, slot.label)));
                        return (
                          <div key={m.id} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${blocked ? "bg-destructive/10 text-destructive" : "bg-chart-2/10 text-chart-2"}`}>
                            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color }} />
                            {m.name}
                            {blocked ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                          </div>
                        );
                      })}
                    </div>
                    {isDateBlockedByInterviewers(selectedDate.date, selectedDate.notes) && (
                      <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2">
                        <AlertCircle className="h-3.5 w-3.5" />
                        No interviewers available for this date
                      </div>
                    )}
                  </div>
                )}

                {selectedDate.status === "available" && selectedDate.notes && (() => {
                  const allSlots = parseTimeRange(selectedDate.notes);
                  const slots = allSlots.filter((slot) => !isSlotBlockedByInterviewers(selectedDate.date, slot.label));
                  const blockedCount = allSlots.length - slots.length;
                  if (allSlots.length > 0) {
                    return (
                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          Available Slots
                          {blockedCount > 0 && (
                            <span className="text-amber-600 text-[11px] ml-1">
                              ({blockedCount} blocked)
                            </span>
                          )}
                        </Label>
                        {slots.length > 0 ? (
                          <div className="grid grid-cols-2 gap-2">
                            {slots.map((slot, idx) => (
                              <button
                                key={idx}
                                className="ios-pill-button ios-pill-button-secondary justify-center"
                                onClick={() => setSelectedSlot(slot)}
                                data-testid={`button-slot-${idx}`}
                              >
                                <Clock className="h-3.5 w-3.5 mr-1.5" />
                                {slot.label}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2">
                            <AlertCircle className="h-3.5 w-3.5" />
                            All slots blocked by interviewer unavailability
                          </div>
                        )}
                      </div>
                    );
                  }
                  const notesLower = selectedDate.notes.toLowerCase();
                  const timeOfDay = notesLower.includes("morning") || notesLower.includes("בוקר")
                    ? "Morning"
                    : notesLower.includes("evening") || notesLower.includes("ערב")
                    ? "Evening"
                    : notesLower.includes("afternoon") || notesLower.includes("צהריים")
                    ? "Afternoon"
                    : null;
                  if (timeOfDay) {
                    return (
                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          Available Time
                        </Label>
                        <Badge variant="secondary" className="text-sm" data-testid="badge-time-of-day">
                          {timeOfDay}
                        </Badge>
                      </div>
                    );
                  }
                  return null;
                })()}

                {selectedDate.status === "taken" && selectedDate.bookedSlot && (
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Booked Slot</Label>
                    <p className="text-sm font-medium">{selectedDate.bookedSlot}</p>
                    {selectedDate.participantEmails && (() => {
                      try {
                        const emails = JSON.parse(selectedDate.participantEmails) as BookingEmails;
                        return (
                          <div className="space-y-1.5 text-sm">
                            {emails.studio && (
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Studio:</span>
                                <span>{emails.studio}</span>
                              </div>
                            )}
                            {emails.interviewers && (
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Interviewers:</span>
                                <span>{emails.interviewers}</span>
                              </div>
                            )}
                            {(emails.intervieweeName || emails.interviewee) && (
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Interviewee:</span>
                                <span>
                                  {emails.intervieweeName || emails.interviewee}
                                  {emails.intervieweeName && emails.intervieweePhone ? ` (${emails.intervieweePhone})` : ""}
                                </span>
                              </div>
                            )}
                            {emails.intervieweeName && emails.interviewee && (
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Email:</span>
                                <span>{emails.interviewee}</span>
                              </div>
                            )}
                          </div>
                        );
                      } catch {
                        return null;
                      }
                    })()}
                  </div>
                )}

                {selectedDate.notes && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Notes</Label>
                    <p className="text-sm mt-1">{selectedDate.notes}</p>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  {selectedDate.status === "available" ? (
                    <button
                      className="ios-pill-button ios-pill-button-secondary flex-1"
                      onClick={() => {
                        updateDateStatus.mutate({ id: selectedDate.id, status: "taken" });
                        setSelectedDate({ ...selectedDate, status: "taken" });
                      }}
                      data-testid="button-mark-taken"
                    >
                      Mark as Taken
                    </button>
                  ) : (
                    <button
                      className="ios-pill-button ios-pill-button-secondary flex-1"
                      onClick={() => {
                        updateDateStatus.mutate({ id: selectedDate.id, status: "available" });
                        setSelectedDate({ ...selectedDate, status: "available" });
                      }}
                      data-testid="button-mark-available"
                    >
                      Mark as Available
                    </button>
                  )}
                  <button
                    className="ios-pill-button ios-pill-button-secondary"
                    onClick={() => deleteDate.mutate(selectedDate.id)}
                    data-testid="button-delete-studio-date"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}

          {selectedDate && selectedSlot && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Book Slot
                </DialogTitle>
                <DialogDescription>
                  {format(parseISO(selectedDate.date), "EEE, MMM d")} at {selectedSlot.label}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="flex items-center gap-2 p-3 rounded-md bg-chart-2/8">
                  <Clock className="h-4 w-4 text-chart-2 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{format(parseISO(selectedDate.date), "EEEE, MMMM d, yyyy")}</p>
                    <p className="text-xs text-muted-foreground">{selectedSlot.label}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm" htmlFor="email-studio">Studio Contact Email</Label>
                    <Input
                      id="email-studio"
                      type="email"
                      placeholder="studio@example.com"
                      value={bookingEmails.studio}
                      onChange={(e) => setBookingEmails({ ...bookingEmails, studio: e.target.value })}
                      data-testid="input-email-studio"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm" htmlFor="email-interviewers">Interviewer Emails</Label>
                    <Input
                      id="email-interviewers"
                      type="text"
                      placeholder="gal@example.com, zion@example.com"
                      value={bookingEmails.interviewers}
                      onChange={(e) => setBookingEmails({ ...bookingEmails, interviewers: e.target.value })}
                      data-testid="input-email-interviewers"
                    />
                    <p className="text-[11px] text-muted-foreground">Separate multiple emails with commas</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm" htmlFor="interviewee-name">Interviewee Name</Label>
                    <Input
                      id="interviewee-name"
                      type="text"
                      placeholder="Guest name"
                      value={bookingEmails.intervieweeName}
                      onChange={(e) => setBookingEmails({ ...bookingEmails, intervieweeName: e.target.value })}
                      data-testid="input-interviewee-name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm" htmlFor="interviewee-phone">Interviewee Phone</Label>
                    <Input
                      id="interviewee-phone"
                      type="tel"
                      placeholder="+972-50-123-4567"
                      value={bookingEmails.intervieweePhone}
                      onChange={(e) => setBookingEmails({ ...bookingEmails, intervieweePhone: e.target.value })}
                      data-testid="input-interviewee-phone"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm" htmlFor="email-interviewee">Interviewee Email</Label>
                    <Input
                      id="email-interviewee"
                      type="email"
                      placeholder="guest@example.com"
                      value={bookingEmails.interviewee}
                      onChange={(e) => setBookingEmails({ ...bookingEmails, interviewee: e.target.value })}
                      data-testid="input-email-interviewee"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    className="ios-pill-button ios-pill-button-secondary flex-1"
                    onClick={() => {
                      setSelectedSlot(null);
                      setBookingEmails({ studio: "", interviewers: "", interviewee: "", intervieweeName: "", intervieweePhone: "" });
                    }}
                    data-testid="button-back-to-slots"
                  >
                    Back
                  </button>
                  <button
                    className="ios-pill-button ios-pill-button-primary flex-1"
                    disabled={bookSlot.isPending}
                    onClick={() => bookSlot.mutate({ dateRecord: selectedDate, slot: selectedSlot, emails: bookingEmails })}
                    data-testid="button-confirm-booking"
                  >
                    {bookSlot.isPending ? <Clock className="h-4 w-4 mr-1.5 animate-spin" /> : <Users className="h-4 w-4 mr-1.5" />}
                    {bookSlot.isPending ? "Booking & Sending Invites..." : "Confirm Booking"}
                  </button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
