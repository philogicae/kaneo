import { client } from "@kaneo/libs";

async function moveTaskToAppointments(taskId: string) {
  const response = await client.appointment["from-task"].$post({
    json: { taskId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return await response.json();
}

export default moveTaskToAppointments;
