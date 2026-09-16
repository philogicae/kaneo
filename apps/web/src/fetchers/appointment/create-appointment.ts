import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type CreateAppointmentRequest = InferRequestType<
  (typeof client)["appointment"]["$post"]
>["json"];

async function createAppointment(input: CreateAppointmentRequest) {
  const response = await client.appointment.$post({ json: input });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return await response.json();
}

export default createAppointment;
