import { createFileRoute, Link } from "@tanstack/react-router";
import { Blocks, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { CopyableBlock } from "@/components/settings/copyable-block";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFrame,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/account/skills",
)({
  component: RouteComponent,
});

type SkillScope = "user" | "project" | "admin";

type SkillInstall = {
  id: string;
  name: string;
  destinations: Array<{ scope: SkillScope; path: string }>;
  installCommand: string;
  verify?: string;
};

const skillDir = "skills/kaneo";

const skillInstalls: SkillInstall[] = [
  {
    id: "shared",
    name: "Codex · Gemini CLI · OpenCode",
    destinations: [
      { scope: "user", path: "~/.agents/skills/kaneo/" },
      { scope: "project", path: ".agents/skills/kaneo/" },
      { scope: "admin", path: "/etc/codex/skills/kaneo/" },
    ],
    installCommand: `mkdir -p ~/.agents/skills && cp -r ${skillDir} ~/.agents/skills/`,
    verify: "/skills",
  },
  {
    id: "claude-code",
    name: "Claude Code",
    destinations: [
      { scope: "user", path: "~/.claude/skills/kaneo/" },
      { scope: "project", path: ".claude/skills/kaneo/" },
    ],
    installCommand: `mkdir -p ~/.claude/skills && cp -r ${skillDir} ~/.claude/skills/`,
  },
  {
    id: "gemini-cli",
    name: "Gemini CLI",
    destinations: [
      { scope: "user", path: "~/.gemini/skills/kaneo/" },
      { scope: "project", path: ".gemini/skills/kaneo/" },
    ],
    installCommand: `gemini skills link ./${skillDir}`,
    verify: "/skills list",
  },
  {
    id: "opencode",
    name: "OpenCode",
    destinations: [
      { scope: "user", path: "~/.config/opencode/skills/kaneo/" },
      { scope: "project", path: ".opencode/skills/kaneo/" },
    ],
    installCommand: `mkdir -p ~/.config/opencode/skills && cp -r ${skillDir} ~/.config/opencode/skills/`,
  },
];

const scopeLabelKeys = {
  user: "settings:skillsPage.userScope",
  project: "settings:skillsPage.projectScope",
  admin: "settings:skillsPage.adminScope",
} as const;

function SkillInstallCard({ install }: { install: SkillInstall }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3 rounded-lg border border-border/60 p-4">
      <p className="text-sm font-medium">{install.name}</p>
      <div className="space-y-1.5">
        <p className="text-xs font-medium">
          {t("settings:skillsPage.destinationLabel")}
        </p>
        <ul className="space-y-1">
          {install.destinations.map((destination) => (
            <li
              key={destination.path}
              className="flex flex-wrap items-baseline gap-1.5 text-xs"
            >
              <code className="rounded-sm border border-border bg-sidebar px-1.5 py-0.5 font-mono">
                {destination.path}
              </code>
              <span className="text-muted-foreground">
                {t(scopeLabelKeys[destination.scope])}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <CopyableBlock
        value={install.installCommand}
        label={t("settings:skillsPage.installCommandLabel")}
        copyLabel={t("settings:skillsPage.copy")}
        copiedLabel={t("settings:skillsPage.copied")}
      />
      {install.verify && (
        <CopyableBlock
          value={install.verify}
          label={t("settings:skillsPage.verifyLabel")}
          copyLabel={t("settings:skillsPage.copy")}
          copiedLabel={t("settings:skillsPage.copied")}
        />
      )}
    </div>
  );
}

function RouteComponent() {
  const { t } = useTranslation();

  return (
    <>
      <PageTitle title={t("settings:skillsPage.pageTitle")} />
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            {t("settings:skillsPage.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("settings:skillsPage.subtitle")}
          </p>
        </div>

        <CardFrame>
          <Card className="rounded-none! border-t-0!">
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2 text-base">
                <Sparkles className="size-4" />
                {t("settings:skillsPage.cardTitle")}
              </CardTitle>
              <CardDescription>
                {t("settings:skillsPage.cardDescription")}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="rounded-none!">
            <CardPanel className="space-y-4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/40 p-3">
                <p className="text-sm text-muted-foreground">
                  {t("settings:skillsPage.mcpRequirement")}
                </p>
                <Button
                  render={<Link to="/dashboard/settings/account/mcp" />}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <Blocks className="size-4" />
                  {t("settings:skillsPage.openMcpSettings")}
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {skillInstalls.map((install) => (
                  <SkillInstallCard key={install.id} install={install} />
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                {t("settings:skillsPage.updateDescription")}
              </p>
            </CardPanel>
          </Card>
        </CardFrame>
      </div>
    </>
  );
}
