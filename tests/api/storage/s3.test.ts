import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyKeyPrefix,
  assertTaskImageKeyMatchesContext,
  buildObjectKey,
  buildObjectKeyPrefix,
  createTaskImageUploadUrl,
  deleteS3Object,
  getFileExtension,
  getPrivateObject,
  isImageContentType,
  parseBoolean,
  parsePositiveInt,
  sanitizePathSegment,
  validateTaskAssetUploadInput,
  writeAssetObject,
} from "../../../apps/api/src/storage/s3";

const ENV_KEYS = [
  "STORAGE_PATH",
  "STORAGE_KEY_PREFIX",
  "STORAGE_MAX_IMAGE_UPLOAD_BYTES",
  "KANEO_API_URL",
] as const;

describe("local asset storage", () => {
  const original: Record<string, string | undefined> = {};
  let tempRoot: string | undefined;

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      original[key] = process.env[key];
      delete process.env[key];
    }
    tempRoot = mkdtempSync(join(tmpdir(), "kaneo-assets-"));
    process.env.STORAGE_PATH = tempRoot;
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = original[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    if (tempRoot) {
      rmSync(tempRoot, { recursive: true, force: true });
    }
    tempRoot = undefined;
  });

  it("recognizes allowed image content types case-insensitively", () => {
    expect(isImageContentType("image/png")).toBe(true);
    expect(isImageContentType("IMAGE/JPEG")).toBe(true);
    expect(isImageContentType("application/pdf")).toBe(false);
  });

  it("parses booleans and positive integers with fallbacks", () => {
    expect(parseBoolean("true", false)).toBe(true);
    expect(parseBoolean("TRUE", false)).toBe(true);
    expect(parseBoolean("", true)).toBe(true);
    expect(parseBoolean(undefined, true)).toBe(true);
    expect(parsePositiveInt("42", 1)).toBe(42);
    expect(parsePositiveInt("0", 7)).toBe(7);
    expect(parsePositiveInt("nope", 7)).toBe(7);
  });

  it("sanitizes path segments and extracts normalized extensions", () => {
    expect(sanitizePathSegment("My File!!.PNG")).toBe("my-file-.png");
    expect(getFileExtension("screenshot.PNG")).toBe("png");
    expect(getFileExtension("no-extension")).toBe("file");
  });

  it("builds stable key prefixes and keys", () => {
    const context = {
      workspaceId: "ws_1",
      projectId: "proj_1",
      taskId: "task_1",
      surface: "comment" as const,
      filename: "Screenshot 2026.png",
      contentType: "image/png",
    };

    expect(buildObjectKeyPrefix(context)).toBe(
      "workspace/ws_1/project/proj_1/task/task_1/comments",
    );

    const key = buildObjectKey(context);
    expect(
      key.startsWith("workspace/ws_1/project/proj_1/task/task_1/comments/"),
    ).toBe(true);
    expect(key.endsWith(".png")).toBe(true);
  });

  it("applyKeyPrefix prepends the prefix and trims trailing slashes", () => {
    expect(applyKeyPrefix("", "a/b")).toBe("a/b");
    expect(applyKeyPrefix("dev/", "a/b")).toBe("dev/a/b");
    expect(applyKeyPrefix("dev", "a/b")).toBe("dev/a/b");
  });

  it("assertTaskImageKeyMatchesContext rejects traversal past the prefix", () => {
    const context = {
      workspaceId: "ws_1",
      projectId: "proj_1",
      taskId: "task_1",
      surface: "description" as const,
    };

    expect(
      assertTaskImageKeyMatchesContext(
        "workspace/ws_1/project/proj_1/task/task_1/descriptions/image.png",
        context,
      ),
    ).toBe(true);
    expect(
      assertTaskImageKeyMatchesContext(
        "workspace/ws_1/project/proj_1/task/task_1/descriptions/../secret.png",
        context,
      ),
    ).toBe(false);
    expect(
      assertTaskImageKeyMatchesContext(
        "workspace/other/project/proj_1/task/task_1/descriptions/image.png",
        context,
      ),
    ).toBe(false);
  });

  it("assertTaskImageKeyMatchesContext respects STORAGE_KEY_PREFIX", () => {
    process.env.STORAGE_KEY_PREFIX = "tenant";

    expect(
      assertTaskImageKeyMatchesContext(
        "tenant/workspace/ws_1/project/proj_1/task/task_1/descriptions/image.png",
        {
          workspaceId: "ws_1",
          projectId: "proj_1",
          taskId: "task_1",
          surface: "description",
        },
      ),
    ).toBe(true);
  });

  it("validates upload size against the configured maximum", () => {
    process.env.STORAGE_MAX_IMAGE_UPLOAD_BYTES = "1024";

    expect(() => validateTaskAssetUploadInput("image/png", 512)).not.toThrow();
    expect(() => validateTaskAssetUploadInput("", 512)).toThrow(
      "A valid content type is required.",
    );
    expect(() => validateTaskAssetUploadInput("image/png", 0)).toThrow(
      "Upload size must be greater than zero.",
    );
    expect(() => validateTaskAssetUploadInput("image/png", 2048)).toThrow(
      "Upload exceeds the maximum upload size",
    );
  });

  it("creates an API blob upload URL rather than a presigned S3 URL", async () => {
    process.env.KANEO_API_URL = "https://kaneo.test";

    const upload = await createTaskImageUploadUrl({
      workspaceId: "ws_1",
      projectId: "proj_1",
      taskId: "task_1",
      surface: "comment",
      filename: "note.png",
      contentType: "image/png",
    });

    expect(
      upload.uploadUrl.startsWith(
        "https://kaneo.test/api/task/image-upload/task_1/blob?",
      ),
    ).toBe(true);
    expect(upload.uploadUrl).toContain("surface=comment");
    expect(upload.uploadUrl).toContain(`key=${encodeURIComponent(upload.key)}`);
    expect(upload.headers["Content-Type"]).toBe("image/png");
  });

  it("writes, reads and deletes an asset on local disk", async () => {
    const key = "workspace/ws_1/project/proj_1/task/task_1/descriptions/a.png";
    const bytes = new Uint8Array([1, 2, 3, 4]);

    await writeAssetObject(key, bytes);

    const object = await getPrivateObject(key);
    const chunks: Uint8Array[] = [];
    for await (const chunk of object.body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    const content = Buffer.concat(chunks);
    expect(content).toEqual(Buffer.from(bytes));
    expect(object.contentLength).toBe(4);
    expect(object.lastModified).toBeInstanceOf(Date);

    await deleteS3Object(key);
    await expect(getPrivateObject(key)).rejects.toThrow();
  });

  it("rejects a key that escapes the storage root", async () => {
    await expect(
      writeAssetObject("../escape.png", new Uint8Array([1])),
    ).rejects.toThrow("Invalid storage key.");
  });
});

vi.mock("../../../apps/api/src/database", () => ({ default: {} }));

const { contentReferencesAsset, extractAssetIds } = await import(
  "../../../apps/api/src/storage/cleanup-assets"
);

describe("extractAssetIds", () => {
  it("extracts asset IDs from content with /api/asset/ URLs", () => {
    const content =
      '<p>Hello <img src="http://localhost:1337/api/asset/abc123" /> world <img src="/api/asset/def456" /></p>';
    const ids = extractAssetIds(content);
    expect(ids).toEqual(new Set(["abc123", "def456"]));
  });

  it("returns empty set for null/undefined/empty content", () => {
    expect(extractAssetIds(null)).toEqual(new Set());
    expect(extractAssetIds(undefined)).toEqual(new Set());
    expect(extractAssetIds("")).toEqual(new Set());
  });

  it("returns empty set when no asset URLs are present", () => {
    expect(extractAssetIds("<p>No images here</p>")).toEqual(new Set());
  });

  it("deduplicates repeated asset IDs", () => {
    const content = "/api/asset/abc123 and again /api/asset/abc123";
    expect(extractAssetIds(content)).toEqual(new Set(["abc123"]));
  });

  it("does not treat asset ID prefixes as references", () => {
    expect(contentReferencesAsset("/api/asset/abc123xyz", "abc123")).toBe(
      false,
    );
    expect(contentReferencesAsset("/api/asset/abc123", "abc123")).toBe(true);
  });
});
