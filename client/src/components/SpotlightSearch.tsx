import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/i18n/LanguageProvider";
import { Search, UserPlus, Mic, Users, CalendarClock, Calendar, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
  url: string;
}

const typeIcons: Record<string, typeof Search> = {
  guest: UserPlus,
  episode: Mic,
  team: Users,
  interview: CalendarClock,
  studio: Calendar,
};

const typeColors: Record<string, string> = {
  guest: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  episode: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  team: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  interview: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  studio: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

export function SpotlightSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t, isRTL } = useLanguage();
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
        setSelectedIndex(0);
      }
    } catch (e) {
      console.error("Search error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 200);
  };

  const navigateToResult = (result: SearchResult) => {
    setLocation(result.url);
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      navigateToResult(results[selectedIndex]);
    }
  };

  const typeLabel = (type: string) => {
    const labels: Record<string, string> = {
      guest: t.search.guests,
      episode: t.search.episodes,
      team: t.search.team,
      interview: t.search.interviews,
      studio: t.search.studio,
    };
    return labels[type] || type;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 max-w-[560px] rounded-2xl border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl overflow-hidden [&>button]:hidden"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40">
          <Search className="h-5 w-5 text-muted-foreground/60 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.search.placeholder}
            className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/50"
            data-testid="input-spotlight-search"
          />
          {query && (
            <button onClick={() => { setQuery(""); setResults([]); }} className="p-1 rounded-lg hover:bg-muted/60 transition-colors" data-testid="button-clear-search">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex h-6 items-center gap-1 rounded-md border bg-muted/40 px-1.5 text-[10px] font-medium text-muted-foreground/60">
            ESC
          </kbd>
        </div>

        <div className="max-h-[360px] overflow-y-auto">
          {!query && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50">
              <Search className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">{t.search.typeToSearch}</p>
            </div>
          )}

          {query && !loading && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50">
              <p className="text-sm">{t.search.noResults}</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="py-2">
              {results.map((result, index) => {
                const Icon = typeIcons[result.type] || Search;
                return (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => navigateToResult(result)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 text-start transition-colors",
                      index === selectedIndex
                        ? "bg-primary/8 dark:bg-primary/12"
                        : "hover:bg-muted/40"
                    )}
                    data-testid={`search-result-${result.type}-${result.id}`}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div className={cn("flex items-center justify-center h-8 w-8 rounded-xl shrink-0", typeColors[result.type] || "bg-muted")}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{result.title}</p>
                      {result.subtitle && (
                        <p className="text-xs text-muted-foreground/60 truncate mt-0.5">{result.subtitle}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {result.status && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground/70 capitalize">
                          {result.status}
                        </span>
                      )}
                      <span className="text-[10px] font-medium text-muted-foreground/40">{typeLabel(result.type)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-t border-border/30 bg-muted/20">
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground/40">
            <span>↑↓ navigate</span>
            <span>↵ select</span>
            <span>esc close</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
