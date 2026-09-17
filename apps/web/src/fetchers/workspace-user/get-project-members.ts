import { client } from "@kaneo/libs";
import type { WorkspaceUsersPayload } from "@/types/workspace-user";

// Members who can access a project, shaped like better-auth's listMembers
// payload so the assignee and mention pickers can swap sources unchanged.
async function getProjectMembers(
  projectId: string,
): Promise<WorkspaceUsersPayload> {
  const response = await client.project[":id"].members.$get({
    param: { id: projectId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const members = await response.json();

  return {
    members: members.map((member) => ({
      id: member.id,
      userId: member.id,
      role: member.role,
      user: {
        id: member.id,
        name: member.name,
        email: member.email,
        image: member.image,
      },
    })),
  };
}

export type ProjectMembers = Awaited<ReturnType<typeof getProjectMembers>>;

export default getProjectMembers;
