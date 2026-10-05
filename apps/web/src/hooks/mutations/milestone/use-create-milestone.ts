import { useMutation, useQueryClient } from "@tanstack/react-query";
import createMilestone from "@/fetchers/milestone/create-milestone";

function useCreateMilestone(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createMilestone,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["milestones", projectId],
      });
    },
  });
}

export default useCreateMilestone;
