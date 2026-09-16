import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../apps/api/src/index";
import { findWorkspaceRoot } from "../../apps/api/src/utils/find-workspace-root";
import { resetTestDatabase } from "./helpers/database";

const skillDir = join(findWorkspaceRoot(process.cwd()), "skills", "kaneo");

beforeEach(async () => {
  await resetTestDatabase();
});

describe("skill bundle endpoint", () => {
  it("serves the entry point without authentication", async () => {
    const { app } = createApp();

    const response = await app.request("/api/skills/kaneo/skill.md");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/markdown");
    expect(await response.text()).toBe(
      readFileSync(join(skillDir, "SKILL.md"), "utf8"),
    );
  });

  it("accepts the canonical uppercase file name", async () => {
    const { app } = createApp();

    const response = await app.request("/api/skills/kaneo/SKILL.md");

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("# Kaneo");
  });

  it("serves reference files with their exact content", async () => {
    const { app } = createApp();

    const response = await app.request(
      "/api/skills/kaneo/references/lifecycle.md",
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/markdown");
    expect(await response.text()).toBe(
      readFileSync(join(skillDir, "references", "lifecycle.md"), "utf8"),
    );
  });

  it("renders HTML with clickable links for browsers", async () => {
    const { app } = createApp();

    const response = await app.request("/api/skills/kaneo/skill.md", {
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");

    const html = await response.text();
    // Links stay relative to the served file: resolved against this URL they
    // land on the reference route (/api/skills/kaneo/references/...).
    expect(html).toContain('href="references/setup.md"');
    expect(html).toContain('href="references/mcp-guidelines.md"');
    // Heading anchors match the bundle's #section links.
    expect(html).toContain('id="authority-and-boundaries"');
    // Frontmatter is served as a metadata block (name + version visible),
    // while the raw YAML stays out of the rendered body.
    expect(html).toContain("<dt>name</dt><dd>kaneo</dd>");
    expect(html).toMatch(/<dt>version<\/dt><dd>\d+\.\d+\.\d+<\/dd>/);
    expect(html).not.toContain("name: kaneo");
  });

  it("keeps sibling links and anchors inside rendered reference pages", async () => {
    const { app } = createApp();

    const response = await app.request(
      "/api/skills/kaneo/references/mcp-guidelines.md",
      { headers: { Accept: "text/html" } },
    );

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('href="setup.md#idempotent-label-setup"');
    expect(html).toContain(
      'href="lifecycle.md#wrong-project-or-wrong-collection"',
    );
  });

  it("still serves markdown to clients that do not ask for HTML", async () => {
    const { app } = createApp();

    const response = await app.request("/api/skills/kaneo/skill.md", {
      headers: { Accept: "*/*" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/markdown");
    expect(await response.text()).toContain("# Kaneo");
  });

  it("returns 404 for unknown skills, unknown files and unsafe paths", async () => {
    const { app } = createApp();
    const paths = [
      "/api/skills/kaneo/references/missing.md",
      "/api/skills/kaneo/references/notes.txt",
      "/api/skills/kaneo/references/..%2FSKILL.md",
      "/api/skills/unknown/skill.md",
      "/api/skills/kaneo/other.md",
    ];

    for (const path of paths) {
      const response = await app.request(path);
      expect(response.status, path).toBe(404);
      expect(await response.json(), path).toEqual({
        message: "Skill file not found",
      });
    }
  });
});
