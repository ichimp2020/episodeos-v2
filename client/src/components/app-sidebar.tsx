import { LayoutDashboard, Mic, Users, Calendar, UserPlus, CalendarClock, Upload, Sparkles, FolderOpen } from "lucide-react";
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
  SidebarSeparator,
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
    { title: t.nav.googleDriveLinks, url: "/backoffice", icon: FolderOpen },
  ];

  return (
    <Sidebar>
      <SidebarHeader className="p-5 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-md" style={{ boxShadow: '0 4px 14px hsl(217 91% 50% / 0.3)' }}>
            <Mic className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight" data-testid="text-app-title">{t.app.title}</h2>
            <p className="text-[11px] text-muted-foreground font-medium">{t.app.subtitle}</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70 px-3 mb-1">{t.nav.overview}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    tooltip={item.title}
                    className="rounded-xl"
                  >
                    <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase().replace(/\s/g, "-")}`}>
                      <item.icon className="h-[18px] w-[18px]" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70 px-3 mb-1">{t.nav.workflow}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {workflowNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    tooltip={item.title}
                    className="rounded-xl"
                  >
                    <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase().replace(/\s/g, "-")}`}>
                      <item.icon className="h-[18px] w-[18px]" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70 px-3 mb-1">{t.nav.backOffice}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {backOfficeNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    tooltip={item.title}
                    className="rounded-xl"
                  >
                    <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase().replace(/\s/g, "-")}`}>
                      <item.icon className="h-[18px] w-[18px]" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div className="flex items-center gap-2 px-2 py-2 rounded-xl bg-primary/5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <p className="text-[11px] font-medium text-muted-foreground">{t.app.footer}</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
