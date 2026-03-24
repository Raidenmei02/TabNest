"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSettings = getSettings;
exports.getAutoOrganize = getAutoOrganize;
exports.getStrategy = getStrategy;
exports.getCustomRules = getCustomRules;
exports.getDebounceMs = getDebounceMs;
exports.getAiEnabled = getAiEnabled;
exports.getAiApiKey = getAiApiKey;
exports.getAiModel = getAiModel;
exports.getAiBaseUrl = getAiBaseUrl;
exports.getAiAuthMode = getAiAuthMode;
exports.getAiTimeoutMs = getAiTimeoutMs;
exports.getAiSystemPrompt = getAiSystemPrompt;
exports.getAiUserPromptTemplate = getAiUserPromptTemplate;
exports.getAiAllowFileContent = getAiAllowFileContent;
exports.getAiContentPreviewChars = getAiContentPreviewChars;
exports.getAiMaxGroups = getAiMaxGroups;
exports.getConfirmDeleteGroup = getConfirmDeleteGroup;
exports.setConfirmDeleteGroup = setConfirmDeleteGroup;
const vscode = __importStar(require("vscode"));
const constants_1 = require("../constants");
const LEGACY_EXTENSION_SECTION = "atlasOrganizer";
function getSettings() {
    return vscode.workspace.getConfiguration(constants_1.EXTENSION_SECTION);
}
function getAutoOrganize() {
    return getSettingValue("autoOrganize", false);
}
function getStrategy() {
    return getSettingValue("strategy", "preset");
}
function getCustomRules() {
    return getSettingValue("rules", []);
}
function getDebounceMs() {
    const value = getSettingValue("debounceMs", 800);
    return Number.isFinite(value) ? Math.max(200, value) : 800;
}
function getAiEnabled() {
    return getSettingValue("aiEnabled", false);
}
function getAiApiKey() {
    return getSettingValue("aiApiKey", "");
}
function getAiModel() {
    return getSettingValue("aiModel", "gpt-4.1-mini");
}
function getAiBaseUrl() {
    return getSettingValue("aiBaseUrl", "https://api.openai.com/v1");
}
function getAiAuthMode() {
    const value = getSettingValue("aiAuthMode", "bearer");
    if (value === "api-key" || value === "x-api-key") {
        return value;
    }
    return "bearer";
}
function getAiTimeoutMs() {
    const value = getSettingValue("aiTimeoutMs", 8000);
    return Number.isFinite(value) ? Math.max(1000, value) : 8000;
}
function getAiSystemPrompt() {
    return getSettingValue("aiSystemPrompt", "You classify file paths into one category: project, tests, docs, temp. Reply with only one category token.");
}
function getAiUserPromptTemplate() {
    return getSettingValue("aiUserPromptTemplate", [
        "Classify this file path.",
        "Path: {{path}}",
        "Output one token only: project | tests | docs | temp"
    ].join("\n"));
}
function getAiAllowFileContent() {
    return getSettingValue("aiAllowFileContent", false);
}
function getAiContentPreviewChars() {
    const value = getSettingValue("aiContentPreviewChars", 500);
    return Number.isFinite(value) ? Math.max(100, Math.min(4000, value)) : 500;
}
function getAiMaxGroups() {
    const value = getSettingValue("aiMaxGroups", 6);
    return Number.isFinite(value) ? Math.max(2, Math.min(12, value)) : 6;
}
function getConfirmDeleteGroup() {
    return getSettingValue("confirmDeleteGroup", true);
}
async function setConfirmDeleteGroup(value) {
    await getSettings().update("confirmDeleteGroup", value, vscode.ConfigurationTarget.Global);
}
function getSettingValue(key, fallback) {
    const primary = getSettings().get(key);
    if (primary !== undefined) {
        return primary;
    }
    return vscode.workspace.getConfiguration(LEGACY_EXTENSION_SECTION).get(key, fallback);
}
//# sourceMappingURL=settings.js.map