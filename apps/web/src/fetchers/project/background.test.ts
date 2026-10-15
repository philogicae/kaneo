import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { removeProjectBackground, uploadProjectBackground } from "./background";

const mocks = vi.hoisted(() => ({
  reserve: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@kaneo/libs", () => ({
  client: {
    project: {
      ":id": {
        background: { $put: mocks.reserve, $delete: mocks.remove },
      },
    },
  },
}));

describe("project background fetchers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.reserve.mockReset();
    mocks.remove.mockReset();
  });

  it("reserves an upload, then posts the bytes to the returned URL", async () => {
    const file = new File(["image bytes"], "board.png", {
      type: "image/png",
    });
    mocks.reserve.mockResolvedValue({
      ok: true,
      json: async () => ({
        key: "projects/ws-1/project-1/background",
        uploadUrl: "https://api.example.test/project/project-1/background/blob",
        headers: { "Content-Type": "image/png", "X-Background-Version": "v1" },
      }),
    });
    const storageFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          backgroundVersion: "v1",
          contentType: "image/png",
        }),
        { status: 200 },
      ),
    );

    await expect(
      uploadProjectBackground("project-1", file, "v1"),
    ).resolves.toEqual({ backgroundVersion: "v1", contentType: "image/png" });

    expect(mocks.reserve).toHaveBeenCalledWith({
      param: { id: "project-1" },
      json: { contentType: "image/png", size: file.size, version: "v1" },
    });
    // The bytes go to the API on its own origin: no storage provider is
    // exposed to the browser.
    expect(storageFetch).toHaveBeenCalledWith(
      "https://api.example.test/project/project-1/background/blob",
      {
        method: "POST",
        headers: { "Content-Type": "image/png", "X-Background-Version": "v1" },
        body: file,
      },
    );
  });

  it("propagates the failure when the byte upload is rejected", async () => {
    const file = new File(["image bytes"], "board.png", {
      type: "image/png",
    });
    mocks.reserve.mockResolvedValue({
      ok: true,
      json: async () => ({
        key: "projects/ws-1/project-1/background",
        uploadUrl: "https://api.example.test/project/project-1/background/blob",
        headers: { "Content-Type": "image/png", "X-Background-Version": "v1" },
      }),
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("too large", { status: 413 }),
    );

    await expect(
      uploadProjectBackground("project-1", file, "v1"),
    ).rejects.toThrow("too large");
  });

  it("removes the project background", async () => {
    mocks.remove.mockResolvedValue({ ok: true });

    await removeProjectBackground("project-1");

    expect(mocks.remove).toHaveBeenCalledWith({
      param: { id: "project-1" },
    });
  });
});
