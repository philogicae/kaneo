import { useLocation } from "@tanstack/react-router";
import type * as React from "react";
import { useEffect } from "react";

import { NavMain } from "@/components/nav-main";
import { NavProjects } from "@/components/nav-projects";
import { NavUnified } from "@/components/nav-unified";
import { SidebarHeaderControls } from "@/components/sidebar-header-controls";
import { ThemeToggleDropdown } from "@/components/theme-toggle-dropdown";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { UiScaleControl } from "@/components/ui-scale-control";
import Search from "./search";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { setOpenMobile } = useSidebar();
  const pathname = useLocation({ select: (location) => location.pathname });

  // Navigation that doesn't start from a sidebar link (creating a project,
  // the command palette) must still dismiss the mobile drawer.
  useEffect(() => {
    if (pathname) setOpenMobile(false);
  }, [pathname, setOpenMobile]);

  return (
    <Sidebar
      collapsible="icon"
      variant="inset"
      className="border-none"
      {...props}
    >
      <SidebarHeader className="pt-1 pb-1.5">
        <SidebarHeaderControls />
      </SidebarHeader>
      <SidebarContent className="overflow-hidden gap-1 py-1">
        {/* Same horizontal padding as the nav groups so the icon column lines
            up in the collapsed rail and the expanded sidebar. */}
        <div className="px-2 pt-1">
          <Search />
        </div>
        <NavUnified />
        <NavMain />
        <NavProjects />
      </SidebarContent>
      <SidebarFooter className="group-data-[collapsible=icon]:hidden">
        <div className="flex items-center justify-between">
          <UiScaleControl />
          <ThemeToggleDropdown />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
