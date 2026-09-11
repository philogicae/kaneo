import { HTTPException } from "hono/http-exception";
import { isBillingEnabled } from "../config";
import {
  computeEntitlement,
  getOrCreateWorkspaceBilling,
} from "./get-workspace-billing";

export async function requireWorkspaceEntitlement(workspaceId: string) {
  if (!isBillingEnabled()) {
    return;
  }

  const billing = await getOrCreateWorkspaceBilling(workspaceId);
  const entitlement = computeEntitlement(billing);

  if (!entitlement.active) {
    throw new HTTPException(402, {
      message:
        "This workspace's Kaneo Cloud plan has expired. Subscribe to continue creating and editing.",
    });
  }
}
