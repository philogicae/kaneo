import { useMutation } from "@tanstack/react-query";
import { deleteWorkspaceInviteLink } from "@/fetchers/workspace-sharing/delete-invite-link";
import queryClient from "@/query-client";

interface UseDeleteWorkspaceInviteLinkOptions {
  workspaceId?: string;
}

function useDeleteWorkspaceInviteLink({
  workspaceId,
}: UseDeleteWorkspaceInviteLinkOptions = {}) {
  return useMutation({
    mutationFn: (linkId: string) =>
      deleteWorkspaceInviteLink({ workspaceId: workspaceId ?? "", id: linkId }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["workspace-invite-links", workspaceId],
      });
    },
  });
}

export default useDeleteWorkspaceInviteLink;
