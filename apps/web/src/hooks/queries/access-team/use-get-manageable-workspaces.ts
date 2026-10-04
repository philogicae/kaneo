import { useQuery } from "@tanstack/react-query";
import listManageableWorkspaces from "@/fetchers/access-team/list-manageable-workspaces";

function useGetManageableWorkspaces() {
  return useQuery({
    queryFn: () => listManageableWorkspaces(),
    queryKey: ["manageable-workspaces"],
    staleTime: 1000 * 60,
  });
}

export default useGetManageableWorkspaces;
