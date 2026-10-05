import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { buildSettingsNav } from "@/components/settings/nav/build-settings-nav";
import useAdminAccess from "@/hooks/queries/admin/use-admin-access";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

export function useSettingsNav() {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();
  const { data: projects } = useGetProjects({
    workspaceId: workspace?.id ?? "",
  });
  const { data: hasAdminAccess } = useAdminAccess();
  const { canInviteUsers } = useWorkspacePermission();
  const canInvite = canInviteUsers();

  return useMemo(
    () =>
      buildSettingsNav({
        t,
        workspaceName: workspace?.name,
        // Billing is upstream cloud-only; this fork has no billing surface.
        billingEnabled: false,
        hasAdminAccess: Boolean(hasAdminAccess),
        canInviteUsers: canInvite,
        projects: projects ?? [],
      }),
    [t, workspace?.name, hasAdminAccess, canInvite, projects],
  );
}
