import { createHmac } from "node:crypto";
import { sendOutboundRequest } from "../../utils/outbound-request";

type GenericWebhookPayload = Record<string, unknown>;

export async function postToGenericWebhook(
  webhookUrl: string,
  payload: GenericWebhookPayload,
  secret?: string,
): Promise<void> {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (secret) {
    headers["X-Kaneo-Signature"] = createHmac("sha256", secret)
      .update(body)
      .digest("hex");
  }

  // The destination is validated and the response body never enters an error:
  // the URL and body are both operator- or webhook-controlled.
  await sendOutboundRequest(
    webhookUrl,
    { headers, body },
    { publicDestination: true },
  );
}
