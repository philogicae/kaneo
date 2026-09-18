import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  askJev,
  isJevEnabled,
  jevApiKey,
} from "../../../apps/api/src/jev/client";

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("TYPESAFE_API_KEY", "test-key");
  vi.stubEnv("KANEO_JEV_MODEL", "");
  vi.stubEnv("KANEO_JEV_BASE_URL", "");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Jev client configuration", () => {
  it("reports the key and trims it", () => {
    vi.stubEnv("TYPESAFE_API_KEY", "  spaced-key  ");

    expect(jevApiKey()).toBe("spaced-key");
    expect(isJevEnabled()).toBe(true);
  });

  it("is disabled without a key", () => {
    vi.stubEnv("TYPESAFE_API_KEY", "   ");

    expect(isJevEnabled()).toBe(false);
  });
});

describe("askJev", () => {
  it("posts the model, state and questions with the bearer key", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ answers: { q: { noul: 0.9 } } }),
    );

    const answers = await askJev(
      { note: "x" },
      { q: { type: "noul", instructions: "is it x" } },
    );

    expect(answers).toEqual({ q: { noul: 0.9 } });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.typesafe.ai/v1/systemone");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("authorization")).toBe(
      "Bearer test-key",
    );
    expect(JSON.parse(String(init.body))).toEqual({
      model: "jev-latest",
      state: { note: "x" },
      questions: { q: { type: "noul", instructions: "is it x" } },
    });
  });

  it("honors model and base URL overrides", async () => {
    vi.stubEnv("KANEO_JEV_MODEL", "jev-1.13.0");
    vi.stubEnv("KANEO_JEV_BASE_URL", "https://jev.internal/v1/systemone");
    fetchMock.mockResolvedValue(jsonResponse({ answers: {} }));

    await askJev({}, { q: { type: "noul", instructions: "x" } });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://jev.internal/v1/systemone");
    expect(JSON.parse(String(init.body)).model).toBe("jev-1.13.0");
  });

  it("refuses to call without a key", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");

    await expect(
      askJev({}, { q: { type: "noul", instructions: "x" } }),
    ).rejects.toThrow("TYPESAFE_API_KEY is not configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not retry a non-transient HTTP error", async () => {
    fetchMock.mockResolvedValue(new Response("bad request", { status: 400 }));

    await expect(
      askJev({}, { q: { type: "noul", instructions: "x" } }),
    ).rejects.toThrow("Jev request failed (400)");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a transient status once and returns the success", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("overloaded", { status: 529 }))
      .mockResolvedValueOnce(jsonResponse({ answers: { q: { noul: 1 } } }));

    const answers = await askJev(
      {},
      { q: { type: "noul", instructions: "x" } },
    );

    expect(answers).toEqual({ q: { noul: 1 } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws on malformed JSON and on missing answers", async () => {
    fetchMock.mockResolvedValueOnce(new Response("not json", { status: 200 }));
    await expect(
      askJev({}, { q: { type: "noul", instructions: "x" } }),
    ).rejects.toThrow("Jev returned malformed JSON");

    fetchMock.mockResolvedValueOnce(jsonResponse({ model: "jev-latest" }));
    await expect(
      askJev({}, { q: { type: "noul", instructions: "x" } }),
    ).rejects.toThrow("Jev response is missing answers");
  });
});
