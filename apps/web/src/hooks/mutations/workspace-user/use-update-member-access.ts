import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateMemberAccess from "@/fetchers/workspace-user/update-member-access";

type UpdateMemberAccessRequest = {
  workspaceId: string;
  userId: string;
  allProjects: boolean;
  projectIds: string[];
};

function useUpdateMemberAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      workspaceId,
      userId,
      allProjects,
      projectIds,
    }: UpdateMemberAccessRequest) =>
      updateMemberAccess(workspaceId, userId, { allProjects, projectIds }),
    onSuccess: (data, variables) => {
      // The dialog reads this exact key; the member's own session picks the
      // new scope up on its next request.
      queryClient.setQueryData(
        ["member-access", variables.workspaceId, variables.userId],
        data,
      );
    },
  });
}

export default useUpdateMemberAccess;
