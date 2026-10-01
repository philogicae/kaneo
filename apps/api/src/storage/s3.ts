import { createReadStream, promises as fs, mkdirSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { createId } from "@paralleldrive/cuid2";
import { config } from "dotenv-mono";
import { resolveDatabaseConfig } from "../database/resolve-database-config";
import { normalizeApiServerUrl } from "../utils/openapi-spec";

config();

const DEFAULT_MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;

const allowedImageMimeTypes = new Set([
  "image/apng",
  "image/avif",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export function isImageContentType(contentType: string) {
  return allowedImageMimeTypes.has(contentType.toLowerCase());
}

type UploadSurface = "description" | "comment";

type TaskImageUploadContext = {
  workspaceId: string;
  projectId: string;
  taskId: string;
  surface: UploadSurface;
  filename: string;
  contentType: string;
};

type TaskImageUploadUrl = {
  key: string;
  uploadUrl: string;
  headers: Record<string, string>;
};

type AssetObject = {
  body: unknown;
  contentType: string | undefined;
  contentLength: number | undefined;
  etag: string | undefined;
  lastModified: Date | undefined;
};

function env(name: string) {
  return process.env[name]?.trim() || "";
}

export function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined || value.trim() === "") return fallback;
  return value.trim().toLowerCase() === "true";
}

export function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value?.trim() || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function sanitizePathSegment(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-+|-+$/g, "") || "file"
  );
}

export function getFileExtension(filename: string) {
  const normalized = filename.trim();
  const extension = normalized.includes(".")
    ? normalized.split(".").pop() || ""
    : "";

  return sanitizePathSegment(extension).slice(0, 12);
}

export function buildObjectKeyPrefix(
  context: Omit<TaskImageUploadContext, "filename" | "contentType">,
) {
  const surfaceFolder =
    context.surface === "comment" ? "comments" : "descriptions";

  return [
    "workspace",
    sanitizePathSegment(context.workspaceId),
    "project",
    sanitizePathSegment(context.projectId),
    "task",
    sanitizePathSegment(context.taskId),
    surfaceFolder,
  ].join("/");
}

export function buildObjectKey(context: TaskImageUploadContext) {
  const extension = getFileExtension(context.filename);
  const objectKeyPrefix = buildObjectKeyPrefix(context);
  const timestamp = Date.now();
  const randomId = createId();

  const baseName = sanitizePathSegment(
    context.filename.replace(/\.[^/.]+$/, "") || "image",
  ).slice(0, 64);

  const fileName = extension
    ? `${baseName}-${timestamp}-${randomId}.${extension}`
    : `${baseName}-${timestamp}-${randomId}`;

  return `${objectKeyPrefix}/${fileName}`;
}

export function applyKeyPrefix(prefix: string, key: string) {
  if (!prefix) return key;
  const trimmed = prefix.replace(/\/+$/, "");
  return `${trimmed}/${key}`;
}

function getKeyPrefix() {
  return env("STORAGE_KEY_PREFIX");
}

function getMaxImageUploadBytes() {
  return parsePositiveInt(
    process.env.STORAGE_MAX_IMAGE_UPLOAD_BYTES,
    DEFAULT_MAX_IMAGE_UPLOAD_BYTES,
  );
}

export function validateTaskAssetUploadInput(
  contentType: string,
  size: number,
) {
  const maxImageUploadBytes = getMaxImageUploadBytes();

  if (!contentType.trim()) {
    throw new Error("A valid content type is required.");
  }

  if (size <= 0) {
    throw new Error("Upload size must be greater than zero.");
  }

  if (size > maxImageUploadBytes) {
    throw new Error(
      `Upload exceeds the maximum upload size of ${Math.floor(maxImageUploadBytes / (1024 * 1024))}MB.`,
    );
  }
}

// Assets live next to the database file (e.g. /data/assets in Docker) unless
// STORAGE_PATH overrides the location.
function getStorageRoot() {
  const explicit = env("STORAGE_PATH");
  if (explicit) return resolve(explicit);

  const database = resolveDatabaseConfig();
  if (database.path !== ":memory:") {
    return join(dirname(database.path), "assets");
  }

  return resolve(process.cwd(), "data/assets");
}

function resolveStoragePath(key: string) {
  const root = getStorageRoot();
  const target = resolve(root, key);

  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    throw new Error("Invalid storage key.");
  }

  return target;
}

export async function createTaskImageUploadUrl(
  context: TaskImageUploadContext,
): Promise<TaskImageUploadUrl> {
  const key = applyKeyPrefix(getKeyPrefix(), buildObjectKey(context));
  const apiBaseUrl = normalizeApiServerUrl(
    process.env.KANEO_API_URL || "http://127.0.0.1:1337",
  );
  const uploadUrl = `${apiBaseUrl}/task/image-upload/${encodeURIComponent(
    context.taskId,
  )}/blob?key=${encodeURIComponent(key)}&surface=${context.surface}`;

  return {
    key,
    uploadUrl,
    headers: {
      "Content-Type": context.contentType,
    },
  };
}

export function assertTaskImageKeyMatchesContext(
  key: string,
  context: Omit<TaskImageUploadContext, "filename" | "contentType">,
) {
  const objectPrefix = buildObjectKeyPrefix(context);
  const fullPrefix = `${applyKeyPrefix(getKeyPrefix(), objectPrefix)}/`;

  if (!key.startsWith(fullPrefix)) {
    return false;
  }

  // The prefix alone is not enough: gateways that normalize paths would let
  // a traversal suffix walk back out into another workspace's objects.
  const suffix = key.slice(fullPrefix.length);
  return /^[A-Za-z0-9._-]+$/.test(suffix) && !suffix.startsWith(".");
}

export async function writeAssetObject(
  key: string,
  data: Uint8Array,
): Promise<void> {
  const target = resolveStoragePath(key);
  mkdirSync(dirname(target), { recursive: true });
  await fs.writeFile(target, data);
}

export async function getPrivateObject(key: string): Promise<AssetObject> {
  const target = resolveStoragePath(key);
  const stat = await fs.stat(target);

  return {
    body: Readable.toWeb(createReadStream(target)),
    contentType: undefined,
    contentLength: stat.size,
    etag: `"${stat.size}-${Math.floor(stat.mtimeMs)}"`,
    lastModified: stat.mtime,
  };
}

export async function deleteS3Object(key: string): Promise<void> {
  await fs.rm(resolveStoragePath(key), { force: true });
}
