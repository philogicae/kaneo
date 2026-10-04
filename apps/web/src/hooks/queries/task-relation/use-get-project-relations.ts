import { useQuery } from "@tanstack/react-query";
import getProjectRelations from "@/fetchers/task-relation/get-project-relations";

function useGetProjectRelations(projectId: string) {
  return useQuery({
    enabled: Boolean(projectId),
    queryKey: ["task-relations", "project", projectId],
    queryFn: () => getProjectRelations(projectId),
    retry: false,
  });
}

export default useGetProjectRelations;
