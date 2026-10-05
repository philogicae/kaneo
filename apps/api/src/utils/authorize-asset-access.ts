import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { canAccessProject } from "./access-scope";
import { resolveAssetBearerOrCookie } from "./authenticate-api-request";
import { validateWorkspaceAccess } from "./validate-workspace-access";

type AssetAccessTarget = {
  workspaceId: string;
  projectId: string;
  surface: string;
  createdBy?: string | null;
  isPublic: boolean | null;
};

/** Only description assets belong to the public project representation. */
export function isPublicAsset(asset: AssetAccessTarget): boolean {
  return asset.isPublic === true && asset.surface === "description";
}

/**
 * Authorizes a request for a stored asset.
 *
 * Public assets are readable by anyone, so the credential check must be skipped
 * entirely for them: `resolveAssetBearerOrCookie` throws a 401 for anonymous
 * callers rather than returning an empty user, so calling it first would make
 * the public case unreachable.
 */
export async function authorizeAssetAccess(
  c: Context,
  asset: AssetAccessTarget,
): Promise<void> {
  if (isPublicAsset(asset)) {
    return;
  }

  const { userId, apiKeyId } = await resolveAssetBearerOrCookie(c);

  // A staged upload is private to whoever uploaded it until the task claims it.
  if (asset.surface.startsWith("draft") && asset.createdBy !== userId) {
    throw new HTTPException(403, {
      message: "Staged uploads are private to their owner",
    });
  }

  await validateWorkspaceAccess(userId, asset.workspaceId, apiKeyId);

  // Workspace reach is not project reach: a scoped member must not read an
  // asset from a project they cannot open.
  if (!(await canAccessProject(userId, asset.projectId))) {
    throw new HTTPException(403, { message: "No access to this asset" });
  }
}
