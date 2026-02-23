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
import { Plus, Upload, Trash2, CheckCircle, ExternalLink, Pencil, Check, X, Globe, ChevronRight } from "lucide-react";
import { SiSpotify, SiYoutube, SiApplemusic } from "react-icons/si";
import type { Publishing, Episode, EpisodePlatformLink } from "@shared/schema";
import { format, parseISO } from "date-fns";
import { useLanguage } from "@/i18n/LanguageProvider";
import { publishingStatusColors, getPublishingStatusLabel } from "@/lib/statusColors";

const platforms = [
  { value: "spotify", label: "Spotify", icon: SiSpotify, color: "#1DB954" },
  { value: "youtube", label: "YouTube", icon: SiYoutube, color: "#FF0000" },
  { value: "apple", label: "Apple Music", icon: SiApplemusic, color: "#FA243C" },
];

const pubStatuses = ["scheduled", "published", "failed"];

export default function Publish() {
  const { t } = useLanguage();
  const [showNewPublish, setShowNewPublish] = useState(false);
  const [editingPublish, setEditingPublish] = useState<Publishing | null>(null);
  const [editPubValues, setEditPubValues] = useState({ title: "", description: "", scheduledDate: "", scheduledTime: "", externalUrl: "", status: "" });
  const [addingPlatformLink, setAddingPlatformLink] = useState<{ episodeId: string; platform: string } | null>(null);
  const [platformLinkUrl, setPlatformLinkUrl] = useState("");
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
  const { data: allPlatformLinks } = useQuery<EpisodePlatformLink[]>({
    queryKey: ["/api/platform-links"],
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

  const updatePublishing = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      await apiRequest("PATCH", `/api/publishing/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/publishing"] });
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const openEditPublish = (pub: Publishing) => {
    setEditPubValues({
      title: pub.title || "",
      description: pub.description || "",
      scheduledDate: pub.scheduledDate || "",
      scheduledTime: pub.scheduledTime || "",
      externalUrl: pub.externalUrl || "",
      status: pub.status,
    });
    setEditingPublish(pub);
  };

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
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-publishing-title">{t.publishing.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.publishing.subtitle}</p>
        </div>
        <Button className="rounded-full px-5 shadow-md" onClick={() => setShowNewPublish(true)} data-testid="button-new-publish">
          <Plus className="h-4 w-4" />
          {t.publishing.scheduleRelease}
        </Button>
      </div>

      {(!allPublishing || allPublishing.length === 0) ? (
        <div className="ios-section">
          <div className="flex flex-col items-center justify-center py-16 px-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/50 mb-3">
              <Upload className="h-6 w-6 text-muted-foreground/60" />
            </div>
            <p className="text-muted-foreground font-medium">{t.publishing.noReleases}</p>
            <p className="text-sm text-muted-foreground mt-1">{t.publishing.scheduleFirst}</p>
            <Button className="rounded-full px-5 shadow-md mt-4" onClick={() => setShowNewPublish(true)} data-testid="button-create-first-publish">
              <Plus className="h-4 w-4" />
              {t.publishing.scheduleRelease}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {scheduled.length > 0 && (
            <div>
              <div className="ios-section-header flex items-center gap-2 mb-3 px-0">
                <h2 className="ios-section-title">{t.publishing.scheduled}</h2>
                <Badge variant="secondary" className="ios-badge border-0 text-xs">{scheduled.length}</Badge>
              </div>
              <div className="space-y-3">
                {scheduled.map((pub) => {
                  const ep = getEpisode(pub.episodeId);
                  const platform = getPlatformInfo(pub.platform);
                  const PlatformIcon = platform?.icon || Upload;
                  const epLinks = allPlatformLinks?.filter((l) => l.episodeId === pub.episodeId) || [];
                  return (
                    <div
                      key={pub.id}
                      className="ios-card cursor-pointer p-4 px-5 group relative"
                      onClick={() => openEditPublish(pub)}
                      data-testid={`card-publishing-${pub.id}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {ep?.episodeNumber && (
                              <span className="text-[11px] text-muted-foreground font-mono bg-muted/50 rounded-md px-1.5 py-0.5">#{ep.episodeNumber}</span>
                            )}
                            <h3 className="text-sm font-semibold">{pub.title || ep?.title || t.publishing.titlePlaceholder}</h3>
                            <Badge className={`ios-badge border-0 ${publishingStatusColors[pub.status]}`}>
                              {getPublishingStatusLabel(t, pub.status)}
                            </Badge>
                            <Badge variant="secondary" className="ios-badge border-0 gap-1" style={{ color: platform?.color }}>
                              <PlatformIcon className="w-3 h-3" />
                              {platform?.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-2 flex-wrap">
                            <span className={`text-xs ${!pub.scheduledDate ? "text-muted-foreground/50 italic" : "text-muted-foreground"}`}>
                              {pub.scheduledDate
                                ? <>{format(parseISO(pub.scheduledDate), "MMM d, yyyy")}{pub.scheduledTime ? ` at ${pub.scheduledTime}` : ""}</>
                                : t.dashboard.noDateSet}
                            </span>
                          </div>
                          {pub.episodeId && epLinks.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                              {(["youtube", "spotify", "apple-music"] as const).map((plat) => {
                                const existing = epLinks.find((l) => l.platform === plat);
                                if (!existing) return null;
                                const Icon = plat === "youtube" ? SiYoutube : plat === "spotify" ? SiSpotify : SiApplemusic;
                                const label = plat === "youtube" ? "YouTube" : plat === "spotify" ? "Spotify" : "Apple Music";
                                const colors = plat === "youtube" ? "text-red-600" : plat === "spotify" ? "text-green-600" : "text-pink-600";
                                return (
                                  <a
                                    key={plat}
                                    href={existing.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border ${colors} transition-colors`}
                                    onClick={(e) => e.stopPropagation()}
                                    data-testid={`link-pub-platform-${plat}-${pub.id}`}
                                  >
                                    <Icon className="w-3 h-3" />
                                    {label}
                                    <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                                  </a>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); updatePublishing.mutate({ id: pub.id, data: { status: "published" } }); }}
                            data-testid={`button-mark-published-${pub.id}`}
                          >
                            <CheckCircle className="h-4 w-4 text-chart-2" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => { e.stopPropagation(); deletePublishing.mutate(pub.id); }}
                            data-testid={`button-delete-publishing-${pub.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {published.length > 0 && (
            <div>
              <div className="ios-section-header flex items-center gap-2 mb-3 px-0">
                <h2 className="ios-section-title">{t.publishing.publishedLabel}</h2>
                <Badge variant="secondary" className="ios-badge border-0 text-xs">{published.length}</Badge>
              </div>
              <div className="space-y-3">
                {published.map((pub) => {
                  const ep = getEpisode(pub.episodeId);
                  const platform = getPlatformInfo(pub.platform);
                  const PlatformIcon = platform?.icon || Upload;
                  const epLinks = allPlatformLinks?.filter((l) => l.episodeId === pub.episodeId) || [];
                  return (
                    <div
                      key={pub.id}
                      className="ios-card cursor-pointer p-4 px-5 group relative opacity-70"
                      onClick={() => openEditPublish(pub)}
                      data-testid={`card-publishing-${pub.id}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {ep?.episodeNumber && (
                              <span className="text-[11px] text-muted-foreground font-mono bg-muted/50 rounded-md px-1.5 py-0.5">#{ep.episodeNumber}</span>
                            )}
                            <h3 className="text-sm font-semibold">{pub.title || ep?.title || t.publishing.titlePlaceholder}</h3>
                            <Badge className={`ios-badge border-0 ${publishingStatusColors[pub.status]}`}>
                              {getPublishingStatusLabel(t, pub.status)}
                            </Badge>
                            <Badge variant="secondary" className="ios-badge border-0 gap-1" style={{ color: platform?.color }}>
                              <PlatformIcon className="w-3 h-3" />
                              {platform?.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-2 flex-wrap">
                            <span className={`text-xs ${pub.scheduledDate ? "text-muted-foreground" : "text-muted-foreground/50 italic"}`}>
                              {pub.scheduledDate ? format(parseISO(pub.scheduledDate), "MMM d, yyyy") : t.dashboard.noDateSet}
                            </span>
                          </div>
                          {pub.episodeId && epLinks.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                              {(["youtube", "spotify", "apple-music"] as const).map((plat) => {
                                const existing = epLinks.find((l) => l.platform === plat);
                                if (!existing) return null;
                                const Icon = plat === "youtube" ? SiYoutube : plat === "spotify" ? SiSpotify : SiApplemusic;
                                const label = plat === "youtube" ? "YouTube" : plat === "spotify" ? "Spotify" : "Apple Music";
                                const colors = plat === "youtube" ? "text-red-600" : plat === "spotify" ? "text-green-600" : "text-pink-600";
                                return (
                                  <a
                                    key={plat}
                                    href={existing.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border ${colors} transition-colors`}
                                    onClick={(e) => e.stopPropagation()}
                                    data-testid={`link-pub-platform-${plat}-${pub.id}`}
                                  >
                                    <Icon className="w-3 h-3" />
                                    {label}
                                    <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                                  </a>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => { e.stopPropagation(); deletePublishing.mutate(pub.id); }}
                            data-testid={`button-delete-publishing-${pub.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={!!editingPublish} onOpenChange={(open) => { if (!open) setEditingPublish(null); }}>
        <DialogContent className="max-w-lg">
          {editingPublish && (
            <>
              <DialogHeader>
                <DialogTitle>{t.publishing.editRelease}</DialogTitle>
                <DialogDescription>{t.publishing.updateDetails}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t.publishing.status}</label>
                  <Select value={editPubValues.status} onValueChange={(val) => setEditPubValues({ ...editPubValues, status: val })}>
                    <SelectTrigger data-testid="select-edit-pub-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {pubStatuses.map((s) => (
                        <SelectItem key={s} value={s}>{getPublishingStatusLabel(t, s)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t.publishing.titleLabel}</label>
                  <Input
                    value={editPubValues.title}
                    onChange={(e) => setEditPubValues({ ...editPubValues, title: e.target.value })}
                    data-testid="input-edit-pub-title"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t.publishing.descriptionLabel}</label>
                  <Textarea
                    value={editPubValues.description}
                    onChange={(e) => setEditPubValues({ ...editPubValues, description: e.target.value })}
                    rows={3}
                    data-testid="input-edit-pub-description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t.publishing.publishDate}</label>
                    <Input
                      type="date"
                      value={editPubValues.scheduledDate}
                      onChange={(e) => setEditPubValues({ ...editPubValues, scheduledDate: e.target.value })}
                      data-testid="input-edit-pub-date"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t.publishing.time}</label>
                    <Input
                      type="time"
                      value={editPubValues.scheduledTime}
                      onChange={(e) => setEditPubValues({ ...editPubValues, scheduledTime: e.target.value })}
                      data-testid="input-edit-pub-time"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t.publishing.externalUrl}</label>
                  <Input
                    value={editPubValues.externalUrl}
                    onChange={(e) => setEditPubValues({ ...editPubValues, externalUrl: e.target.value })}
                    placeholder={t.publishing.externalUrlPlaceholder}
                    data-testid="input-edit-pub-url"
                  />
                </div>
                {editingPublish.episodeId && (() => {
                  const epLinks = allPlatformLinks?.filter((l) => l.episodeId === editingPublish.episodeId) || [];
                  return (
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        {t.episodes.platformLinks}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {(["youtube", "spotify", "apple-music"] as const).map((plat) => {
                          const existing = epLinks.find((l) => l.platform === plat);
                          const Icon = plat === "youtube" ? SiYoutube : plat === "spotify" ? SiSpotify : SiApplemusic;
                          const label = plat === "youtube" ? "YouTube" : plat === "spotify" ? "Spotify" : "Apple Music";
                          const colors = plat === "youtube" ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" : plat === "spotify" ? "text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30" : "text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950/30";
                          return existing ? (
                            <a
                              key={plat}
                              href={existing.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${colors} transition-colors`}
                              data-testid={`link-edit-platform-${plat}`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              {label}
                              <ExternalLink className="w-3 h-3 opacity-50" />
                            </a>
                          ) : addingPlatformLink?.episodeId === editingPublish.episodeId && addingPlatformLink?.platform === plat ? (
                            <div key={plat} className="flex items-center gap-1.5">
                              <Input
                                placeholder={`${label} URL`}
                                value={platformLinkUrl}
                                onChange={(e) => setPlatformLinkUrl(e.target.value)}
                                className="h-7 text-xs w-40"
                                autoFocus
                                data-testid={`input-edit-platform-url-${plat}`}
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                disabled={!platformLinkUrl}
                                onClick={async () => {
                                  try {
                                    await apiRequest("POST", `/api/episodes/${editingPublish.episodeId}/platform-links`, { platform: plat, url: platformLinkUrl });
                                    queryClient.invalidateQueries({ queryKey: ["/api/platform-links"] });
                                    queryClient.invalidateQueries({ queryKey: ["/api/episodes", editingPublish.episodeId, "platform-links"] });
                                    setAddingPlatformLink(null);
                                    setPlatformLinkUrl("");
                                    toast({ title: `${label} link added` });
                                  } catch { toast({ title: "Failed to add link", variant: "destructive" }); }
                                }}
                                data-testid={`button-save-edit-platform-${plat}`}
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setAddingPlatformLink(null); setPlatformLinkUrl(""); }}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              key={plat}
                              variant="outline"
                              size="sm"
                              className={`gap-1.5 rounded-full text-xs ${colors}`}
                              onClick={() => { setAddingPlatformLink({ episodeId: editingPublish.episodeId, platform: plat }); setPlatformLinkUrl(""); }}
                              data-testid={`button-add-edit-platform-${plat}`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              <Plus className="w-3 h-3" />
                              {label}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
                <Button
                  className="w-full rounded-full px-5 shadow-md"
                  onClick={() => {
                    updatePublishing.mutate({
                      id: editingPublish.id,
                      data: {
                        title: editPubValues.title || null,
                        description: editPubValues.description || null,
                        scheduledDate: editPubValues.scheduledDate || null,
                        scheduledTime: editPubValues.scheduledTime || null,
                        externalUrl: editPubValues.externalUrl || null,
                        status: editPubValues.status,
                      },
                    });
                    setEditingPublish(null);
                  }}
                  disabled={updatePublishing.isPending}
                  data-testid="button-save-edit-publish"
                >
                  {updatePublishing.isPending ? t.publishing.saving : t.episodes.saveChanges}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showNewPublish} onOpenChange={setShowNewPublish}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.publishing.scheduleRelease}</DialogTitle>
            <DialogDescription>{t.publishing.scheduleEpisode}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t.publishing.episode}</label>
              <Select value={newPublish.episodeId} onValueChange={selectEpisode}>
                <SelectTrigger data-testid="select-publish-episode">
                  <SelectValue placeholder={t.publishing.selectEpisode} />
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
              <label className="text-sm font-medium">{t.publishing.platform}</label>
              <div className="flex gap-2">
                {platforms.map((p) => {
                  const Icon = p.icon;
                  return (
                    <Button
                      key={p.value}
                      variant={newPublish.platform === p.value ? "default" : "secondary"}
                      className={`rounded-full px-5 ${newPublish.platform === p.value ? "shadow-md" : ""}`}
                      onClick={() => setNewPublish({ ...newPublish, platform: p.value })}
                      data-testid={`button-platform-${p.value}`}
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
                <label className="text-sm font-medium">{t.publishing.publishDate}</label>
                <Input
                  type="date"
                  value={newPublish.scheduledDate}
                  onChange={(e) => setNewPublish({ ...newPublish, scheduledDate: e.target.value })}
                  data-testid="input-publish-date"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t.publishing.time}</label>
                <Input
                  type="time"
                  value={newPublish.scheduledTime}
                  onChange={(e) => setNewPublish({ ...newPublish, scheduledTime: e.target.value })}
                  data-testid="input-publish-time"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t.publishing.titleLabel}</label>
              <Input
                value={newPublish.title}
                onChange={(e) => setNewPublish({ ...newPublish, title: e.target.value })}
                placeholder={t.publishing.titlePlaceholder}
                data-testid="input-publish-title"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t.publishing.descriptionLabel}</label>
              <Textarea
                value={newPublish.description}
                onChange={(e) => setNewPublish({ ...newPublish, description: e.target.value })}
                placeholder={t.publishing.descriptionPlaceholder}
                data-testid="input-publish-description"
              />
            </div>

            <Button
              className="w-full rounded-full px-5 shadow-md"
              onClick={() => createPublishing.mutate()}
              disabled={!newPublish.episodeId || !newPublish.platform || createPublishing.isPending}
              data-testid="button-submit-publish"
            >
              {createPublishing.isPending ? t.publishing.scheduling : t.publishing.scheduleRelease}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
