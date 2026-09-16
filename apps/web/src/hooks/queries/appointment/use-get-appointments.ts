import { useQuery } from "@tanstack/react-query";
import getAppointments from "@/fetchers/appointment/get-appointments";

function useGetAppointments(projectId: string | undefined) {
  return useQuery({
    queryKey: ["appointments", projectId],
    queryFn: () => getAppointments(projectId as string),
    enabled: !!projectId,
  });
}

export default useGetAppointments;
