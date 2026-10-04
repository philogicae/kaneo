import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

type GetNotificationsParams = {
  limit?: number;
  offset?: number;
  workspaceId?: string;
};

async function getNotifications(params: GetNotificationsParams = {}) {
  const response = await client.notification.$get({
    query: {
      ...(params.limit !== undefined ? { limit: String(params.limit) } : {}),
      ...(params.offset !== undefined ? { offset: String(params.offset) } : {}),
      ...(params.workspaceId !== undefined
        ? { workspaceId: params.workspaceId }
        : {}),
    },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return await response.json();
}

export default getNotifications;
