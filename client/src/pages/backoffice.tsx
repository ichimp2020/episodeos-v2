import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, ExternalLink, Pencil, Trash2, Link as LinkIcon, FolderOpen, Copy, Check } from "lucide-react";
import type { SharedLink } from "@shared/schema";

export default function BackOffice() {
  const { toast } = useToast();
  const [showAddLink, setShowAddLink] = useState(false);
  const [editingLink, setEditingLink] = useState<SharedLink | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("google-drive");

  const { data: links, isLoading } = useQuery<SharedLink[]>({
    queryKey: ["/api/shared-links"],
  });

  const createMutation = useMutation({
    mutationFn: (data: { title: string; url: string; description: string; category: string }) =>
      apiRequest("POST", "/api/shared-links", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shared-links"] });
      resetForm();
      setShowAddLink(false);
      toast({ title: "Link added" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SharedLink> }) =>
      apiRequest("PATCH", `/api/shared-links/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shared-links"] });
      resetForm();
      setEditingLink(null);
      toast({ title: "Link updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/shared-links/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shared-links"] });
      toast({ title: "Link removed" });
    },
  });

  const resetForm = () => {
    setTitle("");
    setUrl("");
    setDescription("");
    setCategory("google-drive");
  };

  const openEdit = (link: SharedLink) => {
    setEditingLink(link);
    setTitle(link.title);
    setUrl(link.url);
    setDescription(link.description || "");
    setCategory(link.category);
  };

  const handleSubmit = () => {
    if (!title.trim() || !url.trim()) return;
    if (editingLink) {
      updateMutation.mutate({ id: editingLink.id, data: { title, url, description, category } });
    } else {
      createMutation.mutate({ title, url, description, category });
    }
  };

  const copyToClipboard = (link: SharedLink) => {
    navigator.clipboard.writeText(link.url);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Link copied to clipboard" });
  };

  const categories = [
    { value: "google-drive", label: "Google Drive" },
    { value: "general", label: "General" },
    { value: "tools", label: "Tools" },
    { value: "templates", label: "Templates" },
  ];

  const groupedLinks: Record<string, SharedLink[]> = {};
  links?.forEach((link) => {
    const cat = link.category || "general";
    if (!groupedLinks[cat]) groupedLinks[cat] = [];
    groupedLinks[cat].push(link);
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-backoffice-title">Back Office</h1>
          <p className="text-sm text-muted-foreground mt-1">Shared links and resources for the team</p>
        </div>
        <Button onClick={() => { resetForm(); setShowAddLink(true); }} className="rounded-full px-5 shadow-md" data-testid="button-add-link">
          <Plus className="h-4 w-4 mr-2" />
          Add Link
        </Button>
      </div>

      {(!links || links.length === 0) ? (
        <div className="ios-section">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50 mb-4">
              <FolderOpen className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <p className="text-muted-foreground font-semibold">No links saved yet</p>
            <p className="text-sm text-muted-foreground mt-1">Add Google Drive links, resources, and tools for easy team access</p>
            <Button className="rounded-full px-5 shadow-md mt-5" onClick={() => { resetForm(); setShowAddLink(true); }} data-testid="button-add-first-link">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Link
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedLinks).map(([cat, catLinks]) => {
            const catLabel = categories.find((c) => c.value === cat)?.label || cat;
            return (
              <div key={cat} className="ios-section">
                <div className="ios-section-header">
                  <h2 className="ios-section-title flex items-center gap-2" data-testid={`text-category-${cat}`}>
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                    {catLabel}
                  </h2>
                  <Badge className="ios-badge border-0 bg-muted text-muted-foreground">{catLinks.length}</Badge>
                </div>
                <div className="px-4 pb-4 space-y-2">
                  {catLinks.map((link) => (
                    <div key={link.id} className="ios-list-item group" data-testid={`card-link-${link.id}`}>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                        <LinkIcon className="h-4.5 w-4.5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{link.title}</p>
                        {link.description && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{link.description}</p>
                        )}
                        <p className="text-[10px] text-primary/60 mt-0.5 truncate font-mono">{link.url}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg"
                          onClick={() => copyToClipboard(link)}
                          data-testid={`button-copy-link-${link.id}`}
                        >
                          {copiedId === link.id ? <Check className="h-3.5 w-3.5 text-chart-2" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg"
                          onClick={() => window.open(link.url, "_blank")}
                          data-testid={`button-open-link-${link.id}`}
                        >
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg"
                          onClick={() => openEdit(link)}
                          data-testid={`button-edit-link-${link.id}`}
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg"
                          onClick={() => deleteMutation.mutate(link.id)}
                          data-testid={`button-delete-link-${link.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showAddLink || !!editingLink} onOpenChange={(open) => { if (!open) { setShowAddLink(false); setEditingLink(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLink ? "Edit Link" : "Add New Link"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="e.g. Podcast Graphics"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                data-testid="input-link-title"
              />
            </div>
            <div className="space-y-2">
              <Label>URL</Label>
              <Input
                placeholder="Paste link here..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                data-testid="input-link-url"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="What this link is for..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                data-testid="input-link-description"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <Button
                    key={cat.value}
                    variant={category === cat.value ? "default" : "secondary"}
                    className={`rounded-full px-4 text-xs ${category === cat.value ? "shadow-md" : ""}`}
                    onClick={() => setCategory(cat.value)}
                    data-testid={`button-category-${cat.value}`}
                  >
                    {cat.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleSubmit}
              disabled={!title.trim() || !url.trim() || createMutation.isPending || updateMutation.isPending}
              className="rounded-full px-6 shadow-md"
              data-testid="button-save-link"
            >
              {editingLink ? "Save Changes" : "Add Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
