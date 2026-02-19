import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Upload, Trash2, CheckCircle, Clock, ExternalLink } from "lucide-react";
import { SiSpotify, SiYoutube, SiApplemusic } from "react-icons/si";
import type { Publishing, Episode } from "@shared/schema";
import { format, parseISO } from "date-fns";

const platforms = [
  { value: "spotify", label: "Spotify", icon: SiSpotify, color: "#1DB954" },
  { value: "youtube", label: "YouTube", icon: SiYoutube, color: "#FF0000" },
  { value: "apple", label: "Apple Music", icon: SiApplemusic, color: "#FA243C" },
];

const pubStatuses = ["scheduled", "published", "failed"];
const statusColors: Record<string, string> = {
  scheduled: "bg-chart-4/10 text-chart-4 border-transparent",
  published: "bg-chart-2/10 text-chart-2 border-transparent",
  failed: "bg-destructive/10 text-destructive border-transparent",
};

export default function Publish() {
  const [showNewPublish, setShowNewPublish] = useState(false);
  const [newPublish, setNewPublish] = useState({
    episodeId: "", platform: "", scheduledDate: "", scheduledTime: "12:00", title: "", description: "",
  });
  const { toast } = useToast();

  const { data: allPublishing, isLoading } = useQuery<Publishing[]>({
    queryKey: ["/api/publishing"],
  });
  const { data: episodes } = useQuery<Episode[]>({
    queryKey: ["/api/episodes"],
  });

  const createPublishing = useMutation({
    mutationFn: async () => {
      const ep = episodes?.find((e) => e.id === newPublish.episodeId);
      await apiRequest("POST", "/api/publishing", {
        episodeId: newPublish.episodeId,
        platform: newPublish.platform,
        scheduledDate: newPublish.scheduledDate || null,
        scheduledTime: newPublish.scheduledTime || "12:00",
        status: "scheduled",
        title: newPublish.title || ep?.title || null,
        description: newPublish.description || ep?.description || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/publishing"] });
      setShowNewPublish(false);
      setNewPublish({ episodeId: "", platform: "", scheduledDate: "", scheduledTime: "12:00", title: "", description: "" });
      toast({ title: "Publishing scheduled" });
    },
    onError: () => toast({ title: "Failed to schedule", variant: "destructive" }),
  });

  const updatePublishingStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/publishing/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/publishing"] });
    },
  });

  const deletePublishing = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/publishing/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/publishing"] });
      toast({ title: "Publishing removed" });
    },
  });

  const getEpisode = (id: string) => episodes?.find((e) => e.id === id);
  const getPlatformInfo = (platform: string) => platforms.find((p) => p.value === platform);

  const selectEpisode = (episodeId: string) => {
    const ep = episodes?.find((e) => e.id === episodeId);
    setNewPublish({
      ...newPublish,
      episodeId,
      title: ep?.title || "",
      description: ep?.description || "",
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    );
  }

  const scheduled = allPublishing?.filter((p) => p.status === "scheduled")
    .sort((a, b) => {
      if (!a.scheduledDate) return 1;
      if (!b.scheduledDate) return -1;
      return parseISO(a.scheduledDate).getTime() - parseISO(b.scheduledDate).getTime();
    }) || [];
  const published = allPublishing?.filter((p) => p.status === "published") || [];
  const failed = allPublishing?.filter((p) => p.status === "failed") || [];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-publishing-title">Publishing</h1>
          <p className="text-sm text-muted-foreground mt-1">Schedule and track episode releases across platforms</p>
        </div>
        <Button onClick={() => setShowNewPublish(true)} data-testid="button-new-publish">
          <Plus className="h-4 w-4 mr-2" />
          Schedule Release
        </Button>
      </div>

      {(!allPublishing || allPublishing.length === 0) ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Upload className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-medium">No releases scheduled</p>
            <p className="text-sm text-muted-foreground mt-1">Schedule your first episode release</p>
            <Button className="mt-4" onClick={() => setShowNewPublish(true)} data-testid="button-create-first-publish">
              <Plus className="h-4 w-4 mr-2" />
              Schedule Release
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {scheduled.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-medium">Scheduled</h2>
                <Badge variant="secondary" className="text-xs">{scheduled.length}</Badge>
              </div>
              <div className="space-y-2">
                {scheduled.map((pub) => {
                  const ep = getEpisode(pub.episodeId);
                  const platform = getPlatformInfo(pub.platform);
                  const PlatformIcon = platform?.icon || Upload;
                  return (
                    <Card key={pub.id} data-testid={`card-publishing-${pub.id}`}>
                      <CardContent className="py-4 px-5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div
                              className="flex h-9 w-9 items-center justify-center rounded-md shrink-0"
                              style={{ backgroundColor: `${platform?.color}15`, color: platform?.color }}
                            >
                              <PlatformIcon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm font-medium truncate">{pub.title || ep?.title || "Untitled"}</h3>
                                <Badge variant="secondary" className={statusColors[pub.status]}>
                                  {pub.status}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                <span className="text-xs text-muted-foreground capitalize">{platform?.label}</span>
                                {pub.scheduledDate && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {format(parseISO(pub.scheduledDate), "EEE, MMM d")}
                                    {pub.scheduledTime && ` at ${pub.scheduledTime}`}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updatePublishingStatus.mutate({ id: pub.id, status: "published" })}
                              data-testid={`button-mark-published-${pub.id}`}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Done
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deletePublishing.mutate(pub.id)}
                              data-testid={`button-delete-publishing-${pub.id}`}
                            >
                              <Trash2 className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {published.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-medium">Published</h2>
                <Badge variant="secondary" className="text-xs">{published.length}</Badge>
              </div>
              <div className="space-y-2">
                {published.map((pub) => {
                  const ep = getEpisode(pub.episodeId);
                  const platform = getPlatformInfo(pub.platform);
                  const PlatformIcon = platform?.icon || Upload;
                  return (
                    <Card key={pub.id} className="opacity-60" data-testid={`card-publishing-${pub.id}`}>
                      <CardContent className="py-3 px-5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <PlatformIcon className="h-4 w-4 shrink-0" style={{ color: platform?.color }} />
                            <span className="text-sm truncate">{pub.title || ep?.title}</span>
                            <Badge variant="secondary" className={statusColors.published}>published</Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deletePublishing.mutate(pub.id)}
                          >
                            <Trash2 className="h-3 w-3 text-muted-foreground" />
                          </Button>
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

      <Dialog open={showNewPublish} onOpenChange={setShowNewPublish}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Schedule Release</DialogTitle>
            <DialogDescription>Schedule an episode for publishing on a platform</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Episode</label>
              <Select value={newPublish.episodeId} onValueChange={selectEpisode}>
                <SelectTrigger data-testid="select-publish-episode">
                  <SelectValue placeholder="Select an episode" />
                </SelectTrigger>
                <SelectContent>
                  {episodes?.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.episodeNumber && `#${e.episodeNumber} - `}{e.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Platform</label>
              <div className="flex gap-2">
                {platforms.map((p) => {
                  const Icon = p.icon;
                  return (
                    <Button
                      key={p.value}
                      variant={newPublish.platform === p.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setNewPublish({ ...newPublish, platform: p.value })}
                      data-testid={`button-platform-${p.value}`}
                      className="toggle-elevate"
                    >
                      <Icon className="h-4 w-4 mr-1.5" />
                      {p.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Publish Date</label>
                <Input
                  type="date"
                  value={newPublish.scheduledDate}
                  onChange={(e) => setNewPublish({ ...newPublish, scheduledDate: e.target.value })}
                  data-testid="input-publish-date"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Time</label>
                <Input
                  type="time"
                  value={newPublish.scheduledTime}
                  onChange={(e) => setNewPublish({ ...newPublish, scheduledTime: e.target.value })}
                  data-testid="input-publish-time"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={newPublish.title}
                onChange={(e) => setNewPublish({ ...newPublish, title: e.target.value })}
                placeholder="Episode title for this platform"
                data-testid="input-publish-title"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={newPublish.description}
                onChange={(e) => setNewPublish({ ...newPublish, description: e.target.value })}
                placeholder="Episode description for this platform"
                data-testid="input-publish-description"
              />
            </div>

            <Button
              className="w-full"
              onClick={() => createPublishing.mutate()}
              disabled={!newPublish.episodeId || !newPublish.platform || createPublishing.isPending}
              data-testid="button-submit-publish"
            >
              {createPublishing.isPending ? "Scheduling..." : "Schedule Release"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
