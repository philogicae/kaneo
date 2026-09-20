import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateTaskMilestone from "@/fetchers/task/update-task-milestone";

function useUpdateTaskMilestone(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      milestoneId,
    }: {
      taskId: string;
      milestoneId: string | null;
    }) => updateTaskMilestone(taskId, milestoneId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["tasks", projectId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["milestones", projectId],
      });
    },
  });
}

export default useUpdateTaskMilestone;
