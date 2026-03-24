"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildClassifierMessages = buildClassifierMessages;
exports.buildWorkflowMessages = buildWorkflowMessages;
const settings_1 = require("../../config/settings");
function buildClassifierMessages(target) {
    return [
        {
            role: "system",
            content: (0, settings_1.getAiSystemPrompt)()
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
function buildWorkflowMessages(files, maxGroups) {
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
function buildWorkflowUserPrompt(files, maxGroups) {
    const lines = [];
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
function buildUserPrompt(target) {
    const template = (0, settings_1.getAiUserPromptTemplate)();
    if (!template || !template.trim()) {
        return `Path: ${target}`;
    }
    return template.replaceAll("{{path}}", target);
}
//# sourceMappingURL=prompts.js.map