import { useQuery } from "@tanstack/react-query";
import getMilestones from "@/fetchers/milestone/get-milestones";

function useGetMilestones(projectId: string) {
  return useQuery({
    enabled: Boolean(projectId),
    queryKey: ["milestones", projectId],
    queryFn: () => getMilestones(projectId),
  });
}

export default useGetMilestones;
