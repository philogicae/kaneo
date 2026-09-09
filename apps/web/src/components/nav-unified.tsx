import { useNavigate } from "@tanstack/react-router";
import { LayoutGrid } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function NavUnified() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const url = "/";

  return (
    <SidebarGroup className="gap-1 p-2 pt-1">
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={t("unified:pageTitle")}
              isActive={window.location.pathname === url}
              size="default"
              className="h-8 ps-3.5 text-sm hover:bg-transparent hover:text-sidebar-accent-foreground active:bg-transparent"
              onClick={() => navigate({ to: url })}
            >
              <LayoutGrid className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/70" />
              <span>{t("unified:pageTitle")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
