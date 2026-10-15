import { getMcpUrl } from "./get-mcp-url";

/**
 * Resolves the skill bundle URL served by this instance. The bundle shares the
 * API base with the MCP endpoint, so agents can fetch it without a token.
 */
export function getSkillUrl(skill = "kaneo"): string {
  const mcpUrl = getMcpUrl();
  return `${mcpUrl.replace(/\/mcp$/, "")}/skills/${skill}/skill.md`;
}
