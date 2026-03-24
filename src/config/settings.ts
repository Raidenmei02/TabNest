import * as vscode from "vscode";
import { EXTENSION_SECTION } from "../constants";
import { RuleConfig } from "../types";

const LEGACY_EXTENSION_SECTION = "atlasOrganizer";

export function getSettings(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration(EXTENSION_SECTION);
}

export function getAutoOrganize(): boolean {
  return getSettingValue("autoOrganize", false);
}

export function getStrategy(): string {
  return getSettingValue("strategy", "preset");
}

export function getCustomRules(): RuleConfig[] {
  return getSettingValue<RuleConfig[]>("rules", []);
}

export function getDebounceMs(): number {
  const value = getSettingValue("debounceMs", 800);
  return Number.isFinite(value) ? Math.max(200, value) : 800;
}

export function getAiEnabled(): boolean {
  return getSettingValue("aiEnabled", false);
}

export function getAiApiKey(): string {
  return getSettingValue("aiApiKey", "");
}

export function getAiModel(): string {
  return getSettingValue("aiModel", "gpt-4.1-mini");
}

export function getAiBaseUrl(): string {
  return getSettingValue("aiBaseUrl", "https://api.openai.com/v1");
}

export function getAiAuthMode(): "bearer" | "api-key" | "x-api-key" {
  const value = getSettingValue<string>("aiAuthMode", "bearer");
  if (value === "api-key" || value === "x-api-key") {
    return value;
  }
  return "bearer";
}

export function getAiTimeoutMs(): number {
  const value = getSettingValue("aiTimeoutMs", 8000);
  return Number.isFinite(value) ? Math.max(1000, value) : 8000;
}

export function getAiSystemPrompt(): string {
  return getSettingValue(
    "aiSystemPrompt",
    "You classify file paths into one category: project, tests, docs, temp. Reply with only one category token."
  );
}

export function getAiUserPromptTemplate(): string {
  return getSettingValue(
    "aiUserPromptTemplate",
    [
      "Classify this file path.",
      "Path: {{path}}",
      "Output one token only: project | tests | docs | temp"
    ].join("\n")
  );
}

export function getAiAllowFileContent(): boolean {
  return getSettingValue("aiAllowFileContent", false);
}

export function getAiContentPreviewChars(): number {
  const value = getSettingValue("aiContentPreviewChars", 500);
  return Number.isFinite(value) ? Math.max(100, Math.min(4000, value)) : 500;
}

export function getAiMaxGroups(): number {
  const value = getSettingValue("aiMaxGroups", 6);
  return Number.isFinite(value) ? Math.max(2, Math.min(12, value)) : 6;
}

export function getConfirmDeleteGroup(): boolean {
  return getSettingValue("confirmDeleteGroup", true);
}

export async function setConfirmDeleteGroup(value: boolean): Promise<void> {
  await getSettings().update("confirmDeleteGroup", value, vscode.ConfigurationTarget.Global);
}

function getSettingValue<T>(key: string, fallback: T): T {
  const primary = getSettings().get<T | undefined>(key);
  if (primary !== undefined) {
    return primary;
  }

  return vscode.workspace.getConfiguration(LEGACY_EXTENSION_SECTION).get<T>(key, fallback);
}
