import { useMutation } from "@tanstack/react-query";
import { acceptWorkspaceInviteLink } from "@/fetchers/workspace-sharing/accept-invite-link";
import queryClient from "@/query-client";

function useAcceptWorkspaceInviteLink() {
  return useMutation({
    mutationFn: (token: string) => acceptWorkspaceInviteLink(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-users"] });
    },
  });
}

export default useAcceptWorkspaceInviteLink;
