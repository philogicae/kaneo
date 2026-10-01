import { client } from "@kaneo/libs";

/**
 * Replace a project's board background.
 *
 * The API reserves a same-origin upload URL and then stores the bytes itself,
 * so no storage provider is exposed to the browser. `version` is caller
 * supplied so a client can tell a replaced background from the previous one.
 */
export async function uploadProjectBackground(
  projectId: string,
  file: File,
  version: string,
) {
  const reserved = await client.project[":id"].background.$put({
    param: { id: projectId },
    json: { contentType: file.type, size: file.size, version },
  });
  if (!reserved.ok) throw new Error(await reserved.text());
  const upload = await reserved.json();

  const stored = await fetch(upload.uploadUrl, {
    method: "POST",
    headers: upload.headers,
    body: file,
  });
  if (!stored.ok) throw new Error(await stored.text());

  return stored.json();
}

export async function removeProjectBackground(projectId: string) {
  const response = await client.project[":id"].background.$delete({
    param: { id: projectId },
  });
  if (!response.ok) throw new Error(await response.text());
}
