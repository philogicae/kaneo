import type { QueryClient } from "@tanstack/react-query";
import getTasks from "@/fetchers/task/get-tasks";

export function prefetchBoard(queryClient: QueryClient, projectId: string) {
  if (queryClient.getQueryData(["tasks", projectId]) !== undefined) return;
  return queryClient.prefetchQuery({
    queryKey: ["tasks", projectId],
    queryFn: () => getTasks(projectId),
  });
}
