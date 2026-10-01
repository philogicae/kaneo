import { useMutation, useQueryClient } from "@tanstack/react-query";
import reorderMilestones from "@/fetchers/milestone/reorder-milestones";

function useReorderMilestones(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (milestones: Array<{ id: string; position: number }>) =>
      reorderMilestones(projectId, milestones),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["milestones", projectId],
      });
    },
  });
}

export default useReorderMilestones;
