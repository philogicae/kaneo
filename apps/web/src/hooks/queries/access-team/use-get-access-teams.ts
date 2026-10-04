import { useQuery } from "@tanstack/react-query";
import listAccessTeams from "@/fetchers/access-team/list-access-teams";

function useGetAccessTeams(workspaceId?: string) {
  return useQuery({
    queryFn: () => listAccessTeams(workspaceId),
    queryKey: ["access-teams", workspaceId ?? "all"],
  });
}

export default useGetAccessTeams;
