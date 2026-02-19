import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Plus, UserPlus, Phone, Mail, ExternalLink, Trash2, ChevronRight, X, Pencil } from "lucide-react";
import type { Guest, TeamMember } from "@shared/schema";

const guestStatuses = ["prospect", "contacted", "confirmed", "declined"];
const statusColors: Record<string, string> = {
  prospect: "bg-chart-4/10 text-chart-4 border-transparent",
  contacted: "bg-primary/10 text-primary border-transparent",
  confirmed: "bg-chart-2/10 text-chart-2 border-transparent",
  declined: "bg-destructive/10 text-destructive border-transparent",
};

export default function Guests() {
  const [showNewGuest, setShowNewGuest] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [editingGuest, setEditingGuest] = useState(false);
  const [newGuest, setNewGuest] = useState({
    name: "", phone: "", email: "", shortDescription: "", notes: "", links: [""],
  });
  const [editForm, setEditForm] = useState({
    name: "", phone: "", email: "", shortDescription: "", notes: "", status: "prospect", links: [""],
  });
  const { toast } = useToast();

  const { data: guests, isLoading } = useQuery<Guest[]>({
    queryKey: ["/api/guests"],
  });
  const { data: members } = useQuery<TeamMember[]>({
    queryKey: ["/api/team-members"],
  });

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

  const updateGuest = useMutation({
    mutationFn: async () => {
      if (!selectedGuest) return;
      await apiRequest("PATCH", `/api/guests/${selectedGuest.id}`, {
        name: editForm.name,
        phone: editForm.phone || null,
        email: editForm.email || null,
        shortDescription: editForm.shortDescription || null,
        notes: editForm.notes || null,
        status: editForm.status,
        links: editForm.links.filter((l) => l.trim() !== ""),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/guests"] });
      setEditingGuest(false);
      setSelectedGuest(null);
      toast({ title: "Guest updated" });
    },
    onError: () => toast({ title: "Failed to update guest", variant: "destructive" }),
  });

  const updateGuestStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/guests/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/guests"] });
    },
  });

  const deleteGuest = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/guests/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/guests"] });
      setSelectedGuest(null);
      toast({ title: "Guest removed" });
    },
  });

  const addLinkField = (form: "new" | "edit") => {
    if (form === "new") {
      setNewGuest({ ...newGuest, links: [...newGuest.links, ""] });
    } else {
      setEditForm({ ...editForm, links: [...editForm.links, ""] });
    }
  };

  const removeLinkField = (form: "new" | "edit", index: number) => {
    if (form === "new") {
      setNewGuest({ ...newGuest, links: newGuest.links.filter((_, i) => i !== index) });
    } else {
      setEditForm({ ...editForm, links: editForm.links.filter((_, i) => i !== index) });
    }
  };

  const updateLink = (form: "new" | "edit", index: number, value: string) => {
    if (form === "new") {
      const links = [...newGuest.links];
      links[index] = value;
      setNewGuest({ ...newGuest, links });
    } else {
      const links = [...editForm.links];
      links[index] = value;
      setEditForm({ ...editForm, links });
    }
  };

  const openEditDialog = (guest: Guest) => {
    setSelectedGuest(guest);
    setEditForm({
      name: guest.name,
      phone: guest.phone || "",
      email: guest.email || "",
      shortDescription: guest.shortDescription || "",
      notes: guest.notes || "",
      status: guest.status,
      links: guest.links && guest.links.length > 0 ? [...guest.links] : [""],
    });
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
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-guests-title">Guests</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage potential and confirmed interviewees</p>
        </div>
        <Button onClick={() => setShowNewGuest(true)} data-testid="button-new-guest">
          <UserPlus className="h-4 w-4 mr-2" />
          Add Guest
        </Button>
      </div>

      {(!guests || guests.length === 0) ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <UserPlus className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-medium">No guests yet</p>
            <p className="text-sm text-muted-foreground mt-1">Start by adding potential interviewees</p>
            <Button className="mt-4" onClick={() => setShowNewGuest(true)} data-testid="button-create-first-guest">
              <Plus className="h-4 w-4 mr-2" />
              Add Guest
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {(["confirmed", "contacted", "prospect", "declined"] as const).map((status) => {
            const groupGuests = grouped[status];
            if (groupGuests.length === 0) return null;
            return (
              <div key={status}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-medium capitalize">{status}</h2>
                  <Badge variant="secondary" className="text-xs">{groupGuests.length}</Badge>
                </div>
                <div className="space-y-2">
                  {groupGuests.map((guest) => (
                    <Card
                      key={guest.id}
                      className="hover-elevate cursor-pointer"
                      onClick={() => openEditDialog(guest)}
                      data-testid={`card-guest-${guest.id}`}
                    >
                      <CardContent className="py-4 px-5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm font-medium" data-testid={`text-guest-name-${guest.id}`}>{guest.name}</h3>
                              <Badge variant="secondary" className={statusColors[guest.status]}>
                                {guest.status}
                              </Badge>
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
                                  <ExternalLink className="h-3 w-3" /> {guest.links.length} link{guest.links.length !== 1 ? "s" : ""}
                                </span>
                              )}
                              {guest.addedBy && (
                                <span className="text-xs text-muted-foreground">
                                  Added by {getMemberName(guest.addedBy)}
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showNewGuest} onOpenChange={setShowNewGuest}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Guest</DialogTitle>
            <DialogDescription>Add a potential interviewee to the pipeline</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={newGuest.name}
                onChange={(e) => setNewGuest({ ...newGuest, name: e.target.value })}
                placeholder="Full name"
                data-testid="input-guest-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone</label>
                <Input
                  value={newGuest.phone}
                  onChange={(e) => setNewGuest({ ...newGuest, phone: e.target.value })}
                  placeholder="+972-50-..."
                  data-testid="input-guest-phone"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  value={newGuest.email}
                  onChange={(e) => setNewGuest({ ...newGuest, email: e.target.value })}
                  placeholder="email@example.com"
                  data-testid="input-guest-email"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Short Description</label>
              <Input
                value={newGuest.shortDescription}
                onChange={(e) => setNewGuest({ ...newGuest, shortDescription: e.target.value })}
                placeholder="Brief description of the individual"
                data-testid="input-guest-description"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={newGuest.notes}
                onChange={(e) => setNewGuest({ ...newGuest, notes: e.target.value })}
                placeholder="Initial conversation notes, context..."
                data-testid="input-guest-notes"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Links</label>
              {newGuest.links.map((link, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={link}
                    onChange={(e) => updateLink("new", i, e.target.value)}
                    placeholder="https://youtube.com/..."
                    data-testid={`input-guest-link-${i}`}
                  />
                  {newGuest.links.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => removeLinkField("new", i)} data-testid={`button-remove-link-${i}`}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={() => addLinkField("new")} data-testid="button-add-link">
                <Plus className="h-3 w-3 mr-1" />
                Add Link
              </Button>
            </div>
            <Button
              className="w-full"
              onClick={() => createGuest.mutate()}
              disabled={!newGuest.name || createGuest.isPending}
              data-testid="button-submit-guest"
            >
              {createGuest.isPending ? "Adding..." : "Add Guest"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editingGuest} onOpenChange={(open) => { if (!open) { setEditingGuest(false); setSelectedGuest(null); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedGuest && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Pencil className="h-4 w-4" />
                  Edit Guest
                </DialogTitle>
                <DialogDescription>Update guest details and status</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
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
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name</label>
                  <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} data-testid="input-edit-guest-name" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Phone</label>
                    <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} data-testid="input-edit-guest-phone" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email</label>
                    <Input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} data-testid="input-edit-guest-email" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Short Description</label>
                  <Input value={editForm.shortDescription} onChange={(e) => setEditForm({ ...editForm, shortDescription: e.target.value })} data-testid="input-edit-guest-description" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Notes</label>
                  <Textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} data-testid="input-edit-guest-notes" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Links</label>
                  {editForm.links.map((link, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input value={link} onChange={(e) => updateLink("edit", i, e.target.value)} data-testid={`input-edit-guest-link-${i}`} />
                      {editForm.links.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeLinkField("edit", i)}>
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" onClick={() => addLinkField("edit")}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add Link
                  </Button>
                </div>
                {editForm.links.some((l) => l.trim()) && (
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Quick Links</label>
                    <div className="flex flex-wrap gap-2">
                      {editForm.links.filter((l) => l.trim()).map((link, i) => (
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
                          {new URL(link).hostname.replace("www.", "")}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => deleteGuest.mutate(selectedGuest.id)}
                    data-testid="button-delete-guest"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                  <Button
                    onClick={() => updateGuest.mutate()}
                    disabled={!editForm.name || updateGuest.isPending}
                    data-testid="button-save-guest"
                  >
                    {updateGuest.isPending ? "Saving..." : "Save Changes"}
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
