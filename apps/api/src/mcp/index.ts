import { randomUUID } from "node:crypto";
import { McpServer as LegacyMcpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  isJsonContentType,
  isLegacyRequest,
} from "@modelcontextprotocol/server";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { auth } from "../auth";
import { apiRouter, createRoute, jsonResponse } from "../openapi";
import {
  beginMcpAuthorization,
  decideMcpAuthorizationRequest,
  getMcpAuthorizationRequest,
  registerMcpClient,
} from "./controllers/oauth-consent";
import { createModernMcpHandler } from "./modern";
import { exchangeCode } from "./oauth";
import {
  authorizationDecisionResponseSchema,
  authorizationDecisionSchema,
  authorizationQuerySchema,
  authorizationRequestParamSchema,
  authorizationRequestResponseSchema,
  clientRegistrationResponseSchema,
  clientRegistrationSchema,
  oauthErrorSchema,
} from "./schemas";
import { registerMcpTools, toMcpToolRegistrar } from "./tools";

const publicApiUrl = (process.env.KANEO_API_URL || "http://localhost:1337")
  .replace(/\/api\/?$/, "")
  .replace(/\/+$/, "");
const internalApiUrl = (
  process.env.KANEO_INTERNAL_API_URL || "http://127.0.0.1:1337"
)
  .replace(/\/api\/?$/, "")
  .replace(/\/+$/, "");

type McpSession = {
  transport: WebStandardStreamableHTTPServerTransport;
  userId: string;
};

const sessions = new Map<string, McpSession>();

function createMcpServerForUser(token: string): LegacyMcpServer {
  const server = new LegacyMcpServer({
    name: "kaneo-mcp",
    version: "1.0.0",
  });
  registerMcpTools(toMcpToolRegistrar(server), internalApiUrl, token);
  return server;
}

// verify-api-key pulls in the database client, so it is only loaded when a
// credential actually needs to be checked as an API key.
type VerifyApiKey = typeof import("../utils/verify-api-key").verifyApiKey;
let verifyApiKeyLoader: Promise<VerifyApiKey> | null = null;

function loadVerifyApiKey(): Promise<VerifyApiKey> {
  verifyApiKeyLoader ??= import("../utils/verify-api-key").then(
    (module) => module.verifyApiKey,
  );
  return verifyApiKeyLoader;
}

async function getSessionFromBearerToken(token: string) {
  const headers = new Headers();
  headers.set("authorization", `Bearer ${token}`);
  return auth.api.getSession({ headers });
}

// Mirrors authenticateApiRequest's credential contract for bearer-only
// requests so MCP HTTP accepts the same credentials as the REST API: a
// session token, or an API key either as Bearer or via x-api-key when no
// Authorization header is present. A token cannot be valid as both, so the
// lookup order only decides which store is queried first.
async function validateBearerToken(
  req: Request,
): Promise<{ userId: string; token: string } | null> {
  const authHeader = req.headers.get("authorization");
  const match = authHeader?.match(/^Bearer\s+(\S+)$/i);
  if (authHeader && !match?.[1]) return null;
  const bearerToken = match?.[1];

  if (bearerToken) {
    const session = await getSessionFromBearerToken(bearerToken);
    if (session?.user?.id) {
      return { userId: session.user.id, token: bearerToken };
    }
  }

  const apiKeyHeader = req.headers.get("x-api-key")?.trim();
  const apiKeyToken = bearerToken ?? (apiKeyHeader || null);
  if (apiKeyToken) {
    const verifyApiKey = await loadVerifyApiKey();
    const apiKeyResult = await verifyApiKey(apiKeyToken);
    if (apiKeyResult?.valid && apiKeyResult.key) {
      return { userId: apiKeyResult.key.userId, token: apiKeyToken };
    }
  }

  return null;
}

const mcp = apiRouter();

const jsonError = (description: string) =>
  jsonResponse(description, oauthErrorSchema);

// OAuth clients parse validation failures, so these routes answer with the
// RFC 6749 / RFC 7591 JSON error shape instead of the router's text default.
type ValidationResult = { success: boolean; error?: { issues: unknown[] } };

const oauthValidationHook =
  (error: "invalid_request" | "invalid_client_metadata") =>
  (result: ValidationResult): undefined => {
    if (result.success) return;
    const issue = result.error?.issues[0] as
      | { path?: PropertyKey[]; message?: string }
      | undefined;
    const field = issue?.path?.map(String).join(".");
    throw new HTTPException(400, {
      res: Response.json(
        {
          error: field?.startsWith("redirect_uri")
            ? "invalid_redirect_uri"
            : error,
          error_description: issue
            ? `${field || "request"}: ${issue.message}`
            : "Invalid request",
        },
        { status: 400 },
      ),
    });
  };

const registerRoute = createRoute({
  method: "post",
  operationId: "registerMcpOAuthClient",
  path: "/mcp/register",
  tags: ["MCP"],
  summary: "Register MCP OAuth client",
  description:
    "Dynamically register a public OAuth client for the MCP endpoint. Public clients hold no secret, so authorization is protected by PKCE and an explicit consent step.",
  security: [],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: clientRegistrationSchema } },
    },
  },
  responses: {
    200: jsonResponse(
      "Registered OAuth client",
      clientRegistrationResponseSchema,
    ),
    400: jsonError("Invalid client metadata"),
  },
});

const authorizeRoute = createRoute({
  method: "get",
  operationId: "authorizeMcpOAuthClient",
  path: "/mcp/authorize",
  tags: ["MCP"],
  summary: "Start MCP authorization",
  description:
    "Begin an MCP OAuth authorization. Redirects the browser to the Kaneo consent page, which then approves or denies the request.",
  security: [],
  request: { query: authorizationQuerySchema },
  responses: {
    302: { description: "Redirect to the Kaneo consent page" },
    400: jsonError("Invalid authorization request"),
  },
});

const getAuthorizationRequestRoute = createRoute({
  method: "get",
  operationId: "getMcpAuthorizationRequest",
  path: "/mcp/authorize/request/{requestId}",
  tags: ["MCP"],
  summary: "Get consent request",
  description:
    "Get the client name and redirect URI for a pending consent request, so the consent page can show who is asking.",
  security: [],
  request: { params: authorizationRequestParamSchema },
  responses: {
    200: jsonResponse(
      "Authorization request details",
      authorizationRequestResponseSchema,
    ),
    400: jsonError("Invalid OAuth client"),
    404: jsonError("Unknown or expired authorization request"),
  },
});

const decideAuthorizationRequestRoute = createRoute({
  method: "post",
  operationId: "decideMcpAuthorizationRequest",
  path: "/mcp/authorize/request/{requestId}",
  tags: ["MCP"],
  summary: "Decide consent request",
  description:
    "Approve or deny a pending consent request and get the URL to send the browser back to.",
  request: {
    params: authorizationRequestParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: authorizationDecisionSchema } },
    },
  },
  responses: {
    200: jsonResponse(
      "OAuth client redirect",
      authorizationDecisionResponseSchema,
    ),
    400: jsonError("Invalid request or OAuth client"),
    401: jsonError("Authentication required"),
    403: jsonError("Untrusted request origin"),
    404: jsonError("Unknown or expired authorization request"),
  },
});

mcp
  .openapi(
    registerRoute,
    async (c) => c.json(await registerMcpClient(c.req.valid("json")), 200),
    oauthValidationHook("invalid_client_metadata"),
  )
  .openapi(
    authorizeRoute,
    async (c) => c.redirect(await beginMcpAuthorization(c.req.valid("query"))),
    oauthValidationHook("invalid_request"),
  )
  .openapi(
    getAuthorizationRequestRoute,
    async (c) =>
      c.json(
        await getMcpAuthorizationRequest(c.req.valid("param").requestId),
        200,
      ),
    oauthValidationHook("invalid_request"),
  )
  .openapi(
    decideAuthorizationRequestRoute,
    async (c) => {
      const redirect = await decideMcpAuthorizationRequest({
        requestId: c.req.valid("param").requestId,
        decision: c.req.valid("json"),
        headers: c.req.raw.headers,
        origin: c.req.header("origin"),
      });
      return c.json({ redirect }, 200);
    },
    oauthValidationHook("invalid_request"),
  );

mcp.all("/mcp", async (c) => {
  const authResult = await validateBearerToken(c.req.raw);
  if (!authResult) {
    const prmUrl = `${publicApiUrl}/api/.well-known/oauth-protected-resource/api/mcp`;
    c.header("WWW-Authenticate", `Bearer resource_metadata="${prmUrl}"`);
    return c.json(
      {
        error: "invalid_token",
        error_description: "Missing or invalid token",
      },
      401,
    );
  }

  const sessionId = c.req.header("mcp-session-id");

  if (sessionId) {
    const existing = sessions.get(sessionId);
    // A mismatched owner is reported as missing rather than forbidden so the
    // response cannot confirm that someone else's session id is valid.
    if (existing && existing.userId === authResult.userId) {
      return existing.transport.handleRequest(c.req.raw);
    }
    return c.json({ error: "Session not found" }, 404);
  }

  if (c.req.method !== "POST") {
    return c.json({ error: "Method not allowed" }, 405);
  }

  if (!isJsonContentType(c.req.header("content-type"))) {
    return c.json({ error: "Unsupported Media Type" }, 415);
  }

  if (!(await isLegacyRequest(c.req.raw.clone()))) {
    const modern = createModernMcpHandler(authResult.token, internalApiUrl);
    return modern.fetch(c.req.raw);
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  transport.onclose = () => {
    if (transport.sessionId) {
      sessions.delete(transport.sessionId);
    }
  };

  const server = createMcpServerForUser(authResult.token);
  await server.connect(transport);
  const response = await transport.handleRequest(c.req.raw);

  if (transport.sessionId) {
    sessions.set(transport.sessionId, {
      transport,
      userId: authResult.userId,
    });
  }

  return response;
});

// Public clients disagree on how credentials travel: some put client_id in
// the body, others send client_secret_basic (RFC 6749 §2.3.1) with an empty
// secret. The Basic payload is form-encoded per parameter.
function basicAuthClientId(header: string | undefined): string | undefined {
  const match = header?.match(/^Basic\s+(.+)$/i);
  if (!match?.[1]) return undefined;
  try {
    const decoded = Buffer.from(match[1], "base64").toString("utf8");
    const sep = decoded.indexOf(":");
    return decodeURIComponent(sep === -1 ? decoded : decoded.slice(0, sep));
  } catch {
    return undefined;
  }
}

mcp.post("/mcp/token", async (c) => {
  const contentType = c.req.header("content-type") || "";
  let params: Record<string, unknown>;

  // Treat a missing or incorrect media type as form data when the body is
  // form-shaped. Unreadable input is a protocol error, never a server error.
  try {
    const body = await c.req.text();
    if (contentType.includes("application/x-www-form-urlencoded")) {
      params = Object.fromEntries(new URLSearchParams(body));
    } else if (body.trimStart().startsWith("{")) {
      const parsed: unknown = JSON.parse(body);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return c.json({ error: "invalid_request" }, 400);
      }
      params = parsed as Record<string, unknown>;
    } else {
      params = Object.fromEntries(new URLSearchParams(body));
    }
  } catch {
    return c.json({ error: "invalid_request" }, 400);
  }

  // Some clients put the parameters in the query string instead of the body;
  // body values win when both are present.
  for (const [key, value] of new URL(c.req.url).searchParams) {
    params[key] ??= value;
  }

  const { grant_type, code, code_verifier, redirect_uri } = params;
  const client_id =
    params.client_id ?? basicAuthClientId(c.req.header("authorization"));

  if (grant_type !== "authorization_code") {
    return c.json({ error: "unsupported_grant_type" }, 400);
  }

  const required: Array<[string, unknown]> = [
    ["code", code],
    ["client_id", client_id],
    ["code_verifier", code_verifier],
  ];
  for (const [name, value] of required) {
    if (typeof value !== "string" || !value) {
      return c.json(
        {
          error: "invalid_request",
          error_description: `${name} is required`,
        },
        400,
      );
    }
  }
  if (
    redirect_uri !== undefined &&
    (typeof redirect_uri !== "string" || !redirect_uri)
  ) {
    return c.json(
      {
        error: "invalid_request",
        error_description: "redirect_uri must be a non-empty string",
      },
      400,
    );
  }

  const result = await exchangeCode(
    code as string,
    client_id as string,
    code_verifier as string,
    redirect_uri as string | undefined,
  );
  if (result === null) {
    return c.json({ error: "invalid_grant" }, 400);
  }
  if ("failure" in result) {
    return c.json(
      {
        error: "invalid_grant",
        error_description: `${result.failure} does not match the authorization request`,
      },
      400,
    );
  }

  return c.json({
    access_token: result.accessToken,
    token_type: "Bearer",
    expires_in: result.expiresIn,
  });
});

mcp.get("/.well-known/oauth-protected-resource/api/mcp", (c) =>
  c.json({
    resource: `${publicApiUrl}/api/mcp`,
    authorization_servers: [`${publicApiUrl}/api`],
  }),
);

mcp.get("/.well-known/oauth-authorization-server/api", (c) =>
  c.json({
    issuer: `${publicApiUrl}/api`,
    authorization_endpoint: `${publicApiUrl}/api/mcp/authorize`,
    token_endpoint: `${publicApiUrl}/api/mcp/token`,
    registration_endpoint: `${publicApiUrl}/api/mcp/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
  }),
);

mcp.all("/mcp", async (c) => {
  const authResult = await validateBearerToken(c.req.raw);
  if (!authResult) {
    const prmUrl = `${publicApiUrl}/api/.well-known/oauth-protected-resource/api/mcp`;
    c.header("WWW-Authenticate", `Bearer resource_metadata="${prmUrl}"`);
    return c.json(
      {
        error: "invalid_token",
        error_description: "Missing or invalid token",
      },
      401,
    );
  }

  const sessionId = c.req.header("mcp-session-id");

  if (sessionId) {
    const existing = sessions.get(sessionId);
    // A mismatched owner is reported as missing rather than forbidden so the
    // response cannot confirm that someone else's session id is valid.
    if (existing && existing.userId === authResult.userId) {
      return existing.transport.handleRequest(c.req.raw);
    }
    return c.json({ error: "Session not found" }, 404);
  }

  if (c.req.method !== "POST") {
    return c.json({ error: "Method not allowed" }, 405);
  }

  if (!isJsonContentType(c.req.header("content-type"))) {
    return c.json({ error: "Unsupported Media Type" }, 415);
  }

  if (!(await isLegacyRequest(c.req.raw.clone()))) {
    const modern = createModernMcpHandler(authResult.token, internalApiUrl);
    return modern.fetch(c.req.raw);
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  transport.onclose = () => {
    if (transport.sessionId) {
      sessions.delete(transport.sessionId);
    }
  };

  const server = createMcpServerForUser(authResult.token);
  await server.connect(transport);
  const response = await transport.handleRequest(c.req.raw);

  if (transport.sessionId) {
    sessions.set(transport.sessionId, {
      transport,
      userId: authResult.userId,
    });
  }

  return response;
});

export default mcp;

export function mcpWellKnownRoutes(baseUrl: string) {
  const wellKnown = new Hono();

  wellKnown.get("/.well-known/oauth-protected-resource/api/mcp", (c) =>
    c.json({
      resource: `${baseUrl}/api/mcp`,
      authorization_servers: [`${baseUrl}/api`],
    }),
  );

  wellKnown.get("/.well-known/oauth-authorization-server/api", (c) =>
    c.json({
      issuer: `${baseUrl}/api`,
      authorization_endpoint: `${baseUrl}/api/mcp/authorize`,
      token_endpoint: `${baseUrl}/api/mcp/token`,
      registration_endpoint: `${baseUrl}/api/mcp/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
    }),
  );

  return wellKnown;
}
