import { useMutation } from "@tanstack/react-query";
import type { CreateWorkspaceInviteLinkRequest } from "@/fetchers/workspace-sharing/create-invite-link";
import { createWorkspaceInviteLink } from "@/fetchers/workspace-sharing/create-invite-link";
import queryClient from "@/query-client";

function useCreateWorkspaceInviteLink() {
  return useMutation({
    mutationFn: (request: CreateWorkspaceInviteLinkRequest) =>
      createWorkspaceInviteLink(request),
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({
        queryKey: ["workspace-invite-links", workspaceId],
      });
    },
  });
}

export default useCreateWorkspaceInviteLink;
