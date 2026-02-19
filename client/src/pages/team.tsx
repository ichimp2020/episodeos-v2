import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Users, Trash2, Pencil, Phone, Mail, Briefcase, Check, X, ArrowUp, ArrowDown } from "lucide-react";
import type { TeamMember, Task } from "@shared/schema";

const COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#6366f1",
];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function Team() {
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ name: "", role: "", phone: "", email: "", responsibilities: "" });
  const [newMember, setNewMember] = useState({ name: "", role: "", phone: "", email: "", responsibilities: "" });
  const { toast } = useToast();

  const { data: members, isLoading } = useQuery<TeamMember[]>({
    queryKey: ["/api/team-members"],
  });
  const { data: tasks } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  const createMember = useMutation({
    mutationFn: async () => {
      const colorIndex = (members?.length || 0) % COLORS.length;
      const maxOrder = members?.reduce((max, m) => Math.max(max, m.sortOrder ?? 0), -1) ?? -1;
      await apiRequest("POST", "/api/team-members", {
        name: newMember.name,
        role: newMember.role,
        color: COLORS[colorIndex],
        initials: getInitials(newMember.name),
        phone: newMember.phone || null,
        email: newMember.email || null,
        responsibilities: newMember.responsibilities || null,
        sortOrder: maxOrder + 1,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
      setShowAddMember(false);
      setNewMember({ name: "", role: "", phone: "", email: "", responsibilities: "" });
      toast({ title: "Team member added" });
    },
    onError: () => toast({ title: "Failed to add member", variant: "destructive" }),
  });

  const updateMember = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/team-members/${id}`, data);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
    },
    onError: () => toast({ title: "Failed to update member", variant: "destructive" }),
  });

  const deleteMember = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/team-members/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
      setSelectedMember(null);
      toast({ title: "Team member removed" });
    },
  });

  const sortedMembers = members ? [...members].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)) : [];

  const swapOrder = async (index: number, direction: "up" | "down") => {
    const other = direction === "up" ? index - 1 : index + 1;
    if (other < 0 || other >= sortedMembers.length) return;
    const memberA = sortedMembers[index];
    const memberB = sortedMembers[other];
    await Promise.all([
      apiRequest("PATCH", `/api/team-members/${memberA.id}`, { sortOrder: memberB.sortOrder ?? other }),
      apiRequest("PATCH", `/api/team-members/${memberB.id}`, { sortOrder: memberA.sortOrder ?? index }),
    ]);
    queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
  };

  const startEditing = (field: string) => {
    if (!selectedMember) return;
    setEditValues({
      name: selectedMember.name,
      role: selectedMember.role,
      phone: selectedMember.phone || "",
      email: selectedMember.email || "",
      responsibilities: selectedMember.responsibilities || "",
    });
    setEditingField(field);
  };

  const saveField = (field: string) => {
    if (!selectedMember) return;
    const value = editValues[field as keyof typeof editValues];
    const data: Record<string, unknown> = { [field]: value || null };
    if (field === "name") {
      data.initials = getInitials(value);
    }
    updateMember.mutate({ id: selectedMember.id, data });
    setSelectedMember({ ...selectedMember, ...data } as TeamMember);
    setEditingField(null);
  };

  const cancelEditing = () => setEditingField(null);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-team-title">Team</h1>
          <p className="text-sm text-muted-foreground mt-1">Your podcast crew and their responsibilities</p>
        </div>
        <Button onClick={() => setShowAddMember(true)} data-testid="button-add-member">
          <Plus className="h-4 w-4 mr-2" />
          Add Member
        </Button>
      </div>

      {(!members || members.length === 0) ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-medium">No team members yet</p>
            <p className="text-sm text-muted-foreground mt-1">Add your crew to start assigning tasks</p>
            <Button className="mt-4" onClick={() => setShowAddMember(true)} data-testid="button-add-first-member">
              <Plus className="h-4 w-4 mr-2" />
              Add Member
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedMembers.map((member, idx) => {
            const memberTasks = tasks?.filter((t) => t.assigneeId === member.id) || [];
            const openTasks = memberTasks.filter((t) => t.status !== "done");
            const doneTasks = memberTasks.filter((t) => t.status === "done");
            return (
              <Card
                key={member.id}
                className="cursor-pointer hover-elevate"
                onClick={() => setSelectedMember(member)}
                data-testid={`card-member-${member.id}`}
              >
                <CardContent className="pt-5 pb-4 px-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback
                          className="text-sm font-medium text-white"
                          style={{ backgroundColor: member.color }}
                        >
                          {member.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium" data-testid={`text-member-name-${member.id}`}>{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        className="p-1 rounded hover:bg-muted disabled:opacity-30"
                        disabled={idx === 0}
                        onClick={(e) => { e.stopPropagation(); swapOrder(idx, "up"); }}
                        data-testid={`button-move-up-${member.id}`}
                      >
                        <ArrowUp className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button
                        className="p-1 rounded hover:bg-muted disabled:opacity-30"
                        disabled={idx === sortedMembers.length - 1}
                        onClick={(e) => { e.stopPropagation(); swapOrder(idx, "down"); }}
                        data-testid={`button-move-down-${member.id}`}
                      >
                        <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                  {(member.phone || member.email) && (
                    <div className="mt-3 space-y-1">
                      {member.phone && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          <span>{member.phone}</span>
                        </div>
                      )}
                      {member.email && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{member.email}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <Badge variant="secondary" size="sm">
                      {openTasks.length} open
                    </Badge>
                    <Badge variant="secondary" size="sm" className="bg-chart-2/10 text-chart-2 border-transparent">
                      {doneTasks.length} done
                    </Badge>
                  </div>
                  {openTasks.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {openTasks.slice(0, 3).map((task) => (
                        <div key={task.id} className="flex items-center gap-2">
                          <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${task.status === "in_progress" ? "bg-chart-4" : "bg-muted-foreground/30"}`} />
                          <p className="text-xs text-muted-foreground truncate">{task.title}</p>
                        </div>
                      ))}
                      {openTasks.length > 3 && (
                        <p className="text-xs text-muted-foreground pl-3.5">+{openTasks.length - 3} more</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedMember} onOpenChange={(open) => { if (!open) { setSelectedMember(null); setEditingField(null); } }}>
        <DialogContent className="max-w-md">
          {selectedMember && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 mb-1">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback
                      className="text-base font-medium text-white"
                      style={{ backgroundColor: selectedMember.color }}
                    >
                      {selectedMember.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    {editingField === "name" ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editValues.name}
                          onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                          onKeyDown={(e) => { if (e.key === "Enter") saveField("name"); if (e.key === "Escape") cancelEditing(); }}
                          autoFocus
                          className="text-base font-semibold h-8"
                          data-testid="input-edit-member-name"
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveField("name")} data-testid="button-save-member-name">
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEditing}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <DialogTitle
                        className="cursor-pointer flex items-center gap-1.5 group"
                        onClick={() => startEditing("name")}
                        data-testid="text-member-detail-name"
                      >
                        {selectedMember.name}
                        <Pencil className="h-3 w-3 text-muted-foreground/50" />
                      </DialogTitle>
                    )}
                    {editingField === "role" ? (
                      <div className="flex items-center gap-1 mt-1">
                        <Input
                          value={editValues.role}
                          onChange={(e) => setEditValues({ ...editValues, role: e.target.value })}
                          onKeyDown={(e) => { if (e.key === "Enter") saveField("role"); if (e.key === "Escape") cancelEditing(); }}
                          autoFocus
                          className="text-sm h-7"
                          data-testid="input-edit-member-role"
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveField("role")} data-testid="button-save-member-role">
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEditing}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <DialogDescription
                        className="cursor-pointer flex items-center gap-1.5 group text-sm"
                        onClick={() => startEditing("role")}
                        data-testid="text-member-detail-role"
                      >
                        {selectedMember.role}
                        <Pencil className="h-3 w-3 text-muted-foreground/50" />
                      </DialogDescription>
                    )}
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                <EditableField
                  icon={<Phone className="h-4 w-4 text-muted-foreground" />}
                  label="Phone"
                  value={selectedMember.phone || ""}
                  placeholder="Add phone number"
                  isEditing={editingField === "phone"}
                  editValue={editValues.phone}
                  onStartEdit={() => startEditing("phone")}
                  onSave={() => saveField("phone")}
                  onCancel={cancelEditing}
                  onChange={(v) => setEditValues({ ...editValues, phone: v })}
                  testId="phone"
                />

                <EditableField
                  icon={<Mail className="h-4 w-4 text-muted-foreground" />}
                  label="Email"
                  value={selectedMember.email || ""}
                  placeholder="Add email address"
                  isEditing={editingField === "email"}
                  editValue={editValues.email}
                  onStartEdit={() => startEditing("email")}
                  onSave={() => saveField("email")}
                  onCancel={cancelEditing}
                  onChange={(v) => setEditValues({ ...editValues, email: v })}
                  testId="email"
                />

                <EditableField
                  icon={<Briefcase className="h-4 w-4 text-muted-foreground" />}
                  label="Responsibilities"
                  value={selectedMember.responsibilities || ""}
                  placeholder="Add responsibilities"
                  isEditing={editingField === "responsibilities"}
                  editValue={editValues.responsibilities}
                  onStartEdit={() => startEditing("responsibilities")}
                  onSave={() => saveField("responsibilities")}
                  onCancel={cancelEditing}
                  onChange={(v) => setEditValues({ ...editValues, responsibilities: v })}
                  multiline
                  testId="responsibilities"
                />

                <div className="pt-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive w-full"
                    onClick={() => deleteMember.mutate(selectedMember.id)}
                    data-testid="button-delete-member"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Remove Team Member
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>Add a new member to your podcast crew</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={newMember.name}
                onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                placeholder="Full name"
                data-testid="input-member-name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Role</label>
              <Input
                value={newMember.role}
                onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                placeholder="e.g. Host, Editor, Producer"
                data-testid="input-member-role"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Phone</label>
              <Input
                value={newMember.phone}
                onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
                placeholder="Phone number"
                data-testid="input-member-phone"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                value={newMember.email}
                onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                placeholder="Email address"
                data-testid="input-member-email"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Responsibilities</label>
              <Textarea
                value={newMember.responsibilities}
                onChange={(e) => setNewMember({ ...newMember, responsibilities: e.target.value })}
                placeholder="What they're responsible for"
                rows={2}
                data-testid="input-member-responsibilities"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => createMember.mutate()}
              disabled={!newMember.name || !newMember.role || createMember.isPending}
              data-testid="button-submit-member"
            >
              {createMember.isPending ? "Adding..." : "Add Member"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditableField({
  icon,
  label,
  value,
  placeholder,
  isEditing,
  editValue,
  onStartEdit,
  onSave,
  onCancel,
  onChange,
  multiline,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  placeholder: string;
  isEditing: boolean;
  editValue: string;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onChange: (v: string) => void;
  multiline?: boolean;
  testId: string;
}) {
  if (isEditing) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          {icon}
          <label className="text-sm font-medium">{label}</label>
        </div>
        <div className="flex items-start gap-1">
          {multiline ? (
            <Textarea
              value={editValue}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
              autoFocus
              rows={2}
              className="text-sm"
              data-testid={`input-edit-member-${testId}`}
            />
          ) : (
            <Input
              value={editValue}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
              autoFocus
              className="text-sm h-8"
              data-testid={`input-edit-member-${testId}`}
            />
          )}
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={onSave} data-testid={`button-save-member-${testId}`}>
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={onCancel}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-start gap-3 p-3 rounded-md bg-card cursor-pointer group"
      onClick={onStartEdit}
      data-testid={`field-member-${testId}`}
    >
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-sm ${value ? "" : "text-muted-foreground/50 italic"}`}>
          {value || placeholder}
        </p>
      </div>
      <Pencil className="h-3 w-3 text-muted-foreground/50 shrink-0 mt-1" />
    </div>
  );
}
