import { useQuery } from "@tanstack/react-query";
import getWorkspaceInviteLinkDetails from "@/fetchers/workspace-sharing/get-invite-link-details";

function useGetWorkspaceInviteLinkDetails(token: string | undefined) {
  return useQuery({
    queryKey: ["workspace-invite-link-details", token],
    queryFn: () => getWorkspaceInviteLinkDetails(token ?? ""),
    enabled: !!token,
  });
}

export default useGetWorkspaceInviteLinkDetails;
