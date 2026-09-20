import { client } from "@kaneo/libs";

async function reorderMilestones(
  projectId: string,
  milestones: Array<{ id: string; position: number }>,
) {
  const response = await client.milestone.reorder[":projectId"].$put({
    param: { projectId },
    json: { milestones },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default reorderMilestones;
