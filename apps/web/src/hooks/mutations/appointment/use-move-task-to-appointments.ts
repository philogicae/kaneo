import { useMutation, useQueryClient } from "@tanstack/react-query";
import moveTaskToAppointments from "@/fetchers/appointment/move-task-to-appointments";

function useMoveTaskToAppointments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId }: { taskId: string; projectId: string }) =>
      moveTaskToAppointments(taskId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["appointments", variables.projectId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["tasks", variables.projectId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["projects"],
      });
    },
  });
}

export default useMoveTaskToAppointments;
