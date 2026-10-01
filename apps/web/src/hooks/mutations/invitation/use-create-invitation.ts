import { useMutation } from "@tanstack/react-query";
import createInvitation from "@/fetchers/invitation/create-invitation";
import queryClient from "@/query-client";

function useCreateInvitation() {
  return useMutation({
    mutationFn: createInvitation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-teams"] });
    },
  });
}

export default useCreateInvitation;
