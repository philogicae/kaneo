import { existsSync, lstatSync, readFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import type { Context } from "hono";
import { Hono } from "hono";
import { marked } from "marked";
import { findWorkspaceRoot } from "../utils/find-workspace-root";

const SKILLS_DIR_ENV = "KANEO_SKILLS_DIR";
const SKILL_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const SKILL_ENTRY_FILE_PATTERN = /^skill\.md$/i;
const MARKDOWN_FILE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*\.md$/;

/**
 * The distributed skill bundles live in `<workspace root>/skills/<skill>/`.
 * `KANEO_SKILLS_DIR` overrides the root for deployments that mount the
 * bundles elsewhere.
 */
function skillsRoot(): string {
  const configured = process.env[SKILLS_DIR_ENV]?.trim();
  return configured
    ? resolve(findWorkspaceRoot(process.cwd()), configured)
    : join(findWorkspaceRoot(process.cwd()), "skills");
}

function isSafeMarkdownName(name: string): boolean {
  return (
    MARKDOWN_FILE_PATTERN.test(name) &&
    !name.includes("..") &&
    !name.includes("/") &&
    !name.includes("\\")
  );
}

function readSkillFile(skill: string, ...segments: string[]): string | null {
  if (!SKILL_NAME_PATTERN.test(skill)) return null;

  const skillDir = resolve(skillsRoot(), skill);
  if (!existsSync(join(skillDir, "SKILL.md"))) return null;

  const requested = resolve(skillDir, ...segments);
  // Defense in depth: the pattern checks above already reject separators, but
  // never serve anything outside the skill directory.
  if (requested !== skillDir && !requested.startsWith(skillDir + sep)) {
    return null;
  }

  try {
    // lstat, not stat: a symlink planted inside the bundle must not escape it.
    if (!lstatSync(requested).isFile()) return null;
    return readFileSync(requested, "utf8");
  } catch {
    return null;
  }
}

function notFound(c: Context) {
  return c.json({ message: "Skill file not found" }, 404);
}

function markdown(c: Context, content: string) {
  return c.body(content, 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    "Cache-Control": "public, max-age=300",
  });
}

// Browsers do not render text/markdown: without an HTML view the bundle shows
// as plain text and its links are not clickable. Agents keep asking for (and
// receiving) the raw markdown.
function wantsHtml(c: Context): boolean {
  return (c.req.header("accept") ?? "").includes("text/html");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// GitHub-style heading slugs so the bundle's `#section` links jump to the
// right heading.
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-");
}

function firstHeading(markdownContent: string, fallback: string): string {
  const match = markdownContent.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || fallback;
}

function renderHtmlPage(title: string, markdownContent: string): string {
  // The entry file starts with YAML frontmatter for agent hosts; browsers do
  // not need it in the rendered page.
  const withoutFrontmatter = markdownContent.replace(
    /^---\r?\n[\s\S]*?\r?\n---\r?\n?/,
    "",
  );
  const rendered = String(
    marked.parse(withoutFrontmatter, { async: false, gfm: true }),
  );
  const body = rendered.replace(
    /<h([1-6])>([\s\S]*?)<\/h\1>/g,
    (_match, level: string, inner: string) => {
      const id = slugify(inner.replace(/<[^>]+>/g, ""));
      return id
        ? `<h${level} id="${id}">${inner}</h${level}>`
        : `<h${level}>${inner}</h${level}>`;
    },
  );

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · Kaneo skill</title>
<style>
:root { color-scheme: light dark; }
body { margin: 0 auto; max-width: 52rem; padding: 2rem 1.25rem 4rem; font: 16px/1.65 system-ui, -apple-system, "Segoe UI", sans-serif; }
h1, h2, h3, h4 { line-height: 1.25; margin-top: 2rem; }
a { color: #2f6feb; }
code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .92em; background: rgba(127,127,127,.14); padding: .15em .35em; border-radius: .25rem; }
pre { background: rgba(127,127,127,.14); padding: 1rem; border-radius: .5rem; overflow-x: auto; }
pre code { background: none; padding: 0; }
blockquote { margin: 1rem 0; padding-left: 1rem; border-left: 3px solid rgba(127,127,127,.45); }
hr { border: 0; border-top: 1px solid rgba(127,127,127,.35); margin: 2rem 0; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid rgba(127,127,127,.35); padding: .4rem .6rem; text-align: left; vertical-align: top; }
</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>
`;
}

function respond(c: Context, content: string, fallbackTitle: string) {
  if (!wantsHtml(c)) {
    return markdown(c, content);
  }
  return c.html(
    renderHtmlPage(firstHeading(content, fallbackTitle), content),
    200,
    { "Cache-Control": "public, max-age=300" },
  );
}

const skills = new Hono();

skills.get("/:skill/:file", (c) => {
  const { skill, file } = c.req.param();
  if (!SKILL_ENTRY_FILE_PATTERN.test(file)) return notFound(c);

  const content = readSkillFile(skill, "SKILL.md");
  if (content === null) return notFound(c);
  return respond(c, content, "Kaneo skill");
});

skills.get("/:skill/references/:file", (c) => {
  const { skill, file } = c.req.param();
  if (!isSafeMarkdownName(file)) return notFound(c);

  const content = readSkillFile(skill, "references", file);
  if (content === null) return notFound(c);
  return respond(c, content, file);
});

export default skills;
