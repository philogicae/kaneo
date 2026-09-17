import { useMutation } from "@tanstack/react-query";
import updateAccessTeam from "@/fetchers/access-team/update-access-team";
import queryClient from "@/query-client";

function useUpdateAccessTeam() {
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Parameters<typeof updateAccessTeam>[1];
    }) => updateAccessTeam(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-teams"] });
    },
  });
}

export default useUpdateAccessTeam;
