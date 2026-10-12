import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export type GetProjectMembersRequest = {
  workspaceId: string;
  projectId: string;
};

// The project route answers with the members the fork's access model grants
// (teams and direct grants); the workspace route filters by the newer
// per-member project access rows, which hides team-granted members.
async function getProjectMembers({ projectId }: GetProjectMembersRequest) {
  const response = await client.project[":id"].members.$get({
    param: { id: projectId },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default getProjectMembers;
