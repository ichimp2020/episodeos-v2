import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Episodes from "@/pages/episodes";
import Team from "@/pages/team";
import Studio from "@/pages/studio";
import Guests from "@/pages/guests";
import Scheduling from "@/pages/scheduling";
import Publish from "@/pages/publish";

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
      <Route component={NotFound} />
    </Switch>
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
        <TooltipProvider>
          <SidebarProvider style={style as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1 min-w-0">
                <header className="glass-header flex items-center justify-between gap-2 px-4 py-2.5 sticky top-0 z-50">
                  <SidebarTrigger className="rounded-xl" data-testid="button-sidebar-toggle" />
                  <ThemeToggle />
                </header>
                <main className="flex-1 overflow-auto">
                  <Router />
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
