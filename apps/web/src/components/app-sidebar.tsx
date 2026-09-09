import type * as React from "react";

import { NavMain } from "@/components/nav-main";
import { NavProjects } from "@/components/nav-projects";
import { NavUnified } from "@/components/nav-unified";
import { SidebarHeaderControls } from "@/components/sidebar-header-controls";
import { ThemeToggleDropdown } from "@/components/theme-toggle-dropdown";
import { TrialCard } from "@/components/trial-card";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { UiScaleControl } from "@/components/ui-scale-control";
import { shortcuts } from "@/constants/shortcuts";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";
import Search from "./search";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { toggleSidebar } = useSidebar();

  useRegisterShortcuts({
    modifierShortcuts: {
      [shortcuts.sidebar.prefix]: {
        [shortcuts.sidebar.toggle]: toggleSidebar,
      },
    },
  });

  return (
    <Sidebar
      collapsible="icon"
      variant="inset"
      className="border-none pt-1.5"
      {...props}
    >
      <SidebarHeader className="pt-1 pb-1.5">
        <SidebarHeaderControls />
      </SidebarHeader>
      <SidebarContent className="overflow-hidden gap-1 py-1">
        <Search />
        <NavUnified />
        <NavMain />
        <NavProjects />
      </SidebarContent>
      <SidebarFooter className="group-data-[collapsible=icon]:hidden">
        <TrialCard />
        <div className="flex items-center justify-between">
          <UiScaleControl />
          <ThemeToggleDropdown />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
