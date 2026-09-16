import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteAppointment from "@/fetchers/appointment/delete-appointment";

function useDeleteAppointment(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteAppointment(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["appointments", projectId],
      });
    },
  });
}

export default useDeleteAppointment;
