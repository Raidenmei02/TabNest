import OpenAI from "openai";
import { getAiBaseUrl, getAiModel, getAiTimeoutMs } from "../../config/settings";
import { extractText, ResponsePayload } from "./parsers";
import { AiClassifyDetails, AiMessage } from "./types";

type GatewayResult =
  | {
      ok: true;
      text: string;
      model: string;
      baseUrl: string;
      requestMode: "responses" | "chat.completions";
    }
  | {
      ok: false;
      details: AiClassifyDetails;
    };

export class AiGateway {
  private readonly clients = new Map<string, OpenAI>();

  async generateText(apiKey: string, messages: AiMessage[], maxOutputTokens: number): Promise<GatewayResult> {
    const baseUrl = normalizeBaseUrl(getAiBaseUrl());
    const model = getAiModel();
    const timeoutMs = getAiTimeoutMs();
    const client = this.getClient(apiKey, baseUrl);

    try {
      const response = (await client.responses.create(
        {
          model,
          temperature: 0,
          max_output_tokens: maxOutputTokens,
          input: messages
        },
        { timeout: timeoutMs }
      )) as ResponsePayload;
      return { ok: true, text: extractText(response), model, baseUrl, requestMode: "responses" };
    } catch (error) {
      if (error instanceof OpenAI.APIError && shouldFallbackToChatCompletions(error.status)) {
        const fallback = await this.generateViaChatCompletions(client, messages, model, timeoutMs, baseUrl, maxOutputTokens);
        if (fallback) {
          return fallback;
        }
      }

      if (error instanceof OpenAI.APIError) {
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

  private async generateViaChatCompletions(
    client: OpenAI,
    messages: AiMessage[],
    model: string,
    timeoutMs: number,
    baseUrl: string,
    maxOutputTokens: number
  ): Promise<GatewayResult | undefined> {
    try {
      const completion = await client.chat.completions.create(
        {
          model,
          temperature: 0,
          max_tokens: maxOutputTokens,
          messages,
          stream: false
        },
        { timeout: timeoutMs }
      );

      const raw = completion.choices?.[0]?.message?.content;
      const text = typeof raw === "string" ? raw.trim() : "";
      return { ok: true, text, model, baseUrl, requestMode: "chat.completions" };
    } catch (error) {
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

  private getClient(apiKey: string, baseUrl: string): OpenAI {
    const cacheKey = `${baseUrl}::${apiKey}`;
    const cached = this.clients.get(cacheKey);
    if (cached) {
      return cached;
    }

    const client = new OpenAI({
      apiKey,
      baseURL: baseUrl
    });
    this.clients.set(cacheKey, client);
    return client;
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  const value = baseUrl.trim();
  if (!value) {
    return "https://api.openai.com/v1";
  }
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function shouldFallbackToChatCompletions(statusCode: number | undefined): boolean {
  return statusCode === 400 || statusCode === 401 || statusCode === 403 || statusCode === 404 || statusCode === 405;
}

function stringifyUnknown(value: unknown): string {
  try {
    return JSON.stringify(
      value,
      (_key, innerValue) => {
        if (innerValue instanceof Error) {
          return {
            name: innerValue.name,
            message: innerValue.message,
            stack: innerValue.stack
          };
        }
        return innerValue;
      },
      2
    );
  } catch {
    return String(value);
  }
}
