import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Archive, ExternalLink } from "lucide-react";
import { SiYoutube, SiSpotify, SiApplemusic } from "react-icons/si";
import type { Episode, Guest, EpisodePlatformLink } from "@shared/schema";
import { format, parseISO } from "date-fns";
import { useLanguage } from "@/i18n/LanguageProvider";

export default function ArchivedEpisodes() {
  const { t } = useLanguage();

  const { data: episodes, isLoading } = useQuery<Episode[]>({
    queryKey: ["/api/episodes"],
  });
  const { data: guests } = useQuery<Guest[]>({
    queryKey: ["/api/guests"],
  });
  const { data: allPlatformLinks } = useQuery<EpisodePlatformLink[]>({
    queryKey: ["/api/platform-links"],
  });

  const archivedEpisodes = episodes
    ?.filter((e) => e.status === "archived")
    .sort((a, b) => {
      const dateA = a.publishDate ? parseISO(a.publishDate).getTime() : 0;
      const dateB = b.publishDate ? parseISO(b.publishDate).getTime() : 0;
      return dateB - dateA;
    }) || [];

  const getGuest = (ep: Episode) => guests?.find((g) => g.id === ep.guestId);
  const getLinks = (epId: string) => allPlatformLinks?.filter((l) => l.episodeId === epId) || [];

  const platformIcon = (platform: string) => {
    if (platform === "youtube") return <SiYoutube className="w-3.5 h-3.5" />;
    if (platform === "spotify") return <SiSpotify className="w-3.5 h-3.5" />;
    return <SiApplemusic className="w-3.5 h-3.5" />;
  };

  const platformColor = (platform: string) => {
    if (platform === "youtube") return "text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-900";
    if (platform === "spotify") return "text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 border-green-200 dark:border-green-900";
    return "text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950/30 border-pink-200 dark:border-pink-900";
  };

  const platformLabel = (platform: string) => {
    if (platform === "youtube") return t.episodes.youtube;
    if (platform === "spotify") return t.episodes.spotify;
    return t.episodes.appleMusic;
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-archived-title">
          <Archive className="h-6 w-6 text-muted-foreground" />
          {t.nav.archivedEpisodes}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t.episodes.publishedEpisodes}</p>
      </div>

      {archivedEpisodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50 mb-4">
            <Archive className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <p className="text-sm text-muted-foreground" data-testid="text-no-archived">{t.episodes.noArchivedYet}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {archivedEpisodes.map((ep) => {
            const guest = getGuest(ep);
            const links = getLinks(ep.id);
            return (
              <div key={ep.id} className="ios-card p-4 px-5" data-testid={`card-archived-${ep.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {ep.episodeNumber && (
                        <span className="text-[11px] text-muted-foreground font-mono bg-muted/50 rounded-md px-1.5 py-0.5">#{ep.episodeNumber}</span>
                      )}
                      <h3 className="text-sm font-semibold">{guest?.name || ep.title}</h3>
                      <Badge className="bg-muted text-muted-foreground border-0 text-[10px]">{t.episodes.archived}</Badge>
                    </div>
                    {ep.title && guest?.name && (
                      <p className="text-xs text-muted-foreground mt-0.5">{ep.title}</p>
                    )}
                    {ep.publishDate && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t.episodes.publishDateLabel}: {format(parseISO(ep.publishDate), "MMM d, yyyy")}
                        {ep.publishTime && ` · ${ep.publishTime}`}
                      </p>
                    )}
                  </div>
                </div>

                {links.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {links.map((link) => (
                      <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${platformColor(link.platform)}`}
                        data-testid={`link-archived-platform-${link.platform}-${ep.id}`}
                      >
                        {platformIcon(link.platform)}
                        {platformLabel(link.platform)}
                        <ExternalLink className="w-3 h-3 opacity-50" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
