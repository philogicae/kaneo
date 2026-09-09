import { useQuery } from "@tanstack/react-query";
import getProjectCharts from "@/fetchers/project/get-project-charts";

function useGetProjectCharts(projectId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["project-charts", projectId],
    queryFn: () => getProjectCharts(projectId as string),
    enabled: !!projectId && enabled,
    staleTime: 1000 * 60, // Chart buckets are weekly; a minute of staleness is fine.
  });
}

export default useGetProjectCharts;
