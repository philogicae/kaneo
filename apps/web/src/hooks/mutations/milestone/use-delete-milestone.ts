import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteMilestone from "@/fetchers/milestone/delete-milestone";

function useDeleteMilestone(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteMilestone,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["milestones", projectId],
      });
      // Tasks of the deleted milestone fall back to the no-sprint lane.
      void queryClient.invalidateQueries({
        queryKey: ["tasks", projectId],
      });
    },
  });
}

export default useDeleteMilestone;
