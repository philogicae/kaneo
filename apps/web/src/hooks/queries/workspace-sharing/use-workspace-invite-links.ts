import { useQuery } from "@tanstack/react-query";
import getWorkspaceInviteLinks from "@/fetchers/workspace-sharing/get-invite-links";

function useWorkspaceInviteLinks(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["workspace-invite-links", workspaceId],
    queryFn: () => getWorkspaceInviteLinks(workspaceId ?? ""),
    enabled: !!workspaceId,
  });
}

export default useWorkspaceInviteLinks;
