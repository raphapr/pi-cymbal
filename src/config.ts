import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as codingAgent from "@earendil-works/pi-coding-agent";

// CONFIG_DIR_NAME was added after pi-cymbal's minimum supported Pi API.
const configDirName = (codingAgent as { CONFIG_DIR_NAME?: string }).CONFIG_DIR_NAME ?? ".pi";

export interface CymbalConfig {
  systemPrompt: boolean;
  nudges: boolean;
}

export const DEFAULT_CYMBAL_CONFIG: Readonly<CymbalConfig> = {
  systemPrompt: true,
  nudges: true,
};

function readConfig(path: string): Partial<CymbalConfig> {
  if (!existsSync(path)) return {};

  try {
    const value: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("expected a JSON object");

    const valueByKey = value as Record<string, unknown>;
    const config: Partial<CymbalConfig> = {};
    for (const key of ["systemPrompt", "nudges"] as const) {
      if (valueByKey[key] === undefined) continue;
      if (typeof valueByKey[key] !== "boolean") throw new Error(`${key} must be a boolean`);
      config[key] = valueByKey[key];
    }
    return config;
  } catch (error) {
    console.error(`Warning: Could not parse ${path}: ${error}`);
    return {};
  }
}

export function loadCymbalConfig(cwd: string, projectTrusted: boolean, agentDir = codingAgent.getAgentDir()): CymbalConfig {
  const globalConfig = readConfig(join(agentDir, "extensions", "pi-cymbal.json"));
  const projectConfig = projectTrusted ? readConfig(join(cwd, configDirName, "pi-cymbal.json")) : {};
  return { ...DEFAULT_CYMBAL_CONFIG, ...globalConfig, ...projectConfig };
}
