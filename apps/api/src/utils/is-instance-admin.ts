import { eq } from "drizzle-orm";
import type { Context } from "hono";
import db from "../database";
import { userTable } from "../database/schema";
import { hasInstanceAdminRole } from "./instance-admin-role";

export async function isInstanceAdminUser(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ role: userTable.role })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  // The role column is a comma-separated list, so an exact match would miss
  // `user,admin`.
  return hasInstanceAdminRole(row?.role);
}

export async function isInstanceAdmin(c: Context): Promise<boolean> {
  const user = c.get("user") as { role?: string | null } | null | undefined;
  if (user?.role) {
    return hasInstanceAdminRole(user.role);
  }

  const userId = c.get("userId");
  if (!userId) return false;

  return isInstanceAdminUser(userId);
}
