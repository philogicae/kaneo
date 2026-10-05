import { useMutation } from "@tanstack/react-query";
import createAccessTeam from "@/fetchers/access-team/create-access-team";
import queryClient from "@/query-client";

function useCreateAccessTeam() {
  return useMutation({
    mutationFn: createAccessTeam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-teams"] });
    },
  });
}

export default useCreateAccessTeam;
