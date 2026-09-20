import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateMilestone from "@/fetchers/milestone/update-milestone";

function useUpdateMilestone(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateMilestone,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["milestones", projectId],
      });
    },
  });
}

export default useUpdateMilestone;
