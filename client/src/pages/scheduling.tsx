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
import { Plus, CalendarClock, MapPin, Clock, User, Trash2, CheckCircle, AlertCircle, Pencil, Label } from "lucide-react";
import type { Interview, Guest, StudioDate, TeamMember, InterviewParticipant } from "@shared/schema";
import { format, parseISO, isAfter } from "date-fns";

const interviewStatuses = ["proposed", "confirmed", "completed", "cancelled"];
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
  const [editForm, setEditForm] = useState({ scheduledDate: "", scheduledTime: "", location: "", notes: "" });
  const [newInterview, setNewInterview] = useState({
    guestId: "", studioDateId: "", scheduledDate: "", scheduledTime: "", location: "", notes: "",
    participantIds: [] as string[],
  });
  const { toast } = useToast();

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

  const availableStudioDates = studioDates?.filter(
    (d) => d.status === "available" && isAfter(parseISO(d.date), new Date())
  ).sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()) || [];

  const confirmedGuests = guests?.filter((g) => g.status === "confirmed" || g.status === "contacted") || [];

  const interviewers = members?.filter((m) => m.role === "Interviewer") || [];

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
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      await apiRequest("PATCH", `/api/interviews/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/interviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      setIsEditing(false);
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
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-scheduling-title">Interview Scheduling</h1>
          <p className="text-sm text-muted-foreground mt-1">Coordinate interviews with guests, studio, and interviewers</p>
        </div>
        <Button onClick={() => setShowNewInterview(true)} data-testid="button-new-interview">
          <Plus className="h-4 w-4 mr-2" />
          Schedule Interview
        </Button>
      </div>

      {(!allInterviews || allInterviews.length === 0) ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CalendarClock className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-medium">No interviews scheduled</p>
            <p className="text-sm text-muted-foreground mt-1">Schedule your first interview with a guest</p>
            <Button className="mt-4" onClick={() => setShowNewInterview(true)} data-testid="button-create-first-interview">
              <Plus className="h-4 w-4 mr-2" />
              Schedule Interview
            </Button>
          </CardContent>
        </Card>
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
                    <Card
                      key={interview.id}
                      className="hover-elevate cursor-pointer"
                      onClick={() => setSelectedInterview(interview)}
                      data-testid={`card-interview-${interview.id}`}
                    >
                      <CardContent className="py-4 px-5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm font-medium">{guest?.name || "Unknown Guest"}</h3>
                              <Badge variant="secondary" className={statusColors[interview.status]}>
                                {interview.status}
                              </Badge>
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
                      </CardContent>
                    </Card>
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
                    <Card
                      key={interview.id}
                      className="hover-elevate cursor-pointer opacity-60"
                      onClick={() => setSelectedInterview(interview)}
                      data-testid={`card-interview-${interview.id}`}
                    >
                      <CardContent className="py-3 px-5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-medium">{guest?.name || "Unknown"}</h3>
                            <Badge variant="secondary" className={statusColors[interview.status]}>
                              {interview.status}
                            </Badge>
                          </div>
                          {interview.scheduledDate && (
                            <span className="text-xs text-muted-foreground">
                              {format(parseISO(interview.scheduledDate), "MMM d, yyyy")}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
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
                  {availableStudioDates.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {format(parseISO(d.date), "EEE, MMM d, yyyy")}
                      {d.notes && ` - ${d.notes}`}
                    </SelectItem>
                  ))}
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
                    variant={newInterview.participantIds.includes(member.id) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleParticipant(member.id)}
                    data-testid={`button-toggle-interviewer-${member.id}`}
                    className="toggle-elevate"
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
              className="w-full"
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
        if (!open) { setSelectedInterview(null); setIsEditing(false); }
      }}>
        <DialogContent className="max-w-lg">
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
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setEditForm({
                            scheduledDate: selectedInterview.scheduledDate || "",
                            scheduledTime: selectedInterview.scheduledTime || "",
                            location: selectedInterview.location || "",
                            notes: selectedInterview.notes || "",
                          });
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
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => setIsEditing(false)}
                          data-testid="button-cancel-edit"
                        >
                          Cancel
                        </Button>
                        <Button
                          className="flex-1"
                          disabled={updateInterview.isPending}
                          onClick={() => {
                            updateInterview.mutate({
                              id: selectedInterview.id,
                              data: {
                                scheduledDate: editForm.scheduledDate || null,
                                scheduledTime: editForm.scheduledTime || null,
                                location: editForm.location || null,
                                notes: editForm.notes || null,
                              },
                            });
                            setSelectedInterview({
                              ...selectedInterview,
                              scheduledDate: editForm.scheduledDate || null,
                              scheduledTime: editForm.scheduledTime || null,
                              location: editForm.location || null,
                              notes: editForm.notes || null,
                            });
                          }}
                          data-testid="button-save-edit"
                        >
                          {updateInterview.isPending ? "Saving..." : "Save Changes"}
                        </Button>
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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => deleteInterview.mutate(selectedInterview.id)}
                        data-testid="button-delete-interview"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete Interview
                      </Button>
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
