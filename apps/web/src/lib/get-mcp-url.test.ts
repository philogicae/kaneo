import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { getMcpUrl } from "./get-mcp-url";

describe("getMcpUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("derives the MCP endpoint from a configured API URL", () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com");
    expect(getMcpUrl()).toBe("https://api.example.com/api/mcp");
  });

  it("keeps an API URL that already ends with /api", () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com/api/");
    expect(getMcpUrl()).toBe("https://api.example.com/api/mcp");
  });

  it("falls back to the current origin for same-origin deployments", () => {
    vi.stubEnv("VITE_API_URL", "");
    // jsdom's `window.location` is unforgeable, so assert against the origin
    // the environment actually has rather than faking one.
    expect(getMcpUrl()).toBe(`${window.location.origin}/api/mcp`);
  });
});
