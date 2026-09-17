import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import getActiveWorkspaceUsers from "@/fetchers/workspace-user/get-active-workspace-users";
import getProjectMembers from "@/fetchers/workspace-user/get-project-members";
import type { WorkspaceUsersPayload } from "@/types/workspace-user";

// Inside a project route the list narrows to the members who can open that
// project, so no picker offers a scoped member work they would be refused on.
// Outside a project route (or with an explicit projectId) the caller decides.
export function useGetActiveWorkspaceUsers(
  workspaceId: string,
  projectId?: string,
) {
  const params = useParams({ strict: false }) as { projectId?: string };
  const scopedProjectId = projectId ?? params.projectId;

  return useQuery<WorkspaceUsersPayload>({
    queryKey: [
      "active-workspace-users",
      workspaceId,
      scopedProjectId ?? "workspace",
    ],
    queryFn: async () =>
      scopedProjectId
        ? await getProjectMembers(scopedProjectId)
        : await getActiveWorkspaceUsers({ workspaceId }),
    enabled: !!workspaceId,
  });
}

export default useGetActiveWorkspaceUsers;
