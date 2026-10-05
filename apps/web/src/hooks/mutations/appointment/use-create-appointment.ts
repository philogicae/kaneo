import { useMutation, useQueryClient } from "@tanstack/react-query";
import createAppointment, {
  type CreateAppointmentRequest,
} from "@/fetchers/appointment/create-appointment";

function useCreateAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAppointmentRequest) => createAppointment(input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["appointments", variables.projectId],
      });
    },
  });
}

export default useCreateAppointment;
