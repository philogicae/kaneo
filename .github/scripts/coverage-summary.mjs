/**
 * Renders Vitest coverage summaries (json-summary reporter) as a markdown
 * table in the GitHub Actions job summary.
 *
 * Usage: node .github/scripts/coverage-summary.mjs [report.json ...]
 * Defaults to coverage/coverage-summary.json. Missing reports are skipped,
 * so it is safe to run with `if: always()`.
 */
import { appendFileSync, readFileSync } from "node:fs";
import { relative } from "node:path";

const METRICS = ["statements", "branches", "functions", "lines"];
const MAX_DETAIL_ROWS = 40;

const args = process.argv.slice(2);
const reports = [];
for (const path of args.length > 0
  ? args
  : ["coverage/coverage-summary.json"]) {
  try {
    reports.push({ path, data: JSON.parse(readFileSync(path, "utf8")) });
  } catch {
    console.log(`No coverage summary at ${path} - skipping.`);
  }
}

if (reports.length === 0) {
  console.log("No coverage summary found - skipping job summary.");
  process.exit(0);
}

const emptyTotals = () =>
  Object.fromEntries(METRICS.map((m) => [m, { total: 0, covered: 0 }]));

const addMetrics = (acc, entry) => {
  for (const m of METRICS) {
    acc[m].total += entry[m].total;
    acc[m].covered += entry[m].covered;
  }
};

const pct = ({ total, covered }) =>
  total === 0 ? 100 : (covered / total) * 100;
const fmt = (value) => `${Math.round(value * 100) / 100}%`;
const icon = (value) => (value === 100 ? "✅" : "⚠️");

const files = [];
const perReport = [];
const globalTotals = emptyTotals();

for (const { path, data } of reports) {
  const parts = path.split("/");
  const label = parts.length > 2 ? parts.slice(0, -2).join("/") : "coverage";
  const totals = emptyTotals();
  for (const [file, entry] of Object.entries(data)) {
    if (file === "total") continue;
    addMetrics(totals, entry);
    addMetrics(globalTotals, entry);
    const rel = relative(process.cwd(), file);
    files.push({ file: rel.startsWith("..") ? file : rel, entry });
  }
  perReport.push({ label, totals });
}

const headline = METRICS.map(
  (m) => `${icon(pct(globalTotals[m]))} ${fmt(pct(globalTotals[m]))} ${m}`,
).join(" · ");

const lines = ["## 🧪 Test coverage", "", headline, ""];

if (perReport.length > 1) {
  lines.push("| Workspace | Statements | Branches | Functions | Lines |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const { label, totals } of perReport) {
    lines.push(
      `| \`${label}\` | ${METRICS.map((m) => fmt(pct(totals[m]))).join(" | ")} |`,
    );
  }
  lines.push("");
}

const below = files.filter(({ entry }) =>
  METRICS.some((m) => entry[m].pct < 100),
);

if (below.length === 0) {
  lines.push("✅ All measured files at 100%.");
} else {
  lines.push(
    `<details><summary>Files below 100% (${below.length})</summary>`,
    "",
    "| File | Statements | Branches | Functions | Lines |",
    "| --- | --- | --- | --- | --- |",
  );
  for (const { file, entry } of below.slice(0, MAX_DETAIL_ROWS)) {
    lines.push(
      `| \`${file}\` | ${METRICS.map((m) => fmt(entry[m].pct)).join(" | ")} |`,
    );
  }
  if (below.length > MAX_DETAIL_ROWS) {
    lines.push(`| _… ${below.length - MAX_DETAIL_ROWS} more_ | | | | |`);
  }
  lines.push("", "</details>");
}

const markdown = `${lines.join("\n")}\n`;

// biome-ignore lint/suspicious/noUndeclaredEnvVars: set by GitHub Actions for the job summary
const summaryFile = process.env.GITHUB_STEP_SUMMARY;

if (summaryFile) {
  appendFileSync(summaryFile, markdown);
} else {
  console.log(markdown);
}
