import { getAiSystemPrompt, getAiUserPromptTemplate } from "../../config/settings";
import { AiMessage, AiWorkflowFile } from "./types";

export function buildClassifierMessages(target: string): AiMessage[] {
  return [
    {
      role: "system",
      content: getAiSystemPrompt()
    },
    {
      role: "user",
      content: "Path: src/__tests__/router.test.ts"
    },
    {
      role: "assistant",
      content: "tests"
    },
    {
      role: "user",
      content: "Path: docs/adr/0001-architecture.md"
    },
    {
      role: "assistant",
      content: "docs"
    },
    {
      role: "user",
      content: "Path: scratch/tmp-notes.log"
    },
    {
      role: "assistant",
      content: "temp"
    },
    {
      role: "user",
      content: buildUserPrompt(target)
    }
  ];
}

export function buildWorkflowMessages(files: AiWorkflowFile[], maxGroups: number): AiMessage[] {
  return [
    {
      role: "system",
      content: WORKFLOW_SYSTEM_PROMPT
    },
    {
      role: "user",
      content: buildWorkflowUserPrompt(files, maxGroups)
    }
  ];
}

const WORKFLOW_SYSTEM_PROMPT = [
  "You are a file organizer.",
  "Create meaningful groups and assign every file to exactly one group.",
  "Return JSON only with this schema:",
  '{"groups":[{"name":"Group Name","file_ids":["f1","f2"]}]}',
  "Rules:",
  "- Group names must be short (2-24 chars), clear, and non-empty.",
  "- Include each file id exactly once across all groups.",
  "- Do not invent file ids."
].join("\n");

function buildWorkflowUserPrompt(files: AiWorkflowFile[], maxGroups: number): string {
  const lines: string[] = [];
  lines.push(`Maximum groups: ${maxGroups}`);
  lines.push("Files:");
  for (const file of files) {
    lines.push(`- id: ${file.id}`);
    lines.push(`  path: ${file.target}`);
    lines.push(`  name: ${file.label}`);
    if (file.contentSnippet) {
      lines.push(`  content_preview: ${file.contentSnippet}`);
    }
  }
  return lines.join("\n");
}

function buildUserPrompt(target: string): string {
  const template = getAiUserPromptTemplate();
  if (!template || !template.trim()) {
    return `Path: ${target}`;
  }
  return template.replaceAll("{{path}}", target);
}
