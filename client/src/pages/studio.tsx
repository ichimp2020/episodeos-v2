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
import { Plus, Calendar, ChevronLeft, ChevronRight, Trash2, X } from "lucide-react";
import type { StudioDate } from "@shared/schema";
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

export default function Studio() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showAddDate, setShowAddDate] = useState(false);
  const [selectedDate, setSelectedDate] = useState<StudioDate | null>(null);
  const [newDate, setNewDate] = useState({ date: "", notes: "" });
  const { toast } = useToast();

  const { data: studioDates, isLoading } = useQuery<StudioDate[]>({
    queryKey: ["/api/studio-dates"],
  });

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

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getDateInfo = (day: Date) => {
    return studioDates?.find((d) => isSameDay(parseISO(d.date), day));
  };

  const upcomingDates = useMemo(() => {
    return studioDates
      ?.filter((d) => d.status === "available" && isAfter(parseISO(d.date), new Date()))
      .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()) || [];
  }, [studioDates]);

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
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-studio-title">Studio Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage studio availability from your partner</p>
        </div>
        <Button onClick={() => setShowAddDate(true)} data-testid="button-add-studio-date">
          <Plus className="h-4 w-4 mr-2" />
          Add Date
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-base font-medium" data-testid="text-calendar-month">
              {format(currentMonth, "MMMM yyyy")}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                data-testid="button-prev-month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                data-testid="button-next-month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-px">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground">
                  {d}
                </div>
              ))}
              {calendarDays.map((day) => {
                const dateInfo = getDateInfo(day);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isToday = isSameDay(day, new Date());
                const isPast = isBefore(day, new Date()) && !isToday;
                return (
                  <div
                    key={day.toISOString()}
                    className={`relative p-2 min-h-[3.5rem] rounded-md text-center cursor-pointer transition-colors ${
                      !isCurrentMonth ? "opacity-30" : ""
                    } ${isToday ? "ring-1 ring-primary/30" : ""} ${
                      dateInfo?.status === "available"
                        ? "bg-chart-2/8"
                        : dateInfo?.status === "taken"
                        ? "bg-chart-5/8"
                        : ""
                    }`}
                    onClick={() => dateInfo && setSelectedDate(dateInfo)}
                    data-testid={`cell-day-${format(day, "yyyy-MM-dd")}`}
                  >
                    <span className={`text-sm ${isToday ? "font-semibold text-primary" : isPast ? "text-muted-foreground" : ""}`}>
                      {format(day, "d")}
                    </span>
                    {dateInfo && (
                      <div className="mt-0.5">
                        <div
                          className={`h-1.5 w-1.5 rounded-full mx-auto ${
                            dateInfo.status === "available" ? "bg-chart-2" : "bg-chart-5"
                          }`}
                        />
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
                <div className="h-2.5 w-2.5 rounded-full bg-chart-5" />
                <span className="text-xs text-muted-foreground">Taken</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Upcoming Available</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
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
          </CardContent>
        </Card>
      </div>

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
              className="w-full"
              onClick={() => createDate.mutate()}
              disabled={!newDate.date || createDate.isPending}
              data-testid="button-submit-studio-date"
            >
              {createDate.isPending ? "Adding..." : "Add Date"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedDate} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <DialogContent>
          {selectedDate && (
            <>
              <DialogHeader>
                <DialogTitle>{format(parseISO(selectedDate.date), "EEEE, MMMM d, yyyy")}</DialogTitle>
                <DialogDescription>Studio date details</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground">Status:</label>
                  <Badge
                    variant="secondary"
                    className={selectedDate.status === "available"
                      ? "bg-chart-2/10 text-chart-2 border-transparent"
                      : "bg-chart-5/10 text-chart-5 border-transparent"
                    }
                  >
                    {selectedDate.status}
                  </Badge>
                </div>
                {selectedDate.notes && (
                  <div>
                    <label className="text-sm text-muted-foreground">Notes:</label>
                    <p className="text-sm mt-1">{selectedDate.notes}</p>
                  </div>
                )}
                <div className="flex items-center gap-2 pt-2">
                  {selectedDate.status === "available" ? (
                    <Button
                      variant="secondary"
                      className="flex-1"
                      onClick={() => {
                        updateDateStatus.mutate({ id: selectedDate.id, status: "taken" });
                        setSelectedDate({ ...selectedDate, status: "taken" });
                      }}
                      data-testid="button-mark-taken"
                    >
                      Mark as Taken
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      className="flex-1"
                      onClick={() => {
                        updateDateStatus.mutate({ id: selectedDate.id, status: "available" });
                        setSelectedDate({ ...selectedDate, status: "available" });
                      }}
                      data-testid="button-mark-available"
                    >
                      Mark as Available
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => deleteDate.mutate(selectedDate.id)}
                    data-testid="button-delete-studio-date"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
