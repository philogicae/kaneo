import { useNavigate } from "@tanstack/react-router";
import { Folder, Mail, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { usePendingInvitations } from "@/hooks/queries/invitation/use-pending-invitations";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";

export function NavMain() {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();
  const navigate = useNavigate();
  const { data: invitations = [] } = usePendingInvitations();

  if (!workspace) return null;

  const pendingCount = invitations.length;

  const navItems = [
    {
      title: t("navigation:sidebar.projects"),
      url: `/dashboard/workspace/${workspace.id}`,
      isActive:
        window.location.pathname === `/dashboard/workspace/${workspace.id}`,
      icon: Folder,
      badge: null,
    },
    {
      title: t("navigation:sidebar.members"),
      url: `/dashboard/workspace/${workspace.id}/members`,
      isActive:
        window.location.pathname ===
        `/dashboard/workspace/${workspace.id}/members`,
      icon: Users,
      badge: null,
    },
    {
      title: t("navigation:sidebar.invitations"),
      url: "/dashboard/invitations",
      isActive: window.location.pathname === "/dashboard/invitations",
      icon: Mail,
      badge: pendingCount > 0 ? pendingCount : null,
    },
  ];

  return (
    <SidebarGroup className="gap-1 p-2">
      <SidebarGroupContent>
        {/* The workspace selector took the "Overview" section label's place;
            its chevron opens the same workspace menu the header trigger had.
            The section items stay visible (no collapse). */}
        <WorkspaceSwitcher />
        <SidebarMenu className="mt-1 gap-0.5">
          {navItems.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton
                tooltip={item.title}
                isActive={item.isActive}
                size="default"
                className="h-8 ps-3.5 text-sm hover:bg-transparent hover:text-sidebar-accent-foreground active:bg-transparent"
                onClick={() => navigate({ to: item.url })}
              >
                <item.icon
                  aria-hidden="true"
                  className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/70"
                />
                <span>{item.title}</span>
                {item.badge !== null && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-sm border border-sidebar-border/60 px-1 text-[11px] font-medium text-sidebar-foreground/80">
                    {item.badge}
                  </span>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
