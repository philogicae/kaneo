import { useMutation } from "@tanstack/react-query";
import deleteAccessTeam from "@/fetchers/access-team/delete-access-team";
import queryClient from "@/query-client";

function useDeleteAccessTeam() {
  return useMutation({
    mutationFn: deleteAccessTeam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-teams"] });
    },
  });
}

export default useDeleteAccessTeam;
