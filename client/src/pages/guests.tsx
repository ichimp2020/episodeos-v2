import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { Plus, UserPlus, Phone, Mail, ExternalLink, ChevronRight, X, ClipboardPaste, Trash2, AlertTriangle } from "lucide-react";
import type { Guest, TeamMember, Interview } from "@shared/schema";
import GuestEditDialog from "@/components/GuestEditDialog";
import { useLanguage } from "@/i18n/LanguageProvider";

import { guestStatusColors, getGuestStatusLabel } from "@/lib/statusColors";

const guestStatuses = ["prospect", "contacted", "confirmed", "declined"];

export default function Guests() {
  const [showNewGuest, setShowNewGuest] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [editingGuest, setEditingGuest] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [newGuest, setNewGuest] = useState({
    name: "", phone: "", email: "", shortDescription: "", notes: "", links: [""],
  });
  const { toast } = useToast();
  const { t } = useLanguage();

  const { data: guests, isLoading } = useQuery<Guest[]>({
    queryKey: ["/api/guests"],
  });
  const { data: members } = useQuery<TeamMember[]>({
    queryKey: ["/api/team-members"],
  });
  const { data: interviews } = useQuery<Interview[]>({
    queryKey: ["/api/interviews"],
  });

  useEffect(() => {
    const checkHighlight = () => {
      if (!guests) return;
      const params = new URLSearchParams(window.location.search);
      const highlightId = params.get("highlight");
      if (highlightId) {
        const guest = guests.find((g) => String(g.id) === highlightId);
        if (guest) {
          setSelectedGuest(guest);
          setEditingGuest(true);
        }
        window.history.replaceState({}, "", window.location.pathname);
      }
    };
    checkHighlight();
    window.addEventListener("spotlight-navigate", checkHighlight);
    return () => window.removeEventListener("spotlight-navigate", checkHighlight);
  }, [guests]);

  const createGuest = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/guests", {
        name: newGuest.name,
        phone: newGuest.phone || null,
        email: newGuest.email || null,
        shortDescription: newGuest.shortDescription || null,
        notes: newGuest.notes || null,
        links: newGuest.links.filter((l) => l.trim() !== ""),
        status: "prospect",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/guests"] });
      setShowNewGuest(false);
      setNewGuest({ name: "", phone: "", email: "", shortDescription: "", notes: "", links: [""] });
      toast({ title: "Guest added to pipeline" });
    },
    onError: () => toast({ title: "Failed to add guest", variant: "destructive" }),
  });

  const deleteGuest = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/guests/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/guests"] });
      toast({ title: "Guest removed" });
    },
  });

  const bulkImportGuests = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiRequest("POST", "/api/guests/bulk", { text });
      return res.json();
    },
    onSuccess: (data: { created: Guest[]; skipped: string[] }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/guests"] });
      const parts = [];
      if (data.created.length > 0) parts.push(`${data.created.length} ${t.dashboard.created}`);
      if (data.skipped.length > 0) parts.push(`${data.skipped.length} ${t.dashboard.skipped}`);
      toast({ title: t.dashboard.importSuccess, description: parts.join(", ") });
      setImportOpen(false);
      setImportText("");
    },
  });

  const addLinkField = () => {
    setNewGuest({ ...newGuest, links: [...newGuest.links, ""] });
  };

  const removeLinkField = (index: number) => {
    setNewGuest({ ...newGuest, links: newGuest.links.filter((_, i) => i !== index) });
  };

  const updateLink = (index: number, value: string) => {
    const links = [...newGuest.links];
    links[index] = value;
    setNewGuest({ ...newGuest, links });
  };

  const openEditDialog = (guest: Guest) => {
    setSelectedGuest(guest);
    setEditingGuest(true);
  };

  const getMemberName = (id: string | null) => {
    if (!id) return null;
    return members?.find((m) => m.id === id)?.name;
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

  const grouped = {
    prospect: guests?.filter((g) => g.status === "prospect") || [],
    contacted: guests?.filter((g) => g.status === "contacted") || [],
    confirmed: guests?.filter((g) => g.status === "confirmed") || [],
    declined: guests?.filter((g) => g.status === "declined") || [],
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-guests-title">{t.guests.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.guests.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="rounded-full px-5" onClick={() => setImportOpen(true)} data-testid="button-paste-whatsapp-guests">
            <ClipboardPaste className="h-4 w-4" />
            {t.dashboard.importGuests}
          </Button>
          <Button className="rounded-full px-5 shadow-md" onClick={() => setShowNewGuest(true)} data-testid="button-new-guest">
            <UserPlus className="h-4 w-4" />
            {t.guests.addGuest}
          </Button>
        </div>
      </div>

      {(!guests || guests.length === 0) ? (
        <div className="ios-section flex flex-col items-center justify-center py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/50 mb-3">
            <UserPlus className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">{t.guests.noGuestsYet}</p>
          <p className="text-sm text-muted-foreground mt-1">{t.guests.startAdding}</p>
          <Button className="rounded-full px-5 shadow-md mt-4" onClick={() => setShowNewGuest(true)} data-testid="button-create-first-guest">
            <Plus className="h-4 w-4" />
            {t.guests.addGuest}
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {(["confirmed", "contacted", "prospect", "declined"] as const).map((status) => {
            const groupGuests = grouped[status];
            if (groupGuests.length === 0) return null;
            return (
              <div key={status}>
                <div className="ios-section-header">
                  <h2 className="ios-section-title capitalize">{status}</h2>
                  <span className="ios-badge border-0 bg-primary/10 text-primary text-xs">{groupGuests.length}</span>
                </div>
                <div className="ios-section space-y-2 p-0 overflow-visible">
                  {groupGuests.map((guest) => (
                    <div
                      key={guest.id}
                      className="ios-list-item hover-elevate cursor-pointer group"
                      onClick={() => openEditDialog(guest)}
                      data-testid={`card-guest-${guest.id}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-medium" data-testid={`text-guest-name-${guest.id}`}>{guest.name}</h3>
                          <span className={`ios-badge border-0 ${guestStatusColors[guest.status]}`}>
                            {getGuestStatusLabel(t, guest.status)}
                          </span>
                          {interviews?.find((i) => i.guestId === guest.id && i.status === 'needs-reschedule') && (
                            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 gap-1 text-[10px] py-0 px-1.5" data-testid={`badge-reschedule-guest-${guest.id}`}>
                              <AlertTriangle className="w-2.5 h-2.5" />
                              {t.common.rescheduleNeeded}
                            </Badge>
                          )}
                        </div>
                        {guest.shortDescription && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{guest.shortDescription}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          {guest.phone && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {guest.phone}
                            </span>
                          )}
                          {guest.email && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {guest.email}
                            </span>
                          )}
                          {guest.links && guest.links.length > 0 && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <ExternalLink className="h-3 w-3" /> {guest.links.length} {guest.links.length !== 1 ? t.guests.links_plural : t.guests.link}
                            </span>
                          )}
                          {guest.addedBy && (
                            <span className="text-xs text-muted-foreground">
                              {t.guests.addedBy} {getMemberName(guest.addedBy)}
                            </span>
                          )}
                          {guest.status === "confirmed" && !interviews?.find((i) => i.guestId === guest.id && i.scheduledDate) && (
                            <span className="text-[10px] text-amber-500 flex items-center gap-0.5" data-testid={`hint-no-schedule-${guest.id}`}>
                              {t.episodes.guestNoSchedule}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-8 w-8 md:opacity-0 md:group-hover:opacity-100"
                        onClick={(e) => { e.stopPropagation(); deleteGuest.mutate(guest.id); }}
                        data-testid={`button-delete-guest-${guest.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showNewGuest} onOpenChange={setShowNewGuest}>
        <DialogContent className="max-w-lg w-[95vw] sm:w-full max-h-[85vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>{t.guests.addGuest}</DialogTitle>
            <DialogDescription>{t.guests.addGuestToPipeline}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.guests.name}</label>
              <Input
                value={newGuest.name}
                onChange={(e) => setNewGuest({ ...newGuest, name: e.target.value })}
                placeholder={t.guests.fullName}
                data-testid="input-guest-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t.guests.phone}</label>
                <Input
                  value={newGuest.phone}
                  onChange={(e) => setNewGuest({ ...newGuest, phone: e.target.value })}
                  placeholder={t.guests.phonePlaceholder}
                  data-testid="input-guest-phone"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t.guests.email}</label>
                <Input
                  value={newGuest.email}
                  onChange={(e) => setNewGuest({ ...newGuest, email: e.target.value })}
                  placeholder={t.guests.emailPlaceholder}
                  data-testid="input-guest-email"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.guests.shortDescription}</label>
              <Input
                value={newGuest.shortDescription}
                onChange={(e) => setNewGuest({ ...newGuest, shortDescription: e.target.value })}
                placeholder={t.guests.descriptionPlaceholder}
                data-testid="input-guest-description"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.guests.notes}</label>
              <Textarea
                value={newGuest.notes}
                onChange={(e) => setNewGuest({ ...newGuest, notes: e.target.value })}
                placeholder={t.guests.notesPlaceholder}
                data-testid="input-guest-notes"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.guests.links}</label>
              {newGuest.links.map((link, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={link}
                    onChange={(e) => updateLink(i, e.target.value)}
                    placeholder={t.guests.linkPlaceholder}
                    data-testid={`input-guest-link-${i}`}
                  />
                  {newGuest.links.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => removeLinkField(i)} data-testid={`button-remove-link-${i}`}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={() => addLinkField()} data-testid="button-add-link">
                <Plus className="h-3 w-3 mr-1" />
                {t.guests.addLink}
              </Button>
            </div>
            <Button
              className="w-full rounded-full px-5 shadow-md"
              onClick={() => createGuest.mutate()}
              disabled={!newGuest.name || createGuest.isPending}
              data-testid="button-submit-guest"
            >
              {createGuest.isPending ? t.guests.adding : t.guests.addGuest}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <GuestEditDialog
        guest={selectedGuest}
        open={editingGuest}
        onOpenChange={(open) => { setEditingGuest(open); if (!open) setSelectedGuest(null); }}
        members={members}
      />

      <Dialog open={importOpen} onOpenChange={(open) => { setImportOpen(open); if (!open) setImportText(""); }}>
        <DialogContent className="max-w-lg w-[95vw] sm:w-full max-h-[85vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardPaste className="h-5 w-5 text-purple-500" />
              {t.dashboard.importGuests}
            </DialogTitle>
            <DialogDescription>{t.dashboard.pasteWhatsAppMessage}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <textarea
              className="w-full min-h-[160px] rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              placeholder={t.dashboard.pasteHere}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              dir="auto"
              data-testid="textarea-import-guests-page"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="rounded-full" onClick={() => { setImportOpen(false); setImportText(""); }} data-testid="button-cancel-import-guests">
                {t.scheduling.cancel}
              </Button>
              <Button
                className="rounded-full bg-purple-500 hover:bg-purple-600"
                onClick={() => bulkImportGuests.mutate(importText)}
                disabled={!importText.trim() || bulkImportGuests.isPending}
                data-testid="button-confirm-import-guests"
              >
                {bulkImportGuests.isPending ? t.dashboard.importing : t.dashboard.importNames}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
