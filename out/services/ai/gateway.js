"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiGateway = void 0;
const openai_1 = __importDefault(require("openai"));
const settings_1 = require("../../config/settings");
const parsers_1 = require("./parsers");
class AiGateway {
    clients = new Map();
    async generateText(apiKey, messages, maxOutputTokens) {
        const baseUrl = normalizeBaseUrl((0, settings_1.getAiBaseUrl)());
        const model = (0, settings_1.getAiModel)();
        const timeoutMs = (0, settings_1.getAiTimeoutMs)();
        const client = this.getClient(apiKey, baseUrl);
        try {
            const response = (await client.responses.create({
                model,
                temperature: 0,
                max_output_tokens: maxOutputTokens,
                input: messages
            }, { timeout: timeoutMs }));
            return { ok: true, text: (0, parsers_1.extractText)(response), model, baseUrl, requestMode: "responses" };
        }
        catch (error) {
            if (error instanceof openai_1.default.APIError && shouldFallbackToChatCompletions(error.status)) {
                const fallback = await this.generateViaChatCompletions(client, messages, model, timeoutMs, baseUrl, maxOutputTokens);
                if (fallback) {
                    return fallback;
                }
            }
            if (error instanceof openai_1.default.APIError) {
                return {
                    ok: false,
                    details: {
                        statusCode: error.status,
                        errorMessage: error.message,
                        responseSnippet: stringifyUnknown(error.error),
                        responseBody: stringifyUnknown(error.error),
                        model,
                        baseUrl,
                        requestMode: "responses",
                        errorName: error.name,
                        errorStack: error.stack,
                        rawError: stringifyUnknown(error)
                    }
                };
            }
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                ok: false,
                details: {
                    errorMessage,
                    model,
                    baseUrl,
                    requestMode: "responses",
                    errorName: error instanceof Error ? error.name : undefined,
                    errorStack: error instanceof Error ? error.stack : undefined,
                    rawError: stringifyUnknown(error)
                }
            };
        }
    }
    async generateViaChatCompletions(client, messages, model, timeoutMs, baseUrl, maxOutputTokens) {
        try {
            const completion = await client.chat.completions.create({
                model,
                temperature: 0,
                max_tokens: maxOutputTokens,
                messages,
                stream: false
            }, { timeout: timeoutMs });
            const raw = completion.choices?.[0]?.message?.content;
            const text = typeof raw === "string" ? raw.trim() : "";
            return { ok: true, text, model, baseUrl, requestMode: "chat.completions" };
        }
        catch (error) {
            return {
                ok: false,
                details: {
                    errorMessage: error instanceof Error ? error.message : String(error),
                    model,
                    baseUrl,
                    requestMode: "chat.completions",
                    errorName: error instanceof Error ? error.name : undefined,
                    errorStack: error instanceof Error ? error.stack : undefined,
                    rawError: stringifyUnknown(error)
                }
            };
        }
    }
    getClient(apiKey, baseUrl) {
        const cacheKey = `${baseUrl}::${apiKey}`;
        const cached = this.clients.get(cacheKey);
        if (cached) {
            return cached;
        }
        const client = new openai_1.default({
            apiKey,
            baseURL: baseUrl
        });
        this.clients.set(cacheKey, client);
        return client;
    }
}
exports.AiGateway = AiGateway;
function normalizeBaseUrl(baseUrl) {
    const value = baseUrl.trim();
    if (!value) {
        return "https://api.openai.com/v1";
    }
    return value.endsWith("/") ? value.slice(0, -1) : value;
}
function shouldFallbackToChatCompletions(statusCode) {
    return statusCode === 400 || statusCode === 401 || statusCode === 403 || statusCode === 404 || statusCode === 405;
}
function stringifyUnknown(value) {
    try {
        return JSON.stringify(value, (_key, innerValue) => {
            if (innerValue instanceof Error) {
                return {
                    name: innerValue.name,
                    message: innerValue.message,
                    stack: innerValue.stack
                };
            }
            return innerValue;
        }, 2);
    }
    catch {
        return String(value);
    }
}
//# sourceMappingURL=gateway.js.map