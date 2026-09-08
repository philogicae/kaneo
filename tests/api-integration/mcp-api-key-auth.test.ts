import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

const protocolVersion = "2026-07-28";

function mcpToolsListRequest(headers: Record<string, string>) {
  return {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-method": "tools/list",
      "mcp-protocol-version": protocolVersion,
      ...headers,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {
        _meta: {
          "io.modelcontextprotocol/protocolVersion": protocolVersion,
          "io.modelcontextprotocol/clientInfo": {
            name: "kaneo-integration-test",
            version: "1.0.0",
          },
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  } as const;
}

describe("MCP HTTP endpoint accepts API keys", () => {
  let app: ReturnType<typeof createApp>["app"];
  let apiKey: string;
  let apiKeyId: string;

  beforeEach(async () => {
    await resetTestDatabase();
    ({ app } = createApp());
    const { user } = await createWorkspaceMember();
    const result = await auth.api.createApiKey({
      body: { name: "integration-test-key", userId: user.id },
    });
    if (!result) {
      throw new Error("API key creation failed");
    }
    apiKey = result.key;
    apiKeyId = result.id;
  });

  it("accepts an enabled API key as a Bearer token", async () => {
    const response = await app.request(
      "/api/mcp",
      mcpToolsListRequest({ authorization: `Bearer ${apiKey}` }),
    );

    expect(response.status).toBe(200);
  });

  it("accepts an enabled API key via the x-api-key header", async () => {
    const response = await app.request(
      "/api/mcp",
      mcpToolsListRequest({ "x-api-key": apiKey }),
    );

    expect(response.status).toBe(200);
  });

  it("rejects a disabled API key", async () => {
    await db
      .update(schema.apikeyTable)
      .set({ enabled: false })
      .where(eq(schema.apikeyTable.id, apiKeyId));

    const response = await app.request(
      "/api/mcp",
      mcpToolsListRequest({ authorization: `Bearer ${apiKey}` }),
    );

    expect(response.status).toBe(401);
  });

  it("rejects an unknown API key", async () => {
    const response = await app.request(
      "/api/mcp",
      mcpToolsListRequest({ authorization: "Bearer kaneo_ak_unknown" }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toContain(
      "resource_metadata",
    );
  });
});
