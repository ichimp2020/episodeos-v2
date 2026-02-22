import { LayoutDashboard, Mic, Users, Calendar, UserPlus, CalendarClock, Upload, FolderOpen, Archive } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useLanguage } from "@/i18n/LanguageProvider";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const [location] = useLocation();
  const { t } = useLanguage();

  const mainNav = [
    { title: t.nav.dashboard, url: "/", icon: LayoutDashboard },
    { title: t.nav.episodes, url: "/episodes", icon: Mic },
    { title: t.nav.team, url: "/team", icon: Users },
  ];

  const workflowNav = [
    { title: t.nav.guests, url: "/guests", icon: UserPlus },
    { title: t.nav.scheduling, url: "/scheduling", icon: CalendarClock },
    { title: t.nav.studioCalendar, url: "/studio", icon: Calendar },
    { title: t.nav.publishing, url: "/publishing", icon: Upload },
  ];

  const backOfficeNav = [
    { title: t.nav.archivedEpisodes, url: "/archived", icon: Archive },
    { title: t.nav.googleDriveLinks, url: "/backoffice", icon: FolderOpen },
  ];

  const renderNavItem = (item: { title: string; url: string; icon: typeof LayoutDashboard }) => {
    const isActive = location === item.url;
    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton
          asChild
          isActive={isActive}
          tooltip={item.title}
          className={`rounded-xl h-10 transition-all duration-200 ${
            isActive
              ? "bg-primary/10 text-primary font-semibold shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.15)]"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase().replace(/\s/g, "-")}`}>
            <item.icon className={`h-[18px] w-[18px] transition-colors duration-200 ${isActive ? "text-primary" : ""}`} />
            <span className="tracking-tight">{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-gradient-to-br from-primary via-primary to-primary/70 shadow-lg" style={{ boxShadow: '0 4px 16px hsl(217 91% 50% / 0.35), 0 2px 4px hsl(217 91% 50% / 0.2)' }}>
            <Mic className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold tracking-tight leading-tight" data-testid="text-app-title">{t.app.title}</h2>
            <p className="text-[11px] text-muted-foreground/70 font-medium leading-tight mt-0.5">{t.app.subtitle}</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 pt-1">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.08em] font-semibold text-muted-foreground/50 px-3 mb-1.5">{t.nav.overview}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {mainNav.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mx-3 my-2">
          <div className="h-px bg-border/60" />
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.08em] font-semibold text-muted-foreground/50 px-3 mb-1.5">{t.nav.workflow}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {workflowNav.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mx-3 my-2">
          <div className="h-px bg-border/60" />
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.08em] font-semibold text-muted-foreground/50 px-3 mb-1.5">{t.nav.backOffice}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {backOfficeNav.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-5 pb-5 pt-3">
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-muted/40">
          <div className="h-2 w-2 rounded-full bg-chart-2 animate-pulse" />
          <p className="text-[11px] font-medium text-muted-foreground/70">{t.app.footer}</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
