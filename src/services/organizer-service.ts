import * as vscode from "vscode";
import { TextDecoder } from "util";
import { getAiAllowFileContent, getAiContentPreviewChars, getAiMaxGroups } from "../config/settings";
import { loadRules } from "../core/rules";
import { getMatchTarget, getTabUri } from "../core/tabs";
import { GroupService } from "./group-service";
import { AiClassifierService, AiClassifyDetails, AiClassifyReason, AiWorkflowFile } from "./ai-classifier-service";

type OrganizeStats = {
  tabsTotal: number;
  tabsSeen: number;
  ruleMatched: number;
  aiChecked: number;
  aiCacheHits: number;
  aiApiSuccess: number;
  aiApiFailed: number;
  aiInvalidResponse: number;
  aiMissingKey: number;
  aiAssigned: number;
  aiReasonCounts: Record<AiClassifyReason, number>;
  aiFailureSamples: Array<{
    target: string;
    reason: AiClassifyReason;
    details?: AiClassifyDetails;
  }>;
};

export class OrganizerService implements vscode.Disposable {
  private readonly groupService: GroupService;
  private readonly aiClassifier: AiClassifierService;
  private readonly statusItem: vscode.StatusBarItem;
  private readonly output: vscode.OutputChannel;
  private isOrganizing = false;
  private hasShownAiFailureHelp = false;

  constructor(groupService: GroupService, aiClassifier: AiClassifierService) {
    this.groupService = groupService;
    this.aiClassifier = aiClassifier;
    this.statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 40);
    this.statusItem.text = "$(extensions-view-icon) TabNest";
    this.statusItem.tooltip = "TabNest organizer status";
    this.statusItem.show();
    this.output = vscode.window.createOutputChannel("TabNest");
  }

  dispose(): void {
    this.statusItem.dispose();
    this.output.dispose();
  }

  async organizeNow(options?: { forceAi?: boolean }): Promise<void> {
    if (this.isOrganizing) {
      this.statusItem.text = "$(sync~spin) TabNest: already organizing";
      return;
    }

    this.isOrganizing = true;
    const startedAt = Date.now();
    const stats: OrganizeStats = {
      tabsTotal: 0,
      tabsSeen: 0,
      ruleMatched: 0,
      aiChecked: 0,
      aiCacheHits: 0,
      aiApiSuccess: 0,
      aiApiFailed: 0,
      aiInvalidResponse: 0,
      aiMissingKey: 0,
      aiAssigned: 0,
      aiReasonCounts: {
        disabled: 0,
        missing_key: 0,
        cache_hit: 0,
        api_success: 0,
        api_failed: 0,
        invalid_response: 0
      },
      aiFailureSamples: []
    };
    stats.tabsTotal = vscode.window.tabGroups.all.reduce((acc, group) => acc + group.tabs.length, 0);
    this.statusItem.text = renderRunningStatus(stats);
    try {
      if (options?.forceAi) {
        await this.organizeWithAiWorkflow(stats, options);
        this.updateStatusAndLogs(stats, Date.now() - startedAt, true);
        return;
      }

      const rules = loadRules();

      const maxRuleTargetGroup = rules.length > 0 ? Math.max(...rules.map((item) => item.targetGroup)) : 1;
      const maxTargetGroup = Math.max(4, maxRuleTargetGroup);
      for (let i = 2; i <= maxTargetGroup; i += 1) {
        await this.groupService.ensureGroupIndex(i, presetGroupName(i));
      }

      for (const tabGroup of vscode.window.tabGroups.all) {
        for (const tab of tabGroup.tabs) {
          const uri = getTabUri(tab.input);
          if (!uri) {
            continue;
          }
          stats.tabsSeen += 1;
          if (stats.tabsSeen % 5 === 0 || stats.tabsSeen === stats.tabsTotal) {
            this.statusItem.text = renderRunningStatus(stats);
          }

          const target = getMatchTarget(uri);
          const matched = rules.find((rule) => rule.re.test(target));
          if (matched) {
            const group = await this.groupService.ensureGroupIndex(matched.targetGroup, presetGroupName(matched.targetGroup));
            await this.groupService.assignUri(uri, group.id);
            stats.ruleMatched += 1;
            if (stats.tabsSeen % 5 === 0 || stats.tabsSeen === stats.tabsTotal) {
              this.statusItem.text = renderRunningStatus(stats);
            }
            continue;
          }

          const aiOutcome = await this.pickAiTargetGroup(target, options);
          this.bumpAiStats(stats, target, aiOutcome.reason, aiOutcome.details, !!aiOutcome.groupIndex);
          const aiTargetGroup = aiOutcome.groupIndex;
          if (!aiTargetGroup || aiTargetGroup === 1) {
            continue;
          }

          const group = await this.groupService.ensureGroupIndex(aiTargetGroup, presetGroupName(aiTargetGroup));
          await this.groupService.assignUri(uri, group.id);
          if (stats.tabsSeen % 5 === 0 || stats.tabsSeen === stats.tabsTotal) {
            this.statusItem.text = renderRunningStatus(stats);
          }
        }
      }
      this.updateStatusAndLogs(stats, Date.now() - startedAt, !!options?.forceAi);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.statusItem.text = "$(error) TabNest: organize failed";
      this.output.appendLine(`[${new Date().toISOString()}] organize failed: ${message}`);
      void vscode.window.showErrorMessage(`TabNest failed: ${message}`);
    } finally {
      this.isOrganizing = false;
    }
  }

  private async organizeWithAiWorkflow(stats: OrganizeStats, options?: { forceAi?: boolean }): Promise<void> {
    // 获取已打开编辑器信息 (URI,目标路径,标签)
    const fileTabs = this.collectOpenTabs();
    stats.tabsSeen = fileTabs.length;

    const allowContentRead = getAiAllowFileContent();
    const contentCharLimit = getAiContentPreviewChars();
    const maxGroups = getAiMaxGroups();
    const files: AiWorkflowFile[] = [];

  
    for (const tab of fileTabs) {
      const contentSnippet = allowContentRead ? await this.readFileSnippet(tab.uri, contentCharLimit) : undefined;
      files.push({
        id: tab.id,
        target: tab.target, // 目标路径
        label: tab.label,   // 标签
        contentSnippet
      });
    }

    const result = await this.aiClassifier.planGroups(files, maxGroups, options);
    if (result.reason !== "api_success" || !result.groups) {
      this.bumpAiStatsBulk(stats, files.map((item) => item.target), result.reason, result.details, 0);
      return;
    }

    const uriById = new Map(fileTabs.map((item) => [item.id, item.uri]));
    let assignedCount = 0;
    for (const groupPlan of result.groups) {
      const groupName = groupPlan.name.trim();
      if (!groupName) {
        continue;
      }

      let targetGroupId = "ungrouped";
      if (groupName.toLowerCase() !== "ungrouped") {
        const group = await this.groupService.ensureGroupByName(groupName);
        targetGroupId = group.id;
      }

      for (const fileId of groupPlan.fileIds) {
        const uri = uriById.get(fileId);
        if (!uri) {
          continue;
        }
        await this.groupService.assignUri(uri, targetGroupId);
        assignedCount += 1;
      }
    }

    this.bumpAiStatsBulk(stats, files.map((item) => item.target), "api_success", undefined, assignedCount);
  }

  private async pickAiTargetGroup(
    target: string,
    options?: { forceAi?: boolean }
  ): Promise<{ groupIndex?: number; reason: AiClassifyReason; details?: AiClassifyDetails }> {
    const result = await this.aiClassifier.classify(target, options);
    return {
      groupIndex: groupIndexByCategory(result.category),
      reason: result.reason,
      details: result.details
    };
  }

  private bumpAiStats(
    stats: OrganizeStats,
    target: string,
    reason: AiClassifyReason,
    details: AiClassifyDetails | undefined,
    assigned: boolean
  ): void {
    stats.aiReasonCounts[reason] += 1;
    if (reason === "disabled") {
      return;
    }

    stats.aiChecked += 1;
    if (reason === "cache_hit") {
      stats.aiCacheHits += 1;
    } else if (reason === "api_success") {
      stats.aiApiSuccess += 1;
    } else if (reason === "api_failed") {
      stats.aiApiFailed += 1;
    } else if (reason === "invalid_response") {
      stats.aiInvalidResponse += 1;
    } else if (reason === "missing_key") {
      stats.aiMissingKey += 1;
    }

    if (assigned) {
      stats.aiAssigned += 1;
    }

    if ((reason === "api_failed" || reason === "invalid_response" || reason === "missing_key") && stats.aiFailureSamples.length < 12) {
      stats.aiFailureSamples.push({
        target,
        reason,
        details
      });
    }
  }

  private bumpAiStatsBulk(
    stats: OrganizeStats,
    targets: string[],
    reason: AiClassifyReason,
    details: AiClassifyDetails | undefined,
    assignedCount: number
  ): void {
    for (const target of targets) {
      this.bumpAiStats(stats, target, reason, details, assignedCount > 0);
    }
    stats.aiAssigned = assignedCount;
  }

  private updateStatusAndLogs(stats: OrganizeStats, durationMs: number, forceAi: boolean): void {
    const failed = stats.aiApiFailed + stats.aiInvalidResponse;
    const icon = failed > 0 || stats.aiMissingKey > 0 ? "$(warning)" : "$(check)";
    if (stats.aiChecked === 0) {
      this.statusItem.text = `$(circle-slash) TabNest: ${stats.tabsSeen}/${stats.tabsTotal} | rule ${stats.ruleMatched} | AI not called | ${durationMs}ms`;
    } else if (stats.aiMissingKey > 0) {
      this.statusItem.text =
        `${icon} TabNest: ${stats.tabsSeen}/${stats.tabsTotal} | rule ${stats.ruleMatched} | ` +
        `AI checked ${stats.aiChecked}, missing key ${stats.aiMissingKey}, assigned ${stats.aiAssigned} | ${durationMs}ms`;
    } else {
      this.statusItem.text =
        `${icon} TabNest: ${stats.tabsSeen}/${stats.tabsTotal} | rule ${stats.ruleMatched} | ` +
        `AI checked ${stats.aiChecked}, api ${stats.aiApiSuccess}, cache ${stats.aiCacheHits}, fail ${failed}, assigned ${stats.aiAssigned} | ${durationMs}ms`;
    }
    this.statusItem.tooltip =
      `Tabs: ${stats.tabsSeen}\n` +
      `Rule matched: ${stats.ruleMatched}\n` +
      `AI checked: ${stats.aiChecked}\n` +
      `AI assigned: ${stats.aiAssigned}\n` +
      `AI API success: ${stats.aiApiSuccess}\n` +
      `AI cache hit: ${stats.aiCacheHits}\n` +
      `AI failed: ${stats.aiApiFailed}\n` +
      `AI invalid: ${stats.aiInvalidResponse}\n` +
      `AI missing key: ${stats.aiMissingKey}\n` +
      `Force AI: ${forceAi}\n` +
      `Duration: ${durationMs}ms`;

    this.output.appendLine(
      [
        `[${new Date().toISOString()}] organize done`,
        `tabs=${stats.tabsSeen}`,
        `rule=${stats.ruleMatched}`,
        `ai_checked=${stats.aiChecked}`,
        `ai_assigned=${stats.aiAssigned}`,
        `ai_api_ok=${stats.aiApiSuccess}`,
        `ai_cache=${stats.aiCacheHits}`,
        `ai_fail=${stats.aiApiFailed}`,
        `ai_invalid=${stats.aiInvalidResponse}`,
        `ai_missing_key=${stats.aiMissingKey}`,
        `reason_counts=${formatReasonCounts(stats.aiReasonCounts)}`,
        `force_ai=${forceAi}`,
        `duration_ms=${durationMs}`
      ].join(" ")
    );
    this.appendDetailedFailureLogs(stats);

    this.maybeShowAiTroubleshooting(stats, forceAi);
  }

  private maybeShowAiTroubleshooting(stats: OrganizeStats, forceAi: boolean): void {
    if (stats.aiMissingKey > 0) {
      void vscode.window
        .showWarningMessage(
          "TabNest AI did not run because `tabNest.aiApiKey` is missing. Add your key, then retry AI Auto Organize.",
          "Open AI Settings",
          "Show TabNest Logs"
        )
        .then((choice) => {
          if (choice === "Open AI Settings") {
            void vscode.commands.executeCommand("workbench.action.openSettings", "tabNest.aiApiKey");
          } else if (choice === "Show TabNest Logs") {
            this.output.show(true);
          }
        });
      return;
    }

    const failed = stats.aiApiFailed + stats.aiInvalidResponse;
    if (failed <= 0) {
      this.hasShownAiFailureHelp = false;
      return;
    }

    if (!forceAi && this.hasShownAiFailureHelp) {
      return;
    }
    this.hasShownAiFailureHelp = true;

    const message =
      "TabNest AI request failed. Check `tabNest.aiApiKey`, `tabNest.aiBaseUrl`, `tabNest.aiModel`, and network access, then retry.";
    void vscode.window
      .showWarningMessage(message, "Open AI Settings", "Show TabNest Logs")
      .then((choice) => {
        if (choice === "Open AI Settings") {
          void vscode.commands.executeCommand("workbench.action.openSettings", "tabNest.ai");
        } else if (choice === "Show TabNest Logs") {
          this.output.show(true);
        }
      });
  }

  private appendDetailedFailureLogs(stats: OrganizeStats): void {
    if (stats.aiFailureSamples.length === 0) {
      return;
    }

    this.output.appendLine("ai_failure_samples:");
    for (const sample of stats.aiFailureSamples) {
      const detailParts: string[] = [];
      if (sample.details?.statusCode !== undefined) {
        detailParts.push(`status=${sample.details.statusCode}`);
      }
      if (sample.details?.errorMessage) {
        detailParts.push(`error=${sample.details.errorMessage}`);
      }
      if (sample.details?.responseSnippet) {
        detailParts.push(`response=${sample.details.responseSnippet}`);
      }
      if (sample.details?.responseBody) {
        detailParts.push(`response_body=${sample.details.responseBody}`);
      }
      if (sample.details?.model) {
        detailParts.push(`model=${sample.details.model}`);
      }
      if (sample.details?.baseUrl) {
        detailParts.push(`base=${sample.details.baseUrl}`);
      }
      if (sample.details?.requestMode) {
        detailParts.push(`mode=${sample.details.requestMode}`);
      }
      if (sample.details?.errorName) {
        detailParts.push(`error_name=${sample.details.errorName}`);
      }
      if (sample.details?.errorStack) {
        detailParts.push(`error_stack=${sample.details.errorStack}`);
      }
      if (sample.details?.rawError) {
        detailParts.push(`raw_error=${sample.details.rawError}`);
      }
      const detailsText = detailParts.length > 0 ? ` | ${detailParts.join(" | ")}` : "";
      this.output.appendLine(`  - reason=${sample.reason} | target=${sample.target}${detailsText}`);
      if (sample.details) {
        this.output.appendLine(`    details_json=${JSON.stringify(sample.details)}`);
      }
    }
  }

  private collectOpenTabs(): Array<{ id: string; uri: vscode.Uri; target: string; label: string }> {
    const results: Array<{ id: string; uri: vscode.Uri; target: string; label: string }> = [];
    let index = 0;
    for (const tabGroup of vscode.window.tabGroups.all) {
      for (const tab of tabGroup.tabs) {
        const uri = getTabUri(tab.input);
        if (!uri) {
          continue;
        }
        index += 1;
        results.push({
          id: `f${index}`,
          uri,
          target: getMatchTarget(uri),
          label: tab.label || uri.path.split("/").pop() || uri.toString()
        });
      }
    }
    return results;
  }

  private async readFileSnippet(uri: vscode.Uri, maxChars: number): Promise<string | undefined> {
    if (uri.scheme !== "file") {
      return undefined;
    }

    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      if (bytes.length === 0) {
        return undefined;
      }
      const decoder = new TextDecoder("utf-8", { fatal: false });
      const text = decoder.decode(bytes.slice(0, Math.min(bytes.length, maxChars * 3)));
      if (!text || text.includes("\u0000")) {
        return undefined;
      }
      return text.replaceAll(/\s+/g, " ").trim().slice(0, maxChars);
    } catch {
      return undefined;
    }
  }
}

function presetGroupName(index: number): string | undefined {
  if (index === 2) {
    return "Tests";
  }
  if (index === 3) {
    return "Docs";
  }
  if (index === 4) {
    return "Temp";
  }
  return undefined;
}

function groupIndexByCategory(category: "project" | "tests" | "docs" | "temp" | undefined): number | undefined {
  if (!category) {
    return undefined;
  }
  if (category === "tests") {
    return 2;
  }
  if (category === "docs") {
    return 3;
  }
  if (category === "temp") {
    return 4;
  }
  return 1;
}

function renderRunningStatus(stats: OrganizeStats): string {
  const total = stats.tabsTotal || "?";
  return (
    `$(sync~spin) TabNest: ${stats.tabsSeen}/${total} | ` +
    `rule ${stats.ruleMatched} | AI checked ${stats.aiChecked}, api ${stats.aiApiSuccess}, ` +
    `cache ${stats.aiCacheHits}, fail ${stats.aiApiFailed + stats.aiInvalidResponse}`
  );
}

function formatReasonCounts(reasonCounts: Record<AiClassifyReason, number>): string {
  return Object.entries(reasonCounts)
    .map(([reason, count]) => `${reason}:${count}`)
    .join(",");
}
