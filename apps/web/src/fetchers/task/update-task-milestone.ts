import { client } from "@kaneo/libs";

async function updateTaskMilestone(taskId: string, milestoneId: string | null) {
  const response = await client.task.milestone[":taskId"].$put({
    param: { taskId },
    json: { milestoneId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default updateTaskMilestone;
