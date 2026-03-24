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
exports.AiClassifierService = void 0;
const vscode = __importStar(require("vscode"));
const settings_1 = require("../config/settings");
const gateway_1 = require("./ai/gateway");
const parsers_1 = require("./ai/parsers");
const prompts_1 = require("./ai/prompts");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
class AiClassifierService {
    cache = new Map();
    gateway = new gateway_1.AiGateway();
    hasShownMissingKeyWarning = false;
    isEnabled() {
        return (0, settings_1.getAiEnabled)();
    }
    async classify(target, options) {
        const check = this.checkAiAvailable(options);
        if (!check.apiKey) {
            return check;
        }
        const now = Date.now();
        const cached = this.cache.get(target);
        if (cached && cached.expiresAt > now) {
            return { category: cached.category, reason: "cache_hit" };
        }
        const response = await this.gateway.generateText(check.apiKey, (0, prompts_1.buildClassifierMessages)(target), 32);
        if (!response.ok) {
            return { reason: "api_failed", details: response.details };
        }
        const category = (0, parsers_1.normalizeCategory)(response.text);
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
    async planGroups(files, maxGroups, options) {
        const check = this.checkAiAvailable(options);
        if (!check.apiKey) {
            return check;
        }
        if (files.length === 0) {
            return { reason: "api_success", groups: [] };
        }
        const response = await this.gateway.generateText(check.apiKey, (0, prompts_1.buildWorkflowMessages)(files, maxGroups), Math.min(4096, Math.max(1200, files.length * 80)));
        if (!response.ok) {
            return { reason: "api_failed", details: response.details };
        }
        const groups = (0, parsers_1.parseWorkflowPlan)(response.text, files, maxGroups);
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
    checkAiAvailable(options) {
        if (!options?.forceAi && !this.isEnabled()) {
            return { reason: "disabled" };
        }
        const key = (0, settings_1.getAiApiKey)().trim();
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
exports.AiClassifierService = AiClassifierService;
//# sourceMappingURL=ai-classifier-service.js.map