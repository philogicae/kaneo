import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type UpdateAppointmentRequest = InferRequestType<
  (typeof client)["appointment"][":id"]["$put"]
>["json"];

async function updateAppointment(id: string, input: UpdateAppointmentRequest) {
  const response = await client.appointment[":id"].$put({
    json: input,
    param: { id },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return await response.json();
}

export default updateAppointment;
