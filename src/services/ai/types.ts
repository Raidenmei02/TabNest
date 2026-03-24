export type AiCategory = "project" | "tests" | "docs" | "temp";

export type ClassifyOptions = {
  forceAi?: boolean;
};

export type AiClassifyReason = "disabled" | "missing_key" | "cache_hit" | "api_success" | "api_failed" | "invalid_response";

export type AiClassifyDetails = {
  statusCode?: number;
  errorMessage?: string;
  responseSnippet?: string;
  responseBody?: string;
  model?: string;
  baseUrl?: string;
  requestMode?: "responses" | "chat.completions";
  errorName?: string;
  errorStack?: string;
  rawError?: string;
};

export type AiClassifyResult = {
  category?: AiCategory;
  reason: AiClassifyReason;
  details?: AiClassifyDetails;
};

export type AiWorkflowFile = {
  id: string;
  target: string;
  label: string;
  contentSnippet?: string;
};

export type AiWorkflowGroup = {
  name: string;
  fileIds: string[];
};

export type AiWorkflowResult = {
  groups?: AiWorkflowGroup[];
  reason: AiClassifyReason;
  details?: AiClassifyDetails;
};

export type AiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};
