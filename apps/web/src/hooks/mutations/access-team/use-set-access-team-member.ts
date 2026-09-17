import { useMutation } from "@tanstack/react-query";
import setAccessTeamMember from "@/fetchers/access-team/set-access-team-member";
import queryClient from "@/query-client";

function useSetAccessTeamMember() {
  return useMutation({
    mutationFn: ({
      id,
      userId,
      action,
    }: {
      id: string;
      userId: string;
      action: "add" | "remove";
    }) => setAccessTeamMember(id, userId, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-teams"] });
    },
  });
}

export default useSetAccessTeamMember;
