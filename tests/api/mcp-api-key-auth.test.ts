import { afterEach, describe, expect, it, vi } from "vitest";
import mcpRoutes from "../../apps/api/src/mcp";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(async () => null),
}));

const apiKeyMocks = vi.hoisted(() => ({
  verifyApiKey: vi.fn(async (key: string) => {
    if (key === "kaneo_ak_valid") {
      return {
        valid: true,
        key: {
          id: "key-1",
          userId: "api-key-user",
          name: "test key",
          prefix: "kaneo",
          start: "kaneo_ak_va",
          enabled: true,
          expiresAt: null,
          permissions: null,
        },
      };
    }
    return null;
  }),
}));

vi.mock("../../apps/api/src/auth", () => ({
  auth: { api: { getSession: authMocks.getSession } },
}));

vi.mock("../../apps/api/src/utils/verify-api-key", () => ({
  verifyApiKey: apiKeyMocks.verifyApiKey,
}));

const protocolVersion = "2026-07-28";

function mcpRequest(
  headers: Record<string, string>,
  method = "tools/list",
  params: Record<string, unknown> = {},
): Request {
  const name = method === "tools/call" ? String(params.name) : undefined;
  return new Request("http://mcp.test/mcp", {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-method": method,
      "mcp-protocol-version": protocolVersion,
      ...(name ? { "mcp-name": name } : {}),
      ...headers,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params: {
        ...params,
        _meta: {
          "io.modelcontextprotocol/protocolVersion": protocolVersion,
          "io.modelcontextprotocol/clientInfo": {
            name: "kaneo-api-key-test",
            version: "1.0.0",
          },
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  });
}

afterEach(() => {
  authMocks.getSession.mockClear();
  apiKeyMocks.verifyApiKey.mockClear();
});

describe("MCP HTTP API key authentication", () => {
  it("accepts an API key sent as a Bearer token after session validation fails", async () => {
    const response = await mcpRoutes.request(
      mcpRequest({ authorization: "Bearer kaneo_ak_valid" }),
    );

    expect(response.status).toBe(200);
    expect(apiKeyMocks.verifyApiKey).toHaveBeenCalledWith("kaneo_ak_valid");
  });

  it("accepts an API key sent via x-api-key when no Authorization header is present", async () => {
    const response = await mcpRoutes.request(
      mcpRequest({ "x-api-key": "kaneo_ak_valid" }),
    );

    expect(response.status).toBe(200);
    expect(apiKeyMocks.verifyApiKey).toHaveBeenCalledWith("kaneo_ak_valid");
    expect(authMocks.getSession).not.toHaveBeenCalled();
  });

  it("propagates the API key to tool callbacks against the REST API", async () => {
    const apiFetch = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        expect(new Headers(init?.headers).get("authorization")).toBe(
          "Bearer kaneo_ak_valid",
        );
        return Response.json({ user: { id: "api-key-user" } });
      },
    );
    vi.stubGlobal("fetch", apiFetch);
    const { createModernMcpHandler } = await import(
      "../../apps/api/src/mcp/modern"
    );
    const handler = createModernMcpHandler("kaneo_ak_valid", "http://api.test");

    const handlerResponse = await handler.fetch(
      mcpRequest({ authorization: "Bearer kaneo_ak_valid" }, "tools/call", {
        name: "whoami",
        arguments: {},
      }),
    );

    expect(handlerResponse.status).toBe(200);
    expect(apiFetch).toHaveBeenCalledOnce();
  });

  it("authenticates a session token without consulting the API key store", async () => {
    authMocks.getSession.mockResolvedValueOnce({
      user: { id: "session-user" },
    });
    const response = await mcpRoutes.request(
      mcpRequest({ authorization: "Bearer session-token" }),
    );

    expect(response.status).toBe(200);
    expect(authMocks.getSession).toHaveBeenCalledOnce();
    expect(
      new Headers(authMocks.getSession.mock.calls[0][0].headers).get(
        "authorization",
      ),
    ).toBe("Bearer session-token");
    expect(apiKeyMocks.verifyApiKey).not.toHaveBeenCalled();
  });

  it("falls back to the API key store when session validation fails", async () => {
    const response = await mcpRoutes.request(
      mcpRequest({ authorization: "Bearer kaneo_ak_valid" }),
    );

    expect(response.status).toBe(200);
    expect(apiKeyMocks.verifyApiKey).toHaveBeenCalledWith("kaneo_ak_valid");
  });

  it("rejects a request whose token matches neither an API key nor a session", async () => {
    const response = await mcpRoutes.request(
      mcpRequest({ authorization: "Bearer unknown-token" }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toContain(
      "resource_metadata",
    );
  });

  it("rejects an invalid x-api-key without falling back to cookies", async () => {
    const response = await mcpRoutes.request(
      mcpRequest({ "x-api-key": "kaneo_ak_invalid" }),
    );

    expect(response.status).toBe(401);
    expect(authMocks.getSession).not.toHaveBeenCalled();
  });

  it("keeps legacy sessionful initialize traffic working with an API key", async () => {
    const initialize = await mcpRoutes.request("/mcp", {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        authorization: "Bearer kaneo_ak_valid",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "legacy-api-key", version: "1.0.0" },
        },
      }),
    });
    const sessionId = initialize.headers.get("mcp-session-id");

    expect(initialize.status).toBe(200);
    expect(sessionId).toBeTruthy();

    const tools = await mcpRoutes.request("/mcp", {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        authorization: "Bearer kaneo_ak_valid",
        "content-type": "application/json",
        "mcp-session-id": sessionId ?? "",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      }),
    });
    const text = await tools.text();
    const data = text
      .split("\n")
      .find((line) => line.startsWith("data: "))
      ?.slice(6);

    expect(tools.status).toBe(200);
    expect(JSON.parse(data ?? "{}")?.result?.tools).toContainEqual(
      expect.objectContaining({ name: "whoami" }),
    );
  });
});
