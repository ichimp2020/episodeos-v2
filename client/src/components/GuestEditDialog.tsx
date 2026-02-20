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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Pencil, Phone, Mail, ExternalLink, Trash2, X, Calendar, Check, Clock } from "lucide-react";
import { format, parseISO, isAfter } from "date-fns";
import type { Guest, TeamMember, StudioDate, InterviewerUnavailability } from "@shared/schema";
import { useLanguage } from "@/i18n/LanguageProvider";

const guestStatuses = ["prospect", "contacted", "confirmed", "declined"];

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

interface GuestEditDialogProps {
  guest: Guest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members?: TeamMember[];
}

export default function GuestEditDialog({ guest, open, onOpenChange, members }: GuestEditDialogProps) {
  const [editForm, setEditForm] = useState({
    name: "", phone: "", email: "", shortDescription: "", notes: "", status: "prospect", links: [""],
  });
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const { toast } = useToast();
  const { t } = useLanguage();

  const { data: studioDates } = useQuery<StudioDate[]>({
    queryKey: ["/api/studio-dates"],
    enabled: open,
  });

  const { data: unavailabilityData } = useQuery<InterviewerUnavailability[]>({
    queryKey: ["/api/interviewer-unavailability"],
    enabled: open,
  });

  const interviewerMembers = members?.filter((m) => m.role?.toLowerCase() === "interviewer") || [];

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

  const availableDates = studioDates
    ?.filter((d) => d.status === "available" && isAfter(parseISO(d.date), new Date()))
    .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()) || [];

  const updateGuest = useMutation({
    mutationFn: async () => {
      if (!guest) return;
      await apiRequest("PATCH", `/api/guests/${guest.id}`, {
        name: editForm.name,
        phone: editForm.phone || null,
        email: editForm.email || null,
        shortDescription: editForm.shortDescription || null,
        notes: editForm.notes || null,
        status: editForm.status,
        links: editForm.links.filter((l) => l.trim() !== ""),
      });
      if (selectedDate && editForm.status === "confirmed" && isDateFullySelected) {
        const selectedStudioDate = availableDates.find((d) => d.date === selectedDate);
        await apiRequest("POST", "/api/interviews", {
          guestId: guest.id,
          studioDateId: selectedStudioDate?.id || null,
          scheduledDate: selectedDate,
          status: "confirmed",
        });
        if (selectedStudioDate) {
          const patchData: Record<string, unknown> = {};
          if (selectedSlot) {
            patchData.bookedSlot = selectedSlot.label;
            const allSlots = selectedStudioDate.notes ? parseTimeSlots(selectedStudioDate.notes) : [];
            const remainingSlots = allSlots.filter((s) => s.label !== selectedSlot.label);
            if (remainingSlots.length === 0) {
              patchData.status = "taken";
            } else {
              const remainingNotes = remainingSlots.map((s) => `${s.start}-${s.end}`).join(", ");
              patchData.notes = remainingNotes;
            }
          } else {
            patchData.status = "taken";
          }
          await apiRequest("PATCH", `/api/studio-dates/${selectedStudioDate.id}`, patchData);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/guests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/interviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/studio-dates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      onOpenChange(false);
      const msg = selectedDate && editForm.status === "confirmed" && isDateFullySelected
        ? `Guest confirmed for ${format(parseISO(selectedDate), "MMM d, yyyy")}${selectedSlot ? ` (${selectedSlot.label})` : ""}`
        : "Guest updated";
      toast({ title: msg });
    },
    onError: () => toast({ title: "Failed to update guest", variant: "destructive" }),
  });

  const deleteGuest = useMutation({
    mutationFn: async () => {
      if (!guest) return;
      await apiRequest("DELETE", `/api/guests/${guest.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/guests"] });
      onOpenChange(false);
      toast({ title: "Guest removed" });
    },
  });

  useEffect(() => {
    if (open && guest) {
      setEditForm({
        name: guest.name,
        phone: guest.phone || "",
        email: guest.email || "",
        shortDescription: guest.shortDescription || "",
        notes: guest.notes || "",
        status: guest.status,
        links: guest.links && guest.links.length > 0 ? [...guest.links] : [""],
      });
      setShowCalendar(false);
      setSelectedDate(null);
      setSelectedSlot(null);
    }
  }, [open, guest]);

  const handleOpen = (isOpen: boolean) => {
    onOpenChange(isOpen);
  };

  const addLinkField = () => {
    setEditForm({ ...editForm, links: [...editForm.links, ""] });
  };

  const removeLinkField = (index: number) => {
    setEditForm({ ...editForm, links: editForm.links.filter((_, i) => i !== index) });
  };

  const updateLink = (index: number, value: string) => {
    const links = [...editForm.links];
    links[index] = value;
    setEditForm({ ...editForm, links });
  };

  const handleSelectDate = (date: string) => {
    const studioDate = availableDates.find((d) => d.date === date);
    const slots = studioDate?.notes ? parseTimeSlots(studioDate.notes) : [];
    if (slots.length > 0) {
      setSelectedDate(date);
      setSelectedSlot(null);
    } else {
      setSelectedDate(date);
      setSelectedSlot(null);
      setEditForm({ ...editForm, status: "confirmed" });
    }
  };

  const handleSelectSlot = (slot: TimeSlot) => {
    setSelectedSlot(slot);
    setEditForm({ ...editForm, status: "confirmed" });
  };

  const selectedDateObj = selectedDate ? availableDates.find((d) => d.date === selectedDate) : null;
  const availableSlots = selectedDateObj?.notes ? parseTimeSlots(selectedDateObj.notes) : [];
  const isDateFullySelected = selectedDate && (availableSlots.length === 0 || selectedSlot !== null);

  const getMemberName = (id: string | null) => {
    if (!id) return null;
    return members?.find((m) => m.id === id)?.name;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        {guest && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-4 w-4" />
                {t.guests.editGuest}
              </DialogTitle>
              <DialogDescription>{t.guests.updateDetails}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t.guests.status}</label>
                <Select value={editForm.status} onValueChange={(val) => setEditForm({ ...editForm, status: val })}>
                  <SelectTrigger data-testid="select-guest-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {guestStatuses.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!showCalendar && (
                <Button
                  variant="outline"
                  className="w-full rounded-xl border-dashed border-2 py-3 text-sm"
                  onClick={() => setShowCalendar(true)}
                  data-testid="button-check-availability"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  {t.guests.checkStudioAvailability}
                </Button>
              )}

              {showCalendar && (
                <div className="rounded-xl border bg-muted/30 p-3 space-y-2" data-testid="panel-studio-availability">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-primary" />
                      {t.guests.studioAvailability}
                    </h3>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setShowCalendar(false); setSelectedDate(null); }} data-testid="button-close-availability">
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  {availableDates.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">{t.guests.noAvailableDates}</p>
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
                                  {d.notes && <span className="text-[11px] text-muted-foreground truncate">{d.notes}</span>}
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
                              <div className="ml-12 mt-1 mb-2 space-y-1" data-testid="panel-hour-slots">
                                <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1 mb-1.5">
                                  <Clock className="h-3 w-3" />
                                  {t.guests.selectHourSlot}
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
                        {t.guests.selected}: {format(parseISO(selectedDate!), "MMM d, yyyy")}{selectedSlot ? ` (${selectedSlot.label})` : ""} — {t.guests.statusSetToConfirmed}
                      </Badge>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">{t.guests.name}</label>
                <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} data-testid="input-edit-guest-name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t.guests.phone}</label>
                  <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} data-testid="input-edit-guest-phone" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t.guests.email}</label>
                  <Input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} data-testid="input-edit-guest-email" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t.guests.shortDescription}</label>
                <Input value={editForm.shortDescription} onChange={(e) => setEditForm({ ...editForm, shortDescription: e.target.value })} data-testid="input-edit-guest-description" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t.guests.notes}</label>
                <Textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} data-testid="input-edit-guest-notes" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t.guests.links}</label>
                {editForm.links.map((link, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input value={link} onChange={(e) => updateLink(i, e.target.value)} data-testid={`input-edit-guest-link-${i}`} />
                    {editForm.links.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => removeLinkField(i)} data-testid={`button-remove-link-${i}`}>
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="ghost" size="sm" onClick={addLinkField} data-testid="button-add-link-edit">
                  <Plus className="h-3 w-3 mr-1" />
                  {t.guests.addLink}
                </Button>
              </div>
              {editForm.links.some((l) => l.trim()) && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t.guests.quickLinks}</label>
                  <div className="flex flex-wrap gap-2">
                    {editForm.links.filter((l) => l.trim()).map((link, i) => {
                      let hostname = link;
                      try { hostname = new URL(link).hostname.replace("www.", ""); } catch {}
                      return (
                        <a
                          key={i}
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary flex items-center gap-1 hover:underline"
                          data-testid={`link-guest-external-${i}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3 w-3" />
                          {hostname}
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
              {guest.addedBy && (
                <p className="text-xs text-muted-foreground">{t.guests.addedBy} {getMemberName(guest.addedBy)}</p>
              )}
              <div className="flex items-center justify-between gap-2 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => deleteGuest.mutate()}
                  data-testid="button-delete-guest"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  {t.guests.delete}
                </Button>
                <Button
                  className="rounded-full px-5 shadow-md"
                  onClick={() => updateGuest.mutate()}
                  disabled={!editForm.name || updateGuest.isPending}
                  data-testid="button-save-guest"
                >
                  {updateGuest.isPending ? t.guests.saving : t.guests.saveChanges}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
