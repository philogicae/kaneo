import { createFileRoute, Link } from "@tanstack/react-router";
import { Blocks, KeyRound } from "lucide-react";
import { useState } from "react";
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
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import { getMcpUrl } from "@/lib/get-mcp-url";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/account/mcp",
)({
  component: RouteComponent,
});

type AuthMode = "oauth" | "apiKey";

type AgentSetup = {
  id: string;
  name: string;
  /** One-line install command, proposed first when the harness ships one. */
  installCommand?: string;
  /** Copy-pasteable server entry; TOML for harnesses that reject JSON. */
  configLabel: string;
  config: string;
  /** Extra step after the config, e.g. triggering the OAuth flow. */
  followUp?: string;
};

function buildAgentSetups(mcpUrl: string): Record<AuthMode, AgentSetup[]> {
  const headerPlaceholder = "<YOUR_API_KEY>";

  return {
    oauth: [
      {
        id: "claude-code",
        name: "Claude Code",
        installCommand: `claude mcp add --transport http kaneo ${mcpUrl}`,
        configLabel: ".mcp.json",
        config: `{
  "mcpServers": {
    "kaneo": {
      "type": "http",
      "url": "${mcpUrl}"
    }
  }
}`,
      },
      {
        id: "codex",
        name: "Codex",
        installCommand: `codex mcp add kaneo --url ${mcpUrl}`,
        configLabel: "~/.codex/config.toml",
        config: `[mcp_servers.kaneo]
url = "${mcpUrl}"`,
        followUp: "codex mcp login kaneo",
      },
      {
        id: "gemini-cli",
        name: "Gemini CLI",
        installCommand: `gemini mcp add --transport http kaneo ${mcpUrl}`,
        configLabel: "~/.gemini/settings.json",
        config: `{
  "mcpServers": {
    "kaneo": {
      "httpUrl": "${mcpUrl}"
    }
  }
}`,
      },
      {
        id: "opencode",
        name: "OpenCode",
        configLabel: "opencode.json",
        config: `{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "kaneo": {
      "type": "remote",
      "url": "${mcpUrl}",
      "enabled": true
    }
  }
}`,
        followUp: "opencode mcp auth kaneo",
      },
    ],
    apiKey: [
      {
        id: "claude-code",
        name: "Claude Code",
        installCommand: `claude mcp add --transport http kaneo ${mcpUrl} --header "Authorization: Bearer ${headerPlaceholder}"`,
        configLabel: ".mcp.json",
        config: `{
  "mcpServers": {
    "kaneo": {
      "type": "http",
      "url": "${mcpUrl}",
      "headers": {
        "Authorization": "Bearer ${headerPlaceholder}"
      }
    }
  }
}`,
      },
      {
        id: "codex",
        name: "Codex",
        installCommand: `codex mcp add kaneo --url ${mcpUrl} --bearer-token-env-var KANEO_API_KEY`,
        configLabel: "~/.codex/config.toml",
        config: `[mcp_servers.kaneo]
url = "${mcpUrl}"
bearer_token_env_var = "KANEO_API_KEY"`,
      },
      {
        id: "gemini-cli",
        name: "Gemini CLI",
        installCommand: `gemini mcp add --transport http kaneo ${mcpUrl} --header "Authorization: Bearer ${headerPlaceholder}"`,
        configLabel: "~/.gemini/settings.json",
        config: `{
  "mcpServers": {
    "kaneo": {
      "httpUrl": "${mcpUrl}",
      "headers": {
        "Authorization": "Bearer ${headerPlaceholder}"
      }
    }
  }
}`,
      },
      {
        id: "opencode",
        name: "OpenCode",
        configLabel: "opencode.json",
        config: `{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "kaneo": {
      "type": "remote",
      "url": "${mcpUrl}",
      "enabled": true,
      "oauth": false,
      "headers": {
        "Authorization": "Bearer {env:KANEO_API_KEY}"
      }
    }
  }
}`,
      },
    ],
  };
}

function AgentSetupCard({ setup }: { setup: AgentSetup }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3 rounded-lg border border-border/60 p-4">
      <p className="text-sm font-medium">{setup.name}</p>
      {setup.installCommand && (
        <CopyableBlock
          value={setup.installCommand}
          label={t("settings:mcpPage.installCommandLabel")}
          copyLabel={t("settings:mcpPage.copy")}
          copiedLabel={t("settings:mcpPage.copied")}
        />
      )}
      <CopyableBlock
        value={setup.config}
        label={t("settings:mcpPage.manualConfigLabel")}
        labelHint={setup.configLabel}
        copyLabel={t("settings:mcpPage.copy")}
        copiedLabel={t("settings:mcpPage.copied")}
      />
      {setup.followUp && (
        <CopyableBlock
          value={setup.followUp}
          label={t("settings:mcpPage.followUpLabel")}
          copyLabel={t("settings:mcpPage.copy")}
          copiedLabel={t("settings:mcpPage.copied")}
        />
      )}
    </div>
  );
}

function RouteComponent() {
  const { t } = useTranslation();
  const [authMode, setAuthMode] = useState<AuthMode>("oauth");
  const mcpUrl = getMcpUrl();
  const setups = buildAgentSetups(mcpUrl);

  return (
    <>
      <PageTitle title={t("settings:mcpPage.pageTitle")} />
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            {t("settings:mcpPage.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("settings:mcpPage.subtitle")}
          </p>
        </div>

        <CardFrame>
          <Card className="!rounded-none !border-t-0">
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2 text-base">
                <Blocks className="size-4" />
                {t("settings:mcpPage.cardTitle")}
              </CardTitle>
              <CardDescription>
                {t("settings:mcpPage.cardDescription")}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="!rounded-none">
            <CardPanel className="space-y-4 p-4">
              <CopyableBlock
                value={mcpUrl}
                label={t("settings:mcpPage.serverUrlLabel")}
                labelHint={t("settings:mcpPage.serverUrlDescription")}
                copyLabel={t("settings:mcpPage.copy")}
                copiedLabel={t("settings:mcpPage.copied")}
              />

              <Tabs
                value={authMode}
                onValueChange={(value) => setAuthMode(value as AuthMode)}
                className="gap-4"
              >
                <TabsList className="w-fit">
                  <TabsTrigger value="oauth">
                    {t("settings:mcpPage.authModeOauth")}
                  </TabsTrigger>
                  <TabsTrigger value="apiKey">
                    {t("settings:mcpPage.authModeApiKey")}
                  </TabsTrigger>
                </TabsList>

                <TabsPanel value="oauth" className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {t("settings:mcpPage.oauthNote")}
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    {setups.oauth.map((setup) => (
                      <AgentSetupCard key={setup.id} setup={setup} />
                    ))}
                  </div>
                </TabsPanel>

                <TabsPanel value="apiKey" className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/40 p-3">
                    <p className="text-sm text-muted-foreground">
                      {t("settings:mcpPage.apiKeyNote")}
                    </p>
                    <Button
                      render={
                        <Link to="/dashboard/settings/account/developer" />
                      }
                      variant="outline"
                      size="sm"
                      className="gap-2"
                    >
                      <KeyRound className="size-4" />
                      {t("settings:mcpPage.createApiKey")}
                    </Button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {setups.apiKey.map((setup) => (
                      <AgentSetupCard key={setup.id} setup={setup} />
                    ))}
                  </div>
                </TabsPanel>
              </Tabs>
            </CardPanel>
          </Card>
        </CardFrame>
      </div>
    </>
  );
}
