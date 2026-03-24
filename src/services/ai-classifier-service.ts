import * as vscode from "vscode";
import { getAiApiKey, getAiEnabled } from "../config/settings";
import { AiGateway } from "./ai/gateway";
import { normalizeCategory, parseWorkflowPlan } from "./ai/parsers";
import { buildClassifierMessages, buildWorkflowMessages } from "./ai/prompts";
import {
  AiCategory,
  AiClassifyDetails,
  AiClassifyReason,
  AiClassifyResult,
  AiWorkflowFile,
  AiWorkflowResult,
  ClassifyOptions
} from "./ai/types";

export type {
  AiCategory,
  AiClassifyDetails,
  AiClassifyReason,
  AiClassifyResult,
  AiWorkflowFile,
  AiWorkflowGroup,
  AiWorkflowResult,
  ClassifyOptions
} from "./ai/types";

type CacheEntry = {
  category: AiCategory;
  expiresAt: number;
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export class AiClassifierService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly gateway = new AiGateway();
  private hasShownMissingKeyWarning = false;

  isEnabled(): boolean {
    return getAiEnabled();
  }

  async classify(target: string, options?: ClassifyOptions): Promise<AiClassifyResult> {
    const check = this.checkAiAvailable(options);
    if (!check.apiKey) {
      return check;
    }

    const now = Date.now();
    const cached = this.cache.get(target);
    if (cached && cached.expiresAt > now) {
      return { category: cached.category, reason: "cache_hit" };
    }

    const response = await this.gateway.generateText(check.apiKey, buildClassifierMessages(target), 32);
    if (!response.ok) {
      return { reason: "api_failed", details: response.details };
    }

    const category = normalizeCategory(response.text);
    if (!category) {
      return {
        reason: "invalid_response",
        details: {
          responseSnippet: response.text,
          responseBody: response.text,
          model: response.model,
          baseUrl: response.baseUrl,
          requestMode: response.requestMode
        }
      };
    }

    this.cache.set(target, {
      category,
      expiresAt: now + CACHE_TTL_MS
    });
    return { category, reason: "api_success" };
  }

  async planGroups(files: AiWorkflowFile[], maxGroups: number, options?: ClassifyOptions): Promise<AiWorkflowResult> {
    const check = this.checkAiAvailable(options);
    if (!check.apiKey) {
      return check;
    }

    if (files.length === 0) {
      return { reason: "api_success", groups: [] };
    }

    const response = await this.gateway.generateText(
      check.apiKey,
      buildWorkflowMessages(files, maxGroups),
      Math.min(4096, Math.max(1200, files.length * 80))
    );
    if (!response.ok) {
      return { reason: "api_failed", details: response.details };
    }

    const groups = parseWorkflowPlan(response.text, files, maxGroups);
    if (!groups) {
      return {
        reason: "invalid_response",
        details: {
          responseSnippet: response.text,
          responseBody: response.text,
          model: response.model,
          baseUrl: response.baseUrl,
          requestMode: response.requestMode
        }
      };
    }

    return { reason: "api_success", groups };
  }

  private checkAiAvailable(options?: ClassifyOptions): (AiClassifyResult & { apiKey?: string }) {
    if (!options?.forceAi && !this.isEnabled()) {
      return { reason: "disabled" };
    }

    const key = getAiApiKey().trim();
    if (!key) {
      if (!this.hasShownMissingKeyWarning) {
        this.hasShownMissingKeyWarning = true;
        void vscode.window
          .showWarningMessage("TabNest AI requires `tabNest.aiApiKey`. Add your API key in Settings.", "Open AI Settings")
          .then((choice) => {
            if (choice === "Open AI Settings") {
              void vscode.commands.executeCommand("workbench.action.openSettings", "tabNest.aiApiKey");
            }
          });
      }
      return { reason: "missing_key", details: { errorMessage: "tabNest.aiApiKey is empty" } };
    }

    return { reason: "api_success", apiKey: key };
  }
}
