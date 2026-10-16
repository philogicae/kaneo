import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateAppointment, {
  type UpdateAppointmentRequest,
} from "@/fetchers/appointment/update-appointment";

function useUpdateAppointment(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...input }: UpdateAppointmentRequest & { id: string }) =>
      updateAppointment(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["appointments", projectId],
      });
    },
  });
}

export default useUpdateAppointment;
