import { useQuery } from "@tanstack/react-query";
import getMemberAccess from "@/fetchers/workspace-user/get-member-access";

function useGetMemberAccess(
  workspaceId: string | undefined,
  userId: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["member-access", workspaceId, userId],
    enabled: Boolean(enabled && workspaceId && userId),
    queryFn: () => getMemberAccess(workspaceId as string, userId as string),
  });
}

export default useGetMemberAccess;
