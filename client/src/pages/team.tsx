import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { Plus, Users, Trash2 } from "lucide-react";
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
  const [newMember, setNewMember] = useState({ name: "", role: "" });
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
      await apiRequest("POST", "/api/team-members", {
        name: newMember.name,
        role: newMember.role,
        color: COLORS[colorIndex],
        initials: getInitials(newMember.name),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
      setShowAddMember(false);
      setNewMember({ name: "", role: "" });
      toast({ title: "Team member added" });
    },
    onError: () => toast({ title: "Failed to add member", variant: "destructive" }),
  });

  const deleteMember = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/team-members/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
      toast({ title: "Team member removed" });
    },
  });

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
          {members.map((member) => {
            const memberTasks = tasks?.filter((t) => t.assigneeId === member.id) || [];
            const openTasks = memberTasks.filter((t) => t.status !== "done");
            const doneTasks = memberTasks.filter((t) => t.status === "done");
            return (
              <Card key={member.id} data-testid={`card-member-${member.id}`}>
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
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMember.mutate(member.id)}
                      data-testid={`button-delete-member-${member.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 mt-4 flex-wrap">
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
