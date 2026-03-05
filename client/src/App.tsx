import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { LanguageToggle } from "@/components/language-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SpotlightSearch } from "@/components/SpotlightSearch";
import { AIAssistant } from "@/components/AIAssistant";
import { Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Episodes from "@/pages/episodes";
import Team from "@/pages/team";
import Studio from "@/pages/studio";
import Guests from "@/pages/guests";
import Scheduling from "@/pages/scheduling";
import Publish from "@/pages/publish";
import BackOffice from "@/pages/backoffice";
import ArchivedEpisodes from "@/pages/archived";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/episodes" component={Episodes} />
      <Route path="/team" component={Team} />
      <Route path="/studio" component={Studio} />
      <Route path="/guests" component={Guests} />
      <Route path="/scheduling" component={Scheduling} />
      <Route path="/publishing" component={Publish} />
      <Route path="/archived" component={ArchivedEpisodes} />
      <Route path="/backoffice" component={BackOffice} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="glass-header flex items-center justify-between gap-2 px-4 py-2.5 sticky top-0 z-50">
            <SidebarTrigger className="rounded-xl" data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchOpen(true)}
                className="rounded-xl h-8 gap-2 text-muted-foreground/70 hover:text-foreground px-2.5"
                data-testid="button-open-search"
              >
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">Search</span>
                <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border bg-muted/40 px-1 text-[10px] font-medium text-muted-foreground/50">
                  ⌘K
                </kbd>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAiOpen(true)}
                className="rounded-xl h-8 gap-1.5 text-muted-foreground/70 hover:text-foreground px-2.5"
                data-testid="button-open-ai"
              >
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">AI</span>
              </Button>
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Router />
          </main>
          {import.meta.env.DEV && (
            <footer className="text-[10px] text-muted-foreground/40 text-center py-1 select-none" data-testid="text-ui-build-marker">
              DEV BUILD
            </footer>
          )}
        </div>
      </div>
      <SpotlightSearch open={searchOpen} onOpenChange={setSearchOpen} />
      <AIAssistant open={aiOpen} onOpenChange={setAiOpen} />
    </>
  );
}

function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <TooltipProvider>
            <SidebarProvider style={style as React.CSSProperties}>
              <AppContent />
            </SidebarProvider>
            <Toaster />
          </TooltipProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
