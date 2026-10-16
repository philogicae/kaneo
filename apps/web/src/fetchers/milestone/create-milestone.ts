import { client } from "@kaneo/libs";

type CreateMilestoneInput = {
  projectId: string;
  name: string;
  description?: string;
  color?: string;
};

async function createMilestone(input: CreateMilestoneInput) {
  const response = await client.milestone.$post({
    json: input,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default createMilestone;
