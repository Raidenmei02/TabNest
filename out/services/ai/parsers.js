"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractText = extractText;
exports.normalizeCategory = normalizeCategory;
exports.parseWorkflowPlan = parseWorkflowPlan;
exports.truncate = truncate;
function extractText(payload) {
    if (typeof payload.output_text === "string") {
        return payload.output_text.trim();
    }
    const parts = [];
    for (const outputItem of payload.output ?? []) {
        for (const content of outputItem.content ?? []) {
            if (typeof content.text === "string" && content.text.trim()) {
                parts.push(content.text.trim());
            }
        }
    }
    return parts.join(" ").trim();
}
function normalizeCategory(raw) {
    const value = raw.toLowerCase().trim();
    if (value.includes("test")) {
        return "tests";
    }
    if (value.includes("doc")) {
        return "docs";
    }
    if (value.includes("temp") || value.includes("tmp") || value.includes("scratch")) {
        return "temp";
    }
    if (value.includes("project") || value.includes("code") || value.includes("source")) {
        return "project";
    }
    if (value === "tests" || value === "docs" || value === "temp" || value === "project") {
        return value;
    }
    return undefined;
}
function parseWorkflowPlan(raw, files, maxGroups) {
    const jsonText = extractFirstJsonObject(raw);
    if (!jsonText) {
        return undefined;
    }
    let payload;
    try {
        payload = JSON.parse(jsonText);
    }
    catch {
        return undefined;
    }
    if (!payload || typeof payload !== "object" || !("groups" in payload)) {
        return undefined;
    }
    const rawGroups = payload.groups;
    if (!Array.isArray(rawGroups) || rawGroups.length === 0) {
        return undefined;
    }
    const idSet = new Set(files.map((item) => item.id));
    const assigned = new Set();
    const groups = [];
    const usedNames = new Set();
    for (const item of rawGroups) {
        if (!item || typeof item !== "object") {
            continue;
        }
        const rawName = String(item.name ?? "").trim();
        const fileIds = item.file_ids;
        if (!rawName || !Array.isArray(fileIds)) {
            continue;
        }
        const normalizedName = normalizeGroupName(rawName, usedNames);
        const uniqueIds = [];
        for (const id of fileIds) {
            const value = String(id);
            if (!idSet.has(value) || assigned.has(value)) {
                continue;
            }
            assigned.add(value);
            uniqueIds.push(value);
        }
        if (uniqueIds.length > 0) {
            groups.push({ name: normalizedName, fileIds: uniqueIds });
            usedNames.add(normalizedName.toLowerCase());
        }
        if (groups.length >= maxGroups) {
            break;
        }
    }
    const missing = files.filter((file) => !assigned.has(file.id)).map((file) => file.id);
    if (missing.length > 0) {
        const fallbackName = normalizeGroupName("Other", usedNames);
        let fallback = groups.find((group) => group.name.toLowerCase() === fallbackName.toLowerCase());
        if (!fallback) {
            fallback = { name: fallbackName, fileIds: [] };
            groups.push(fallback);
        }
        fallback.fileIds.push(...missing);
    }
    return groups.length > 0 ? groups.slice(0, maxGroups) : undefined;
}
function truncate(value, maxLength) {
    if (!value) {
        return "";
    }
    return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}
function extractFirstJsonObject(raw) {
    if (!raw) {
        return undefined;
    }
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) {
        return undefined;
    }
    return raw.slice(start, end + 1);
}
function normalizeGroupName(name, usedNames) {
    const base = name
        .replaceAll(/\s+/g, " ")
        .replaceAll(/[^\p{L}\p{N}\s\-_/]/gu, "")
        .trim()
        .slice(0, 24);
    const safeBase = base || "Other";
    let candidate = safeBase;
    let i = 2;
    while (usedNames.has(candidate.toLowerCase())) {
        candidate = `${safeBase.slice(0, Math.max(1, 22 - String(i).length))} ${i}`;
        i += 1;
    }
    return candidate;
}
//# sourceMappingURL=parsers.js.map